# Dockly

Turn your business documents into a website chatbot in minutes. Upload a file with your business info, and Dockly creates a chatbot that answers customer questions from it. Share it as a link or embed it on your site.

**Live:** https://dockly-bay.vercel.app

## How it works

1. **Upload** a document with your business info (pricing, FAQs, policies, services).
2. **Process:** The document is split into chunks and converted into embeddings.
3. **Chat:** Dockly generates a shareable link where anyone can chat with your bot.
4. **Embed:** Add the chatbot to your website. 

Answers come from retrieved passages of your document (RAG), so the bot sticks to your business information. 

## Features

- Document upload [PDF / DOCX / TXT]
- Embedding generation and semantic search
- Shareable chat link per chatbot
- Website embed widget


## Stack

- **Framework:** Next.js (TypeScript)
- **Database and migrations:** Supabase/Pgvector
- **AI:** Grow LLM
- **Hosting:** Vercel

## Running locally

Install with `npm install`, copy your environment variables (Supabase keys, LLM key), then run `npm run dev` and open http://localhost:3000.
