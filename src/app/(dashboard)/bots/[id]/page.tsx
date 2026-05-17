import { notFound, redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import BotDetailClient from '@/components/bots/BotDetailClient'

export default async function BotDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  const { data: bot } = await supabase
    .from('bots')
    .select('*')
    .eq('id', id)
    .eq('user_id', user.id)
    .single()

  if (!bot) notFound()

  const { data: documents } = await supabase
    .from('documents')
    .select('*')
    .eq('bot_id', id)
    .order('created_at', { ascending: false })

  return <BotDetailClient bot={bot} documents={documents ?? []} />
}
