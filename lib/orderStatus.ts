import type { DeliveryType, OrderStatus } from '@/lib/supabase/types'

/**
 * One status scale with two branches (stage 2 of the colleagues' feedback):
 *   pickup — new → assembling → ready → received   (office, incl. business trips)
 *   post   — new → assembling → shipped → received (remote workers)
 * Any open order can be cancelled or rejected; closed orders stay closed.
 * The same rules are enforced in the database by admin_set_order_status.
 */

export type Branch = 'pickup' | 'post'

export function getBranch(deliveryType: DeliveryType | string | null | undefined): Branch {
  return deliveryType === 'post' ? 'post' : 'pickup'
}

export const FLOW: Record<Branch, OrderStatus[]> = {
  pickup: ['new', 'assembling', 'ready', 'received'],
  post:   ['new', 'assembling', 'shipped', 'received'],
}

export const CLOSED_STATUSES: OrderStatus[] = ['received', 'cancelled', 'rejected']

/** Statuses an admin can pick for an order (the current one always included). */
export function getAllowedStatuses(status: OrderStatus, deliveryType: DeliveryType | string): OrderStatus[] {
  if (CLOSED_STATUSES.includes(status)) return [status]
  const options: OrderStatus[] = [...FLOW[getBranch(deliveryType)], 'cancelled', 'rejected']
  return options.includes(status) ? options : [status, ...options]
}

export function isClosed(status: OrderStatus) {
  return CLOSED_STATUSES.includes(status)
}

/**
 * Labels differ by audience: in the admin panel a handed-out pickup order is
 * "Отдали заказ", the employee sees "Получен".
 */
export function getStatusLabel(
  status: OrderStatus,
  deliveryType: DeliveryType | string | null | undefined,
  audience: 'employee' | 'admin' = 'employee'
): string {
  const branch = getBranch(deliveryType)

  switch (status) {
    case 'new':        return 'Заявка'
    case 'assembling': return 'Сборка'
    case 'ready':      return 'Можно забирать'
    case 'shipped':    return 'Отправлено'
    case 'received':
      if (branch === 'post') return 'Получено'
      return audience === 'admin' ? 'Отдали заказ' : 'Получен'
    case 'cancelled':  return 'Отменён'
    case 'rejected':   return 'Отклонён'
    case 'review':     return 'На проверке'
    case 'confirmed':  return 'Подтверждён'
    default:           return status
  }
}

/** Generic label for filters and counters, where the branch is unknown. */
export function getStatusFilterLabel(status: OrderStatus): string {
  if (status === 'received') return 'Выдан / получен'
  return getStatusLabel(status, 'office', 'admin')
}

export type StatusTone = 'amber' | 'blue' | 'violet' | 'green' | 'red'

export function getStatusTone(status: OrderStatus): StatusTone {
  if (status === 'new' || status === 'review') return 'amber'
  if (status === 'assembling' || status === 'confirmed' || status === 'shipped') return 'blue'
  if (status === 'ready') return 'violet'
  if (status === 'received') return 'green'
  return 'red'
}

/** Pickup codes are 10 hex characters; shown in two groups for reading aloud. */
export function formatPickupCode(code: string | null | undefined) {
  if (!code) return ''
  const clean = code.replace(/[^0-9A-Za-z]/g, '').toUpperCase()
  return clean.length === 10 ? `${clean.slice(0, 5)}-${clean.slice(5)}` : clean
}

/** What a scanner or a person typed → normalized lookup key. */
export function normalizeScannedCode(value: string) {
  return value.replace(/[^0-9A-Za-z]/g, '').toUpperCase()
}
