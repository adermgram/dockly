export const dynamic = 'force-dynamic'

import { notFound } from 'next/navigation'
import { createClient } from '@supabase/supabase-js'
import ChatInterface from '@/components/chat/ChatInterface'

function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

export default async function PublicChatPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params

  const { data: bot } = await getSupabase()
    .from('bots')
    .select('id, name, description, status')
    .eq('embed_token', token)
    .single()

  if (!bot) notFound()

  return (
    <div className="min-h-screen bg-[#F2F2F7] flex flex-col items-center justify-center px-4 py-8">
      <div className="w-full max-w-xl">
        {/* Bot header */}
        <div className="text-center mb-6">
          <div className="inline-flex items-center justify-center w-12 h-12 rounded-2xl bg-[#007AFF] mb-3">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
              <path d="M12 2a4 4 0 014 4v1h1a2 2 0 012 2v9a2 2 0 01-2 2H7a2 2 0 01-2-2V9a2 2 0 012-2h1V6a4 4 0 014-4z" stroke="white" strokeWidth="1.5"/>
              <circle cx="9" cy="13" r="1" fill="white"/>
              <circle cx="15" cy="13" r="1" fill="white"/>
            </svg>
          </div>
          <h1 className="text-xl font-medium text-gray-900">{bot.name}</h1>
          {bot.description && (
            <p className="text-sm text-gray-500 mt-1">{bot.description}</p>
          )}
          {bot.status !== 'live' && (
            <p className="text-xs text-amber-600 bg-amber-50 px-3 py-1 rounded-full inline-block mt-2">
              This bot is still being set up
            </p>
          )}
        </div>

        <ChatInterface botId={bot.id} botName={bot.name} />

        <p className="text-center text-xs text-gray-400 mt-4">
          Powered by{' '}
          <a href="/" className="text-[#007AFF] hover:underline">Docly</a>
        </p>
      </div>
    </div>
  )
}
