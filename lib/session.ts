import { cache } from 'react'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'

export type SessionUser = { id: string; email: string | null }

export type SessionEmployee = {
  full_name: string | null
  email: string | null
  is_admin: boolean
  is_active: boolean | null
  phone: string | null
  hired_at: string | null
  password_set_at: string | null
}

/**
 * Пользователь и его запись сотрудника — одним проходом на запрос.
 * getClaims проверяет JWT локально (асимметричные ключи) и сам откатывается
 * на сетевой getUser для старых HS-ключей, так что медленнее, чем раньше, не будет.
 * cache() — страница и её компоненты не повторяют эти запросы.
 */
export const getSession = cache(async () => {
  const supabase = await createClient()
  const { data } = await supabase.auth.getClaims()
  const claims = data?.claims

  if (!claims?.sub) {
    return { supabase, user: null, employee: null }
  }

  const user: SessionUser = {
    id: claims.sub,
    email: typeof claims.email === 'string' ? claims.email : null,
  }

  const { data: employee } = await supabase
    .from('employees')
    .select('full_name, email, is_admin, is_active, phone, hired_at, password_set_at')
    .eq('id', user.id)
    .maybeSingle()

  return { supabase, user, employee: (employee ?? null) as SessionEmployee | null }
})

/** Для страниц сотрудника: нужен вход и заданный пароль. */
export async function requireSession() {
  const session = await getSession()
  if (!session.user) redirect('/login')
  if (!session.employee?.password_set_at) redirect('/set-password')
  return session as {
    supabase: typeof session.supabase
    user: SessionUser
    employee: SessionEmployee
  }
}

/** Для страниц админки: то же плюс права администратора. */
export async function requireAdmin() {
  const session = await requireSession()
  if (!session.employee.is_admin || session.employee.is_active === false) redirect('/catalog')
  return session
}
