import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import CatalogClient, {
  type CatalogProduct,
  type CatalogVariant,
} from './CatalogClient'
import type { CSSProperties } from 'react'

export default async function CatalogPage() {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  const { data: employee } = await supabase
    .from('employees')
    .select('is_admin, phone, city, office')
    .eq('id', user.id)
    .maybeSingle()

  const defaultDeliveryAddress = [employee?.city, employee?.office]
    .filter(Boolean)
    .join(', ')

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
    .order('name', { ascending: true })

  if (error) {
    return (
      <main style={styles.page}>
        <section style={styles.errorCard}>
          <h1 style={styles.errorTitle}>Не удалось загрузить каталог</h1>
          <p style={styles.errorText}>{error.message}</p>
        </section>
      </main>
    )
  }

  const products: CatalogProduct[] = (data ?? [])
    .map((product: any) => {
      const variants: CatalogVariant[] = (product.product_variants ?? [])
        .filter((variant: any) => variant.is_active)
        .map((variant: any) => {
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
      isAdmin={Boolean(employee?.is_admin)}
      checkoutDefaults={{
        deliveryType: 'office',
        deliveryAddress: defaultDeliveryAddress,
        phone: employee?.phone ?? '',
      }}
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
    margin: 0,
    color: '#374151',
    fontSize: '15px',
    lineHeight: 1.5,
  },
}