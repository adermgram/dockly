import { createClient } from '@supabase/supabase-js'

function getClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

export interface RetrievedChunk {
  id: string
  content: string
  similarity: number
}

export async function retrieveChunks(
  queryEmbedding: number[],
  botId: string,
  matchCount = 5
): Promise<RetrievedChunk[]> {
  const { data, error } = await getClient().rpc('match_chunks', {
    query_embedding: queryEmbedding,
    bot_id_filter: botId,
    match_count: matchCount,
    min_similarity: 0.2,
  })

  if (error) throw error
  return data ?? []
}
