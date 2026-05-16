export type Plan = 'free' | 'pro'
export type BotStatus = 'training' | 'live' | 'paused'
export type BotTone = 'friendly' | 'formal' | 'technical'
export type DocumentStatus = 'processing' | 'indexed' | 'failed'
export type FileType = 'pdf' | 'docx' | 'txt'
export type MessageRole = 'user' | 'assistant'

export interface Profile {
  id: string
  email: string
  full_name: string | null
  plan: Plan
  message_count: number
  created_at: string
}

export interface Bot {
  id: string
  user_id: string
  name: string
  description: string | null
  tone: BotTone
  status: BotStatus
  embed_token: string
  created_at: string
  updated_at: string
  // joined fields
  document_count?: number
  message_count?: number
}

export interface Document {
  id: string
  bot_id: string
  filename: string
  file_url: string
  file_type: FileType
  status: DocumentStatus
  chunk_count: number | null
  created_at: string
}

export interface ChatMessage {
  id: string
  bot_id: string
  session_id: string
  role: MessageRole
  content: string
  rating: 1 | -1 | null
  created_at: string
}

export interface Chunk {
  id: string
  bot_id: string
  document_id: string
  content: string
  created_at: string
}

// Free plan limits
export const FREE_PLAN_LIMITS = {
  bots: 1,
  docs_per_bot: 5,
  messages_per_month: 500,
  max_file_size_mb: 10,
} as const
