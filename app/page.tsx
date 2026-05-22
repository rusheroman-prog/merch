import { createClient } from '@/lib/supabase/server'
import { needsPasswordSetup } from '@/lib/auth'
import { redirect } from 'next/navigation'

export default async function HomePage() {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (user) {
    if (await needsPasswordSetup(supabase, user.id)) {
      redirect('/set-password')
    }

    redirect('/catalog')
  }

  redirect('/login')
}
