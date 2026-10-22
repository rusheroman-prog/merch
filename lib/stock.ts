/**
 * Stock helpers shared by the storefront and the admin screens.
 *
 * "Available" is what an employee can still order: total minus reserved.
 * A variant is "low" when available <= the product's beacon threshold
 * (products.low_stock_threshold, set per product in the admin panel).
 */

export const DEFAULT_LOW_STOCK_THRESHOLD = 5

type VariantStock = {
  total_qty: number | null
  reserved_qty: number | null
  is_active?: boolean | null
}

type ProductStock = {
  is_active?: boolean | null
  archived_at?: string | null
  low_stock_threshold?: number | null
  product_variants?: VariantStock[] | null
}

export function getAvailableQty(variant: VariantStock) {
  return Math.max(0, Number(variant.total_qty ?? 0) - Number(variant.reserved_qty ?? 0))
}

export function getLowStockThreshold(product: { low_stock_threshold?: number | null }) {
  // Number(null) is 0, so a missing value must be handled before converting.
  if (product.low_stock_threshold === null || product.low_stock_threshold === undefined) {
    return DEFAULT_LOW_STOCK_THRESHOLD
  }
  const value = Number(product.low_stock_threshold)
  return Number.isFinite(value) && value >= 0 ? value : DEFAULT_LOW_STOCK_THRESHOLD
}

/** Archived and hidden products are out of circulation: no orders, no alerts. */
export function isInCirculation(product: { is_active?: boolean | null; archived_at?: string | null }) {
  return !product.archived_at && product.is_active !== false
}

type VariantOf<P> = P extends { product_variants?: Array<infer V> | null } ? V : never

/** Active variants of in-circulation products that hit their beacon (0 included). */
export function getLowStockVariants<P extends ProductStock>(products: P[]) {
  return products.flatMap((product) => {
    if (!isInCirculation(product)) return []
    const threshold = getLowStockThreshold(product)
    const variants = (product.product_variants ?? []) as Array<VariantOf<P> & VariantStock>

    return variants
      .filter((variant) => variant.is_active !== false && getAvailableQty(variant) <= threshold)
      .map((variant) => ({ product, variant, availableQty: getAvailableQty(variant), threshold }))
  })
}

export function countLowStockVariants(products: ProductStock[]) {
  return getLowStockVariants(products).length
}
