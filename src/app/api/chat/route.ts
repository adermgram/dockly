export const dynamic = 'force-dynamic'

import { NextRequest } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { Ratelimit } from '@upstash/ratelimit'
import { Redis } from '@upstash/redis'
import { embedQuery } from '@/lib/rag/embed'
import { retrieveChunks } from '@/lib/rag/retrieve'
import { buildPrompt, streamChat } from '@/lib/rag/chat'

function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

function getRatelimit() {
  return new Ratelimit({
    redis: Redis.fromEnv(),
    limiter: Ratelimit.slidingWindow(20, '1 m'),
  })
}

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
}

export async function OPTIONS() {
  return new Response(null, { status: 204, headers: CORS_HEADERS })
}

export async function POST(request: NextRequest) {
  const { botId, sessionId, message } = await request.json()

  if (!botId || !sessionId || !message?.trim()) {
    return new Response('Missing required fields', { status: 400, headers: CORS_HEADERS })
  }

  const supabase = getSupabase()
  const ratelimit = getRatelimit()

  // Rate limit per bot token
  const { success } = await ratelimit.limit(`chat:${botId}`)
  if (!success) {
    return new Response('Too many requests', { status: 429, headers: CORS_HEADERS })
  }

  // Look up by UUID (dashboard preview) or embed_token (widget / share page)
  const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(botId)
  const query = supabase.from('bots').select('id, name, tone, status, user_id')
  const { data: bot } = isUuid
    ? await query.eq('id', botId).single()
    : await query.eq('embed_token', botId).single()

  if (!bot) {
    return new Response('Bot not found', { status: 404, headers: CORS_HEADERS })
  }

  if (bot.status !== 'live') {
    return new Response('Bot is not live yet', { status: 503, headers: CORS_HEADERS })
  }

  // Use the resolved UUID for all downstream operations
  const resolvedBotId = bot.id

  // Save user message
  await supabase.from('chat_logs').insert({
    bot_id: resolvedBotId,
    session_id: sessionId,
    role: 'user',
    content: message,
  })

  // Increment message count on profile
  await supabase.rpc('increment_message_count', { profile_id: bot.user_id })

  // RAG: embed query → retrieve chunks → build prompt → stream from Groq
  // Retry up to 2 times on transient network errors before giving up.
  let stream: ReadableStream | null = null
  let lastError: unknown
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      if (attempt > 0) await new Promise(r => setTimeout(r, 400 * attempt))
      const queryEmbedding = await embedQuery(message)
      const chunks = await retrieveChunks(queryEmbedding, resolvedBotId)
      const systemPrompt = buildPrompt(bot.name, chunks, bot.tone)
      stream = await streamChat(systemPrompt, message)
      break
    } catch (err) {
      lastError = err
    }
  }
  if (!stream) {
    console.error('Chat failed after 3 attempts:', lastError)
    return new Response('I\'m having trouble connecting right now. Please try again in a moment.', { status: 503, headers: CORS_HEADERS })
  }

  // Collect full response in background for logging
  const [streamForClient, streamForLog] = stream.tee()

  ;(async () => {
    const decoder = new TextDecoder()
    const reader = streamForLog.getReader()
    let fullResponse = ''
    try {
      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        fullResponse += decoder.decode(value)
      }
    } catch { /* stream closed early — log what we have */ }
    if (fullResponse) {
      await supabase.from('chat_logs').insert({
        bot_id: resolvedBotId,
        session_id: sessionId,
        role: 'assistant',
        content: fullResponse,
      })
    }
  })()

  return new Response(streamForClient, {
    headers: {
      ...CORS_HEADERS,
      'Content-Type': 'text/plain; charset=utf-8',
      'X-Content-Type-Options': 'nosniff',
    },
  })
}
