'use client'

import { useState, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { BotTone, FREE_PLAN_LIMITS } from '@/types'

type Step = 1 | 2 | 3

const TONES: { value: BotTone; label: string; desc: string }[] = [
  { value: 'friendly', label: 'Friendly',   desc: 'Warm, approachable, conversational' },
  { value: 'formal',   label: 'Formal',     desc: 'Professional and business-like' },
  { value: 'technical', label: 'Technical', desc: 'Precise, detailed, technical terms' },
]

const ACCEPTED_TYPES = ['application/pdf', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'text/plain']
const MAX_FILE_SIZE = FREE_PLAN_LIMITS.max_file_size_mb * 1024 * 1024

export default function NewBotPage() {
  const router = useRouter()
  const supabase = createClient()

  const [step, setStep] = useState<Step>(1)
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [tone, setTone] = useState<BotTone>('friendly')
  const [files, setFiles] = useState<File[]>([])
  const [dragOver, setDragOver] = useState(false)
  const [creating, setCreating] = useState(false)
  const [error, setError] = useState('')
  const fileInputRef = useRef<HTMLInputElement>(null)

  function addFiles(incoming: FileList | null) {
    if (!incoming) return
    const valid: File[] = []
    const errors: string[] = []

    Array.from(incoming).forEach(f => {
      if (!ACCEPTED_TYPES.includes(f.type)) {
        errors.push(`${f.name}: unsupported type`)
      } else if (f.size > MAX_FILE_SIZE) {
        errors.push(`${f.name}: exceeds 10MB`)
      } else if (files.length + valid.length >= FREE_PLAN_LIMITS.docs_per_bot) {
        errors.push(`Max ${FREE_PLAN_LIMITS.docs_per_bot} files on free plan`)
      } else {
        valid.push(f)
      }
    })

    if (errors.length) setError(errors[0])
    setFiles(prev => [...prev, ...valid])
  }

  function removeFile(index: number) {
    setFiles(prev => prev.filter((_, i) => i !== index))
  }

  function fileExt(file: File) {
    if (file.type === 'application/pdf') return 'PDF'
    if (file.type.includes('wordprocessingml')) return 'DOCX'
    return 'TXT'
  }

  async function handleCreate() {
    setCreating(true)
    setError('')

    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error('Not authenticated')

      // Create bot
      const { data: bot, error: botErr } = await supabase
        .from('bots')
        .insert({ user_id: user.id, name, description, tone, status: 'training' })
        .select()
        .single()

      if (botErr) throw botErr

      // Upload files and create document records
      for (const file of files) {
        const ext = file.name.split('.').pop()
        const path = `${user.id}/${bot.id}/${Date.now()}-${file.name}`

        const { error: uploadErr } = await supabase.storage
          .from('documents')
          .upload(path, file)

        if (uploadErr) throw uploadErr

        const { data: { publicUrl } } = supabase.storage
          .from('documents')
          .getPublicUrl(path)

        const fileType = ext === 'pdf' ? 'pdf' : ext === 'docx' ? 'docx' : 'txt'

        const { data: doc, error: docErr } = await supabase
          .from('documents')
          .insert({
            bot_id: bot.id,
            filename: file.name,
            file_url: publicUrl,
            file_type: fileType,
            status: 'processing',
          })
          .select()
          .single()

        if (docErr) throw docErr

        // Trigger ingestion (fire and forget)
        fetch('/api/ingest', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ botId: bot.id, documentId: doc.id }),
        })
      }

      router.push(`/bots/${bot.id}`)
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Something went wrong')
      setCreating(false)
    }
  }

  return (
    <div className="p-8 max-w-2xl mx-auto">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-[28px] font-medium text-gray-900">Create chatbot</h1>
        <p className="text-sm text-gray-500 mt-0.5">Set up your AI assistant in minutes</p>
      </div>

      {/* Steps indicator */}
      <div className="flex items-center gap-2 mb-8">
        {([1, 2, 3] as Step[]).map((s, i) => (
          <div key={s} className="flex items-center gap-2">
            <div className={`w-6 h-6 rounded-full text-xs font-medium flex items-center justify-center transition-colors ${
              step === s ? 'bg-[#007AFF] text-white' :
              step > s  ? 'bg-[#007AFF]/20 text-[#007AFF]' :
              'bg-gray-100 text-gray-400'
            }`}>
              {step > s ? (
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none">
                  <path d="M20 6L9 17l-5-5" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              ) : s}
            </div>
            <span className={`text-sm ${step === s ? 'text-gray-900 font-medium' : 'text-gray-400'}`}>
              {['Name & tone', 'Upload docs', 'Review'][i]}
            </span>
            {i < 2 && <div className="w-8 h-px bg-gray-200 mx-1" />}
          </div>
        ))}
      </div>

      <div className="bg-white rounded-2xl border border-black/[0.06] shadow-sm p-6">
        {/* Step 1 */}
        {step === 1 && (
          <div className="space-y-5">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Bot name *</label>
              <input
                type="text"
                placeholder="e.g. Support Assistant"
                value={name}
                onChange={e => setName(e.target.value)}
                className="w-full h-10 px-3 rounded-[10px] border border-black/[0.12] text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-[#007AFF]/30 focus:border-[#007AFF]"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Description <span className="text-gray-400 font-normal">(optional)</span></label>
              <textarea
                placeholder="What does this bot help with?"
                value={description}
                onChange={e => setDescription(e.target.value)}
                rows={2}
                className="w-full px-3 py-2.5 rounded-[10px] border border-black/[0.12] text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-[#007AFF]/30 focus:border-[#007AFF] resize-none"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Tone</label>
              <div className="space-y-2">
                {TONES.map(t => (
                  <button
                    key={t.value}
                    type="button"
                    onClick={() => setTone(t.value)}
                    className={`w-full flex items-center gap-3 p-3 rounded-[10px] border text-left transition-colors ${
                      tone === t.value
                        ? 'border-[#007AFF] bg-[#007AFF]/5'
                        : 'border-black/[0.10] hover:bg-gray-50'
                    }`}
                  >
                    <div className={`w-4 h-4 rounded-full border-2 flex-shrink-0 flex items-center justify-center ${
                      tone === t.value ? 'border-[#007AFF]' : 'border-gray-300'
                    }`}>
                      {tone === t.value && <div className="w-2 h-2 rounded-full bg-[#007AFF]" />}
                    </div>
                    <div>
                      <p className="text-sm font-medium text-gray-900">{t.label}</p>
                      <p className="text-xs text-gray-400">{t.desc}</p>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Step 2 */}
        {step === 2 && (
          <div className="space-y-4">
            <div>
              <p className="text-sm font-medium text-gray-700 mb-1">Upload documents</p>
              <p className="text-xs text-gray-400 mb-3">PDF, DOCX, TXT · Max 10MB per file · Up to 5 files</p>
            </div>

            {/* Drop zone */}
            <div
              onDragOver={e => { e.preventDefault(); setDragOver(true) }}
              onDragLeave={() => setDragOver(false)}
              onDrop={e => { e.preventDefault(); setDragOver(false); addFiles(e.dataTransfer.files) }}
              onClick={() => fileInputRef.current?.click()}
              className={`border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-colors ${
                dragOver ? 'border-[#007AFF] bg-[#007AFF]/5' : 'border-gray-200 hover:border-gray-300'
              }`}
            >
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none" className="mx-auto mb-3 text-gray-300">
                <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4M17 8l-5-5-5 5M12 3v12" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
              <p className="text-sm font-medium text-gray-600">Drop files here or click to upload</p>
              <p className="text-xs text-gray-400 mt-1">PDF, DOCX, TXT supported</p>
              <input
                ref={fileInputRef}
                type="file"
                multiple
                accept=".pdf,.docx,.txt"
                onChange={e => addFiles(e.target.files)}
                className="hidden"
              />
            </div>

            {/* File list */}
            {files.length > 0 && (
              <div className="space-y-2">
                {files.map((f, i) => (
                  <div key={i} className="flex items-center gap-3 px-3 py-2.5 bg-gray-50 rounded-[10px]">
                    <span className="text-xs font-medium text-[#007AFF] bg-[#007AFF]/10 px-1.5 py-0.5 rounded">
                      {fileExt(f)}
                    </span>
                    <span className="flex-1 text-sm text-gray-700 truncate">{f.name}</span>
                    <span className="text-xs text-gray-400">{(f.size / 1024 / 1024).toFixed(1)} MB</span>
                    <button onClick={() => removeFile(i)} className="text-gray-300 hover:text-red-400 transition-colors">
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
                        <path d="M18 6L6 18M6 6l12 12" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
                      </svg>
                    </button>
                  </div>
                ))}
              </div>
            )}

            {error && <p className="text-xs text-red-500">{error}</p>}
          </div>
        )}

        {/* Step 3 */}
        {step === 3 && (
          <div className="space-y-5">
            <h3 className="text-[15px] font-medium text-gray-900">Review & launch</h3>

            <div className="space-y-3">
              {[
                { label: 'Name', value: name },
                { label: 'Tone', value: TONES.find(t => t.value === tone)?.label },
                { label: 'Documents', value: `${files.length} file${files.length !== 1 ? 's' : ''}` },
              ].map(item => (
                <div key={item.label} className="flex justify-between py-2 border-b border-gray-100 last:border-0">
                  <span className="text-sm text-gray-500">{item.label}</span>
                  <span className="text-sm font-medium text-gray-900">{item.value}</span>
                </div>
              ))}
              {description && (
                <div className="py-2 border-b border-gray-100">
                  <span className="text-sm text-gray-500">Description</span>
                  <p className="text-sm text-gray-900 mt-0.5">{description}</p>
                </div>
              )}
            </div>

            <div className="bg-amber-50 rounded-xl p-3.5">
              <p className="text-xs text-amber-700">
                After creating, your documents will be indexed in the background. This usually takes 30–60 seconds.
              </p>
            </div>

            {error && <p className="text-xs text-red-500">{error}</p>}
          </div>
        )}

        {/* Navigation */}
        <div className="flex justify-between mt-7 pt-5 border-t border-gray-100">
          <button
            onClick={() => step > 1 ? setStep(s => (s - 1) as Step) : router.back()}
            className="h-9 px-4 rounded-[10px] border border-black/[0.10] text-sm text-gray-600 hover:bg-gray-50 transition-colors"
          >
            {step === 1 ? 'Cancel' : 'Back'}
          </button>

          {step < 3 ? (
            <button
              onClick={() => { setError(''); setStep(s => (s + 1) as Step) }}
              disabled={step === 1 && !name.trim()}
              className="h-9 px-5 rounded-[10px] bg-[#007AFF] text-white text-sm font-medium hover:bg-[#0066DD] disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              Continue
            </button>
          ) : (
            <button
              onClick={handleCreate}
              disabled={creating || files.length === 0}
              className="h-9 px-5 rounded-[10px] bg-[#007AFF] text-white text-sm font-medium hover:bg-[#0066DD] disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              {creating ? 'Creating...' : 'Create bot'}
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
