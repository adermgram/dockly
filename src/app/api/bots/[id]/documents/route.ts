export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { inngest } from '@/inngest/client'
import { FREE_PLAN_LIMITS } from '@/types'

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id: botId } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  // Verify bot ownership
  const { data: bot } = await supabase
    .from('bots')
    .select('id')
    .eq('id', botId)
    .eq('user_id', user.id)
    .single()

  if (!bot) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  // Enforce free plan doc limit
  const { count } = await supabase
    .from('documents')
    .select('*', { count: 'exact', head: true })
    .eq('bot_id', botId)

  if ((count ?? 0) >= FREE_PLAN_LIMITS.docs_per_bot) {
    return NextResponse.json(
      { error: `Free plan allows ${FREE_PLAN_LIMITS.docs_per_bot} documents per bot.` },
      { status: 403 }
    )
  }

  const formData = await request.formData()
  const file = formData.get('file') as File

  if (!file) return NextResponse.json({ error: 'No file provided' }, { status: 400 })

  const maxBytes = FREE_PLAN_LIMITS.max_file_size_mb * 1024 * 1024
  if (file.size > maxBytes) {
    return NextResponse.json({ error: 'File exceeds 10MB limit' }, { status: 400 })
  }

  const ext = file.name.split('.').pop()?.toLowerCase()
  if (!['pdf', 'docx', 'txt'].includes(ext ?? '')) {
    return NextResponse.json({ error: 'Unsupported file type' }, { status: 400 })
  }

  // Upload to Supabase Storage
  const path = `${user.id}/${botId}/${Date.now()}-${file.name}`
  const { error: uploadErr } = await supabase.storage
    .from('documents')
    .upload(path, file)

  if (uploadErr) return NextResponse.json({ error: uploadErr.message }, { status: 500 })

  const { data: { publicUrl } } = supabase.storage.from('documents').getPublicUrl(path)

  const { data: doc, error: docErr } = await supabase
    .from('documents')
    .insert({
      bot_id: botId,
      filename: file.name,
      file_url: publicUrl,
      file_type: ext,
      status: 'processing',
    })
    .select()
    .single()

  if (docErr) return NextResponse.json({ error: docErr.message }, { status: 500 })

  await inngest.send({ name: 'doc/ingest', data: { botId, documentId: doc.id } })

  return NextResponse.json(doc, { status: 201 })
}
