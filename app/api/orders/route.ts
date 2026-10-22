import { after, NextResponse, type NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { isEmailConfigured, sendOrderEmail } from '@/lib/email'
import { ACTIVE_DELIVERY_TYPES, type ActiveDeliveryType } from '@/lib/supabase/types'

type CheckoutItem = {
  variant_id: string
  qty: number
}

type CheckoutPayload = {
  items: CheckoutItem[]
  delivery_type?: string
  delivery_address?: string
  phone?: string
  comment?: string
  country?: string
  /** Remote worker picking merch up in Tashkent: trip dates, YYYY-MM-DD. */
  trip_from?: string | null
  trip_until?: string | null
}

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/

export async function POST(request: NextRequest) {
  try {
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

    const body = (await request.json()) as CheckoutPayload

    if (!Array.isArray(body.items) || body.items.length === 0) {
      return NextResponse.json(
        { error: 'Корзина пустая' },
        { status: 400 }
      )
    }

    const items = body.items.map((item) => ({
      variant_id: item.variant_id,
      qty: Number(item.qty),
    }))

    const hasInvalidItem = items.some(
      (item) =>
        !item.variant_id ||
        !Number.isFinite(item.qty) ||
        item.qty <= 0
    )

    if (hasInvalidItem) {
      return NextResponse.json(
        { error: 'В корзине есть некорректные позиции' },
        { status: 400 }
      )
    }

    if (items.some((item) => item.qty !== 1)) {
      return NextResponse.json(
        { error: 'one_unit_per_product_only' },
        { status: 400 }
      )
    }

    const deliveryType = (body.delivery_type ?? 'office') as ActiveDeliveryType

    if (!ACTIVE_DELIVERY_TYPES.includes(deliveryType)) {
      return NextResponse.json({ error: 'delivery_type_not_available' }, { status: 400 })
    }

    const phone = body.phone?.trim() || null
    const deliveryAddress = body.delivery_address?.trim() || null
    const isPost = deliveryType === 'post'

    // The profile page is gone: the phone given at checkout is the only
    // contact besides email, so it is required for every order.
    if (!phone) {
      return NextResponse.json({ error: 'phone_required' }, { status: 400 })
    }

    if (isPost && !deliveryAddress) {
      return NextResponse.json({ error: 'delivery_address_required' }, { status: 400 })
    }

    const tripFrom = body.trip_from?.trim() || null
    const tripUntil = body.trip_until?.trim() || null
    const hasTrip = Boolean(tripFrom || tripUntil)

    if (hasTrip && (!tripFrom || !tripUntil || !DATE_RE.test(tripFrom) || !DATE_RE.test(tripUntil))) {
      return NextResponse.json({ error: 'trip_dates_required' }, { status: 400 })
    }

    if (hasTrip && isPost) {
      return NextResponse.json({ error: 'trip_only_for_office' }, { status: 400 })
    }

    const { data: accessRows, error: accessError } = await supabase.rpc(
      'get_employee_merch_access',
      { p_email: user.email ?? '' }
    )

    if (accessError) {
      return NextResponse.json({ error: accessError.message }, { status: 400 })
    }

    const access = Array.isArray(accessRows) ? accessRows[0] : null

    if (!access?.is_allowed) {
      return NextResponse.json(
        { error: access?.reason ?? 'employee_not_allowed' },
        { status: 403 }
      )
    }

    const variantIds = items.map((item) => item.variant_id)
    const { data: variants, error: variantsError } = await supabase
      .from('product_variants')
      .select('id, product_id')
      .in('id', variantIds)

    if (variantsError) {
      return NextResponse.json({ error: variantsError.message }, { status: 400 })
    }

    if ((variants ?? []).length !== variantIds.length) {
      return NextResponse.json({ error: 'product_is_not_available' }, { status: 400 })
    }

    const uniqueProductIds = new Set((variants ?? []).map((variant) => variant.product_id))

    if (uniqueProductIds.size !== items.length) {
      return NextResponse.json({ error: 'one_variant_per_product_only' }, { status: 400 })
    }

    // Item limits across orders (per employee, per order window) are enforced
    // by create_merch_order, which reads them from merch_settings.
    const { data, error } = await supabase.rpc('create_merch_order', {
      p_items: items,
      p_delivery_type: deliveryType,
      p_delivery_address: isPost ? deliveryAddress : null,
      p_phone: phone,
      p_comment: body.comment?.trim() || null,
      p_is_remote: isPost || hasTrip,
      p_country: isPost ? body.country?.trim() || null : null,
      p_trip_from: tripFrom,
      p_trip_until: tripUntil,
    })

    if (error) {
      return NextResponse.json(
        { error: error.message },
        { status: 400 }
      )
    }

    const created = data as { id?: string } | null

    if (created?.id && isEmailConfigured()) {
      const orderId = created.id
      // Confirmation with the pickup QR goes out after the response is sent.
      after(async () => {
        const { data: order } = await supabase
          .from('orders')
          .select('order_number, pickup_code, email, full_name, delivery_type, trip_until, order_items ( product_name, size, color )')
          .eq('id', orderId)
          .maybeSingle()

        const { data: settings } = await supabase
          .from('merch_settings')
          .select('handout_place, handout_deadline')
          .eq('id', 1)
          .maybeSingle()

        if (order) {
          await sendOrderEmail('created', { ...order, items: order.order_items ?? [] }, {
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
