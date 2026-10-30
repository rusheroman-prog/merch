import AdminShell from '@/components/AdminShell'
import Link from 'next/link'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { needsPasswordSetup } from '@/lib/auth'
import { alertLimit, isLowStock, loadAlertMap } from '@/lib/stockAlerts'
import type { DeliveryType, OrderStatus } from '@/lib/supabase/types'
import { decline } from '@/lib/utils'
import { matchesSegment, parseSegmentFilter, SEGMENT_LABELS, SEGMENTS, type SegmentFilter } from '@/lib/segments'
import type { ProductSegment } from '@/lib/supabase/types'

/**
 * Аналитика: сколько мерча выдали за период, что осталось с учётом размеров,
 * и маячки — варианты, которые вот-вот закончатся.
 * Денег (закупка/продажа остатков) в системе пока нет — цены не хранятся.
 */

const PERIODS = [
  { key: '7',   label: '7 дней',  days: 7 },
  { key: '30',  label: '30 дней', days: 30 },
  { key: '90',  label: '90 дней', days: 90 },
  { key: 'all', label: 'Всё время', days: null },
] as const

type PeriodKey = (typeof PERIODS)[number]['key']

type AnalyticsOrder = {
  id: string
  status: OrderStatus
  delivery_type: DeliveryType
  is_remote: boolean
  employee_id: string
  created_at: string
  received_at: string | null
  order_items: { variant_id: string; product_id: string; qty: number }[]
}

type AnalyticsProduct = {
  id: string
  name: string
  is_active: boolean
  segment?: ProductSegment | null
  product_variants: {
    id: string
    size: string | null
    color: string | null
    total_qty: number
    reserved_qty: number
    is_active: boolean
  }[]
}

