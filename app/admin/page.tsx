import AdminShell from '@/components/AdminShell'
import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import type { CSSProperties } from 'react'

type OrderStatus =
  | 'new'
  | 'review'
  | 'confirmed'
  | 'assembling'
  | 'shipped'
  | 'received'
  | 'cancelled'
  | 'rejected'

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

const statusLabels: Record<OrderStatus, string> = {
  new: 'Новый',
  review: 'На проверке',
  confirmed: 'Подтверждён',
  assembling: 'Собирается',
  shipped: 'Отправлен',
  received: 'Получен',
  cancelled: 'Отменён',
  rejected: 'Отклонён',
}

const statusOrder: OrderStatus[] = [
  'new',
  'review',
  'confirmed',
  'assembling',
  'shipped',
  'received',
  'cancelled',
  'rejected',
]

export default async function AdminDashboardPage() {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  const { data: employee } = await supabase
    .from('employees')
    .select('is_admin, email')
    .eq('id', user.id)
    .maybeSingle()

  if (!employee?.is_admin) {
    redirect('/catalog')
  }

  const [{ data: ordersData }, { data: productsData }] = await Promise.all([
    supabase
      .from('orders')
      .select(
        `
        id,
        order_number,
        employee_id,
        status,
        full_name,
        email,
        department,
        created_at,
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

    supabase
      .from('products')
      .select(
        `
        id,
        name,
        is_active,
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
      .order('created_at', { ascending: false }),
  ])

  const orders = ((ordersData ?? []) as unknown) as AdminDashOrder[]
  const products = ((productsData ?? []) as unknown) as AdminDashProduct[]

  const activeOrders = orders.filter(
    (order) => !['received', 'cancelled', 'rejected'].includes(order.status)
  )

  const weekAgo = new Date()
  weekAgo.setDate(weekAgo.getDate() - 7)

  const newThisWeek = orders.filter(
    (order) => new Date(order.created_at) >= weekAgo
  )

  const uniqueEmployees = new Set(orders.map((order) => order.employee_id)).size

  const lowStockVariants = products.flatMap((product) =>
    product.product_variants
      .filter((variant) => variant.is_active)
      .map((variant) => ({
        productName: product.name,
        sku: variant.sku,
        size: variant.size,
        color: variant.color,
        availableQty: Math.max(
          0,
          Number(variant.total_qty) - Number(variant.reserved_qty)
        ),
      }))
      .filter((variant) => variant.availableQty <= 4)
  )

  const statusCounters = statusOrder.map((status) => ({
    status,
    label: statusLabels[status],
    count: orders.filter((order) => order.status === status).length,
  }))

  const recentOrders = orders.slice(0, 6)
  const recentActivity = orders.slice(0, 7)

  return (
    <AdminShell
      adminEmail={employee.email || user.email || 'admin'}
      title="Сводка"
      subtitle="Админ-панель · merch.uzum.tech"
      orderCount={orders.length}
      stockAlertCount={lowStockVariants.length}
    >
      <section style={styles.kpiGrid}>
        <KpiCard
          tone="primary"
          label="Активных заказов"
          value={String(activeOrders.length)}
          hint={`из ${orders.length} всего`}
        />

        <KpiCard
          tone="default"
          label="Новые за неделю"
          value={String(newThisWeek.length)}
          hint="заявки за последние 7 дней"
        />

        <KpiCard
          tone="danger"
          label="Позиций в дефиците"
          value={String(lowStockVariants.length)}
          hint="≤ 4 шт. доступно"
        />

        <KpiCard
          tone="default"
          label="Сотрудников с заказами"
          value={String(uniqueEmployees)}
          hint="уникальных получателей"
        />
      </section>

      <section style={styles.dashboardGrid}>
        <section style={styles.card}>
          <div style={styles.cardHead}>
            <h2 style={styles.cardTitle}>По статусам</h2>
            <a href="/admin/orders" style={styles.cardLink}>
              Все заказы →
            </a>
          </div>

          <div style={styles.statusGrid}>
            {statusCounters.map((item) => (
              <div key={item.status} style={styles.statusTile}>
                <span style={getStatusDotStyle(item.status)} />
                <b>{item.count}</b>
                <small>{item.label}</small>
              </div>
            ))}
          </div>
        </section>

        <section style={styles.card}>
          <div style={styles.cardHead}>
            <h2 style={styles.cardTitle}>Свежие заказы</h2>
            <a href="/admin/orders" style={styles.cardLink}>
              Все →
            </a>
          </div>

          <div style={styles.recentList}>
            {recentOrders.length === 0 ? (
              <div style={styles.emptyText}>Заказов пока нет.</div>
            ) : (
              recentOrders.map((order) => (
                <div key={order.id} style={styles.recentRow}>
                  <div>
                    <b>#{order.order_number}</b>
                    <span>{order.full_name || order.email || 'Сотрудник'}</span>
                  </div>

                  <div style={styles.recentRight}>
                    <small>{formatRelativeDate(order.created_at)}</small>
                    <span style={getStatusBadgeStyle(order.status)}>
                      {statusLabels[order.status]}
                    </span>
                  </div>
                </div>
              ))
            )}
          </div>
        </section>

        <section style={styles.card}>
          <div style={styles.cardHead}>
            <h2 style={styles.cardTitle}>Низкие остатки</h2>
            <a href="/admin/products" style={styles.cardLink}>
              В склад →
            </a>
          </div>

          <div style={styles.stockList}>
            {lowStockVariants.length === 0 ? (
              <div style={styles.emptyText}>Критичных остатков нет.</div>
            ) : (
              lowStockVariants.slice(0, 7).map((variant, index) => (
                <div
                  key={`${variant.productName}-${variant.sku}-${index}`}
                  style={styles.stockRow}
                >
                  <div style={styles.stockMark}>{variant.availableQty}</div>

                  <div>
                    <b>{variant.productName}</b>
                    <span>
                      {formatVariant(variant.size, variant.color)} · SKU:{' '}
                      {variant.sku || '—'}
                    </span>
                  </div>
                </div>
              ))
            )}
          </div>
        </section>

        <section style={styles.card}>
          <div style={styles.cardHead}>
            <h2 style={styles.cardTitle}>Журнал действий</h2>
            <span style={styles.cardLink}>CSV</span>
          </div>

          <div style={styles.activityList}>
            {recentActivity.length === 0 ? (
              <div style={styles.emptyText}>Активности пока нет.</div>
            ) : (
              recentActivity.map((order) => (
                <div key={order.id} style={styles.activityRow}>
                  <span style={styles.activityDot} />

                  <div>
                    <b>Создан заказ #{order.order_number}</b>
                    <span>
                      {order.full_name || order.email || 'Сотрудник'} ·{' '}
                      {statusLabels[order.status]}
                    </span>
                  </div>

                  <small>{formatRelativeDate(order.created_at)}</small>
                </div>
              ))
            )}
          </div>
        </section>
      </section>
    </AdminShell>
  )
}

function KpiCard({
  label,
  value,
  hint,
  tone,
}: {
  label: string
  value: string
  hint: string
  tone: 'primary' | 'danger' | 'default'
}) {
  return (
    <div
      style={{
        ...styles.kpiCard,
        ...(tone === 'primary' ? styles.kpiCardPrimary : {}),
        ...(tone === 'danger' ? styles.kpiCardDanger : {}),
      }}
    >
      <span>{label}</span>
      <b>{value}</b>
      <small>{hint}</small>
    </div>
  )
}

function formatVariant(size: string | null, color: string | null) {
  return [color || 'Без цвета', size || 'ONE SIZE'].join(' · ')
}

function formatRelativeDate(value: string) {
  const date = new Date(value)
  const now = new Date()
  const diffMs = now.getTime() - date.getTime()
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24))

  if (diffDays <= 0) {
    return 'сегодня'
  }

  if (diffDays === 1) {
    return 'вчера'
  }

  if (diffDays < 7) {
    return `${diffDays} дн. назад`
  }

  return date.toLocaleDateString('ru-RU', {
    timeZone: 'Asia/Tashkent',
    day: 'numeric',
    month: 'short',
  })
}

