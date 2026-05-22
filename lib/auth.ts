import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/lib/supabase/types'

export async function needsPasswordSetup(
  supabase: SupabaseClient<Database>,
  userId: string
) {
  const { data } = await supabase
    .from('employees')
    .select('password_set_at')
    .eq('id', userId)
    .maybeSingle()

  return !data?.password_set_at
}