export default async function AdminAnalyticsPage({
  searchParams,
}: {
  searchParams: Promise<{ period?: string; segment?: string }>
}) {
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

  const params = await searchParams
  const period = PERIODS.find((p) => p.key === params.period) ?? PERIODS[1]
  const segment = parseSegmentFilter(params.segment)
  const hrefFor = (next: { period?: string; segment?: SegmentFilter }) => {
    const query = new URLSearchParams()
    const p = next.period ?? period.key
    const sg = next.segment ?? segment
    if (p !== '30') query.set('period', p)
    if (sg !== 'all') query.set('segment', sg)
    const qs = query.toString()
    return qs ? `/admin/analytics?${qs}` : '/admin/analytics'
  }
  const since = period.days === null ? null : Date.now() - period.days * 86_400_000
  const inPeriod = (value: string | null) => value !== null && (since === null || new Date(value).getTime() >= since)

  const loadProducts = (withSegment: boolean) => supabase
    .from('products')
    .select(`id, name, is_active, ${withSegment ? 'segment,' : ''} product_variants ( id, size, color, total_qty, reserved_qty, is_active )`)
    .order('name', { ascending: true })

  const [{ data: ordersData }, productsResult, alerts] = await Promise.all([
    supabase
      .from('orders')
      .select('id, status, delivery_type, is_remote, employee_id, created_at, received_at, order_items ( variant_id, product_id, qty )'),
    loadProducts(true),
    loadAlertMap(supabase),
  ])

  // До 20261030000600_merch_segments_holds.sql колонки segment нет — работаем без переключателя.
  const segmentsReady = !productsResult.error
  const { data: productsData } = segmentsReady ? productsResult : await loadProducts(false)

  const allOrders = (ordersData ?? []) as unknown as AnalyticsOrder[]
  const products  = ((productsData ?? []) as unknown as AnalyticsProduct[])
    .filter((p) => !segmentsReady || matchesSegment(p.segment, segment))

  // В выбранном сегменте считаем только заказы с его товарами.
  const productIds = new Set(products.map((p) => p.id))
  const orders = segment === 'all'
    ? allOrders
    : allOrders
        .map((o) => ({ ...o, order_items: (o.order_items ?? []).filter((i) => productIds.has(i.product_id)) }))
        .filter((o) => o.order_items.length > 0)

  // Выдано = заказ получен в выбранный период.
  const handedOrders = orders.filter((o) => o.status === 'received' && inPeriod(o.received_at ?? o.created_at))
  const placedOrders = orders.filter((o) => inPeriod(o.created_at) && o.status !== 'cancelled' && o.status !== 'rejected')
  const cancelledInPeriod = orders.filter((o) => (o.status === 'cancelled' || o.status === 'rejected') && inPeriod(o.created_at)).length

  const handedByVariant = new Map<string, number>()
  const handedByProduct = new Map<string, number>()
  for (const order of handedOrders) {
    for (const item of order.order_items ?? []) {
      handedByVariant.set(item.variant_id, (handedByVariant.get(item.variant_id) ?? 0) + Number(item.qty))
      handedByProduct.set(item.product_id, (handedByProduct.get(item.product_id) ?? 0) + Number(item.qty))
    }
  }
  const handedQty = Array.from(handedByProduct.values()).reduce((s, n) => s + n, 0)

  const channel = { office: 0, post: 0, trip: 0 }
  for (const order of handedOrders) {
    if (order.delivery_type === 'post') channel.post += 1
    else if (order.is_remote) channel.trip += 1
    else channel.office += 1
  }

  const allVariants = products.flatMap((p) =>
    p.product_variants.filter((v) => v.is_active).map((v) => ({
      ...v,
      productId: p.id,
      productName: p.name,
      available: Math.max(0, Number(v.total_qty) - Number(v.reserved_qty)),
      limit: alertLimit(alerts?.get(v.id)),
    }))
  )
  const reservedNow  = allVariants.reduce((s, v) => s + Number(v.reserved_qty), 0)
  const availableNow = allVariants.reduce((s, v) => s + v.available, 0)

  const beacons = allVariants
    .filter((v) => v.available <= v.limit)
    .sort((a, b) => a.available - b.available || a.productName.localeCompare(b.productName, 'ru'))

  const topProducts = products
    .map((p) => ({ id: p.id, name: p.name, qty: handedByProduct.get(p.id) ?? 0 }))
    .filter((p) => p.qty > 0)
    .sort((a, b) => b.qty - a.qty)
    .slice(0, 10)
  const topMax = topProducts[0]?.qty ?? 0

  const stockRows = products
    .filter((p) => p.product_variants.some((v) => v.is_active))
    .map((p) => {
      const variants = allVariants.filter((v) => v.productId === p.id)
      return {
        id: p.id,
        name: p.name,
        isActive: p.is_active,
        handed: handedByProduct.get(p.id) ?? 0,
        total: variants.reduce((s, v) => s + Number(v.total_qty), 0),
        reserved: variants.reduce((s, v) => s + Number(v.reserved_qty), 0),
        available: variants.reduce((s, v) => s + v.available, 0),
        variants: variants.map((v) => ({
          id: v.id,
          label: [v.size || 'ONE SIZE', v.color].filter(Boolean).join(' · '),
          available: v.available,
          reserved: Number(v.reserved_qty),
          handed: handedByVariant.get(v.id) ?? 0,
          low: isLowStock(v.available, alerts?.get(v.id)) || v.available === 0,
        })),
      }
    })

  return (
    <AdminShell
      adminEmail={employee.email || user.email || 'admin'}
      title="Аналитика"
      subtitle={`Выдача и остатки · ${period.label.toLowerCase()}`}
      orderCount={allOrders.length}
      stockAlertCount={allVariants.filter((v) => isLowStock(v.available, alerts?.get(v.id))).length}
    >
      {/* ── Период ── */}
      <nav className="an-periods" aria-label="Период">
        {PERIODS.map((p) => (
          <Link
            key={p.key}
            href={hrefFor({ period: p.key })}
            className={`an-period${p.key === (period.key as PeriodKey) ? ' an-period-active' : ''}`}
          >
            {p.label}
          </Link>
        ))}
      </nav>

      {segmentsReady && (
        <nav className="an-periods" aria-label="Сегмент">
          {(['all', 'common', ...SEGMENTS] as SegmentFilter[]).map((key) => (
            <Link
              key={key}
              href={hrefFor({ segment: key })}
              className={`an-period${segment === key ? ' an-period-active' : ''}`}
            >
              {key === 'all' ? 'Все сегменты' : key === 'common' ? 'Общие' : SEGMENT_LABELS[key]}
            </Link>
          ))}
        </nav>
      )}

      {/* ── KPI ── */}
      <section className="dash-kpi-grid">
        <div className="dash-kpi dash-kpi-primary">
          <span>Выдано мерча</span>
          <b>{handedQty}</b>
          <small>{handedOrders.length} {decline(handedOrders.length, ['заказ', 'заказа', 'заказов'])} получено</small>
        </div>
        <div className="dash-kpi">
          <span>Оформлено заказов</span>
          <b>{placedOrders.length}</b>
          <small>
            {new Set(placedOrders.map((o) => o.employee_id)).size} сотрудников
            {cancelledInPeriod > 0 ? ` · отменено ${cancelledInPeriod}` : ''}
          </small>
        </div>
        <div className="dash-kpi">
          <span>Доступно на складе</span>
          <b>{availableNow}</b>
          <small>в резерве ещё {reservedNow} шт.</small>
        </div>
        <div className={`dash-kpi${beacons.length > 0 ? ' dash-kpi-danger' : ''}`}>
          <span>Маячки</span>
          <b>{beacons.length}</b>
          <small>{decline(beacons.length, ['вариант', 'варианта', 'вариантов'])} на исходе</small>
        </div>
      </section>

      <section className="dash-grid">
        {/* ── Маячки ── */}
        <div className="dash-card">
          <div className="dash-card-head">
            <h2 className="dash-card-title">Маячки — заканчивается</h2>
            <Link href="/admin/products" className="dash-card-link">Пороги — в складе →</Link>
          </div>
          {beacons.length === 0 ? (
            <p className="dash-empty-text">Все остатки выше порогов.</p>
          ) : (
            <div className="dash-stock-list">
              {beacons.slice(0, 12).map((v) => (
                <div key={v.id} className="dash-stock-row">
                  <div className={`dash-stock-mark${v.available === 0 ? ' an-mark-zero' : ''}`}>{v.available}</div>
                  <div>
                    <b>{v.productName}</b>
                    <span>
                      {[v.size || 'ONE SIZE', v.color].filter(Boolean).join(' · ')} ·{' '}
                      {v.available === 0 ? 'закончился' : `осталось ${v.available} шт.`} (порог {v.limit})
                    </span>
                  </div>
                </div>
              ))}
              {beacons.length > 12 && <p className="dash-empty-text">И ещё {beacons.length - 12}…</p>}
            </div>
          )}
        </div>

        {/* ── Выдано по товарам ── */}
        <div className="dash-card">
          <div className="dash-card-head">
            <h2 className="dash-card-title">Выдано по товарам, шт.</h2>
            <span className="dash-card-link">
              офис {channel.office} · почта {channel.post} · командировка {channel.trip}
            </span>
          </div>
          {topProducts.length === 0 ? (
            <p className="dash-empty-text">За период ничего не выдано.</p>
          ) : (
            <div className="an-bars" role="list">
              {topProducts.map((p) => (
                <div key={p.id} className="an-bar-row" role="listitem" title={`${p.name}: ${p.qty} шт.`}>
                  <span className="an-bar-label">{p.name}</span>
                  <span className="an-bar-track">
                    <span className="an-bar" style={{ width: `${Math.max(4, (p.qty / topMax) * 100)}%` }} />
                  </span>
                  <b className="an-bar-value">{p.qty}</b>
                </div>
              ))}
            </div>
          )}
        </div>
      </section>

      {/* ── Остатки по размерам ── */}
      <section className="dash-card">
        <div className="dash-card-head">
          <h2 className="dash-card-title">Остатки и выдача по размерам</h2>
          <span className="dash-card-link">выдано — за {period.label.toLowerCase()}</span>
        </div>
        <div className="an-table-wrap">
          <table className="an-table">
            <thead>
              <tr>
                <th>Товар</th>
                <th>Выдано</th>
                <th>Всего</th>
                <th>Резерв</th>
                <th>Доступно</th>
                <th>По вариантам (доступно / выдано)</th>
              </tr>
            </thead>
            <tbody>
              {stockRows.map((row) => (
                <tr key={row.id}>
                  <td>
                    <b>{row.name}</b>
                    {!row.isActive && <small className="an-muted"> · скрыт</small>}
                  </td>
                  <td>{row.handed}</td>
                  <td>{row.total}</td>
                  <td>{row.reserved}</td>
                  <td><b>{row.available}</b></td>
                  <td>
                    <div className="an-chips">
                      {row.variants.map((v) => (
                        <span
                          key={v.id}
                          className={`an-chip${v.low ? ' an-chip-low' : ''}`}
                          title={`${v.label}: доступно ${v.available}, в резерве ${v.reserved}, выдано ${v.handed}`}
                        >
                          {v.label} <b>{v.available}</b>
                          {v.handed > 0 && <small> / {v.handed}</small>}
                        </span>
                      ))}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </AdminShell>
  )
}