function getStatusDotStyle(status: OrderStatus): CSSProperties {
  const color =
    status === 'new' || status === 'review'
      ? '#d97706'
      : status === 'confirmed' || status === 'assembling'
        ? '#3b82f6'
        : status === 'shipped' || status === 'received'
          ? '#22c55e'
          : '#ef4444'

  return {
    width: '8px',
    height: '8px',
    borderRadius: '50%',
    background: color,
  }
}

function getStatusBadgeStyle(status: OrderStatus): CSSProperties {
  const base: CSSProperties = {
    borderRadius: '999px',
    padding: '5px 9px',
    fontSize: '12px',
    fontWeight: 900,
    whiteSpace: 'nowrap',
  }

  if (status === 'shipped' || status === 'received') {
    return {
      ...base,
      background: '#dcfce7',
      color: '#166534',
    }
  }

  if (status === 'confirmed' || status === 'assembling') {
    return {
      ...base,
      background: '#dbeafe',
      color: '#1d4ed8',
    }
  }

  if (status === 'cancelled' || status === 'rejected') {
    return {
      ...base,
      background: '#fee2e2',
      color: '#dc2626',
    }
  }

  return {
    ...base,
    background: '#fef3c7',
    color: '#92400e',
  }
}

const styles: Record<string, CSSProperties> = {
  kpiGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(4, minmax(0, 1fr))',
    gap: '16px',
    marginBottom: '24px',
  },
  kpiCard: {
    minHeight: '144px',
    borderRadius: '16px',
    background: '#ffffff',
    border: '1px solid var(--border)',
    padding: '22px',
    display: 'flex',
    flexDirection: 'column',
    justifyContent: 'space-between',
    boxShadow: 'var(--shadow-soft)',
    color: 'var(--inkMute)',
  },
  kpiCardPrimary: {
    background: 'linear-gradient(135deg, #7000ff 0%, #8a00ff 100%)',
    color: '#ffffff',
    boxShadow: '0 24px 50px rgba(112, 0, 255, 0.26)',
  },
  kpiCardDanger: {
    background: '#ffe7f7',
    borderColor: '#ffc4eb',
  },
  dashboardGrid: {
    display: 'grid',
    gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 1fr)',
    gap: '18px',
  },
  card: {
    minHeight: '300px',
    background: '#ffffff',
    border: '1px solid var(--border)',
    borderRadius: '16px',
    padding: '24px',
    boxShadow: 'var(--shadow-soft)',
  },
  cardHead: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: '16px',
    marginBottom: '18px',
  },
  cardTitle: {
    margin: 0,
    fontFamily: 'var(--font-display)',
    color: 'var(--ink)',
    fontSize: '20px',
    fontWeight: 700,
    letterSpacing: '-0.02em',
  },
  cardLink: {
    color: 'var(--inkMute)',
    fontSize: '14px',
    fontWeight: 800,
  },
  statusGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(3, minmax(0, 1fr))',
    gap: '10px',
  },
  statusTile: {
    minHeight: '98px',
    borderRadius: '12px',
    background: '#f1ebff',
    padding: '14px 16px',
    display: 'flex',
    flexDirection: 'column',
    gap: '8px',
    color: 'var(--inkMute)',
  },
  recentList: {
    display: 'flex',
    flexDirection: 'column',
    gap: '16px',
  },
  recentRow: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: '14px',
    color: 'var(--ink)',
  },
  recentRight: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
  },
  stockList: {
    display: 'flex',
    flexDirection: 'column',
    gap: '12px',
  },
  stockRow: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
    padding: '12px',
    borderRadius: '12px',
    background: '#fbfaff',
    border: '1px solid var(--border)',
  },
  stockMark: {
    width: '40px',
    height: '40px',
    borderRadius: '12px',
    background: '#ffe7f7',
    color: '#be185d',
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontWeight: 900,
    flex: '0 0 auto',
  },
  activityList: {
    display: 'flex',
    flexDirection: 'column',
    gap: '14px',
  },
  activityRow: {
    display: 'grid',
    gridTemplateColumns: '10px minmax(0, 1fr) auto',
    gap: '12px',
    alignItems: 'start',
    color: 'var(--ink)',
  },
  activityDot: {
    width: '8px',
    height: '8px',
    borderRadius: '50%',
    background: 'var(--accent)',
    marginTop: '7px',
  },
  emptyText: {
    color: 'var(--inkMute)',
    fontSize: '14px',
    fontWeight: 700,
  },
}