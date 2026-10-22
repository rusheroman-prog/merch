import AdminShell from '@/components/AdminShell'
import MerchSettingsEditor from '@/components/MerchSettingsEditor'
import { createClient } from '@/lib/supabase/server'
import { needsPasswordSetup } from '@/lib/auth'
import { getLowStockVariants } from '@/lib/stock'
import { getStatusFilterLabel, getStatusLabel, getStatusTone, isClosed } from '@/lib/orderStatus'
import type { OrderStatus } from '@/lib/supabase/types'
import { redirect } from 'next/navigation'

type AdminDashOrderItem = {
  id: string
  product_name: string
  size: string | null
  color: string | null
  sku: string | null
  qty: number
}

type AdminDashOrder = {
  id: string
  order_number: string
  employee_id: string
  status: OrderStatus
  delivery_type: string
  full_name: string | null
  email: string | null
  department: string | null
  trip_until: string | null
  created_at: string
  order_items: AdminDashOrderItem[]
}

type AdminDashVariant = {
  id: string
  size: string | null
  color: string | null
  sku: string | null
  total_qty: number
  reserved_qty: number
  is_active: boolean
}

type AdminDashProduct = {
  id: string
  name: string
  is_active: boolean
  archived_at: string | null
  low_stock_threshold: number | null
  product_variants: AdminDashVariant[]
}

const statusOrder: OrderStatus[] = [
  'new', 'assembling', 'ready', 'shipped', 'received', 'cancelled', 'rejected',
]

