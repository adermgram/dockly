'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Bot, Document } from '@/types'
import { createClient } from '@/lib/supabase/client'
import ChatInterface from '@/components/chat/ChatInterface'

type Tab = 'preview' | 'embed' | 'share' | 'settings'

const STATUS_CONFIG = {
  live:     { label: 'Live',     bg: 'bg-green-50',  text: 'text-green-700', dot: 'bg-green-500', pulse: false },
  training: { label: 'Training', bg: 'bg-amber-50',  text: 'text-amber-700', dot: 'bg-amber-400', pulse: true  },
  paused:   { label: 'Paused',   bg: 'bg-gray-100',  text: 'text-gray-500',  dot: 'bg-gray-400',  pulse: false },
}

const DOC_STATUS = {
  indexed:    { label: 'Indexed',    color: 'text-green-600' },
  processing: { label: 'Processing', color: 'text-amber-600' },
  failed:     { label: 'Failed',     color: 'text-red-500'   },
}

export default function BotDetailClient({ bot: initialBot, documents: initialDocuments }: { bot: Bot; documents: Document[] }) {
  const router = useRouter()
  const [bot, setBot]   = useState(initialBot)
  const [docs, setDocs] = useState(initialDocuments)
  const [tab, setTab]   = useState<Tab>('preview')
  const [copied, setCopied]     = useState(false)
  const [editName, setEditName] = useState(initialBot.name)
  const [saving, setSaving]     = useState(false)
  const [deleting, setDeleting] = useState(false)

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'https://docly.vercel.app'
  const embedSnippet = `<script src="${appUrl}/embed.js" data-token="${bot.embed_token}"></script>`
  const shareUrl     = `${appUrl}/chat/${bot.embed_token}`

  // Auto-poll while bot is training
  useEffect(() => {
    if (bot.status !== 'training') return
    const supabase = createClient()

    const timer = setInterval(async () => {
      const [{ data: botData }, { data: docsData }] = await Promise.all([
        supabase.from('bots').select('status').eq('id', bot.id).single(),
        supabase.from('documents').select('*').eq('bot_id', bot.id).order('created_at', { ascending: false }),
      ])
      if (botData?.status && botData.status !== bot.status) {
        setBot(prev => ({ ...prev, status: botData.status as typeof bot.status }))
      }
      if (docsData) setDocs(docsData)
    }, 5000)

    return () => clearInterval(timer)
  }, [bot.status, bot.id])

  async function copyToClipboard(text: string) {
    await navigator.clipboard.writeText(text)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  async function saveName() {
    if (!editName.trim() || editName === bot.name) return
    setSaving(true)
    const res = await fetch(`/api/bots/${bot.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: editName }),
    })
    if (res.ok) {
      const updated = await res.json()
      setBot(updated)
    }
    setSaving(false)
  }

  async function handleDelete() {
    if (!confirm(`Delete "${bot.name}"? This cannot be undone.`)) return
    setDeleting(true)
    await fetch(`/api/bots/${bot.id}`, { method: 'DELETE' })
    router.push('/')
  }

  const sc = STATUS_CONFIG[bot.status] ?? STATUS_CONFIG.paused

  return (
    <div className="p-8 max-w-4xl mx-auto">
      {/* Header */}
      <div className="flex items-center gap-3 mb-8">
        <Link href="/" className="w-8 h-8 rounded-[10px] flex items-center justify-center text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors flex-shrink-0">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
            <path d="M19 12H5M12 19l-7-7 7-7" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </Link>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-3 flex-wrap">
            <h1 className="text-[28px] font-medium text-gray-900 truncate">{bot.name}</h1>
            <span className={`inline-flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-full ${sc.bg} ${sc.text}`}>
              <span className={`w-1.5 h-1.5 rounded-full ${sc.dot} ${sc.pulse ? 'animate-pulse' : ''}`} />
              {sc.label}
            </span>
          </div>
          {bot.description && <p className="text-sm text-gray-400 mt-0.5 truncate">{bot.description}</p>}
        </div>
      </div>

      {/* Documents */}
      <div className="bg-white rounded-xl border border-black/[0.06] shadow-sm p-5 mb-5">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-[15px] font-medium text-gray-900">Documents ({docs.length})</h2>
          {bot.status === 'training' && (
            <span className="flex items-center gap-1.5 text-xs text-amber-600">
              <svg className="animate-spin" width="12" height="12" viewBox="0 0 24 24" fill="none">
                <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" opacity="0.25"/>
                <path d="M12 2a10 10 0 0110 10" stroke="currentColor" strokeWidth="3" strokeLinecap="round"/>
              </svg>
              Indexing…
            </span>
          )}
        </div>

        {docs.length === 0 ? (
          <p className="text-sm text-gray-400">No documents uploaded yet.</p>
        ) : (
          <div className="space-y-1">
            {docs.map(doc => {
              const ds = DOC_STATUS[doc.status] ?? DOC_STATUS.processing
              return (
                <div key={doc.id} className="flex items-center gap-3 py-2.5 px-1 border-b border-gray-50 last:border-0">
                  <div className="w-7 h-7 rounded-lg bg-[#007AFF]/10 flex items-center justify-center flex-shrink-0">
                    <span className="text-[10px] font-bold text-[#007AFF] uppercase">{doc.file_type}</span>
                  </div>
                  <span className="flex-1 text-sm text-gray-700 truncate">{doc.filename}</span>
                  {doc.chunk_count != null && (
                    <span className="text-xs text-gray-400">{doc.chunk_count} chunks</span>
                  )}
                  <div className="flex items-center gap-1.5">
                    {doc.status === 'processing' && (
                      <svg className="animate-spin text-amber-500" width="11" height="11" viewBox="0 0 24 24" fill="none">
                        <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" opacity="0.25"/>
                        <path d="M12 2a10 10 0 0110 10" stroke="currentColor" strokeWidth="3" strokeLinecap="round"/>
                      </svg>
                    )}
                    {doc.status === 'indexed' && (
                      <svg width="11" height="11" viewBox="0 0 24 24" fill="none" className="text-green-500">
                        <path d="M20 6L9 17l-5-5" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
                      </svg>
                    )}
                    {doc.status === 'failed' && (
                      <svg width="11" height="11" viewBox="0 0 24 24" fill="none" className="text-red-400">
                        <path d="M18 6L6 18M6 6l12 12" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"/>
                      </svg>
                    )}
                    <span className={`text-xs font-medium ${ds.color}`}>{ds.label}</span>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* Tabs */}
      <div className="bg-white rounded-xl border border-black/[0.06] shadow-sm overflow-hidden">
        <div className="flex border-b border-black/[0.06]">
          {(['preview', 'embed', 'share', 'settings'] as Tab[]).map(t => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`px-5 py-3 text-sm font-medium capitalize transition-colors ${
                tab === t
                  ? 'text-[#007AFF] border-b-2 border-[#007AFF] -mb-px'
                  : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              {t}
            </button>
          ))}
        </div>

        <div className="p-5">
          {/* Preview */}
          {tab === 'preview' && (
            <ChatInterface botId={bot.id} botName={bot.name} compact />
          )}

          {/* Embed */}
          {tab === 'embed' && (
            <div className="space-y-4">
              <div>
                <p className="text-sm font-medium text-gray-700 mb-1">Embed snippet</p>
                <p className="text-xs text-gray-400 mb-3">
                  Paste this just before the closing <code className="bg-gray-100 px-1 rounded">&lt;/body&gt;</code> tag on your website.
                </p>
              </div>
              <div className="relative">
                <pre className="bg-gray-50 rounded-xl p-4 text-xs text-gray-700 overflow-x-auto font-mono border border-black/[0.06] leading-relaxed">
                  {embedSnippet}
                </pre>
                <button
                  onClick={() => copyToClipboard(embedSnippet)}
                  className="absolute top-3 right-3 h-7 px-3 rounded-lg bg-white border border-black/[0.10] text-xs text-gray-600 hover:bg-gray-50 transition-colors"
                >
                  {copied ? 'Copied!' : 'Copy'}
                </button>
              </div>
            </div>
          )}

          {/* Share */}
          {tab === 'share' && (
            <div className="space-y-4">
              <div>
                <p className="text-sm font-medium text-gray-700 mb-1">Public share link</p>
                <p className="text-xs text-gray-400 mb-3">
                  Anyone with this link can chat with your bot. No login required.
                </p>
              </div>
              <div className="flex gap-2">
                <input
                  readOnly
                  value={shareUrl}
                  className="flex-1 h-10 px-3 rounded-[10px] border border-black/[0.10] text-sm text-gray-600 bg-gray-50 font-mono"
                />
                <button
                  onClick={() => copyToClipboard(shareUrl)}
                  className="h-10 px-4 rounded-[10px] bg-[#007AFF] text-white text-sm font-medium hover:bg-[#0066DD] transition-colors flex-shrink-0"
                >
                  {copied ? 'Copied!' : 'Copy link'}
                </button>
              </div>
              <a
                href={shareUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 text-sm text-[#007AFF] hover:underline"
              >
                Open in new tab
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none">
                  <path d="M18 13v6a2 2 0 01-2 2H5a2 2 0 01-2-2V8a2 2 0 012-2h6M15 3h6v6M10 14L21 3"
                    stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              </a>
            </div>
          )}

          {/* Settings */}
          {tab === 'settings' && (
            <div className="space-y-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Bot name</label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={editName}
                    onChange={e => setEditName(e.target.value)}
                    className="flex-1 h-10 px-3 rounded-[10px] border border-black/[0.12] text-sm focus:outline-none focus:ring-2 focus:ring-[#007AFF]/30 focus:border-[#007AFF]"
                  />
                  <button
                    onClick={saveName}
                    disabled={saving || editName === bot.name || !editName.trim()}
                    className="h-10 px-4 rounded-[10px] bg-[#007AFF] text-white text-sm font-medium hover:bg-[#0066DD] disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                  >
                    {saving ? 'Saving…' : 'Save'}
                  </button>
                </div>
              </div>

              <div className="pt-4 border-t border-gray-100">
                <p className="text-sm font-medium text-gray-700 mb-1">Danger zone</p>
                <p className="text-xs text-gray-400 mb-3">
                  Deleting this bot removes all its documents, vectors, and chat history permanently.
                </p>
                <button
                  onClick={handleDelete}
                  disabled={deleting}
                  className="h-9 px-4 rounded-[10px] border border-red-200 text-red-500 text-sm hover:bg-red-50 disabled:opacity-40 transition-colors"
                >
                  {deleting ? 'Deleting…' : 'Delete bot'}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
