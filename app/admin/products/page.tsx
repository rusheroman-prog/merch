import { requireAdmin } from '@/lib/session'
import { loadAlertMap } from '@/lib/stockAlerts'
import AdminProductsClient, {
  type AdminCategory,
  type AdminProduct,
} from './AdminProductsClient'

export default async function AdminProductsPage() {
  const { supabase, user } = await requireAdmin()

  const loadProducts = (optional: string[]) => supabase
    .from('products')
    .select(
      `
      id,
      name,
      description,
      material,
      category_id,
      image_url,
      images,
      is_active,
      ${optional.map((column) => `${column},`).join(' ')}
      created_at,
      updated_at,
      categories (
        id,
        name,
        sort
      ),
      product_variants (
        id,
        product_id,
        size,
        color,
        sku,
        total_qty,
        reserved_qty,
        is_active,
        created_at,
        updated_at
      )
    `
    )
    .order('name', { ascending: true })

  // archived_at, audience и segment появляются миграциями 20261030000200, 20261030000400
  // и 20261030000600; пороги маячков — 20261030000500 (грузятся отдельно).
  // Всё независимое — параллельно, чтобы не ждать круги до базы по очереди.
  let optional = ['archived_at', 'audience', 'segment']
  const [
    { data: categories, error: categoriesError },
    firstProducts,
    alerts,
    { count: orderCount },
  ] = await Promise.all([
    supabase.from('categories').select('id, name, sort').order('sort', { ascending: true }),
    loadProducts(optional),
    loadAlertMap(supabase),
    supabase.from('orders').select('id', { count: 'exact', head: true }),
  ])

  let { data: products, error: productsError } = firstProducts

  // Если какой-то миграции нет — убираем её колонку и показываем страницу без этой функции.
  while (productsError && optional.some((column) => productsError!.message.includes(column))) {
    optional = optional.filter((column) => !productsError!.message.includes(column))
    ;({ data: products, error: productsError } = await loadProducts(optional))
  }
  const archiveReady = optional.includes('archived_at')

  if (categoriesError) {
    return (
      <main className="page-error">
        <section className="error-card">
          <div className="error-card-icon">!</div>
          <h1 className="error-title">Не удалось загрузить категории</h1>
          <p className="error-text">{categoriesError.message}</p>
        </section>
      </main>
    )
  }

  const productsWithAlerts = ((products ?? []) as unknown as AdminProduct[]).map((product) => ({
    ...product,
    product_variants: product.product_variants.map((variant) =>
      alerts ? { ...variant, alert_qty: alerts.get(variant.id) ?? null } : variant
    ),
  }))

  if (productsError) {
    return (
      <main className="page-error">
        <section className="error-card">
          <div className="error-card-icon">!</div>
          <h1 className="error-title">Не удалось загрузить товары</h1>
          <p className="error-text">{productsError.message}</p>
        </section>
      </main>
    )
  }

  return (
    <AdminProductsClient
      products={productsWithAlerts}
      archiveReady={archiveReady}
      categories={(categories ?? []) as AdminCategory[]}
      adminEmail={user.email ?? ''}
      orderCount={orderCount ?? 0}
    />
  )
}
