import type { ProductSegment } from '@/lib/supabase/types'

/** Разделение айтемов в админке: на продажу и по бизнес-юнитам. */
export const SEGMENT_LABELS: Record<ProductSegment, string> = {
  sale:    'На продажу',
  fintech: 'Финтех',
  ecom:    'Еком',
  holding: 'Холдинг',
}

export const SEGMENTS = Object.keys(SEGMENT_LABELS) as ProductSegment[]

/** Значение переключателя: all — все, common — без сегмента. */
export type SegmentFilter = 'all' | 'common' | ProductSegment

export function matchesSegment(segment: ProductSegment | null | undefined, filter: SegmentFilter) {
  if (filter === 'all') return true
  if (filter === 'common') return !segment
  return segment === filter
}

export function parseSegmentFilter(value: string | null | undefined): SegmentFilter {
  return value === 'common' || (SEGMENTS as string[]).includes(value ?? '') ? (value as SegmentFilter) : 'all'
}
