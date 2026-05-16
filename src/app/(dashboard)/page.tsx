import { redirect } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { Bot } from '@/types'

export default async function DashboardPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  const [{ data: bots }, { data: profile }] = await Promise.all([
    supabase
      .from('bots')
      .select('*')
      .order('created_at', { ascending: false }),
    supabase
      .from('profiles')
      .select('*')
      .eq('id', user.id)
      .single(),
  ])

  const totalMessages = profile?.message_count ?? 0
  const activeBots = bots?.filter(b => b.status === 'live').length ?? 0

  return (
    <div className="p-8 max-w-5xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-[28px] font-medium text-gray-900">Dashboard</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            {profile?.full_name ? `Welcome back, ${profile.full_name.split(' ')[0]}` : 'Welcome back'}
          </p>
        </div>
        <Link
          href="/bots/new"
          className="h-9 px-4 rounded-[10px] bg-[#007AFF] text-white text-sm font-medium hover:bg-[#0066DD] active:scale-[0.98] transition-all inline-flex items-center gap-2"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
            <path d="M12 5v14M5 12h14" stroke="white" strokeWidth="2" strokeLinecap="round"/>
          </svg>
          New chatbot
        </Link>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4 mb-8">
        {[
          { label: 'Total bots', value: bots?.length ?? 0 },
          { label: 'Active bots', value: activeBots },
          { label: 'Messages handled', value: totalMessages.toLocaleString() },
        ].map(stat => (
          <div key={stat.label} className="bg-white rounded-xl border border-black/[0.06] shadow-sm p-5">
            <p className="text-xs text-gray-500 mb-1">{stat.label}</p>
            <p className="text-[28px] font-medium text-gray-900 leading-none">{stat.value}</p>
          </div>
        ))}
      </div>

      {/* Bots list */}
      <div>
        <h2 className="text-[15px] font-medium text-gray-900 mb-3">Your chatbots</h2>

        {!bots || bots.length === 0 ? (
          <EmptyState />
        ) : (
          <div className="space-y-2">
            {bots.map(bot => (
              <BotCard key={bot.id} bot={bot} />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

function BotCard({ bot }: { bot: Bot }) {
  const statusConfig = {
    live:     { label: 'Live',     color: 'bg-green-50 text-green-700' },
    training: { label: 'Training', color: 'bg-amber-50 text-amber-700' },
    paused:   { label: 'Paused',   color: 'bg-gray-100 text-gray-500'  },
  }
  const { label, color } = statusConfig[bot.status] ?? statusConfig.paused

  return (
    <Link
      href={`/bots/${bot.id}`}
      className="flex items-center gap-4 bg-white rounded-xl border border-black/[0.06] shadow-sm p-4 hover:scale-[1.01] transition-transform"
    >
      <div className="w-9 h-9 rounded-xl bg-[#007AFF]/10 flex items-center justify-center flex-shrink-0">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
          <path d="M12 2a4 4 0 014 4v1h1a2 2 0 012 2v9a2 2 0 01-2 2H7a2 2 0 01-2-2V9a2 2 0 012-2h1V6a4 4 0 014-4z" stroke="#007AFF" strokeWidth="1.5"/>
        </svg>
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-[15px] font-medium text-gray-900 truncate">{bot.name}</p>
        {bot.description && (
          <p className="text-sm text-gray-400 truncate">{bot.description}</p>
        )}
      </div>
      <span className={`text-xs font-medium px-2.5 py-1 rounded-full ${color}`}>
        {label}
      </span>
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" className="text-gray-300">
        <path d="M9 18l6-6-6-6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
      </svg>
    </Link>
  )
}

function EmptyState() {
  return (
    <div className="bg-white rounded-xl border border-black/[0.06] border-dashed p-12 text-center">
      <div className="w-12 h-12 rounded-2xl bg-[#007AFF]/10 flex items-center justify-center mx-auto mb-4">
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
          <path d="M12 2a4 4 0 014 4v1h1a2 2 0 012 2v9a2 2 0 01-2 2H7a2 2 0 01-2-2V9a2 2 0 012-2h1V6a4 4 0 014-4z" stroke="#007AFF" strokeWidth="1.5"/>
        </svg>
      </div>
      <h3 className="text-[15px] font-medium text-gray-900 mb-1">No chatbots yet</h3>
      <p className="text-sm text-gray-400 mb-5">Upload your documents and launch your first AI chatbot.</p>
      <Link
        href="/bots/new"
        className="inline-flex items-center gap-2 h-9 px-4 rounded-[10px] bg-[#007AFF] text-white text-sm font-medium hover:bg-[#0066DD] transition-colors"
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
          <path d="M12 5v14M5 12h14" stroke="white" strokeWidth="2" strokeLinecap="round"/>
        </svg>
        Create your first bot
      </Link>
    </div>
  )
}
