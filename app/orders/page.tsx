import AppNav from '@/components/AppNav'
import Link from 'next/link'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
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

type DeliveryType = 'office' | 'pvz' | 'pickup' | 'courier'

type OrderItem = {
  id: string
  product_id?: string | null
  product_name: string
  size: string | null
  color: string | null
  sku: string | null
  qty: number
}

type Order = {
  id: string
  order_number: string
  status: OrderStatus
  delivery_type: DeliveryType
  delivery_address: string | null
  full_name: string | null
  phone: string | null
  email: string | null
  city: string | null
  department: string | null
  comment: string | null
  admin_comment: string | null
  tracking_number: string | null
  created_at: string
  confirmed_at: string | null
  shipped_at: string | null
  received_at: string | null
  cancelled_at: string | null
  order_items: OrderItem[]
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

const deliveryLabels: Record<DeliveryType, string> = {
  office: 'В офис',
  pvz: 'ПВЗ / филиал',
  pickup: 'Самовывоз',
  courier: 'Курьер',
}

const flowStatuses: OrderStatus[] = [
  'new',
  'review',
  'confirmed',
  'assembling',
  'shipped',
  'received',
]

export default async function OrdersPage() {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  const { data: employee } = await supabase
    .from('employees')
    .select('is_admin')
    .eq('id', user.id)
    .maybeSingle()

  const { data, error } = await supabase
    .from('orders')
    .select(
      `
      id,
      order_number,
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
      created_at,
      confirmed_at,
      shipped_at,
      received_at,
      cancelled_at,
      order_items (
        id,
        product_id,
        product_name,
        size,
        color,
        sku,
        qty
      )
    `
    )
    .eq('employee_id', user.id)
    .order('created_at', { ascending: false })

  if (error) {
    return (
      <main style={styles.page}>
        <SiteHeader isAdmin={Boolean(employee?.is_admin)} />

        <section style={styles.errorCard}>
          <div style={styles.emptyMark}>!</div>
          <h1 style={styles.emptyTitle}>Не удалось загрузить заказы</h1>
          <p style={styles.emptyText}>{error.message}</p>

          <Link href="/catalog" style={styles.primaryLink}>
            Вернуться в каталог
          </Link>
        </section>
      </main>
    )
  }

  const orders = ((data ?? []) as unknown) as Order[]

  const activeOrders = orders.filter(
    (order) => !['received', 'cancelled', 'rejected'].includes(order.status)
  ).length

  const completedOrders = orders.filter(
    (order) => order.status === 'received'
  ).length

  return (
    <main style={styles.page}>
      <SiteHeader isAdmin={Boolean(employee?.is_admin)} />

      <section style={styles.orders}>
        <header style={styles.ordersHead}>
          <div>
            <div style={styles.kicker}>Мои заказы</div>

            <h1 style={styles.display}>История и статусы</h1>

            <p style={styles.lead}>
              Здесь отображаются ваши заявки на корпоративный мерч, текущий
              статус обработки и детали получения.
            </p>
          </div>

          <Link href="/catalog" style={styles.ghostButton}>
            ← В каталог
          </Link>
        </header>

        <section style={styles.statRow}>
          <StatCard label="Всего заказов" value={String(orders.length)} />
          <StatCard label="В работе" value={String(activeOrders)} />
          <StatCard label="Получено" value={String(completedOrders)} />
        </section>

        {orders.length === 0 ? (
          <section style={styles.emptyCard}>
            <div style={styles.emptyMark}>+</div>

            <h2 style={styles.emptyTitle}>Заказов пока нет</h2>

            <p style={styles.emptyText}>
              Перейдите в каталог, выберите мерч и оформите первую заявку.
            </p>

            <Link href="/catalog" style={styles.primaryLink}>
              Перейти в каталог
            </Link>
          </section>
        ) : (
          <section style={styles.ordersList}>
            {orders.map((order) => (
              <OrderCard key={order.id} order={order} />
            ))}
          </section>
        )}
      </section>
    </main>
  )
}

function SiteHeader({ isAdmin }: { isAdmin: boolean }) {
  return (
    <header style={styles.siteHead}>
      <div style={styles.headInner}>
        <Link href="/catalog" style={styles.brand}>
          <img src="/brand/uzum-logo.svg" alt="Uzum" style={styles.logo} />

          <span style={styles.brandName}>
            uzum <span style={styles.brandNameSoft}>мерч</span>
          </span>

          <span style={styles.brandSub}>внутренний портал</span>
        </Link>

        <AppNav isAdmin={isAdmin} />
      </div>
    </header>
  )
}

function OrderCard({ order }: { order: Order }) {
  const items = order.order_items ?? []
  const totalQty = items.reduce((sum, item) => sum + Number(item.qty), 0)

  const isRejected = order.status === 'cancelled' || order.status === 'rejected'
  const isReceived = order.status === 'received'

  return (
    <article style={styles.order}>
      <div style={styles.orderTop}>
        <div style={styles.orderMeta}>
          <span style={styles.orderId}>#{order.order_number}</span>
          <span style={styles.orderDate}>Оформлен {formatDateShort(order.created_at)}</span>
          {order.tracking_number && (
            <span style={styles.orderTrack}>Трек: {order.tracking_number}</span>
          )}
        </div>

        <span style={getStatusStyle(order.status)}>
          {statusLabels[order.status]}
        </span>
      </div>

      <div style={styles.orderMid}>
        <div style={styles.orderThumbs}>
          {items.slice(0, 4).map((item, index) => (
            <div key={item.id} style={getThumbStyle(index)}>
              {getProductLetter(item.product_name)}
            </div>
          ))}
        </div>

        <div style={styles.orderItems}>
          {items.map((item) => (
            <div key={item.id} style={styles.orderItem}>
              <b>{item.product_name}</b>
              <span>
                {formatVariant(item)} · {item.qty} шт.
              </span>
            </div>
          ))}
        </div>

        <div style={styles.orderSide}>
          <span style={styles.kicker}>
            {isReceived ? 'Получено' : 'Получение'}
          </span>

          <p style={styles.orderSideMain}>
            {isReceived && order.received_at
              ? formatDateShort(order.received_at)
              : deliveryLabels[order.delivery_type]}
          </p>

          <p style={styles.orderSideMute}>
            {order.delivery_address || 'Адрес не указан'}
          </p>
        </div>
      </div>

      <div style={styles.timeline}>
        {isRejected ? (
          <div style={styles.finalStatusBox}>
            {order.status === 'cancelled'
              ? 'Заказ был отменён.'
              : 'Заказ был отклонён.'}
          </div>
        ) : (
          flowStatuses.map((status) => {
            const stepIndex = getStepIndex(status)
            const currentIndex = getStepIndex(order.status)
            const isDone = stepIndex < currentIndex
            const isCurrent = stepIndex === currentIndex

            return (
              <div
                key={status}
                style={{
                  ...styles.timelineStep,
                  ...(isDone ? styles.timelineStepDone : {}),
                  ...(isCurrent ? styles.timelineStepCurrent : {}),
                }}
              >
                <span
                  style={{
                    ...styles.timelineDot,
                    ...(isDone ? styles.timelineDotDone : {}),
                    ...(isCurrent ? styles.timelineDotCurrent : {}),
                  }}
                />

                <span style={styles.timelineText}>
                  {getFlowLabel(status)}
                </span>
              </div>
            )
          })
        )}
      </div>

      {(order.comment || order.admin_comment) && (
        <div style={styles.comments}>
          {order.comment && (
            <div style={styles.commentBox}>
              <span>Ваш комментарий</span>
              <p>{order.comment}</p>
            </div>
          )}

          {order.admin_comment && (
            <div style={styles.adminCommentBox}>
              <span>Комментарий администратора</span>
              <p>{order.admin_comment}</p>
            </div>
          )}
        </div>
      )}

      <div style={styles.orderFoot}>
        <div style={styles.orderFootInfo}>
          <span>{totalQty} шт.</span>
          <span>·</span>
          <span>{items.length} {decline(items.length, ['позиция', 'позиции', 'позиций'])}</span>
        </div>

        <div style={styles.orderActions}>
          {order.tracking_number && (
            <span style={styles.linkLike}>Трек-номер указан</span>
          )}

          {isReceived && <span style={styles.linkLike}>Заказ завершён</span>}

          {!isReceived && !isRejected && (
            <span style={styles.linkLike}>Статус обновляется администратором</span>
          )}
        </div>
      </div>
    </article>
  )
}

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <div style={styles.statCard}>
      <span>{label}</span>
      <b>{value}</b>
    </div>
  )
}