export default async function AdminDashboardPage() {
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

  const [{ data: ordersData }, { data: productsData }] = await Promise.all([
    supabase
      .from('orders')
      .select(`
        id, order_number, employee_id, status, delivery_type, full_name, email, department, trip_until, created_at,
        order_items ( id, product_name, size, color, sku, qty )
      `)
      .order('created_at', { ascending: false }),

    supabase
      .from('products')
      .select(`
        id, name, is_active, archived_at, low_stock_threshold,
        product_variants ( id, size, color, sku, total_qty, reserved_qty, is_active )
      `)
      .order('created_at', { ascending: false }),
  ])

  const { data: settings } = await supabase
    .from('merch_settings')
    .select('handout_deadline, handout_place, handout_note, order_window_start, max_items_per_employee, support_label, support_url')
    .eq('id', 1)
    .maybeSingle()

  const orders   = ((ordersData   ?? []) as unknown) as AdminDashOrder[]
  const products = ((productsData ?? []) as unknown) as AdminDashProduct[]

  const activeOrders = orders.filter(o => !isClosed(o.status))

  // Remote workers on a business trip: merch must be handed out by trip_until.
  const deadlineTasks = activeOrders
    .filter(o => o.trip_until)
    .sort((a, b) => String(a.trip_until).localeCompare(String(b.trip_until)))

  const weekAgo = new Date()
  weekAgo.setDate(weekAgo.getDate() - 7)
  const newThisWeek = orders.filter(o => new Date(o.created_at) >= weekAgo)

  // "Beacons": each product has its own threshold, archived/hidden ones are skipped.
  const lowStockVariants = getLowStockVariants(products)
    .map(({ product, variant, availableQty, threshold }) => ({
      productName:  product.name,
      sku:          variant.sku,
      size:         variant.size,
      color:        variant.color,
      availableQty,
      threshold,
    }))
    .sort((a, b) => a.availableQty - b.availableQty)

  const legacyStatuses = (['review', 'confirmed'] as OrderStatus[])
    .filter(status => orders.some(o => o.status === status))

  const statusCounters = [...statusOrder, ...legacyStatuses].map(status => ({
    status,
    label: getStatusFilterLabel(status),
    count: orders.filter(o => o.status === status).length,
  }))

  const recentOrders   = orders.slice(0, 6)
  const recentActivity = orders.slice(0, 7)

  return (
    <AdminShell
      adminEmail={employee.email || user.email || 'admin'}
      title="Сводка"
      subtitle="Админ-панель · merch.uzum.tech"
      orderCount={orders.length}
      stockAlertCount={lowStockVariants.length}
    >
      {/* ── KPI row ── */}
      <section className="dash-kpi-grid">
        <KpiCard tone="primary"  label="Активных заказов"        value={String(activeOrders.length)}     hint={`из ${orders.length} всего`} />
        <KpiCard tone="default"  label="Новые за неделю"         value={String(newThisWeek.length)}      hint="заявки за последние 7 дней" />
        <KpiCard tone={deadlineTasks.length > 0 ? 'danger' : 'default'} label="Задачи с дедлайном" value={String(deadlineTasks.length)} hint="выдать до конца командировки" />
        <KpiCard tone="danger"   label="Сработали маячки"        value={String(lowStockVariants.length)} hint="вариантов на пороге остатка" />

      </section>

      {/* ── Настройки раздачи ── */}
      <section className="dash-card">
        <div className="dash-card-head">
          <h2 className="dash-card-title">Настройки раздачи</h2>
          <span className="dash-card-link">видны сотрудникам</span>
        </div>
        <MerchSettingsEditor
          handoutDeadline={settings?.handout_deadline ?? null}
          handoutPlace={settings?.handout_place ?? null}
          handoutNote={settings?.handout_note ?? null}
          orderWindowStart={settings?.order_window_start ?? null}
          maxItemsPerEmployee={Number(settings?.max_items_per_employee ?? 3)}
          supportLabel={settings?.support_label ?? null}
          supportUrl={settings?.support_url ?? null}
        />
      </section>

      {/* ── Задачи с дедлайном (командировки) ── */}
      {deadlineTasks.length > 0 && (
        <section className="dash-card">
          <div className="dash-card-head">
            <h2 className="dash-card-title">Выдать до дедлайна</h2>
            <a href="/admin/handout" className="dash-card-link">Выдача →</a>
          </div>
          <div className="dash-recent-list">
            {deadlineTasks.slice(0, 8).map(order => (
              <a
                key={order.id}
                href={`/admin/orders?q=${encodeURIComponent(order.order_number)}`}
                className="dash-recent-row dash-task-row"
              >
                <div>
                  <b>#{order.order_number} · {order.full_name || order.email || 'Сотрудник'}</b>
                  <span>
                    Командировка в Ташкент · {getStatusLabel(order.status, order.delivery_type, 'admin')}
                  </span>
                </div>
                <span className={`dash-deadline${isOverdue(order.trip_until) ? ' dash-deadline-overdue' : ''}`}>
                  до {formatDay(order.trip_until)}
                </span>
              </a>
            ))}
          </div>
        </section>
      )}

      {/* ── Dashboard 2×2 ── */}
      <section className="dash-grid">

        {/* По статусам */}
        <div className="dash-card">
          <div className="dash-card-head">
            <h2 className="dash-card-title">По статусам</h2>
            <a href="/admin/orders" className="dash-card-link">Все заказы →</a>
          </div>
          <div className="dash-status-grid">
            {statusCounters.map(item => (
              <div key={item.status} className="dash-status-tile">
                <span className={`dash-status-dot ${getStatusDotClass(item.status)}`} />
                <b>{item.count}</b>
                <small>{item.label}</small>
              </div>
            ))}
          </div>
        </div>

        {/* Свежие заказы */}
        <div className="dash-card">
          <div className="dash-card-head">
            <h2 className="dash-card-title">Свежие заказы</h2>
            <a href="/admin/orders" className="dash-card-link">Все →</a>
          </div>
          <div className="dash-recent-list">
            {recentOrders.length === 0 ? (
              <p className="dash-empty-text">Заказов пока нет.</p>
            ) : recentOrders.map(order => (
              <div key={order.id} className="dash-recent-row">
                <div>
                  <b>#{order.order_number}</b>
                  <span>{order.full_name || order.email || 'Сотрудник'}</span>
                </div>
                <div className="dash-recent-right">
                  <small>{formatRelativeDate(order.created_at)}</small>
                  <span className={getStatusBadgeClass(order.status)}>
                    {getStatusLabel(order.status, order.delivery_type, 'admin')}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Низкие остатки */}
        <div className="dash-card">
          <div className="dash-card-head">
            <h2 className="dash-card-title">Маячки остатков</h2>
            <a href="/admin/products" className="dash-card-link">В склад →</a>
          </div>
          <div className="dash-stock-list">
            {lowStockVariants.length === 0 ? (
              <p className="dash-empty-text">Все остатки выше порога.</p>
            ) : lowStockVariants.slice(0, 7).map((variant, index) => (
              <div key={`${variant.productName}-${variant.sku}-${index}`} className="dash-stock-row">
                <div className="dash-stock-mark">{variant.availableQty}</div>
                <div>
                  <b>{variant.productName}</b>
                  <span>
                    {formatVariant(variant.size, variant.color)} · SKU: {variant.sku || '—'} · порог {variant.threshold} шт.
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Журнал */}
        <div className="dash-card">
          <div className="dash-card-head">
            <h2 className="dash-card-title">Журнал действий</h2>
            <span className="dash-card-link">CSV</span>
          </div>
          <div className="dash-activity-list">
            {recentActivity.length === 0 ? (
              <p className="dash-empty-text">Активности пока нет.</p>
            ) : recentActivity.map(order => (
              <div key={order.id} className="dash-activity-row">
                <span className="dash-activity-dot" />
                <div>
                  <b>Создан заказ #{order.order_number}</b>
                  <span>
                    {order.full_name || order.email || 'Сотрудник'} · {getStatusLabel(order.status, order.delivery_type, 'admin')}
                  </span>
                </div>
                <small>{formatRelativeDate(order.created_at)}</small>
              </div>
            ))}
          </div>
        </div>

      </section>
    </AdminShell>
  )
}

/* ─────────────────────────────────────────────────────────────────────────── */
/*  KpiCard                                                                     */
/* ─────────────────────────────────────────────────────────────────────────── */

function KpiCard({
  label, value, hint, tone,
}: {
  label: string
  value: string
  hint: string
  tone: 'primary' | 'danger' | 'default'
}) {
  const cls =
    tone === 'primary' ? 'dash-kpi dash-kpi-primary' :
    tone === 'danger'  ? 'dash-kpi dash-kpi-danger'  : 'dash-kpi'
  return (
    <div className={cls}>
      <span>{label}</span>
      <b>{value}</b>
      <small>{hint}</small>
    </div>
  )
}

/* ─────────────────────────────────────────────────────────────────────────── */
/*  Helpers                                                                     */
/* ─────────────────────────────────────────────────────────────────────────── */

function getStatusDotClass(status: OrderStatus) {
  return `dash-status-dot-${getStatusTone(status)}`
}

function getStatusBadgeClass(status: OrderStatus) {
  return `dash-badge dash-badge-${getStatusTone(status)}`
}

function formatDay(value: string | null) {
  if (!value) return '—'
  return new Date(`${value.slice(0, 10)}T00:00:00`).toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' })
}

function isOverdue(value: string | null) {
  if (!value) return false
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  return new Date(`${value.slice(0, 10)}T00:00:00`) < today
}

function formatVariant(size: string | null, color: string | null) {
  return [color || 'Без цвета', size || 'ONE SIZE'].join(' · ')
}

function formatRelativeDate(value: string) {
  const date    = new Date(value)
  const diffMs  = Date.now() - date.getTime()
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24))

  if (diffDays <= 0) return 'сегодня'
  if (diffDays === 1) return 'вчера'
  if (diffDays < 7)   return `${diffDays} дн. назад`

  return date.toLocaleDateString('ru-RU', {
    timeZone: 'Asia/Tashkent',
    day:   'numeric',
    month: 'short',
  })
}
