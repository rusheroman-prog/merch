import { NextResponse, type NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'

/**
 * Выдача по скану (правка #9): сканер считывает QR с номером заказа,
 * и заказ сразу помечается «Получен» + «Отдан заказчику».
 */
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'Необходимо войти в систему' }, { status: 401 })
    }

    const { data: employee } = await supabase
      .from('employees')
      .select('is_admin')
      .eq('id', user.id)
      .maybeSingle()

    if (!employee?.is_admin) {
      return NextResponse.json({ error: 'Доступ разрешён только администратору' }, { status: 403 })
    }

    const body = (await request.json()) as { code?: string }
    // Сканер может добавить «#», пробелы или перевод строки — оставляем сам номер.
    const orderNumber = (body.code ?? '').replace(/^#/, '').trim()

    if (!orderNumber) {
      return NextResponse.json({ error: 'Пустой код' }, { status: 400 })
    }

    const { data: order, error: orderError } = await supabase
      .from('orders')
      .select(`
        id, order_number, status, delivery_type, full_name, email,
        admin_comment, tracking_number, storage_location, handed_to,
        order_items ( product_name, size, color, qty )
      `)
      .eq('order_number', orderNumber)
      .maybeSingle()

    if (orderError) {
      return NextResponse.json({ error: orderError.message }, { status: 400 })
    }
    if (!order) {
      return NextResponse.json({ error: `Заказ #${orderNumber} не найден` }, { status: 404 })
    }

    const summary = {
      order_number:     order.order_number,
      full_name:        order.full_name || order.email || 'Сотрудник',
      storage_location: order.storage_location,
      items:            order.order_items ?? [],
    }

    if (order.status === 'cancelled' || order.status === 'rejected') {
      return NextResponse.json(
        { error: `Заказ #${order.order_number} отменён — выдавать нельзя`, order: summary },
        { status: 409 }
      )
    }
    if (order.delivery_type === 'post') {
      return NextResponse.json(
        { error: `Заказ #${order.order_number} отправляется почтой, а не выдаётся в офисе`, order: summary },
        { status: 409 }
      )
    }
    if (order.status === 'received') {
      return NextResponse.json({ ok: true, alreadyHanded: true, order: summary })
    }

    // Текущие комментарий и трек передаём как есть, чтобы RPC их не затёр.
    const { error: statusError } = await supabase.rpc('admin_update_order', {
      p_order_id:        order.id,
      p_status:          'received',
      p_admin_comment:   order.admin_comment,
      p_tracking_number: order.tracking_number,
    })
    if (statusError) {
      return NextResponse.json({ error: statusError.message }, { status: 400 })
    }

    const { error: handoutError } = await supabase.rpc('admin_set_order_handout', {
      p_order_id:         order.id,
      p_storage_location: order.storage_location,
      p_pickup_status:    'handed_owner',
      p_handed_to:        order.handed_to,
    })
    if (handoutError) {
      return NextResponse.json({ error: handoutError.message }, { status: 400 })
    }

    return NextResponse.json({ ok: true, alreadyHanded: false, order: summary })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Неизвестная ошибка'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
