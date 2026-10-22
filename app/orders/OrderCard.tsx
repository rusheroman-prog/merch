import OrderBarcode from '@/components/OrderBarcode'
import OrderQrDownload from '@/components/OrderQrDownload'
import SupportLink from '@/components/SupportLink'
import { FLOW, formatPickupCode, getBranch, getStatusLabel, getStatusTone, isClosed } from '@/lib/orderStatus'
import { DELIVERY_TYPE_LABELS, type DeliveryType, type OrderStatus } from '@/lib/supabase/types'
import type { SupportContact } from '@/lib/support'
import { decline, getProductLetter } from '@/lib/utils'

/* ─────────────────────────────────────────────────────────────────────────── */
/*  Types                                                                       */
/* ─────────────────────────────────────────────────────────────────────────── */

export type OrderItem = {
  id: string
  product_id?: string | null
  product_name: string
  size: string | null
  color: string | null
  sku: string | null
  qty: number
}

export type Order = {
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
  is_remote: boolean | null
  country: string | null
  pickup_code: string
  trip_from: string | null
  trip_until: string | null
  ready_at: string | null
  created_at: string
  confirmed_at: string | null
  shipped_at: string | null
  received_at: string | null
  cancelled_at: string | null
  order_items: OrderItem[]
}

/** Retired statuses shown at their place on the new scale. */
const LEGACY_POSITION: Partial<Record<OrderStatus, OrderStatus>> = {
  review:    'new',
  confirmed: 'assembling',
}

/* ─────────────────────────────────────────────────────────────────────────── */
/*  OrderCard                                                                   */
/* ─────────────────────────────────────────────────────────────────────────── */

