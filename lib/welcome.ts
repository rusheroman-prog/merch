import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database, WelcomeInviteStatus } from '@/lib/supabase/types'

/**
 * Ссылка /w/<token> кладёт токен в эту cookie: новичок может сначала
 * зарегистрироваться и войти, а потом всё равно попадёт в свой welcome pack.
 */
export const WELCOME_COOKIE = 'welcome_token'

export type WelcomeInvite = {
  status: WelcomeInviteStatus
  orderNumber: string | null
}

/** null — RPC недоступен (миграция 20261030000400_merch_welcome_pack.sql ещё не прогнана). */
export async function getWelcomeInvite(
  supabase: SupabaseClient<Database>,
  token: string,
): Promise<WelcomeInvite | null> {
  const { data, error } = await supabase.rpc('get_welcome_invite', { p_token: token })
  if (error) return null
  const row = Array.isArray(data) ? data[0] : null
  return row ? { status: row.status, orderNumber: row.order_number } : { status: 'not_found', orderNumber: null }
}

export function welcomeInviteUrl(origin: string, token: string) {
  return `${origin.replace(/\/$/, '')}/w/${token}`
}
