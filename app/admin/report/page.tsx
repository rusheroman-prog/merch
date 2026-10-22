import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { needsPasswordSetup } from '@/lib/auth'
import { countLowStockVariants, getAvailableQty, getLowStockThreshold } from '@/lib/stock'
import ReportClient, { type HandedRow, type StockRow } from './ReportClient'

type ReportPageProps = {
  searchParams: Promise<{ from?: string; to?: string }>
}

type ReceivedOrder = {
  id: string
  delivery_type: string
  received_at: string | null
  order_items: Array<{ product_id: string; product_name: string; size: string | null; color: string | null; qty: number }> | null
}

type StockProduct = {
  id: string
  name: string
  is_active: boolean
  archived_at: string | null
  low_stock_threshold: number | null
  product_variants: Array<{
    id: string
    size: string | null
    color: string | null
    sku: string | null
    total_qty: number
    reserved_qty: number
    is_active: boolean
  }> | null
}

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/

export default async function AdminReportPage({ searchParams }: ReportPageProps) {
  const params = await searchParams
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')
  if (await needsPasswordSetup(supabase, user.id)) redirect('/set-password')

  const { data: employee } = await supabase
    .from('employees')
    .select('is_admin, email')
    .eq('id', user.id)
    .maybeSingle()

  if (!employee?.is_admin) redirect('/catalog')

  // Period: inclusive dates in Tashkent time, default — last 30 days.
  const today = toIsoDate(new Date())
  const to = params.to && DATE_RE.test(params.to) ? params.to : today
  const from = params.from && DATE_RE.test(params.from) ? params.from : shiftDays(to, -29)
  const fromTs = `${from}T00:00:00+05:00`
  const toTs = `${shiftDays(to, 1)}T00:00:00+05:00`

  const [{ data: received }, { count: createdCount }, { count: cancelledCount }, { data: products }, { count: orderCount }] =
    await Promise.all([
      supabase
        .from('orders')
        .select('id, delivery_type, received_at, order_items ( product_id, product_name, size, color, qty )')
        .eq('status', 'received')
        .gte('received_at', fromTs)
        .lt('received_at', toTs),
      supabase
        .from('orders')
        .select('id', { count: 'exact', head: true })
        .gte('created_at', fromTs)
        .lt('created_at', toTs),
      supabase
        .from('orders')
        .select('id', { count: 'exact', head: true })
        .in('status', ['cancelled', 'rejected'])
        .gte('cancelled_at', fromTs)
        .lt('cancelled_at', toTs),
      supabase
        .from('products')
        .select('id, name, is_active, archived_at, low_stock_threshold, product_variants ( id, size, color, sku, total_qty, reserved_qty, is_active )')
        .is('archived_at', null)
        .order('name', { ascending: true }),
      supabase.from('orders').select('id', { count: 'exact', head: true }),
    ])

  // Handed out / received in the period, by product and size.
  const handedMap = new Map<string, HandedRow>()
  for (const order of (received ?? []) as ReceivedOrder[]) {
    for (const item of order.order_items ?? []) {
      const key = `${item.product_id}|${item.size ?? ''}|${item.color ?? ''}`
      const row = handedMap.get(key) ?? {
        product: item.product_name,
        size: item.size || 'ONE SIZE',
        color: item.color || '—',
        office: 0,
        post: 0,
      }
      if (order.delivery_type === 'post') row.post += Number(item.qty)
      else row.office += Number(item.qty)
      handedMap.set(key, row)
    }
  }
  const handed = Array.from(handedMap.values())
    .sort((a, b) => a.product.localeCompare(b.product, 'ru') || a.size.localeCompare(b.size, 'ru'))

  const stockProducts = (products ?? []) as StockProduct[]
  const stock: StockRow[] = stockProducts.flatMap((product) =>
    (product.product_variants ?? [])
      .filter((variant) => variant.is_active)
      .map((variant) => ({
        product: product.name,
        size: variant.size || 'ONE SIZE',
        color: variant.color || '—',
        sku: variant.sku || '',
        total: Number(variant.total_qty),
        reserved: Number(variant.reserved_qty),
        available: getAvailableQty(variant),
        threshold: getLowStockThreshold(product),
        hidden: !product.is_active,
      }))
  )

  return (
    <ReportClient
      adminEmail={employee.email || user.email || 'admin'}
      orderCount={orderCount ?? 0}
      stockAlertCount={countLowStockVariants(stockProducts)}
      from={from}
      to={to}
      summary={{
        created: createdCount ?? 0,
        received: (received ?? []).length,
        cancelled: cancelledCount ?? 0,
        unitsOut: handed.reduce((sum, row) => sum + row.office + row.post, 0),
      }}
      handed={handed}
      stock={stock}
    />
  )
}

function toIsoDate(date: Date) {
  return date.toLocaleDateString('sv-SE', { timeZone: 'Asia/Tashkent' })
}

function shiftDays(isoDate: string, days: number) {
  const date = new Date(`${isoDate}T12:00:00Z`)
  date.setUTCDate(date.getUTCDate() + days)
  return date.toISOString().slice(0, 10)
}
