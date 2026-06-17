import { NextResponse, type NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import type { OrderStatus } from '@/lib/supabase/types'

type UpdateOrderPayload = {
  status?: OrderStatus
  admin_comment?: string
  tracking_number?: string
  storage_location?: string | null
  pickup_status?: string | null
  handed_to?: string | null
}

const allowedStatuses: OrderStatus[] = [
  'new',
  'review',
  'confirmed',
  'assembling',
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

    const { data, error } = await supabase.rpc('admin_update_order', {
      p_order_id: orderId,
      p_status: body.status,
      p_admin_comment: body.admin_comment ?? null,
      p_tracking_number: body.tracking_number ?? null,
    })

    if (error) {
      return NextResponse.json(
        { error: error.message },
        { status: 400 }
      )
    }

    // Handout fields (storage location, pickup status, recipient) are managed by
    // a separate admin RPC so the core status flow above stays untouched.
    const hasHandoutUpdate =
      'storage_location' in body || 'pickup_status' in body || 'handed_to' in body

    if (hasHandoutUpdate) {
      const { error: handoutError } = await supabase.rpc('admin_set_order_handout', {
        p_order_id: orderId,
        p_storage_location: body.storage_location ?? null,
        p_pickup_status: body.pickup_status ?? null,
        p_handed_to: body.handed_to ?? null,
      })

      if (handoutError) {
        return NextResponse.json({ error: handoutError.message }, { status: 400 })
      }
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