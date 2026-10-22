import { NextResponse, type NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'

type AdminProductAction =
  | 'create_product'
  | 'update_product'
  | 'archive_product'
  | 'restore_product'
  | 'create_variant'
  | 'update_variant'
  | 'add_stock'

type Payload = {
  action?: AdminProductAction

  product_id?: string
  variant_id?: string

  name?: string
  description?: string | null
  material?: string | null
  category_id?: string | null
  image_url?: string | null
  is_active?: boolean
  low_stock_threshold?: number | string | null

  size?: string | null
  color?: string | null
  sku?: string | null
  initial_qty?: number
  qty?: number
  comment?: string | null
  movement_type?: 'income' | 'adjustment'
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

    const { data: employee, error: employeeError } = await supabase
      .from('employees')
      .select('id, is_admin')
      .eq('id', user.id)
      .maybeSingle()

    if (employeeError) {
      return NextResponse.json(
        { error: employeeError.message },
        { status: 400 }
      )
    }

    if (!employee?.is_admin) {
      return NextResponse.json(
        { error: 'Доступ разрешён только администратору' },
        { status: 403 }
      )
    }

    const body = (await request.json()) as Payload

    if (!body.action) {
      return NextResponse.json(
        { error: 'Не передано действие' },
        { status: 400 }
      )
    }

    if (body.action === 'create_product') {
      const name = body.name?.trim()

      if (!name) {
        return NextResponse.json(
          { error: 'Название товара обязательно' },
          { status: 400 }
        )
      }

      const threshold = parseThreshold(body.low_stock_threshold)
      if (threshold === undefined) {
        return NextResponse.json({ error: THRESHOLD_ERROR }, { status: 400 })
      }

      const { data, error } = await supabase
        .from('products')
        .insert({
          name,
          description: cleanText(body.description),
          material: cleanText(body.material),
          category_id: cleanText(body.category_id),
          image_url: cleanText(body.image_url),
          images: cleanText(body.image_url) ? [cleanText(body.image_url) as string] : [],
          is_active: body.is_active ?? true,
          ...(threshold === null ? {} : { low_stock_threshold: threshold }),
        })
        .select('id')
        .single()

      if (error) {
        return NextResponse.json({ error: error.message }, { status: 400 })
      }

      return NextResponse.json({ ok: true, product: data })
    }

    if (body.action === 'update_product') {
      if (!body.product_id) {
        return NextResponse.json(
          { error: 'Не передан product_id' },
          { status: 400 }
        )
      }

      const name = body.name?.trim()

      if (!name) {
        return NextResponse.json(
          { error: 'Название товара обязательно' },
          { status: 400 }
        )
      }

      const imageUrl = cleanText(body.image_url)
      const threshold = parseThreshold(body.low_stock_threshold)
      if (threshold === undefined) {
        return NextResponse.json({ error: THRESHOLD_ERROR }, { status: 400 })
      }

      const { data, error } = await supabase
        .from('products')
        .update({
          name,
          description: cleanText(body.description),
          material: cleanText(body.material),
          category_id: cleanText(body.category_id),
          image_url: imageUrl,
          images: imageUrl ? [imageUrl] : [],
          is_active: body.is_active ?? true,
          ...(threshold === null ? {} : { low_stock_threshold: threshold }),
        })
        .eq('id', body.product_id)
        .select('id')
        .single()

      if (error) {
        return NextResponse.json({ error: error.message }, { status: 400 })
      }

      return NextResponse.json({ ok: true, product: data })
    }

    if (body.action === 'archive_product' || body.action === 'restore_product') {
      if (!body.product_id) {
        return NextResponse.json(
          { error: 'Не передан product_id' },
          { status: 400 }
        )
      }

      // Archiving hides the product everywhere. Restoring brings the card
      // back unpublished, so stock can be checked before it shows up again.
      const isArchive = body.action === 'archive_product'

      const { data, error } = await supabase
        .from('products')
        .update({
          archived_at: isArchive ? new Date().toISOString() : null,
          is_active: false,
        })
        .eq('id', body.product_id)
        .select('id')
        .single()

      if (error) {
        return NextResponse.json({ error: error.message }, { status: 400 })
      }

      return NextResponse.json({ ok: true, product: data })
    }

    if (body.action === 'create_variant') {
      if (!body.product_id) {
        return NextResponse.json(
          { error: 'Не передан product_id' },
          { status: 400 }
        )
      }

      const sku = body.sku?.trim()

      if (!sku) {
        return NextResponse.json(
          { error: 'SKU обязателен' },
          { status: 400 }
        )
      }

      const { data: variant, error: variantError } = await supabase
        .from('product_variants')
        .insert({
          product_id: body.product_id,
          size: cleanText(body.size),
          color: cleanText(body.color),
          sku,
          total_qty: 0,
          reserved_qty: 0,
          is_active: body.is_active ?? true,
        })
        .select('id')
        .single()

      if (variantError) {
        return NextResponse.json(
          { error: variantError.message },
          { status: 400 }
        )
      }

      const initialQty = Number(body.initial_qty ?? 0)

      if (Number.isFinite(initialQty) && initialQty > 0) {
        const { error: stockError } = await supabase
          .from('stock_movements')
          .insert({
            variant_id: variant.id,
            movement_type: 'income',
            qty: initialQty,
            comment: 'Первичное поступление при создании варианта',
            created_by: user.id,
          })

        if (stockError) {
          return NextResponse.json(
            { error: stockError.message },
            { status: 400 }
          )
        }
      }

      return NextResponse.json({ ok: true, variant })
    }

    if (body.action === 'update_variant') {
      if (!body.variant_id) {
        return NextResponse.json(
          { error: 'Не передан variant_id' },
          { status: 400 }
        )
      }

      const sku = body.sku?.trim()

      if (!sku) {
        return NextResponse.json(
          { error: 'SKU обязателен' },
          { status: 400 }
        )
      }

      const { data, error } = await supabase
        .from('product_variants')
        .update({
          size: cleanText(body.size),
          color: cleanText(body.color),
          sku,
          is_active: body.is_active ?? true,
        })
        .eq('id', body.variant_id)
        .select('id')
        .single()

      if (error) {
        return NextResponse.json({ error: error.message }, { status: 400 })
      }

      return NextResponse.json({ ok: true, variant: data })
    }

    if (body.action === 'add_stock') {
      if (!body.variant_id) {
        return NextResponse.json(
          { error: 'Не передан variant_id' },
          { status: 400 }
        )
      }

      const qty = Number(body.qty)

      if (!Number.isFinite(qty) || qty === 0) {
        return NextResponse.json(
          { error: 'Количество должно быть не равно 0' },
          { status: 400 }
        )
      }

      const movementType = body.movement_type ?? 'income'

      if (movementType === 'income' && qty <= 0) {
        return NextResponse.json(
          { error: 'Поступление должно быть положительным числом' },
          { status: 400 }
        )
      }

      const { data, error } = await supabase
        .from('stock_movements')
        .insert({
          variant_id: body.variant_id,
          movement_type: movementType,
          qty,
          comment:
            cleanText(body.comment) ??
            (movementType === 'income'
              ? 'Поступление через админку'
              : 'Ручная корректировка через админку'),
          created_by: user.id,
        })
        .select('id')
        .single()

      if (error) {
        return NextResponse.json({ error: error.message }, { status: 400 })
      }

      return NextResponse.json({ ok: true, movement: data })
    }

    return NextResponse.json(
      { error: 'Неизвестное действие' },
      { status: 400 }
    )
  } catch (error) {
    const message =
      error instanceof Error ? error.message : 'Неизвестная ошибка'

    return NextResponse.json({ error: message }, { status: 500 })
  }
}

const THRESHOLD_ERROR = 'Маячок остатка — целое число от 0 до 1000'

/** null when not provided, undefined when invalid. */
function parseThreshold(value: unknown): number | null | undefined {
  if (value === undefined || value === null || value === '') return null
  const number = Number(value)
  return Number.isInteger(number) && number >= 0 && number <= 1000 ? number : undefined
}

function cleanText(value: unknown) {
  if (typeof value !== 'string') {
    return null
  }

  const trimmed = value.trim()

  return trimmed.length > 0 ? trimmed : null
}