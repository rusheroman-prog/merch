import { countStockAlerts } from '@/lib/stockAlerts'
import { requireAdmin } from '@/lib/session'
import AdminOrdersClient, { type AdminOrder } from './AdminOrdersClient'

export default async function AdminOrdersPage() {
  const { supabase, user } = await requireAdmin()

  // Заказы и счётчик маячков — параллельно.
  const [{ data, error }, stockAlertCount] = await Promise.all([
    supabase
    .from('orders')
    .select(
      `
      id,
      order_number,
      employee_id,
      status,
      delivery_type,
      delivery_address,
      full_name,
      phone,
      email,
      city,
      department,
      comment,
      admin_comment,
      tracking_number,
      assigned_to,
      storage_location,
      pickup_status,
      handed_to,
      is_remote,
      country,
      created_at,
      confirmed_at,
      shipped_at,
      received_at,
      cancelled_at,
      order_items (
        id,
        product_name,
        size,
        color,
        sku,
        qty
      )
    `
    )
    .order('created_at', { ascending: false }),
    countStockAlerts(supabase),
  ])

  if (error) {
    return (
      <main className="page-error">
        <section className="error-card">
          <div className="error-card-icon">!</div>
          <h1 className="error-title">Не удалось загрузить заказы</h1>
          <p className="error-text">{error.message}</p>
        </section>
      </main>
    )
  }

  return (
    <AdminOrdersClient
      orders={(data ?? []) as AdminOrder[]}
      adminEmail={user.email ?? ''}
      stockAlertCount={stockAlertCount}
    />
  )
}
