'use client'

import { useState, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { BotTone, FREE_PLAN_LIMITS } from '@/types'

type Step = 1 | 2 | 3

const TONES: { value: BotTone; label: string; desc: string }[] = [
  { value: 'friendly',  label: 'Friendly',   desc: 'Warm, approachable, conversational' },
  { value: 'formal',    label: 'Formal',      desc: 'Professional and business-like' },
  { value: 'technical', label: 'Technical',   desc: 'Precise, detailed, technical terms' },
]

const ACCEPTED_TYPES = [
  'application/pdf',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'text/plain',
]
const MAX_FILE_SIZE = FREE_PLAN_LIMITS.max_file_size_mb * 1024 * 1024
const STEP_LABELS = ['Name & tone', 'Upload docs', 'Review']

export default function NewBotPage() {
  const router = useRouter()
  const supabase = createClient()

  const [step, setStep]                   = useState<Step>(1)
  const [name, setName]                   = useState('')
  const [description, setDescription]     = useState('')
  const [tone, setTone]                   = useState<BotTone>('friendly')
  const [files, setFiles]                 = useState<File[]>([])
  const [dragOver, setDragOver]           = useState(false)
  const [creating, setCreating]           = useState(false)
  const [creatingLabel, setCreatingLabel] = useState('')
  const [error, setError]                 = useState('')
  const fileInputRef = useRef<HTMLInputElement>(null)

  function addFiles(incoming: FileList | null) {
    if (!incoming) return
    const valid: File[] = []
    const errs: string[] = []
    Array.from(incoming).forEach(f => {
      if (!ACCEPTED_TYPES.includes(f.type)) {
        errs.push(`${f.name}: unsupported file type`)
      } else if (f.size > MAX_FILE_SIZE) {
        errs.push(`${f.name}: exceeds ${FREE_PLAN_LIMITS.max_file_size_mb} MB limit`)
      } else if (files.length + valid.length >= FREE_PLAN_LIMITS.docs_per_bot) {
        errs.push(`Free plan allows up to ${FREE_PLAN_LIMITS.docs_per_bot} documents`)
      } else {
        valid.push(f)
      }
    })
    if (errs.length) setError(errs[0])
    else setError('')
    if (valid.length) setFiles(prev => [...prev, ...valid])
  }

  function removeFile(index: number) {
    setFiles(prev => prev.filter((_, i) => i !== index))
  }

  function fileExt(file: File) {
    if (file.type === 'application/pdf') return 'PDF'
    if (file.type.includes('wordprocessingml')) return 'DOCX'
    return 'TXT'
  }

  function goNext() {
    if (step === 2 && files.length === 0) {
      setError('Add at least one document before continuing.')
      return
    }
    setError('')
    setStep(s => (s + 1) as Step)
  }

  async function handleCreate() {
    setCreating(true)
    setError('')

    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error('Not authenticated')

      setCreatingLabel('Creating your bot…')
      const { data: bot, error: botErr } = await supabase
        .from('bots')
        .insert({ user_id: user.id, name, description, tone, status: 'training' })
        .select()
        .single()
      if (botErr) throw botErr

      for (let i = 0; i < files.length; i++) {
        const file = files[i]
        setCreatingLabel(`Uploading "${file.name}" (${i + 1} of ${files.length})…`)

        const ext = file.name.split('.').pop()?.toLowerCase()
        const path = `${user.id}/${bot.id}/${Date.now()}-${file.name}`

        const { error: uploadErr } = await supabase.storage.from('documents').upload(path, file)
        if (uploadErr) throw uploadErr

        const { data: { publicUrl } } = supabase.storage.from('documents').getPublicUrl(path)
        const fileType = ext === 'pdf' ? 'pdf' : ext === 'docx' ? 'docx' : 'txt'

        const { data: doc, error: docErr } = await supabase
          .from('documents')
          .insert({ bot_id: bot.id, filename: file.name, file_url: publicUrl, file_type: fileType, status: 'processing' })
          .select()
          .single()
        if (docErr) throw docErr

        fetch('/api/ingest', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ botId: bot.id, documentId: doc.id }),
        })
      }

      router.push(`/bots/${bot.id}`)
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Something went wrong')
      setCreatingLabel('')
      setCreating(false)
    }
  }

  const canContinue = step === 1 ? name.trim().length > 0 : files.length > 0

  return (
    <div className="p-8 max-w-2xl mx-auto">
      <div className="mb-8">
        <h1 className="text-[28px] font-medium text-gray-900">Create chatbot</h1>
        <p className="text-sm text-gray-500 mt-0.5">Set up your AI assistant in minutes</p>
      </div>

      {/* Step indicator */}
      <div className="flex items-center gap-2 mb-8">
        {([1, 2, 3] as Step[]).map((s, i) => (
          <div key={s} className="flex items-center gap-2">
            <div className={`w-6 h-6 rounded-full text-xs font-semibold flex items-center justify-center transition-all duration-200 ${
              step > s  ? 'bg-green-500 text-white' :
              step === s ? 'bg-[#007AFF] text-white' :
              'bg-gray-100 text-gray-400'
            }`}>
              {step > s ? (
                <svg width="10" height="10" viewBox="0 0 24 24" fill="none">
                  <path d="M20 6L9 17l-5-5" stroke="white" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              ) : s}
            </div>
            <span className={`text-sm transition-colors ${
              step === s ? 'text-gray-900 font-medium' : step > s ? 'text-gray-500' : 'text-gray-400'
            }`}>
              {STEP_LABELS[i]}
            </span>
            {i < 2 && <div className="w-8 h-px bg-gray-200 mx-1" />}
          </div>
        ))}
      </div>

      <div className="bg-white rounded-2xl border border-black/[0.06] shadow-sm p-6">

        {/* ── Step 1: Name & Tone ── */}
        {step === 1 && (
          <div className="space-y-5">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">
                Bot name <span className="text-red-400">*</span>
              </label>
              <input
                type="text"
                placeholder="e.g. Support Assistant"
                value={name}
                onChange={e => { setName(e.target.value); setError('') }}
                autoFocus
                className="w-full h-10 px-3 rounded-[10px] border border-black/[0.12] text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-[#007AFF]/30 focus:border-[#007AFF]"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">
                Description{' '}
                <span className="text-xs text-gray-400 font-normal">(optional)</span>
              </label>
              <textarea
                placeholder="What does this bot help with?"
                value={description}
                onChange={e => setDescription(e.target.value)}
                rows={2}
                className="w-full px-3 py-2.5 rounded-[10px] border border-black/[0.12] text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-[#007AFF]/30 focus:border-[#007AFF] resize-none"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Response tone</label>
              <div className="space-y-2">
                {TONES.map(t => (
                  <button
                    key={t.value}
                    type="button"
                    onClick={() => setTone(t.value)}
                    className={`w-full flex items-center gap-3 p-3.5 rounded-[10px] border text-left transition-all ${
                      tone === t.value
                        ? 'border-[#007AFF] bg-[#007AFF]/[0.04] shadow-sm'
                        : 'border-black/[0.08] hover:border-black/[0.16] hover:bg-gray-50/50'
                    }`}
                  >
                    <div className={`w-4 h-4 rounded-full border-2 flex-shrink-0 flex items-center justify-center transition-colors ${
                      tone === t.value ? 'border-[#007AFF]' : 'border-gray-300'
                    }`}>
                      {tone === t.value && <div className="w-2 h-2 rounded-full bg-[#007AFF]" />}
                    </div>
                    <div>
                      <p className="text-sm font-medium text-gray-900">{t.label}</p>
                      <p className="text-xs text-gray-400 mt-0.5">{t.desc}</p>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* ── Step 2: Upload ── */}
        {step === 2 && (
          <div className="space-y-4">
            <div>
              <p className="text-sm font-medium text-gray-700 mb-0.5">Upload documents</p>
              <p className="text-xs text-gray-400">
                PDF, DOCX, or TXT · Max {FREE_PLAN_LIMITS.max_file_size_mb} MB per file · Up to {FREE_PLAN_LIMITS.docs_per_bot} files
              </p>
            </div>

            <div
              onDragOver={e => { e.preventDefault(); setDragOver(true) }}
              onDragLeave={() => setDragOver(false)}
              onDrop={e => { e.preventDefault(); setDragOver(false); addFiles(e.dataTransfer.files) }}
              onClick={() => fileInputRef.current?.click()}
              className={`border-2 border-dashed rounded-xl p-10 text-center cursor-pointer transition-all select-none ${
                dragOver
                  ? 'border-[#007AFF] bg-[#007AFF]/[0.04] scale-[1.01]'
                  : 'border-gray-200 hover:border-[#007AFF]/40 hover:bg-gray-50/50'
              }`}
            >
              <div className={`w-11 h-11 rounded-2xl flex items-center justify-center mx-auto mb-3 transition-colors ${
                dragOver ? 'bg-[#007AFF]/10' : 'bg-gray-100'
              }`}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" className={dragOver ? 'text-[#007AFF]' : 'text-gray-400'}>
                  <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4M17 8l-5-5-5 5M12 3v12"
                    stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              </div>
              <p className="text-sm font-medium text-gray-700">
                {dragOver ? 'Release to upload' : 'Drop files here or click to browse'}
              </p>
              <p className="text-xs text-gray-400 mt-1">PDF, DOCX, TXT supported</p>
              <input
                ref={fileInputRef}
                type="file"
                multiple
                accept=".pdf,.docx,.txt"
                onChange={e => { addFiles(e.target.files); e.target.value = '' }}
                className="hidden"
              />
            </div>

            {files.length > 0 && (
              <div className="space-y-2">
                {files.map((f, i) => (
                  <div key={i} className="flex items-center gap-3 px-3 py-2.5 bg-gray-50 rounded-[10px] group">
                    <div className="w-7 h-7 rounded-lg bg-[#007AFF]/10 flex items-center justify-center flex-shrink-0">
                      <span className="text-[10px] font-bold text-[#007AFF]">{fileExt(f)}</span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-800 truncate">{f.name}</p>
                      <p className="text-xs text-gray-400">{(f.size / 1024 / 1024).toFixed(2)} MB</p>
                    </div>
                    <button
                      onClick={e => { e.stopPropagation(); removeFile(i) }}
                      className="w-6 h-6 rounded-full flex items-center justify-center text-gray-300 hover:text-red-400 hover:bg-red-50 transition-all opacity-0 group-hover:opacity-100"
                    >
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none">
                        <path d="M18 6L6 18M6 6l12 12" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"/>
                      </svg>
                    </button>
                  </div>
                ))}
              </div>
            )}

            {error ? (
              <div className="flex items-center gap-2 text-xs text-red-600 bg-red-50 rounded-[10px] px-3 py-2.5">
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" className="flex-shrink-0">
                  <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="2"/>
                  <path d="M12 8v5M12 16h.01" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
                </svg>
                {error}
              </div>
            ) : files.length === 0 ? (
              <p className="text-xs text-center text-gray-400">
                You need at least one document to continue.
              </p>
            ) : null}
          </div>
        )}

        {/* ── Step 3: Review ── */}
        {step === 3 && (
          <div className="space-y-5">
            <h3 className="text-[15px] font-medium text-gray-900">Review & launch</h3>

            <div className="rounded-xl border border-black/[0.06] overflow-hidden divide-y divide-black/[0.04]">
              {[
                { label: 'Bot name',  value: name },
                { label: 'Tone',      value: TONES.find(t => t.value === tone)?.label },
                { label: 'Documents', value: `${files.length} file${files.length !== 1 ? 's' : ''}` },
                ...(description ? [{ label: 'Description', value: description }] : []),
              ].map(item => (
                <div key={item.label} className="flex items-start gap-4 px-4 py-3">
                  <span className="text-sm text-gray-500 w-28 flex-shrink-0">{item.label}</span>
                  <span className="text-sm font-medium text-gray-900">{item.value}</span>
                </div>
              ))}
            </div>

            <div className="space-y-1.5">
              {files.map((f, i) => (
                <div key={i} className="flex items-center gap-2.5 px-3 py-2 bg-gray-50 rounded-[10px]">
                  <div className="w-6 h-6 rounded-md bg-[#007AFF]/10 flex items-center justify-center flex-shrink-0">
                    <span className="text-[9px] font-bold text-[#007AFF]">{fileExt(f)}</span>
                  </div>
                  <span className="text-sm text-gray-700 flex-1 truncate">{f.name}</span>
                  <span className="text-xs text-gray-400">{(f.size / 1024 / 1024).toFixed(2)} MB</span>
                </div>
              ))}
            </div>

            <div className="flex items-start gap-2.5 bg-amber-50 rounded-xl p-3.5">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" className="flex-shrink-0 mt-0.5 text-amber-500">
                <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="1.5"/>
                <path d="M12 8v5M12 16h.01" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
              </svg>
              <p className="text-xs text-amber-700 leading-relaxed">
                After launching, your documents will be indexed in the background. This usually takes 30–60 seconds per document.
              </p>
            </div>

            {error && (
              <div className="flex items-center gap-2 text-xs text-red-600 bg-red-50 rounded-[10px] px-3 py-2.5">
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" className="flex-shrink-0">
                  <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="2"/>
                  <path d="M12 8v5M12 16h.01" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
                </svg>
                {error}
              </div>
            )}

            {creating && creatingLabel && (
              <div className="flex items-center gap-2.5 bg-blue-50 rounded-xl px-3.5 py-3">
                <svg className="animate-spin flex-shrink-0 text-[#007AFF]" width="14" height="14" viewBox="0 0 24 24" fill="none">
                  <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" opacity="0.25"/>
                  <path d="M12 2a10 10 0 0110 10" stroke="currentColor" strokeWidth="3" strokeLinecap="round"/>
                </svg>
                <span className="text-xs text-[#007AFF]">{creatingLabel}</span>
              </div>
            )}
          </div>
        )}

        {/* Navigation */}
        <div className="flex justify-between mt-7 pt-5 border-t border-gray-100">
          <button
            onClick={() => step > 1 ? setStep(s => (s - 1) as Step) : router.back()}
            disabled={creating}
            className="h-9 px-4 rounded-[10px] border border-black/[0.10] text-sm text-gray-600 hover:bg-gray-50 disabled:opacity-40 transition-colors"
          >
            {step === 1 ? 'Cancel' : 'Back'}
          </button>

          {step < 3 ? (
            <button
              onClick={goNext}
              disabled={!canContinue}
              className="h-9 px-5 rounded-[10px] bg-[#007AFF] text-white text-sm font-medium hover:bg-[#0066DD] disabled:opacity-40 disabled:cursor-not-allowed active:scale-[0.98] transition-all"
            >
              Continue
            </button>
          ) : (
            <button
              onClick={handleCreate}
              disabled={creating}
              className="h-9 px-5 rounded-[10px] bg-[#007AFF] text-white text-sm font-medium hover:bg-[#0066DD] disabled:opacity-40 disabled:cursor-not-allowed active:scale-[0.98] transition-all"
            >
              {creating ? 'Launching…' : 'Launch bot'}
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
