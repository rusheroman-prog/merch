/** Командировка в Ташкент: даты хранятся как YYYY-MM-DD (колонки date). */

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/

/** Сегодня по Ташкенту в формате YYYY-MM-DD. */
export function todayInTashkent(): string {
  return new Date().toLocaleDateString('sv-SE', { timeZone: 'Asia/Tashkent' })
}

/** null — даты корректны, иначе код ошибки для getCheckoutErrorMessage. */
export function validateTripDates(from?: string | null, to?: string | null): string | null {
  if (!from || !to || !ISO_DATE.test(from) || !ISO_DATE.test(to)) return 'trip_dates_required'
  if (to < from) return 'trip_dates_invalid'
  if (to < todayInTashkent()) return 'trip_dates_past'
  return null
}

/** «12–15 нояб.» / «30 нояб. – 2 дек.» */
export function formatTripRange(from: string, to: string): string {
  const fmt = (value: string, withMonth: boolean) =>
    new Date(`${value}T00:00:00`).toLocaleDateString('ru-RU', withMonth
      ? { day: 'numeric', month: 'short' }
      : { day: 'numeric' })
  if (from === to) return fmt(to, true)
  const sameMonth = from.slice(0, 7) === to.slice(0, 7)
  return sameMonth ? `${fmt(from, false)}–${fmt(to, true)}` : `${fmt(from, true)} – ${fmt(to, true)}`
}
