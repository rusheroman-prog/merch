import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { needsPasswordSetup } from '@/lib/auth'
import { getSupportContact } from '@/lib/support'
import { ACTIVE_DELIVERY_TYPES, type ActiveDeliveryType } from '@/lib/supabase/types'
import CatalogClient, {
  type CatalogProduct,
  type CatalogVariant,
} from './CatalogClient'

type CatalogQueryVariant = {
  id: string
  size: string | null
  color: string | null
  sku: string | null
  total_qty: number | null
  reserved_qty: number | null
  is_active: boolean | null
}

type CatalogQueryProduct = {
  id: string
  name: string
  description: string | null
  material: string | null
  image_url: string | null
  images: string[] | null
  categories: { name: string | null } | Array<{ name: string | null }> | null
  product_variants: CatalogQueryVariant[] | null
}

type MyOrderRow = {
  status: string
  created_at: string
  delivery_type: string
  delivery_address: string | null
  phone: string | null
  country: string | null
  order_items: Array<{ product_id: string }> | null
}

const DEFAULT_MAX_ITEMS = 3

export default async function CatalogPage() {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  if (await needsPasswordSetup(supabase, user.id)) {
    redirect('/set-password')
  }

  const [
    { data: employee },
    { data: accessRows },
    { data: settings },
    { data: myOrders },
  ] = await Promise.all([
    supabase
      .from('employees')
      .select('full_name, is_admin, phone, hired_at')
      .eq('id', user.id)
      .maybeSingle(),
    supabase.rpc('get_employee_merch_access', { p_email: user.email ?? '' }),
    supabase
      .from('merch_settings')
      .select('handout_place, support_label, support_url, order_window_start, max_items_per_employee')
      .eq('id', 1)
      .maybeSingle(),
    supabase
      .from('orders')
      .select('status, created_at, delivery_type, delivery_address, phone, country, order_items ( product_id )')
      .eq('employee_id', user.id)
      .order('created_at', { ascending: false }),
  ])

  const access = Array.isArray(accessRows) ? accessRows[0] : null

  // Limits mirror create_merch_order: count active orders in the current window.
  const windowStart = settings?.order_window_start ?? null
  const maxItems = Number(settings?.max_items_per_employee ?? DEFAULT_MAX_ITEMS) || DEFAULT_MAX_ITEMS
  const orders = (myOrders ?? []) as MyOrderRow[]
  const ordersInWindow = orders.filter((order) =>
    !['cancelled', 'rejected'].includes(order.status) &&
    (!windowStart || new Date(order.created_at) >= new Date(windowStart))
  )
  const orderedProductIds = Array.from(new Set(
    ordersInWindow.flatMap((order) => (order.order_items ?? []).map((item) => item.product_id))
  ))

  // Contacts are entered in the cart for every order; prefill from the last one.
  const lastOrder = orders[0]
  const lastDelivery = lastOrder?.delivery_type as ActiveDeliveryType | undefined
  const deliveryType: ActiveDeliveryType =
    lastDelivery && ACTIVE_DELIVERY_TYPES.includes(lastDelivery) ? lastDelivery : 'office'

  const { data, error } = await supabase
    .from('products')
    .select(
      `
      id,
      name,
      description,
      material,
      image_url,
      images,
      is_active,
      categories (
        id,
        name,
        sort
      ),
      product_variants (
        id,
        size,
        color,
        sku,
        total_qty,
        reserved_qty,
        is_active
      )
    `
    )
    .eq('is_active', true)
    .is('archived_at', null)
    .order('name', { ascending: true })

  if (error) {
    return (
      <main className="page-error">
        <section className="error-card">
          <div className="error-card-icon">!</div>
          <h1 className="error-title">Не удалось загрузить каталог</h1>
          <p className="error-text">{error.message}</p>
        </section>
      </main>
    )
  }

  const products: CatalogProduct[] = ((data ?? []) as CatalogQueryProduct[])
    .map((product) => {
      const variants: CatalogVariant[] = (product.product_variants ?? [])
        .filter((variant) => variant.is_active)
        .map((variant) => {
          const totalQty = Number(variant.total_qty ?? 0)
          const reservedQty = Number(variant.reserved_qty ?? 0)

          return {
            id: variant.id,
            size: variant.size,
            color: variant.color,
            sku: variant.sku,
            total_qty: totalQty,
            reserved_qty: reservedQty,
            available_qty: Math.max(0, totalQty - reservedQty),
          }
        })
        .filter((variant: CatalogVariant) => variant.available_qty > 0)

      return {
        id: product.id,
        name: product.name,
        description: product.description,
        material: product.material,
        image_url: product.image_url,
        images: Array.isArray(product.images) ? product.images : [],
        category_name: Array.isArray(product.categories)
          ? product.categories[0]?.name ?? null
          : product.categories?.name ?? null,
        variants,
      }
    })
    .filter((product: CatalogProduct) => product.variants.length > 0)

  return (
    <CatalogClient
      products={products}
      userEmail={user.email ?? null}
      userName={employee?.full_name ?? null}
      isAdmin={Boolean(employee?.is_admin)}
      checkoutDefaults={{
        deliveryType,
        deliveryAddress: lastDelivery === 'post' ? lastOrder?.delivery_address ?? '' : '',
        phone: lastOrder?.phone ?? employee?.phone ?? '',
        country: lastOrder?.country ?? '',
      }}
      limits={{
        maxItems,
        orderedProductIds,
        hasWindow: Boolean(windowStart),
      }}
      support={getSupportContact(settings)}
      handoutPlace={settings?.handout_place ?? null}
      merchAccess={{
        isAllowed: Boolean(access?.is_allowed),
        reason: access?.reason ?? 'employee_not_in_directory',
        hiredAt: access?.hired_at ?? employee?.hired_at ?? null,
        monthsWorked: access?.months_worked ?? null,
      }}
    />
  )
}
