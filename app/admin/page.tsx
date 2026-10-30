import AdminShell from '@/components/AdminShell'
import DeadlineEditor from '@/components/DeadlineEditor'
import { createClient } from '@/lib/supabase/server'
import { needsPasswordSetup } from '@/lib/auth'
import { redirect } from 'next/navigation'
import type { OrderStatus } from '@/lib/supabase/types'
import { ADMIN_STATUS_OPTIONS, orderStatusLabel, statusTone } from '@/lib/orderStatus'
import { formatTripRange, todayInTashkent } from '@/lib/trip'
import { alertLimit, DEFAULT_ALERT_QTY, loadAlertMap } from '@/lib/stockAlerts'

type TripTask = {
  id: string
  order_number: string
  full_name: string | null
  email: string | null
  pickup_status: string | null
  trip_from: string
  trip_to: string
}

type HoldTask = {
  id: string
  order_number: string
  full_name: string | null
  email: string | null
  pickup_status: string | null
  hold_until: string
}

/** Задача на дашборде: отдать мерч сотруднику до даты. */
type DeadlineTask = {
  id: string
  order_number: string
  name: string
  deadline: string
  detail: string
}

const DONE_PICKUP = ['handed_owner', 'handed_other', 'refused']

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
  full_name: string | null
  email: string | null
  department: string | null
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
  product_variants: AdminDashVariant[]
}

