import Link from 'next/link'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import AdminOrdersClient, { type AdminOrder } from './AdminOrdersClient'
import type { CSSProperties } from 'react'

export default async function AdminOrdersPage() {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  const { data: employee, error: employeeError } = await supabase
    .from('employees')
    .select('id, email, full_name, is_admin')
    .eq('id', user.id)
    .maybeSingle()

  if (employeeError) {
    return (
      <main style={styles.page}>
        <section style={styles.errorCard}>
          <h1 style={styles.errorTitle}>Не удалось проверить роль</h1>
          <p style={styles.errorText}>{employeeError.message}</p>
        </section>
      </main>
    )
  }

  if (!employee?.is_admin) {
    return (
      <main style={styles.page}>
        <section style={styles.errorCard}>
          <h1 style={styles.errorTitle}>Доступ запрещён</h1>
          <p style={styles.errorText}>
            Эта страница доступна только администраторам.
          </p>

          <Link href="/catalog" style={styles.backLink}>
            Вернуться в каталог
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
        if (!variant.is_active) {
          return false
        }

        const available =
          Number(variant.total_qty) - Number(variant.reserved_qty)

        return available > 0 && available <= 4
      }).length

      return sum + lowCount
    }, 0) ?? 0

  if (error) {
    return (
      <main style={styles.page}>
        <section style={styles.errorCard}>
          <h1 style={styles.errorTitle}>Не удалось загрузить заказы</h1>
          <p style={styles.errorText}>{error.message}</p>
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

const styles: Record<string, CSSProperties> = {
  page: {
    minHeight: '100vh',
    background: '#f5f5f7',
    padding: '32px',
    fontFamily:
      'Inter, Arial, system-ui, -apple-system, BlinkMacSystemFont, sans-serif',
  },
  errorCard: {
    maxWidth: '640px',
    margin: '80px auto',
    background: '#ffffff',
    borderRadius: '20px',
    padding: '28px',
    boxShadow: '0 14px 40px rgba(0,0,0,0.07)',
  },
  errorTitle: {
    margin: '0 0 12px',
    fontSize: '24px',
    fontWeight: 800,
    color: '#991b1b',
  },
  errorText: {
    margin: '0 0 16px',
    color: '#374151',
    fontSize: '15px',
    lineHeight: 1.5,
  },
  backLink: {
    color: '#7c3aed',
    fontWeight: 800,
    textDecoration: 'none',
  },
}