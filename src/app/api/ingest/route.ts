export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { inngest } from '@/inngest/client'

export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { botId, documentId } = await request.json()

  if (!botId || !documentId) {
    return NextResponse.json({ error: 'botId and documentId required' }, { status: 400 })
  }

  // Verify the bot belongs to this user
  const { data: bot } = await supabase
    .from('bots')
    .select('id')
    .eq('id', botId)
    .eq('user_id', user.id)
    .single()

  if (!bot) {
    return NextResponse.json({ error: 'Bot not found' }, { status: 404 })
  }

  await inngest.send({
    name: 'doc/ingest',
    data: { botId, documentId },
  })

  return NextResponse.json({ queued: true })
}
