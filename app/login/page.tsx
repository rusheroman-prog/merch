import { Suspense } from 'react'
import { createClient } from '@/lib/supabase/server'
import { getSupportContact } from '@/lib/support'
import LoginClient from './LoginClient'

export default async function LoginPage() {
  const supabase = await createClient()

  // merch_settings is readable without a session, so the help contact is
  // available before sign-in. Missing columns (migration not applied yet)
  // simply hide the contact.
  const { data: settings } = await supabase
    .from('merch_settings')
    .select('support_label, support_url')
    .eq('id', 1)
    .maybeSingle()

  return (
    <Suspense>
      <LoginClient support={getSupportContact(settings)} />
    </Suspense>
  )
}
