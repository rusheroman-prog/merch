import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database, ProductAudience } from '@/lib/supabase/types'
import type { SessionEmployee, SessionUser } from '@/lib/session'
import type { CatalogProduct, CatalogVariant } from './CatalogClient'

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

/** catalog — обычный каталог, welcome — набор по спецссылке. */
export type CatalogAudience = 'catalog' | 'welcome'

const PRODUCT_SELECT = `
  id, name, description, material, image_url, images, is_active,
  categories ( id, name, sort ),
  product_variants ( id, size, color, sku, total_qty, reserved_qty, is_active )
`

/**
 * Данные для CatalogClient, общие для /catalog и /welcome.
 * До миграции 20261030000400_merch_welcome_pack.sql колонки audience нет: тогда каталог
 * показывает все товары, а welcome pack — пустой.
 */
export async function loadCatalogData(
  supabase: SupabaseClient<Database>,
  user: SessionUser,
  employee: SessionEmployee,
  audience: CatalogAudience,
) {
  const allowed: ProductAudience[] = audience === 'welcome' ? ['welcome', 'both'] : ['catalog', 'both']

  // Три независимых запроса — параллельно, а не по очереди.
  const [{ data: lastOrder }, { data: settings }, firstProducts] = await Promise.all([
    // Профиля больше нет: телефон и адрес подставляем из последнего заказа,
    // чтобы сотруднику не вводить их заново.
    supabase
      .from('orders')
      .select('delivery_type, delivery_address, phone, country')
      .eq('employee_id', user.id)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle(),
    supabase
      .from('merch_settings')
      .select('handout_deadline, handout_place')
      .eq('id', 1)
      .maybeSingle(),
    supabase
      .from('products')
      .select(PRODUCT_SELECT)
      .eq('is_active', true)
      .in('audience', allowed)
      .order('name', { ascending: true }),
  ])

  let { data, error } = firstProducts

  if (error?.message.includes('audience')) {
    ({ data, error } = audience === 'catalog'
      ? await supabase
          .from('products')
          .select(PRODUCT_SELECT)
          .eq('is_active', true)
          .order('name', { ascending: true })
      : { data: [], error: null })
  }

  const lastWasPost = lastOrder?.delivery_type === 'post'

  const products: CatalogProduct[] = ((data ?? []) as unknown as CatalogQueryProduct[])
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

  return {
    error: error?.message ?? null,
    employee,
    props: {
      products,
      userEmail: user.email ?? null,
      userName: employee?.full_name ?? null,
      isAdmin: Boolean(employee?.is_admin),
      checkoutDefaults: {
        deliveryType: (lastWasPost ? 'post' : 'office') as 'post' | 'office',
        deliveryAddress: lastWasPost ? lastOrder?.delivery_address ?? '' : '',
        phone: lastOrder?.phone ?? employee?.phone ?? '',
        country: lastOrder?.country ?? '',
      },
      handout: {
        place: settings?.handout_place ?? null,
        deadline: settings?.handout_deadline ?? null,
      },
    },
  }
}
