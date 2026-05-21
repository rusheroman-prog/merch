import Link from 'next/link'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import AdminProductsClient, {
  type AdminCategory,
  type AdminProduct,
} from './AdminProductsClient'
import type { CSSProperties } from 'react'

export default async function AdminProductsPage() {
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

  const { data: categories, error: categoriesError } = await supabase
    .from('categories')
    .select('id, name, sort')
    .order('sort', { ascending: true })

  if (categoriesError) {
    return (
      <main style={styles.page}>
        <section style={styles.errorCard}>
          <h1 style={styles.errorTitle}>Не удалось загрузить категории</h1>
          <p style={styles.errorText}>{categoriesError.message}</p>
        </section>
      </main>
    )
  }

  const { data: products, error: productsError } = await supabase
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

  const { count: orderCount } = await supabase
    .from('orders')
    .select('id', { count: 'exact', head: true })

  if (productsError) {
    return (
      <main style={styles.page}>
        <section style={styles.errorCard}>
          <h1 style={styles.errorTitle}>Не удалось загрузить товары</h1>
          <p style={styles.errorText}>{productsError.message}</p>
        </section>
      </main>
    )
  }

  return (
    <AdminProductsClient
      products={(products ?? []) as AdminProduct[]}
      categories={(categories ?? []) as AdminCategory[]}
      adminEmail={user.email ?? ''}
      orderCount={orderCount ?? 0}
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