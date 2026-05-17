import { inngest } from '../client'
import { createClient } from '@supabase/supabase-js'
import { parsePdf } from '@/lib/parsers/pdf'
import { parseDocx } from '@/lib/parsers/docx'
import { parseTxt } from '@/lib/parsers/txt'
import { splitText } from '@/lib/rag/chunk'
import { embedTexts } from '@/lib/rag/embed'

function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

export const ingestDocument = inngest.createFunction(
  {
    id: 'ingest-document',
    retries: 2,
    triggers: [{ event: 'doc/ingest' }],
  },
  async ({ event, step }) => {
    const { botId, documentId } = event.data as { botId: string; documentId: string }

    // 1. Fetch document record
    const doc = await step.run('fetch-document', async () => {
      const { data, error } = await getSupabase()
        .from('documents')
        .select('*')
        .eq('id', documentId)
        .single()
      if (error) throw new Error(`Document not found: ${error.message}`)
      if (!data) throw new Error(`Document ${documentId} does not exist`)
      return data
    })

    // 2. Download and parse (Buffer can't cross step boundaries — do both in one step)
    const rawText = await step.run('download-and-parse', async () => {
      const response = await fetch(doc.file_url)
      if (!response.ok) throw new Error(`Download failed: ${response.statusText}`)
      const buffer = Buffer.from(await response.arrayBuffer())

      switch (doc.file_type) {
        case 'pdf':  return parsePdf(buffer)
        case 'docx': return parseDocx(buffer)
        case 'txt':  return parseTxt(buffer)
        default: throw new Error(`Unsupported type: ${doc.file_type}`)
      }
    })

    if (!rawText.trim()) {
      await getSupabase().from('documents').update({ status: 'failed' }).eq('id', documentId)
      return { status: 'failed', reason: 'empty document' }
    }

    // 3. Chunk
    const chunks = await step.run('split-text', async () => splitText(rawText))

    // 4. Embed + store in batches — return count from each step so we can sum them
    const BATCH_SIZE = 50
    const batchCounts: number[] = []

    for (let i = 0; i < chunks.length; i += BATCH_SIZE) {
      const batch = chunks.slice(i, i + BATCH_SIZE)

      // step.run returns the count so we can accumulate it outside the callback
      const count = await step.run(`embed-batch-${i}`, async () => {
        const embeddings = await embedTexts(batch)
        const rows = batch.map((content, j) => ({
          bot_id: botId,
          document_id: documentId,
          content,
          embedding: embeddings[j],
        }))
        const { error } = await getSupabase().from('chunks').insert(rows)
        if (error) throw new Error(`Chunk insert failed: ${error.message}`)
        return rows.length
      })

      batchCounts.push(count)
    }

    const totalInserted = batchCounts.reduce((sum, n) => sum + n, 0)

    // 5. Mark indexed and flip bot live if all docs are done
    await step.run('mark-indexed', async () => {
      const db = getSupabase()

      await db
        .from('documents')
        .update({ status: 'indexed', chunk_count: totalInserted })
        .eq('id', documentId)

      const { data: pendingDocs } = await db
        .from('documents')
        .select('id')
        .eq('bot_id', botId)
        .neq('status', 'indexed')

      if (!pendingDocs || pendingDocs.length === 0) {
        await db.from('bots').update({ status: 'live' }).eq('id', botId)
      }
    })

    return { status: 'success', chunks: totalInserted }
  }
)