function formatVariant(item: OrderItem) {
  const size = item.size || 'ONE SIZE'
  const color = item.color || 'Без цвета'

  return [color, size].filter(Boolean).join(' · ')
}

function formatDateShort(value: string) {
  const date = new Date(value)

  return date.toLocaleDateString('ru-RU', {
    timeZone: 'Asia/Tashkent',
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  })
}

function getStepIndex(status: OrderStatus) {
  const index = flowStatuses.indexOf(status)

  return index >= 0 ? index : 0
}

function getFlowLabel(status: OrderStatus) {
  if (status === 'new') return 'Заявка'
  if (status === 'review') return 'Проверка'
  if (status === 'confirmed') return 'Подтверждение'
  if (status === 'assembling') return 'Сборка'
  if (status === 'shipped') return 'Отправка'
  if (status === 'received') return 'Получение'

  return statusLabels[status]
}

function getProductLetter(name: string) {
  return name.trim()[0]?.toUpperCase() ?? 'U'
}

function getThumbStyle(index: number): CSSProperties {
  const backgrounds = [
    'linear-gradient(135deg, #f1ebff 0%, #ffffff 100%)',
    'linear-gradient(135deg, #ffe7f7 0%, #ffffff 100%)',
    'linear-gradient(135deg, #e7f8ff 0%, #ffffff 100%)',
    'linear-gradient(135deg, #fff4dd 0%, #ffffff 100%)',
  ]

  return {
    width: '64px',
    height: '64px',
    borderRadius: 'var(--r-sm)',
    background: backgrounds[index % backgrounds.length],
    border: '1px solid var(--border)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    color: 'var(--accent)',
    fontFamily: 'var(--font-display)',
    fontSize: '24px',
    fontWeight: 800,
    flex: '0 0 auto',
  }
}

