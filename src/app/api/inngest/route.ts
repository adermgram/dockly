import { serve } from 'inngest/next'
import { inngest } from '@/inngest/client'
import { ingestDocument } from '@/inngest/functions/ingestDocument'

export const { GET, POST, PUT } = serve({
  client: inngest,
  functions: [ingestDocument],
})