/** Устаревшие review/confirmed считаем вместе с «Заявкой». */
function statusBucket(status: OrderStatus): OrderStatus {
  return status === 'review' || status === 'confirmed' ? 'new' : status
}

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
        id, order_number, employee_id, status, full_name, email, department, created_at,
        order_items ( id, product_name, size, color, sku, qty )
      `)
      .order('created_at', { ascending: false }),

    supabase
      .from('products')
      .select(`
        id, name, is_active,
        product_variants ( id, size, color, sku, total_qty, reserved_qty, is_active )
      `)
      .order('created_at', { ascending: false }),
  ])

  const { data: settings } = await supabase
    .from('merch_settings')
    .select('handout_deadline, handout_place, handout_note')
    .eq('id', 1)
    .maybeSingle()

  // Командировочные заказы — задачи с дедлайном. До миграции 20261030000300_merch_business_trip.sql
  // колонок trip_* нет: запрос вернёт ошибку, и блок просто не покажется.
  const { data: tripRows } = await supabase
    .from('orders')
    .select('id, order_number, full_name, email, pickup_status, trip_from, trip_to')
    .not('trip_to', 'is', null)
    .not('status', 'in', '(received,cancelled,rejected)')
    .order('trip_to', { ascending: true })

  // Ручные резервы «до даты» (20261030000600_merch_segments_holds.sql) — те же задачи.
  const { data: holdRows } = await supabase
    .from('orders')
    .select('id, order_number, full_name, email, pickup_status, hold_until')
    .not('hold_until', 'is', null)
    .not('status', 'in', '(received,cancelled,rejected)')

  const tasks: DeadlineTask[] = [
    ...((tripRows ?? []) as TripTask[])
      .filter(t => !DONE_PICKUP.includes(t.pickup_status ?? ''))
      .map(t => ({
        id: t.id,
        order_number: t.order_number,
        name: t.full_name || t.email || 'сотруднику',
        deadline: t.trip_to,
        detail: `в Ташкенте ${formatTripRange(t.trip_from, t.trip_to)}`,
      })),
    ...((holdRows ?? []) as HoldTask[])
      .filter(t => !DONE_PICKUP.includes(t.pickup_status ?? ''))
      .map(t => ({
        id: t.id,
        order_number: t.order_number,
        name: t.full_name || t.email || 'сотруднику',
        deadline: t.hold_until,
        detail: 'ручной резерв',
      })),
  ].sort((a, b) => a.deadline.localeCompare(b.deadline))
  const today = todayInTashkent()

  const orders   = ((ordersData   ?? []) as unknown) as AdminDashOrder[]
  const products = ((productsData ?? []) as unknown) as AdminDashProduct[]

  const activeOrders = orders.filter(
    o => !['received', 'cancelled', 'rejected'].includes(o.status)
  )

  const weekAgo = new Date()
  weekAgo.setDate(weekAgo.getDate() - 7)
  const newThisWeek = orders.filter(o => new Date(o.created_at) >= weekAgo)

  const uniqueEmployees = new Set(orders.map(o => o.employee_id)).size

  // Маячки: у варианта может быть свой порог (20261030000500_merch_stock_alerts.sql), иначе 4 шт.
  const alerts = await loadAlertMap(supabase)
  const lowStockVariants = products.flatMap(product =>
    product.product_variants
      .filter(v => v.is_active)
      .map(v => ({
        productName:  product.name,
        sku:          v.sku,
        size:         v.size,
        color:        v.color,
        availableQty: Math.max(0, Number(v.total_qty) - Number(v.reserved_qty)),
        limit:        alertLimit(alerts?.get(v.id)),
      }))
      .filter(v => v.availableQty <= v.limit)
  )

  const statusCounters = ADMIN_STATUS_OPTIONS.map(status => ({
    status,
    label: orderStatusLabel(status),
    count: orders.filter(o => statusBucket(o.status) === status).length,
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
        <KpiCard tone="danger"   label="Позиций в дефиците"      value={String(lowStockVariants.length)} hint={alerts ? 'ниже порога маячка' : `≤ ${DEFAULT_ALERT_QTY} шт. доступно`} />
        <KpiCard tone="default"  label="Сотрудников с заказами"  value={String(uniqueEmployees)}         hint="уникальных получателей" />
      </section>

      {/* ── Дедлайн раздачи ── */}
      <section className="dash-card">
        <div className="dash-card-head">
          <h2 className="dash-card-title">Дедлайн раздачи</h2>
          <span className="dash-card-link">виден сотрудникам</span>
        </div>
        <DeadlineEditor
          handoutDeadline={settings?.handout_deadline ?? null}
          handoutPlace={settings?.handout_place ?? null}
          handoutNote={settings?.handout_note ?? null}
        />
      </section>

      {/* ── Задачи: командировки и ручные резервы ── */}
      {tasks.length > 0 && (
        <section className="dash-card">
          <div className="dash-card-head">
            <h2 className="dash-card-title">Задачи · выдать до даты</h2>
            <span className="dash-card-link">{tasks.length} к выдаче</span>
          </div>
          <div className="dash-recent-list">
            {tasks.map(task => {
              const due = getDueTag(task.deadline, today)
              return (
                <a
                  key={task.id}
                  href={`/admin/orders?q=${encodeURIComponent(task.order_number)}`}
                  className="dash-recent-row dash-task-row"
                >
                  <div>
                    <b>
                      Отдать мерч {task.name} до {formatTripRange(task.deadline, task.deadline)}
                    </b>
                    <span>#{task.order_number} · {task.detail}</span>
                  </div>
                  <span className={`dash-badge dash-badge-${due.tone}`}>{due.label}</span>
                </a>
              )
            })}
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
                <span className={`dash-status-dot dash-status-dot-${statusTone(item.status)}`} />
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
                  <span className={`dash-badge dash-badge-${statusTone(order.status)}`}>
                    {orderStatusLabel(order.status)}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Низкие остатки */}
        <div className="dash-card">
          <div className="dash-card-head">
            <h2 className="dash-card-title">Низкие остатки</h2>
            <a href="/admin/products" className="dash-card-link">В склад →</a>
          </div>
          <div className="dash-stock-list">
            {lowStockVariants.length === 0 ? (
              <p className="dash-empty-text">Критичных остатков нет.</p>
            ) : lowStockVariants.slice(0, 7).map((variant, index) => (
              <div key={`${variant.productName}-${variant.sku}-${index}`} className="dash-stock-row">
                <div className="dash-stock-mark">{variant.availableQty}</div>
                <div>
                  <b>{variant.productName}</b>
                  <span>{formatVariant(variant.size, variant.color)} · SKU: {variant.sku || '—'}</span>
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
                    {order.full_name || order.email || 'Сотрудник'} · {orderStatusLabel(order.status)}
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

/** Метка дедлайна командировочной задачи относительно сегодняшней даты (YYYY-MM-DD). */
function getDueTag(tripTo: string, today: string): { label: string; tone: 'red' | 'amber' | 'blue' } {
  const days = Math.round(
    (Date.parse(`${tripTo}T00:00:00Z`) - Date.parse(`${today}T00:00:00Z`)) / 86_400_000
  )
  if (days < 0)  return { label: 'Просрочено', tone: 'red' }
  if (days === 0) return { label: 'Сегодня', tone: 'red' }
  if (days <= 3) return { label: `Через ${days} дн.`, tone: 'amber' }
  return { label: `Через ${days} дн.`, tone: 'blue' }
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
