import { NextResponse, type NextRequest } from 'next/server'
import { requireAdmin } from '@/lib/admin'
import { createClient } from '@/lib/supabase/server'
import { getBranch, isClosed, normalizeScannedCode } from '@/lib/orderStatus'
import type { OrderStatus } from '@/lib/supabase/types'

const ORDER_FIELDS = `
  id, order_number, pickup_code, status, delivery_type, full_name, email, phone,
  department, storage_location, handed_to, received_at, trip_until, comment,
  order_items ( id, product_name, size, color, qty )
`

/** Finds an order by the scanned pickup code or by a typed order number. */
export async function GET(request: NextRequest) {
  const supabase = await createClient()
  const admin = await requireAdmin(supabase)
  if (!admin.ok) return NextResponse.json({ error: admin.error }, { status: admin.status })

  const raw = request.nextUrl.searchParams.get('code') ?? ''
  const code = normalizeScannedCode(raw)

  if (!code) {
    return NextResponse.json({ error: 'Пустой код' }, { status: 400 })
  }

  // Pickup codes are 10 hex characters and come from the QR. A bare number is
  // an order number typed by hand: guessable, so the UI asks to check the name.
  let matchedBy: 'code' | 'number' = 'code'
  let { data: order, error } = await supabase
    .from('orders')
    .select(ORDER_FIELDS)
    .eq('pickup_code', code)
    .maybeSingle()

  if (!order && !error && /^\d{1,6}$/.test(code)) {
    matchedBy = 'number'
    ;({ data: order, error } = await supabase
      .from('orders')
      .select(ORDER_FIELDS)
      .eq('order_number', code.padStart(6, '0'))
      .maybeSingle())
  }

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 })
  }

  if (!order) {
    return NextResponse.json({ error: 'Заказ с таким кодом не найден' }, { status: 404 })
  }

  return NextResponse.json({ ok: true, order, matchedBy })
}

type HandOutPayload = {
  order_id?: string
  handed_to?: string | null
}

/** Marks a pickup order as handed out ("Отдали заказ") and writes off its stock. */
export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const admin = await requireAdmin(supabase)
  if (!admin.ok) return NextResponse.json({ error: admin.error }, { status: admin.status })

  const body = (await request.json()) as HandOutPayload

  if (!body.order_id) {
    return NextResponse.json({ error: 'Не передан заказ' }, { status: 400 })
  }

  const { data: current, error: currentError } = await supabase
    .from('orders')
    .select('status, delivery_type')
    .eq('id', body.order_id)
    .maybeSingle()

  if (currentError || !current) {
    return NextResponse.json({ error: currentError?.message ?? 'Заказ не найден' }, { status: 404 })
  }

  if (getBranch(current.delivery_type) === 'post') {
    return NextResponse.json(
      { error: 'Этот заказ отправляется почтой — выдавать на месте не нужно' },
      { status: 400 }
    )
  }

  if (isClosed(current.status as OrderStatus)) {
    return NextResponse.json(
      { error: current.status === 'received' ? 'Заказ уже выдан' : 'Заказ отменён или отклонён' },
      { status: 409 }
    )
  }

  const { data, error } = await supabase.rpc('admin_set_order_status', {
    p_order_id: body.order_id,
    p_status: 'received',
    p_handed_to: body.handed_to?.trim() || null,
  })

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 })
  }

  return NextResponse.json({ ok: true, order: data })
}
