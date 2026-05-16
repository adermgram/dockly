import { redirect } from 'next/navigation'

// /bots redirects to dashboard (bots are listed there)
export default function BotsPage() {
  redirect('/')
}
