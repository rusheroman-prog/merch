import { NextResponse, type NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import type { DeliveryType } from '@/lib/supabase/types'

const HOLD_ERRORS: Record<string, string> = {
  employee_has_no_account:  'У сотрудника ещё нет аккаунта в портале — попросите его зарегистрироваться',
  product_is_not_available: 'Этот вариант закончился',
  hold_date_invalid:        'Дата резерва должна быть не раньше сегодняшней',
  not_admin:                'Доступ разрешён только администратору',
}

/** «Отложить айтем для сотрудника до даты»: заказ от его имени с дедлайном. */
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'Необходимо войти в систему' }, { status: 401 })
    }

    const body = (await request.json()) as {
      email?: string
      variant_ids?: string[]
      hold_until?: string
      delivery_type?: DeliveryType
      note?: string
    }

    const email = body.email?.trim() ?? ''
    const variantIds = Array.isArray(body.variant_ids) ? body.variant_ids.filter(Boolean) : []
    const deliveryType: DeliveryType = body.delivery_type === 'office' ? 'office' : 'post'

    if (!email || variantIds.length === 0 || !/^\d{4}-\d{2}-\d{2}$/.test(body.hold_until ?? '')) {
      return NextResponse.json({ error: 'Укажите email сотрудника и дату резерва' }, { status: 400 })
    }

    const { data, error } = await supabase.rpc('admin_create_hold', {
      p_employee_email: email,
      p_variant_ids:    variantIds,
      p_hold_until:     body.hold_until!,
      p_delivery_type:  deliveryType,
      p_note:           body.note?.trim() || null,
    })

    if (error) {
      const known = Object.keys(HOLD_ERRORS).find((code) => error.message.includes(code))
      return NextResponse.json({ error: known ? HOLD_ERRORS[known] : error.message }, { status: 400 })
    }

    return NextResponse.json({ ok: true, order: data })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Неизвестная ошибка'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
