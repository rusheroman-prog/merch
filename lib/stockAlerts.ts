import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/lib/supabase/types'

/** Порог «маячка» по умолчанию: предупреждаем, когда доступно ≤ 4 шт. */
export const DEFAULT_ALERT_QTY = 4

/** Пороги по variant_id. null — миграция merch-stock-alerts.sql ещё не прогнана. */
export type AlertMap = Map<string, number | null> | null

export function alertLimit(alertQty?: number | null) {
  return alertQty ?? DEFAULT_ALERT_QTY
}

/** Мало, но ещё есть: 0 < доступно ≤ порога. */
export function isLowStock(available: number, alertQty?: number | null) {
  return available > 0 && available <= alertLimit(alertQty)
}

export async function loadAlertMap(supabase: SupabaseClient<Database>): Promise<AlertMap> {
  const { data, error } = await supabase.from('product_variants').select('id, alert_qty')
  if (error) return null
  return new Map((data ?? []).map((row) => [row.id, row.alert_qty]))
}

/** Сколько активных вариантов на грани — для бейджа «Склад» в меню админки. */
export async function countStockAlerts(supabase: SupabaseClient<Database>): Promise<number> {
  const [{ data: variants }, alerts] = await Promise.all([
    supabase.from('product_variants').select('id, total_qty, reserved_qty, is_active'),
    loadAlertMap(supabase),
  ])
  return (variants ?? []).filter((v) =>
    v.is_active && isLowStock(Number(v.total_qty) - Number(v.reserved_qty), alerts?.get(v.id))
  ).length
}