function getStatusStyle(status: OrderStatus): CSSProperties {
  const base: CSSProperties = {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 'var(--r-pill)',
    padding: '8px 12px',
    fontSize: '13px',
    fontWeight: 800,
    whiteSpace: 'nowrap',
  }

  if (status === 'new' || status === 'review') {
    return {
      ...base,
      background: '#fff7dd',
      color: '#92400e',
    }
  }

  if (status === 'confirmed' || status === 'assembling') {
    return {
      ...base,
      background: '#e8f1ff',
      color: '#1e40af',
    }
  }

  if (status === 'shipped' || status === 'received') {
    return {
      ...base,
      background: '#dcfce7',
      color: '#166534',
    }
  }

  return {
    ...base,
    background: '#fee2e2',
    color: '#991b1b',
  }
}

function decline(count: number, words: [string, string, string]) {
  const abs = Math.abs(count) % 100
  const last = abs % 10

  if (abs > 10 && abs < 20) {
    return words[2]
  }

  if (last > 1 && last < 5) {
    return words[1]
  }

  if (last === 1) {
    return words[0]
  }

  return words[2]
}

const styles: Record<string, CSSProperties> = {
  page: {
    minHeight: '100vh',
    background: 'var(--bg)',
  },

  siteHead: {
    position: 'sticky',
    top: 0,
    zIndex: 50,
    background: 'rgba(255,255,255,0.86)',
    backdropFilter: 'blur(14px) saturate(140%)',
    borderBottom: '1px solid var(--border)',
  },
  headInner: {
    maxWidth: '1320px',
    margin: '0 auto',
    padding: '14px 48px',
    display: 'grid',
    gridTemplateColumns: 'auto 1fr',
    gap: '24px',
    alignItems: 'center',
  },
  brand: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '12px',
    color: 'var(--ink)',
  },
  logo: {
    width: '32px',
    height: '32px',
    objectFit: 'contain',
  },
  brandName: {
    fontFamily: 'var(--font-display)',
    fontWeight: 700,
    fontSize: '20px',
    letterSpacing: '-0.02em',
    lineHeight: 1,
    whiteSpace: 'nowrap',
  },
  brandNameSoft: {
    color: 'var(--inkMute)',
    fontWeight: 500,
  },
  brandSub: {
    color: 'var(--inkMute)',
    fontSize: '12px',
    borderLeft: '1px solid var(--border)',
    paddingLeft: '10px',
    marginLeft: '2px',
    whiteSpace: 'nowrap',
  },

  orders: {
    maxWidth: '1320px',
    margin: '0 auto',
    padding: '56px 48px 64px',
  },
  ordersHead: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: '24px',
    marginBottom: '22px',
  },
  kicker: {
    fontSize: '11px',
    fontWeight: 700,
    letterSpacing: '0.12em',
    textTransform: 'uppercase',
    color: 'var(--inkMute)',
    display: 'inline-block',
  },
  display: {
    fontFamily: 'var(--font-display)',
    fontWeight: 700,
    fontSize: 'clamp(40px, 5vw, 68px)',
    lineHeight: 1.02,
    letterSpacing: '-0.025em',
    margin: '10px 0 14px',
    color: 'var(--ink)',
  },
  lead: {
    fontSize: '17px',
    color: 'var(--inkMute)',
    maxWidth: '66ch',
    margin: 0,
    lineHeight: 1.55,
  },
  ghostButton: {
    border: '1px solid var(--border)',
    background: 'var(--surface)',
    color: 'var(--ink)',
    borderRadius: 'var(--r-pill)',
    padding: '12px 18px',
    fontWeight: 800,
    cursor: 'pointer',
    whiteSpace: 'nowrap',
  },
  primaryLink: {
    minHeight: '44px',
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 'var(--r-pill)',
    padding: '0 16px',
    background: 'var(--accent)',
    color: 'var(--accentInk)',
    fontWeight: 800,
    textDecoration: 'none',
    marginTop: '16px',
  },

  statRow: {
    display: 'grid',
    gridTemplateColumns: 'repeat(3, minmax(0, 1fr))',
    gap: '14px',
    marginBottom: '24px',
  },
  statCard: {
    background: 'var(--surface)',
    border: '1px solid var(--border)',
    borderRadius: 'var(--r-card)',
    padding: '18px',
    boxShadow: 'var(--shadow-soft)',
    display: 'flex',
    flexDirection: 'column',
    gap: '6px',
    color: 'var(--inkMute)',
    fontSize: '13px',
    fontWeight: 700,
  },

  ordersList: {
    display: 'flex',
    flexDirection: 'column',
    gap: '16px',
  },
  order: {
    background: 'var(--surface)',
    border: '1px solid var(--border)',
    borderRadius: 'var(--r-card)',
    padding: '24px 28px',
    display: 'flex',
    flexDirection: 'column',
    gap: '16px',
    boxShadow: 'var(--shadow-card)',
  },
  orderTop: {
    display: 'flex',
    justifyContent: 'space-between',
    gap: '18px',
    alignItems: 'center',
  },
  orderMeta: {
    display: 'flex',
    gap: '16px',
    alignItems: 'baseline',
    flexWrap: 'wrap',
  },
  orderId: {
    fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace',
    fontSize: '13px',
    color: 'var(--ink)',
    fontWeight: 700,
  },
  orderDate: {
    fontSize: '13px',
    color: 'var(--inkMute)',
    fontWeight: 700,
  },
  orderTrack: {
    fontSize: '13px',
    color: 'var(--accent)',
    background: 'var(--chip)',
    borderRadius: 'var(--r-pill)',
    padding: '5px 9px',
    fontWeight: 800,
  },
  orderMid: {
    display: 'grid',
    gridTemplateColumns: 'auto 1fr 240px',
    gap: '24px',
    alignItems: 'start',
  },
  orderThumbs: {
    display: 'flex',
    gap: '6px',
    flexWrap: 'wrap',
    maxWidth: '140px',
  },
  orderItems: {
    display: 'flex',
    flexDirection: 'column',
    gap: '7px',
  },
  orderItem: {
    display: 'flex',
    justifyContent: 'space-between',
    gap: '16px',
    fontSize: '14px',
    color: 'var(--ink)',
  },
  orderSide: {
    minWidth: 0,
  },
  orderSideMain: {
    margin: '4px 0 0',
    fontSize: '14px',
    color: 'var(--ink)',
    fontWeight: 800,
  },
  orderSideMute: {
    margin: '4px 0 0',
    color: 'var(--inkMute)',
    fontSize: '13px',
    lineHeight: 1.45,
  },

  timeline: {
    display: 'grid',
    gridTemplateColumns: 'repeat(6, minmax(0, 1fr))',
    gap: '8px',
    paddingTop: '2px',
  },
  timelineStep: {
    minWidth: 0,
    display: 'flex',
    alignItems: 'center',
    gap: '7px',
    borderRadius: 'var(--r-pill)',
    border: '1px solid var(--border)',
    background: 'var(--surfaceAlt)',
    padding: '8px 9px',
    color: 'var(--inkMute)',
    fontSize: '12px',
    fontWeight: 800,
  },
  timelineStepDone: {
    background: 'var(--chip)',
    color: 'var(--accent)',
  },
  timelineStepCurrent: {
    borderColor: 'rgba(112,0,255,0.28)',
    background: '#ffffff',
    color: 'var(--ink)',
  },
  timelineDot: {
    width: '9px',
    height: '9px',
    borderRadius: '50%',
    background: '#d9d2ea',
    flex: '0 0 auto',
  },
  timelineDotDone: {
    background: 'var(--accent)',
  },
  timelineDotCurrent: {
    background: 'var(--accent)',
    boxShadow: '0 0 0 4px rgba(112,0,255,0.14)',
  },
  timelineText: {
    whiteSpace: 'nowrap',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
  },
  finalStatusBox: {
    gridColumn: '1 / -1',
    borderRadius: 'var(--r-md)',
    background: '#fee2e2',
    color: '#991b1b',
    padding: '12px',
    fontSize: '14px',
    fontWeight: 800,
  },

  comments: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
    gap: '12px',
  },
  commentBox: {
    borderRadius: 'var(--r-md)',
    background: 'var(--surfaceAlt)',
    border: '1px solid var(--border)',
    padding: '12px',
    color: 'var(--inkMute)',
    fontSize: '13px',
  },
  adminCommentBox: {
    borderRadius: 'var(--r-md)',
    background: '#ecfdf5',
    border: '1px solid rgba(22,101,52,0.12)',
    padding: '12px',
    color: '#166534',
    fontSize: '13px',
  },

  orderFoot: {
    display: 'flex',
    justifyContent: 'space-between',
    gap: '16px',
    alignItems: 'center',
    paddingTop: '12px',
    borderTop: '1px solid var(--border)',
    flexWrap: 'wrap',
  },
  orderFootInfo: {
    display: 'flex',
    gap: '8px',
    color: 'var(--inkMute)',
    fontSize: '13px',
    fontWeight: 800,
  },
  orderActions: {
    display: 'flex',
    gap: '12px',
    flexWrap: 'wrap',
  },
  linkLike: {
    color: 'var(--accent)',
    fontSize: '13px',
    fontWeight: 800,
  },

  emptyCard: {
    background: 'var(--surface)',
    border: '1px solid var(--border)',
    borderRadius: 'var(--r-card)',
    padding: '42px',
    textAlign: 'center',
    boxShadow: 'var(--shadow-card)',
  },
  errorCard: {
    maxWidth: '720px',
    margin: '80px auto',
    background: 'var(--surface)',
    border: '1px solid var(--border)',
    borderRadius: 'var(--r-card)',
    padding: '42px',
    textAlign: 'center',
    boxShadow: 'var(--shadow-card)',
  },
  emptyMark: {
    width: '52px',
    height: '52px',
    borderRadius: '18px',
    margin: '0 auto 12px',
    background: 'var(--chip)',
    color: 'var(--accent)',
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: '28px',
    fontWeight: 800,
  },
  emptyTitle: {
    margin: '0 0 6px',
    fontFamily: 'var(--font-display)',
    color: 'var(--ink)',
    fontSize: '24px',
    fontWeight: 700,
  },
  emptyText: {
    margin: 0,
    color: 'var(--inkMute)',
    fontSize: '14px',
  },
}