export default function OrderCard({
  order,
  support,
  handoutPlace,
  handoutDeadline,
}: {
  order: Order
  support: SupportContact | null
  handoutPlace: string | null
  handoutDeadline: string | null
}) {
  const items    = order.order_items ?? []
  const totalQty = items.reduce((s, i) => s + Number(i.qty), 0)

  const isRejected = order.status === 'cancelled' || order.status === 'rejected'
  const isReceived = order.status === 'received'
  const isPost     = getBranch(order.delivery_type) === 'post'
  const flow       = FLOW[getBranch(order.delivery_type)]
  const position   = LEGACY_POSITION[order.status] ?? order.status

  return (
    <article className="order">

      {/* ── Top: number + date + status pill ── */}
      <div className="order-top">
        <div className="order-meta">
          <span className="order-id">#{order.order_number}</span>
          <span className="order-date">Оформлен {formatDateShort(order.created_at)}</span>
          {order.tracking_number && (
            <span className="order-track">Трек: {order.tracking_number}</span>
          )}
        </div>
        <span className={`pill pill-${getStatusTone(order.status)}`}>
          {getStatusLabel(order.status, order.delivery_type)}
        </span>
      </div>

      {/* ── Mid: thumbs | items | delivery side ── */}
      <div className="order-mid">
        <div className="order-thumbs">
          {items.slice(0, 4).map(item => (
            <div key={item.id} className="order-thumb">
              {getProductLetter(item.product_name)}
            </div>
          ))}
        </div>

        <div className="order-items">
          {items.map(item => (
            <div key={item.id} className="order-item">
              <b>{item.product_name}</b>
              <span>{formatVariant(item)} · {item.qty} шт.</span>
            </div>
          ))}
        </div>

        <div className="order-side">
          <span className="kicker">{isReceived ? 'Получено' : 'Получение'}</span>
          <p className="order-side-main">
            {isReceived && order.received_at
              ? formatDateShort(order.received_at)
              : DELIVERY_TYPE_LABELS[order.delivery_type] ?? order.delivery_type}
          </p>
          <p className="order-side-mute">
            {order.delivery_type === 'post'
              ? [order.country, order.delivery_address].filter(Boolean).join(', ') || 'Адрес не указан'
              : isReceived ? 'Выдан в офисе'
              : order.delivery_address || handoutPlace || 'Место выдачи сообщим'}
          </p>
        </div>
      </div>

      {/* ── Progress timeline ── */}
      <div className="order-timeline">
        {isRejected ? (
          <div className="order-final-status">
            {order.status === 'cancelled' ? 'Заказ был отменён.' : 'Заказ был отклонён.'}
          </div>
        ) : (
          flow.map(step => {
            const stepIdx    = flow.indexOf(step)
            const currentIdx = Math.max(0, flow.indexOf(position))
            const isDone     = stepIdx < currentIdx
            const isCurrent  = stepIdx === currentIdx

            return (
              <div
                key={step}
                className={`timeline-step${isDone ? ' done' : ''}${isCurrent ? ' current' : ''}`}
              >
                <span className={`timeline-dot${isDone ? ' done' : ''}${isCurrent ? ' current' : ''}`} />
                <span className="timeline-lbl">{getStatusLabel(step, order.delivery_type)}</span>
              </div>
            )
          })
        )}
      </div>

      {/* ── Ready for pickup / business trip deadline ── */}
      {order.status === 'ready' && (
        <div className="order-ready">
          <b>Заказ собран — можно забирать.</b>
          <span>
            {[
              handoutPlace ? `Где: ${handoutPlace}` : null,
              handoutDeadline ? `Когда: ${formatDateTime(handoutDeadline)}` : null,
            ].filter(Boolean).join(' · ') || 'Покажите QR-код на выдаче.'}
          </span>
        </div>
      )}
      {order.trip_until && !isClosed(order.status) && (
        <div className="order-trip">
          Командировка {formatDayMonth(order.trip_from ?? order.trip_until)} – {formatDayMonth(order.trip_until)}:
          мерч отложен, заберите его до {formatDayMonth(order.trip_until)}
        </div>
      )}

      {/* ── Comments ── */}
      {(order.comment || order.admin_comment) && (
        <div className="order-comments">
          {order.comment && (
            <div className="comment-box">
              <span>Ваш комментарий</span>
              <p>{order.comment}</p>
            </div>
          )}
          {order.admin_comment && (
            <div className="comment-box comment-box-admin">
              <span>Комментарий администратора</span>
              <p>{order.admin_comment}</p>
            </div>
          )}
        </div>
      )}

      {/* ── Pickup QR (office pickup only; post orders get a tracking number) ── */}
      {!isRejected && !isPost && !isReceived && (
        <div className="order-pickup">
          <OrderBarcode value={order.pickup_code} size={104} />
          <div className="order-pickup-text">
            <b>Код для получения: <span className="order-pickup-num">{formatPickupCode(order.pickup_code)}</span></b>
            <span>Покажите QR на выдаче — его отсканируют, и заказ отметится выданным.</span>
            <OrderQrDownload value={order.pickup_code} orderNumber={order.order_number} />
          </div>
        </div>
      )}

      {/* ── Footer ── */}
      <div className="order-foot">
        <div className="order-foot-info">
          <span>{totalQty} шт.</span>
          <span>·</span>
          <span>{items.length} {decline(items.length, ['позиция', 'позиции', 'позиций'])}</span>
        </div>
        <div className="order-foot-actions">
          {order.tracking_number && (
            <span className="order-status-note">Трек-номер указан</span>
          )}
          {isReceived && (
            <span className="order-status-note">Заказ завершён ✓</span>
          )}
          {!isReceived && !isRejected && (
            <span className="order-foot-mute">
              Статус обновляется администратором
            </span>
          )}
          {support?.href && (
            <SupportLink
              contact={{ label: 'Вопрос по заказу →', href: support.href }}
              className="order-foot-link"
            />
          )}
        </div>
      </div>

    </article>
  )
}

/* ─────────────────────────────────────────────────────────────────────────── */
/*  Helpers                                                                     */
/* ─────────────────────────────────────────────────────────────────────────── */

function formatVariant(item: OrderItem) {
  return [item.color || 'Без цвета', item.size || 'ONE SIZE']
    .filter(Boolean)
    .join(' · ')
}

function formatDateShort(value: string) {
  return new Date(value).toLocaleDateString('ru-RU', {
    timeZone: 'Asia/Tashkent',
    day:      'numeric',
    month:    'short',
    year:     'numeric',
  })
}

/** Trip dates are plain dates (YYYY-MM-DD): "10 ноября". */
function formatDayMonth(value: string) {
  return new Date(`${value.slice(0, 10)}T00:00:00`).toLocaleDateString('ru-RU', { day: 'numeric', month: 'long' })
}

export function formatDateTime(value: string) {
  return new Date(value).toLocaleString('ru-RU', {
    timeZone: 'Asia/Tashkent',
    day:      'numeric',
    month:    'short',
    year:     'numeric',
    hour:     '2-digit',
    minute:   '2-digit',
  })
}
