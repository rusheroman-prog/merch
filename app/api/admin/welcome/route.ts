import { NextResponse, type NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

async function requireAdmin() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { supabase, user: null, error: NextResponse.json({ error: 'Необходимо войти в систему' }, { status: 401 }) }

  const { data: employee } = await supabase
    .from('employees')
    .select('is_admin')
    .eq('id', user.id)
    .maybeSingle()

  if (!employee?.is_admin) {
    return { supabase, user, error: NextResponse.json({ error: 'Доступ разрешён только администратору' }, { status: 403 }) }
  }
  return { supabase, user, error: null }
}

/** Создать ссылку на welcome pack для email новичка. */
export async function POST(request: NextRequest) {
  const { supabase, user, error: authError } = await requireAdmin()
  if (authError) return authError

  const body = (await request.json()) as { email?: string; full_name?: string; note?: string }
  const email = body.email?.trim().toLowerCase() ?? ''

  if (!EMAIL.test(email)) {
    return NextResponse.json({ error: 'Укажите корректный email' }, { status: 400 })
  }

  const { data, error } = await supabase
    .from('welcome_invites')
    .insert({
      email,
      full_name: body.full_name?.trim() || null,
      note: body.note?.trim() || null,
      created_by: user!.id,
    })
    .select('id, token')
    .single()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 })
  }

  return NextResponse.json({ ok: true, invite: data })
}

/** Отозвать неиспользованную ссылку. */
export async function DELETE(request: NextRequest) {
  const { supabase, error: authError } = await requireAdmin()
  if (authError) return authError

  const body = (await request.json()) as { id?: string }
  if (!body.id) {
    return NextResponse.json({ error: 'Не передан id' }, { status: 400 })
  }

  const { error } = await supabase
    .from('welcome_invites')
    .delete()
    .eq('id', body.id)
    .is('used_at', null)

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 })
  }

  return NextResponse.json({ ok: true })
}
