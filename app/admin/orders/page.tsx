import Link from 'next/link'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { needsPasswordSetup } from '@/lib/auth'
import AdminOrdersClient, { type AdminOrder } from './AdminOrdersClient'

export default async function AdminOrdersPage() {
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

  const { data: employee, error: employeeError } = await supabase
    .from('employees')
    .select('id, email, full_name, is_admin')
    .eq('id', user.id)
    .maybeSingle()

  if (employeeError) {
    return (
      <main className="page-error">
        <section className="error-card">
          <div className="error-card-icon">!</div>
          <h1 className="error-title">Не удалось проверить роль</h1>
          <p className="error-text">{employeeError.message}</p>
        </section>
      </main>
    )
  }

  if (!employee?.is_admin) {
    return (
      <main className="page-error">
        <section className="error-card">
          <div className="error-card-icon">🔒</div>
          <h1 className="error-title">Доступ запрещён</h1>
          <p className="error-text">
            Эта страница доступна только администраторам.
          </p>
          <Link href="/catalog" className="error-back-link">
            ← Вернуться в каталог
          </Link>
        </section>
      </main>
    )
  }

  const { data, error } = await supabase
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
    .order('created_at', { ascending: false })

  const { data: productsForStock } = await supabase
    .from('products')
    .select(
      `
      id,
      product_variants (
        id,
        total_qty,
        reserved_qty,
        is_active
      )
    `
    )

  const stockAlertCount =
    productsForStock?.reduce((sum, product) => {
      const variants = product.product_variants ?? []
      const lowCount = variants.filter((variant) => {
        if (!variant.is_active) return false
        const available = Number(variant.total_qty) - Number(variant.reserved_qty)
        return available > 0 && available <= 4
      }).length
      return sum + lowCount
    }, 0) ?? 0

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
