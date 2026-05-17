import Groq from 'groq-sdk'
import { RetrievedChunk } from './retrieve'

function getClient() {
  return new Groq({ apiKey: process.env.GROQ_API_KEY })
}

export function buildPrompt(botName: string, chunks: RetrievedChunk[], tone: string): string {
  const toneInstruction = {
    friendly:  'Be warm, approachable, and conversational.',
    formal:    'Be professional and business-like.',
    technical: 'Be precise and use technical terminology where appropriate.',
  }[tone] ?? 'Be helpful.'

  const context = chunks.length > 0
    ? chunks.map(c => c.content).join('\n\n---\n\n')
    : 'No relevant context found.'

  return `You are a helpful assistant for ${botName}. ${toneInstruction}
Answer questions ONLY using the context below.
If you cannot find the answer in the context, say exactly: "I don't have information about that in my knowledge base."
Do not make up answers. Do not use outside knowledge.

Context:
${context}`
}

export async function streamChat(
  systemPrompt: string,
  userMessage: string
): Promise<ReadableStream> {
  const stream = await getClient().chat.completions.create({
    model: 'llama-3.3-70b-versatile',
    temperature: 0.2,
    stream: true,
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userMessage },
    ],
  })

  return new ReadableStream({
    async start(controller) {
      try {
        for await (const chunk of stream) {
          const text = chunk.choices[0]?.delta?.content ?? ''
          if (text) controller.enqueue(new TextEncoder().encode(text))
        }
        controller.close()
      } catch {
        controller.close()
      }
    },
  })
}
