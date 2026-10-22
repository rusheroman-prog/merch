import { NextResponse, type NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'
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
}

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
      p_is_remote: isPost,
      p_country: isPost ? body.country?.trim() || null : null,
    })

    if (error) {
      return NextResponse.json(
        { error: error.message },
        { status: 400 }
      )
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
