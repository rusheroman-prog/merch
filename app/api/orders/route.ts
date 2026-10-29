import { NextResponse, type NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { ACTIVE_DELIVERY_TYPES, type DeliveryType } from '@/lib/supabase/types'
import { formatTripRange, validateTripDates } from '@/lib/trip'

type CheckoutItem = {
  variant_id: string
  qty: number
}

type CheckoutPayload = {
  items: CheckoutItem[]
  delivery_type?: DeliveryType
  delivery_address?: string
  phone?: string
  comment?: string
  is_remote?: boolean
  country?: string
  /** Удалёнщик в командировке забирает в офисе Ташкента в эти даты. */
  trip_from?: string | null
  trip_to?: string | null
  /** Токен спецссылки welcome pack: свои правила вместо обычных. */
  welcome_token?: string | null
}

const MAX_UNIQUE_PRODUCTS = 3

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

    // Welcome pack: стаж и лимит в 3 позиции не действуют — приглашение,
    // email и состав набора проверяет create_welcome_order.
    const welcomeToken = body.welcome_token?.trim() || null

    if (!welcomeToken) {
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

    if (!welcomeToken) {
      if (uniqueProductIds.size > MAX_UNIQUE_PRODUCTS) {
        return NextResponse.json({ error: 'max_unique_products_exceeded' }, { status: 400 })
      }

      // Товары только для welcome pack в обычном заказе недоступны.
      // До миграции колонки audience нет — тогда проверку пропускаем.
      const { data: audienceRows, error: audienceError } = await supabase
        .from('products')
        .select('id, audience')
        .in('id', Array.from(uniqueProductIds))

      if (!audienceError && (audienceRows ?? []).some((row) => row.audience === 'welcome')) {
        return NextResponse.json({ error: 'product_is_not_available' }, { status: 400 })
      }
    }

    if (uniqueProductIds.size !== items.length) {
      return NextResponse.json({ error: 'one_variant_per_product_only' }, { status: 400 })
    }

    // Принимаем только активные способы получения: офис или почта BTS.
    // ПВЗ и курьер в интерфейсе неактивны — защищаемся и на сервере.
    const deliveryType: DeliveryType = body.delivery_type ?? 'office'

    if (!ACTIVE_DELIVERY_TYPES.includes(deliveryType)) {
      return NextResponse.json({ error: 'delivery_type_unavailable' }, { status: 400 })
    }

    // Удалёнщик = отправка почтой или командировка с выдачей в офисе.
    // Флаг выводим из выбора в корзине, чтобы они не расходились.
    const isTrip = deliveryType === 'office' && Boolean(body.trip_from || body.trip_to)
    const isRemote = deliveryType === 'post' || isTrip
    const country = deliveryType === 'post' ? (body.country?.trim() || null) : null
    const deliveryAddress = body.delivery_address?.trim() || null
    const phone = body.phone?.trim() || null

    if (deliveryType === 'post' && (!country || !deliveryAddress || !phone)) {
      return NextResponse.json({ error: 'post_details_required' }, { status: 400 })
    }

    if (isTrip) {
      const tripError = validateTripDates(body.trip_from, body.trip_to)
      if (tripError) {
        return NextResponse.json({ error: tripError }, { status: 400 })
      }
    }

    // Даты дублируем в комментарий: админ увидит их даже до миграции trip_*.
    const tripNote = isTrip
      ? `Командировка в Ташкент: ${formatTripRange(body.trip_from!, body.trip_to!)}`
      : null
    const comment = [welcomeToken ? 'Welcome pack' : null, tripNote, body.comment?.trim()]
      .filter(Boolean).join('\n') || null

    const orderArgs = {
      p_items: items,
      p_delivery_type: deliveryType,
      p_delivery_address: deliveryAddress,
      p_phone: phone,
      p_comment: comment,
      p_is_remote: isRemote,
      p_country: country,
    }

    const { data, error } = welcomeToken
      ? await supabase.rpc('create_welcome_order', { ...orderArgs, p_token: welcomeToken })
      : await supabase.rpc('create_merch_order', orderArgs)

    if (error) {
      return NextResponse.json(
        { error: error.message },
        { status: 400 }
      )
    }

    if (isTrip) {
      const order = data as { id?: string } | null
      // Заказ и резерв уже созданы — сбой дат не должен его отменять.
      const { error: tripError } = await supabase.rpc('set_order_trip', {
        p_order_id: order?.id ?? '',
        p_trip_from: body.trip_from!,
        p_trip_to: body.trip_to!,
      })
      if (tripError) console.error('set_order_trip failed', tripError.message)
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
