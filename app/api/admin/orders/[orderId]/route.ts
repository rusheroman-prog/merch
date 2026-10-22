import { after, NextResponse, type NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { isEmailConfigured, sendOrderEmail } from '@/lib/email'
import type { OrderStatus } from '@/lib/supabase/types'

type UpdateOrderPayload = {
  status?: OrderStatus
  admin_comment?: string | null
  tracking_number?: string | null
  storage_location?: string | null
  handed_to?: string | null
}

const allowedStatuses: OrderStatus[] = [
  'new',
  'assembling',
  'ready',
  'shipped',
  'received',
  'cancelled',
  'rejected',
]

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ orderId: string }> }
) {
  try {
    const { orderId } = await context.params

    const supabase = await createClient()

    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser()

    if (userError || !user) {
      return NextResponse.json(
        { error: 'Необходимо войти в систему' },
        { status: 401 }
      )
    }

    const body = (await request.json()) as UpdateOrderPayload

    if (!body.status || !allowedStatuses.includes(body.status)) {
      return NextResponse.json(
        { error: 'Некорректный статус заказа' },
        { status: 400 }
      )
    }

    const { data: before } = await supabase
      .from('orders')
      .select('status')
      .eq('id', orderId)
      .maybeSingle()

    // Status, stock effects (unreserve / write-off) and the handout fields are
    // applied in one transaction by the database; it also rejects transitions
    // that do not fit the order's branch (pickup vs post).
    const { data, error } = await supabase.rpc('admin_set_order_status', {
      p_order_id: orderId,
      p_status: body.status,
      p_admin_comment: body.admin_comment ?? null,
      p_tracking_number: body.tracking_number ?? null,
      p_handed_to: body.handed_to ?? null,
      p_storage_location: body.storage_location ?? null,
    })

    if (error) {
      return NextResponse.json(
        { error: getStatusErrorMessage(error.message) },
        { status: 400 }
      )
    }

    if (before?.status !== 'ready' && body.status === 'ready' && isEmailConfigured()) {
      after(async () => {
        const [{ data: order }, { data: settings }] = await Promise.all([
          supabase
            .from('orders')
            .select('order_number, pickup_code, email, full_name, delivery_type, trip_until, order_items ( product_name, size, color )')
            .eq('id', orderId)
            .maybeSingle(),
          supabase
            .from('merch_settings')
            .select('handout_place, handout_deadline')
            .eq('id', 1)
            .maybeSingle(),
        ])

        if (order) {
          await sendOrderEmail('ready', { ...order, items: order.order_items ?? [] }, {
            place: settings?.handout_place,
            deadline: settings?.handout_deadline,
          })
        }
      })
    }

    return NextResponse.json({
      ok: true,
      order: data,
    })
  } catch (error) {
    const message =
      error instanceof Error ? error.message : 'Неизвестная ошибка'

    return NextResponse.json(
      { error: message },
      { status: 500 }
    )
  }
}

function getStatusErrorMessage(message: string) {
  if (message.includes('not_admin')) return 'Доступ разрешён только администратору'
  if (message.includes('order_is_closed')) return 'Заказ уже закрыт — статус больше не меняется'
  if (message.includes('status_not_for_post')) return 'Заказ отправляется почтой: статус «Можно забирать» не подходит'
  if (message.includes('status_only_for_post')) return 'Статус «Отправлено» — только для заказов почтой'
  if (message.includes('status_retired')) return 'Этот статус больше не используется'
  if (message.includes('order_not_found')) return 'Заказ не найден'
  return message
}
