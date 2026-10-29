import type { DeliveryType, OrderStatus } from '@/lib/supabase/types'

/**
 * Сотрудник видит 4 шага: Заявка → Сборка → (Отправка | Можно забирать) → Получено.
 * В БД enum остаётся прежним: review/confirmed — устаревшие промежуточные значения,
 * для сотрудника они сливаются с «Заявкой». Шаг «Отправка» есть только у заказов,
 * которые уезжают почтой (удалёнщики); офисные на этом шаге — «Можно забирать».
 */
export const ORDER_FLOW: OrderStatus[] = ['new', 'assembling', 'shipped', 'received']

/** Статусы, которые админ выставляет вручную. */
export const ADMIN_STATUS_OPTIONS: OrderStatus[] = [
  'new', 'assembling', 'shipped', 'received', 'cancelled', 'rejected',
]

export type StatusTone = 'amber' | 'blue' | 'green' | 'red'

/** true — заказ отправляется (почта), false — забирают сами, null — неизвестно. */
export function isShippedOrder(delivery?: DeliveryType | null): boolean | null {
  if (!delivery) return null
  return delivery !== 'office' && delivery !== 'pickup'
}

/** Сводит review/confirmed к «Заявке»; для отменённых возвращает -1. */
export function flowIndex(status: OrderStatus): number {
  if (status === 'review' || status === 'confirmed') return 0
  return ORDER_FLOW.indexOf(status)
}

/** Подпись третьего шага в зависимости от способа получения. */
function readyLabel(delivery?: DeliveryType | null) {
  const shipped = isShippedOrder(delivery)
  if (shipped === null) return 'Можно забирать / отправлен'
  return shipped ? 'Отправлен' : 'Можно забирать'
}

export function orderStatusLabel(status: OrderStatus, delivery?: DeliveryType | null): string {
  switch (status) {
    case 'new':
    case 'review':
    case 'confirmed':  return 'Заявка'
    case 'assembling': return 'Сборка'
    case 'shipped':    return readyLabel(delivery)
    case 'received':   return 'Получен'
    case 'cancelled':  return 'Отменён'
    case 'rejected':   return 'Отклонён'
  }
}

/** Подписи шагов таймлайна для конкретного заказа. */
export function flowStepLabels(delivery?: DeliveryType | null): string[] {
  const shipped = isShippedOrder(delivery)
  return ['Заявка', 'Сборка', shipped ? 'Отправка' : 'Можно забирать', 'Получено']
}

export function statusTone(status: OrderStatus): StatusTone {
  if (status === 'cancelled' || status === 'rejected') return 'red'
  if (status === 'shipped' || status === 'received')   return 'green'
  if (status === 'assembling')                         return 'blue'
  return 'amber'
}
