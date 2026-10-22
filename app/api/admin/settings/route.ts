import { NextResponse, type NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { normalizeSupportUrl } from '@/lib/support'

type SettingsPayload = {
  handout_deadline?: string | null
  handout_place?: string | null
  handout_note?: string | null
  order_window_start?: string | null
  max_items_per_employee?: number | string | null
  support_label?: string | null
  support_url?: string | null
}

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()

    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser()

    if (userError || !user) {
      return NextResponse.json({ error: 'Необходимо войти в систему' }, { status: 401 })
    }

    const { data: employee, error: employeeError } = await supabase
      .from('employees')
      .select('is_admin, is_active')
      .eq('id', user.id)
      .maybeSingle()

    if (employeeError) {
      return NextResponse.json({ error: employeeError.message }, { status: 400 })
    }

    if (!employee?.is_admin || employee.is_active === false) {
      return NextResponse.json(
        { error: 'Доступ разрешён только администратору' },
        { status: 403 }
      )
    }

    const body = (await request.json()) as SettingsPayload

    const maxItems = Number(body.max_items_per_employee ?? 3)
    if (!Number.isInteger(maxItems) || maxItems < 1 || maxItems > 20) {
      return NextResponse.json(
        { error: 'Лимит позиций — целое число от 1 до 20' },
        { status: 400 }
      )
    }

    const supportUrlInput = cleanText(body.support_url)
    const supportUrl = normalizeSupportUrl(supportUrlInput)
    if (supportUrlInput && !supportUrl) {
      return NextResponse.json(
        { error: 'Контакт поддержки: укажите ссылку https://…, @telegram, email или телефон' },
        { status: 400 }
      )
    }

    const windowStart = cleanDate(body.order_window_start)
    if (windowStart === undefined) {
      return NextResponse.json({ error: 'Некорректная дата начала раздачи' }, { status: 400 })
    }

    const handoutDeadline = cleanDate(body.handout_deadline)
    if (handoutDeadline === undefined) {
      return NextResponse.json({ error: 'Некорректная дата раздачи' }, { status: 400 })
    }

    const { error } = await supabase
      .from('merch_settings')
      .update({
        handout_deadline:       handoutDeadline,
        handout_place:          cleanText(body.handout_place),
        handout_note:           cleanText(body.handout_note),
        order_window_start:     windowStart,
        max_items_per_employee: maxItems,
        support_label:          cleanText(body.support_label),
        support_url:            supportUrl,
        updated_at:             new Date().toISOString(),
      })
      .eq('id', 1)

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 })
    }

    return NextResponse.json({ ok: true })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Неизвестная ошибка'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

function cleanText(value: unknown) {
  if (typeof value !== 'string') return null
  const trimmed = value.trim()
  return trimmed.length > 0 ? trimmed : null
}

/** null for "not set", undefined for an unparseable value. */
function cleanDate(value: unknown): string | null | undefined {
  const text = cleanText(value)
  if (!text) return null
  const date = new Date(text)
  return Number.isNaN(date.getTime()) ? undefined : date.toISOString()
}
