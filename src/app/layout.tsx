import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'Docly — AI chatbots from your documents',
  description: 'Upload your documents and instantly get a custom AI chatbot you can embed on your website.',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="h-full">
      <body className="min-h-full">{children}</body>
    </html>
  )
}
