'use client'

import AppNav from '@/components/AppNav'
import ProductImage from '@/components/ProductImage'
import SupportLink from '@/components/SupportLink'
import { type ActiveDeliveryType } from '@/lib/supabase/types'
import type { SupportContact } from '@/lib/support'
import { decline, getProductLetter } from '@/lib/utils'
import { useMemo, useState } from 'react'

/* ─────────────────────────────────────────────────────────────────────────── */
/*  Types                                                                       */
/* ─────────────────────────────────────────────────────────────────────────── */

export type CatalogVariant = {
  id: string
  size: string | null
  color: string | null
  sku: string | null
  total_qty: number
  reserved_qty: number
  available_qty: number
}

export type CatalogProduct = {
  id: string
  name: string
  description: string | null
  material: string | null
  image_url: string | null
  images: string[]
  category_name: string | null
  variants: CatalogVariant[]
}

type CartItem = {
  product: CatalogProduct
  variant: CatalogVariant
}

type SortMode = 'rec' | 'abc'

type CheckoutDefaults = {
  deliveryType: ActiveDeliveryType
  deliveryAddress: string
  phone: string
  country: string
}

type MerchAccess = {
  isAllowed: boolean
  reason: string
  hiredAt: string | null
  monthsWorked: number | null
}

type Limits = {
  /** Unique products one employee may order in the current window. */
  maxItems: number
  /** Products already in the employee's active orders of this window. */
  orderedProductIds: string[]
  /** True when admins started a new order window (a distribution). */
  hasWindow: boolean
}

type CatalogClientProps = {
  products: CatalogProduct[]
  userEmail: string | null
  userName: string | null
  isAdmin: boolean
  checkoutDefaults: CheckoutDefaults
  limits: Limits
  support: SupportContact | null
  handoutPlace: string | null
  merchAccess: MerchAccess
}

/* ─────────────────────────────────────────────────────────────────────────── */
/*  Constants                                                                   */
/* ─────────────────────────────────────────────────────────────────────────── */

const ALL = 'all'
const NO_SIZE = 'one-size'
const SIZE_ORDER = ['XXS', 'XS', 'S', 'M', 'L', 'XL', 'XXL', '2XL', 'XXXL', '3XL', '4XL']

type DeliveryOption = {
  value: ActiveDeliveryType | 'pvz' | 'courier'
  title: string
  hint: string
  disabled?: boolean
}

/* ─────────────────────────────────────────────────────────────────────────── */
/*  CatalogClient                                                               */
/* ─────────────────────────────────────────────────────────────────────────── */

export default function CatalogClient({
  products,
  userEmail,
  userName,
  isAdmin,
  checkoutDefaults,
  limits,
  support,
  handoutPlace,
  merchAccess,
}: CatalogClientProps) {
  /* Cart */
  const [cart, setCart] = useState<CartItem[]>([])

  /* Checkout form */
  const [deliveryType,    setDeliveryType]    = useState<ActiveDeliveryType>(checkoutDefaults.deliveryType)
  const [deliveryAddress, setDeliveryAddress] = useState(checkoutDefaults.deliveryAddress)
  const [country,         setCountry]         = useState(checkoutDefaults.country || 'Узбекистан')
  const [phone,           setPhone]           = useState(checkoutDefaults.phone)
  const [comment,         setComment]         = useState('')
  const [isSubmitting,    setIsSubmitting]    = useState(false)
  const [checkoutError,   setCheckoutError]   = useState<string | null>(null)
  const [checkoutSuccess, setCheckoutSuccess] = useState<string | null>(null)
  /* Products ordered in this session join the server-provided list. */
  const [justOrderedIds,  setJustOrderedIds]  = useState<string[]>([])

  /* Filters */
  const [category, setCategory] = useState<string>(ALL)
  const [size,     setSize]     = useState<string>(ALL)
  const [search,   setSearch]   = useState('')
  const [sortMode, setSortMode] = useState<SortMode>('rec')

  /* Derived */
  const orderedIds = useMemo(
    () => new Set([...limits.orderedProductIds, ...justOrderedIds]),
    [limits.orderedProductIds, justOrderedIds]
  )
  const remaining = Math.max(0, limits.maxItems - orderedIds.size)

  const categories = useMemo(
    () => Array.from(new Set(products.map(p => p.category_name).filter(Boolean) as string[])),
    [products]
  )

  const sizes = useMemo(() => {
    const unique = new Set<string>()
    let hasOneSize = false
    for (const product of products) {
      for (const variant of product.variants) {
        if (variant.size?.trim()) unique.add(variant.size.trim())
        else hasOneSize = true
      }
    }
    const sorted = Array.from(unique).sort(compareSizes)
    return { list: sorted, hasOneSize }
  }, [products])

  const filteredProducts = useMemo(() => {
    const q = search.trim().toLowerCase()
    const filtered = products.filter(p => {
      const catMatch  = category === ALL || p.category_name === category
      const sizeMatch = size === ALL || p.variants.some(v => matchesSize(v, size))
      const srchMatch =
        q.length === 0 ||
        p.name.toLowerCase().includes(q) ||
        p.description?.toLowerCase().includes(q) ||
        p.category_name?.toLowerCase().includes(q) ||
        p.material?.toLowerCase().includes(q)
      return catMatch && sizeMatch && srchMatch
    })
    if (sortMode === 'abc') {
      return [...filtered].sort((a, b) =>
        a.name.localeCompare(b.name, 'ru', { sensitivity: 'base' })
      )
    }
    return filtered
  }, [products, category, size, search, sortMode])

  const hasActiveFilters = category !== ALL || size !== ALL || search.trim().length > 0
  const firstName = getUserFirstName(userName, userEmail)
  const initials  = getInitials(userName, userEmail)

  const deliveryOptions: DeliveryOption[] = [
    {
      value: 'office',
      title: 'Заберу в офисе',
      hint:  handoutPlace ? `Выдача: ${handoutPlace}` : 'Место и время выдачи покажем в «Мои заказы»',
    },
    {
      value: 'post',
      title: 'Отправить почтой',
      hint:  'Для сотрудников на удалёнке',
    },
    { value: 'pvz',     title: 'ПВЗ / филиал', hint: 'Скоро', disabled: true },
    { value: 'courier', title: 'Курьер',       hint: 'Скоро', disabled: true },
  ]

  /* Cart actions */
  function isProductInCart(productId: string) {
    return cart.some(item => item.product.id === productId)
  }

  function addToCart(product: CatalogProduct, variant: CatalogVariant) {
    setCheckoutError(null)
    setCheckoutSuccess(null)
    if (variant.available_qty <= 0 || orderedIds.has(product.id)) return
    if (isProductInCart(product.id) || cart.length >= remaining) return
    setCart(cur => [...cur, { product, variant }])
  }

  function removeFromCart(variantId: string) {
    setCart(cur => cur.filter(item => item.variant.id !== variantId))
  }

  /* Checkout */
  async function handleCheckout() {
    if (cart.length === 0) { setCheckoutError('Корзина пустая'); return }
    if (!merchAccess.isAllowed) {
      setCheckoutError(getMerchAccessMessage(merchAccess))
      return
    }
    if (!phone.trim()) {
      setCheckoutError('Укажите телефон — по нему с вами свяжутся, если что-то пойдёт не так.')
      return
    }
    if (deliveryType === 'post' && !deliveryAddress.trim()) {
      setCheckoutError('Укажите адрес, куда отправить посылку.')
      return
    }

    setIsSubmitting(true)
    setCheckoutError(null)
    setCheckoutSuccess(null)

    try {
      const res = await fetch('/api/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          items:            cart.map(item => ({ variant_id: item.variant.id, qty: 1 })),
          delivery_type:    deliveryType,
          delivery_address: deliveryType === 'post' ? deliveryAddress : null,
          country:          deliveryType === 'post' ? country : null,
          phone,
          comment,
        }),
      })

      const result = await res.json()

      if (!res.ok) {
        setCheckoutError(getCheckoutErrorMessage(result.error, limits.maxItems))
        return
      }

      setJustOrderedIds(cur => [...cur, ...cart.map(item => item.product.id)])
      setCart([])
      setComment('')
      setCheckoutSuccess(
        result.order?.order_number
          ? `Заказ #${result.order.order_number} оформлен`
          : 'Заказ оформлен'
      )
    } catch (err) {
      setCheckoutError(err instanceof Error ? err.message : 'Неизвестная ошибка')
    } finally {
      setIsSubmitting(false)
    }
  }

  /* ── Render ───────────────────────────────────────────────────────────── */

  return (
    <div>
      {/* ── HEADER ──────────────────────────────────────────────────────── */}
      <header className="site-head">
        <div className="site-head-glass" aria-hidden="true" />
        <div className="head-inner">

          <a href="/catalog" className="brand">
            <span className="brand-mark">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/brand/uzum-big-logo.webp" alt="Uzum" />
            </span>
            <span className="brand-name">
              uzum <span className="brand-name-soft">мерч</span>
            </span>
          </a>

          <AppNav isAdmin={isAdmin} />

          <div className="head-side">
            {cart.length > 0 && (
              <button
                type="button"
                className="head-cart"
                onClick={() =>
                  document.getElementById('cart-aside')
                    ?.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
                }
              >
                Корзина
                <span className="head-cart-badge">{cart.length}</span>
              </button>
            )}

            <div className="head-user head-user-static">
              <span className="head-user-avatar">{initials}</span>
              <span className="head-user-info">
                <span className="head-user-name">{firstName}</span>
                <span className="head-user-team">{userEmail}</span>
              </span>
            </div>

            <LogoutButton />
          </div>

        </div>
      </header>

      {/* ── CATALOG BODY ────────────────────────────────────────────────── */}
      <div className="catalog catalog-compact">

        {!merchAccess.isAllowed && (
          <div className="catalog-notice">
            <b>Оформление недоступно.</b> {getMerchAccessMessage(merchAccess)}
            {support && (
              <> Вопросы: <SupportLink contact={support} className="support-link" /></>
            )}
          </div>
        )}

        <div className="catalog-body">

          {/* Filters sidebar */}
          <aside className="filters">
            <div className="filters-block">
              <label className="filters-label" htmlFor="catalog-search">Поиск</label>
              <input
                id="catalog-search"
                className="filters-input"
                placeholder="Худи, шоппер, блокнот…"
                value={search}
                onChange={e => setSearch(e.target.value)}
              />
            </div>

            <div className="filters-block">
              <label className="filters-label" htmlFor="catalog-category">Категория</label>
              <select
                id="catalog-category"
                className="filters-select"
                value={category}
                onChange={e => setCategory(e.target.value)}
              >
                <option value={ALL}>Все категории</option>
                {categories.map(cat => (
                  <option key={cat} value={cat}>{cat}</option>
                ))}
              </select>
            </div>

            <div className="filters-block">
              <label className="filters-label" htmlFor="catalog-size">Размер</label>
              <select
                id="catalog-size"
                className="filters-select"
                value={size}
                onChange={e => setSize(e.target.value)}
              >
                <option value={ALL}>Любой размер</option>
                {sizes.list.map(s => (
                  <option key={s} value={s}>{s}</option>
                ))}
                {sizes.hasOneSize && <option value={NO_SIZE}>Без размера</option>}
              </select>
            </div>

            {hasActiveFilters && (
              <button
                type="button"
                className="filters-reset"
                onClick={() => { setCategory(ALL); setSize(ALL); setSearch('') }}
              >
                Сбросить фильтры
              </button>
            )}

            <div className="rules-card">
              <span className="kicker">Правила</span>
              <ol className="rules-list">
                <li>
                  Можно выбрать до {limits.maxItems}{' '}
                  {decline(limits.maxItems, ['уникальной позиции', 'уникальных позиций', 'уникальных позиций'])}
                  {limits.hasWindow ? ' в текущей раздаче' : ''}
                </li>
                <li>1 товар = 1 штука</li>
                <li>Разные размеры одного товара — одна позиция</li>
                <li>Получение — в офисе, удалёнщикам отправим почтой</li>
              </ol>
            </div>

            {support && (
              <div className="filters-help">
                Вопросы по мерчу: <SupportLink contact={support} className="support-link" />
              </div>
            )}
          </aside>

          {/* Grid area */}
          <main className="grid-wrap">
            <div className="grid-head">
              <div className="grid-picked">
                {remaining > 0 || cart.length > 0 ? (
                  <>
                    Выбрано <span className="num">{cart.length}</span> из {remaining}
                    {orderedIds.size > 0 && (
                      <span className="grid-picked-note">
                        {' '}· ещё {orderedIds.size} уже в ваших заказах
                      </span>
                    )}
                  </>
                ) : (
                  <span className="grid-picked-note">
                    Лимит исчерпан: вы уже заказали {orderedIds.size}{' '}
                    {decline(orderedIds.size, ['позицию', 'позиции', 'позиций'])}
                  </span>
                )}
              </div>
              <div className="grid-sort">
                <span className="kicker">Сортировка</span>
                <select
                  className="sort-select"
                  value={sortMode}
                  onChange={e => setSortMode(e.target.value as SortMode)}
                >
                  <option value="rec">Рекомендуем</option>
                  <option value="abc">По алфавиту</option>
                </select>
              </div>
            </div>

            <p className="rules-compact">
              Правила: до {limits.maxItems}{' '}
              {decline(limits.maxItems, ['позиции', 'позиций', 'позиций'])}, 1 товар = 1 штука,
              разные размеры одного товара — одна позиция. Получение в офисе или почтой.
            </p>

            <div id="catalog-grid" className="grid-layout">
              <div className="grid grid-cols">
                {filteredProducts.length === 0 ? (
                  <div className="empty">
                    <div className="empty-mark">∅</div>
                    <h3>Товары не найдены</h3>
                    <p>Сбросьте фильтры или измените поиск.</p>
                  </div>
                ) : (
                  filteredProducts.map(product => (
                    <ProductCard
                      // Remount on size filter change so the card preselects that size.
                      key={`${product.id}:${size}`}
                      product={product}
                      preferredSize={size}
                      state={
                        isProductInCart(product.id) ? 'in-cart'
                        : orderedIds.has(product.id) ? 'ordered'
                        : !merchAccess.isAllowed ? 'blocked'
                        : cart.length >= remaining ? 'limit'
                        : 'available'
                      }
                      onAddToCart={addToCart}
                    />
                  ))
                )}
              </div>

              <CartAside
                cart={cart}
                remaining={remaining}
                deliveryOptions={deliveryOptions}
                deliveryType={deliveryType}
                deliveryAddress={deliveryAddress}
                country={country}
                phone={phone}
                comment={comment}
                isSubmitting={isSubmitting}
                checkoutError={checkoutError}
                checkoutSuccess={checkoutSuccess}
                merchAccess={merchAccess}
                onRemove={removeFromCart}
                onDeliveryTypeChange={setDeliveryType}
                onDeliveryAddressChange={setDeliveryAddress}
                onCountryChange={setCountry}
                onPhoneChange={setPhone}
                onCommentChange={setComment}
                onCheckout={handleCheckout}
              />
            </div>
          </main>

        </div>{/* /catalog-body */}
      </div>{/* /catalog */}
    </div>
  )
}

/* ─────────────────────────────────────────────────────────────────────────── */
/*  ProductCard                                                                 */
/* ─────────────────────────────────────────────────────────────────────────── */

type CardState = 'available' | 'in-cart' | 'ordered' | 'limit' | 'blocked'

function ProductCard({
  product,
  preferredSize,
  state,
  onAddToCart,
}: {
  product: CatalogProduct
  preferredSize: string
  state: CardState
  onAddToCart: (product: CatalogProduct, variant: CatalogVariant) => void
}) {
  const [selectedVariantId, setSelectedVariantId] = useState(
    () => (product.variants.find(v => matchesSize(v, preferredSize)) ?? product.variants[0])?.id ?? ''
  )

  const selectedVariant =
    product.variants.find(v => v.id === selectedVariantId) ??
    product.variants[0]

  const imageUrl = product.image_url || product.images?.[0] || ''
  const hasMultipleVariants = product.variants.length > 1

  const totalAvail  = product.variants.reduce((s, v) => s + v.available_qty, 0)
  const stockClass  = totalAvail > 4 ? 'card-stock-ok' : totalAvail > 0 ? 'card-stock-low' : 'card-stock-out'
  const stockText   = totalAvail > 0 ? `${totalAvail} шт.` : 'Нет в наличии'

  const canAdd = state === 'available' && !!selectedVariant && selectedVariant.available_qty > 0
  const buttonText =
    state === 'in-cart' ? 'Уже в корзине'
    : state === 'ordered' ? 'Уже заказан'
    : state === 'limit' ? 'Лимит выбран'
    : 'Добавить'

  return (
    <article className={`card${state === 'ordered' ? ' card-ordered' : ''}`}>
      <div className="card-art">
        {imageUrl ? (
          <ProductImage
            src={imageUrl}
            alt={product.name}
            sizes="(max-width: 640px) 50vw, (max-width: 900px) 33vw, 300px"
          />
        ) : (
          <div className="card-art-placeholder">
            <div className="card-art-letter">{getProductLetter(product.name)}</div>
          </div>
        )}
        {state === 'in-cart' && <span className="card-badge card-badge-cart">В корзине</span>}
        {state === 'ordered' && <span className="card-badge card-badge-ordered">Уже заказан</span>}
      </div>

      <div className="card-body">
        <div className="card-top">
          <span className="card-kind">{product.category_name || 'Мерч'}</span>
          <span className={`card-stock ${stockClass}`}>{stockText}</span>
        </div>

        <h3 className="card-name">{product.name}</h3>

        {product.description && (
          <p className="card-desc">{product.description}</p>
        )}

        <label className="variant-label">
          {hasMultipleVariants ? 'Вариант' : 'Размер'}
          <select
            className="variant-select"
            value={selectedVariant?.id ?? ''}
            onChange={e => setSelectedVariantId(e.target.value)}
            disabled={state === 'in-cart' || state === 'ordered'}
          >
            {product.variants.map(v => (
              <option key={v.id} value={v.id}>{formatVariant(v)}</option>
            ))}
          </select>
        </label>

        <button
          type="button"
          className={`card-btn${state === 'in-cart' || state === 'ordered' ? ' in-cart' : ''}`}
          disabled={!canAdd}
          onClick={() => selectedVariant && onAddToCart(product, selectedVariant)}
        >
          {buttonText}
        </button>
      </div>
    </article>
  )
}

/* ─────────────────────────────────────────────────────────────────────────── */
/*  CartAside                                                                   */
/* ─────────────────────────────────────────────────────────────────────────── */

function CartAside({
  cart,
  remaining,
  deliveryOptions,
  deliveryType,
  deliveryAddress,
  country,
  phone,
  comment,
  isSubmitting,
  checkoutError,
  checkoutSuccess,
  merchAccess,
  onRemove,
  onDeliveryTypeChange,
  onDeliveryAddressChange,
  onCountryChange,
  onPhoneChange,
  onCommentChange,
  onCheckout,
}: {
  cart: CartItem[]
  remaining: number
  deliveryOptions: DeliveryOption[]
  deliveryType: ActiveDeliveryType
  deliveryAddress: string
  country: string
  phone: string
  comment: string
  isSubmitting: boolean
  checkoutError: string | null
  checkoutSuccess: string | null
  merchAccess: MerchAccess
  onRemove: (variantId: string) => void
  onDeliveryTypeChange: (value: ActiveDeliveryType) => void
  onDeliveryAddressChange: (value: string) => void
  onCountryChange: (value: string) => void
  onPhoneChange: (value: string) => void
  onCommentChange: (value: string) => void
  onCheckout: () => void
}) {
  const limitLabel = `${cart.length} / ${remaining} ${decline(remaining, ['позиция', 'позиции', 'позиций'])}`

  return (
    <aside className="cart-aside" id="cart-aside">
      <div className="cart-header">
        <p className="aside-title">Корзина</p>
        <span className="cart-quota-pill">{limitLabel}</span>
      </div>

      {checkoutSuccess && <CheckoutSuccessCard message={checkoutSuccess} />}

      {cart.length === 0 ? (
        <>
          <div className="cart-empty">
            <div className="cart-empty-mark">+</div>
            <p className="cart-empty-title">Пока пусто</p>
            <p className="cart-empty-text">
              {remaining > 0
                ? `Добавьте от 1 до ${remaining} ${decline(remaining, ['товара', 'товаров', 'товаров'])} из каталога.`
                : 'Вы выбрали весь доступный лимит. Статусы заказов — в «Мои заказы».'}
            </p>
          </div>
          <p className="cart-footnote">
            Контакты и способ получения вы укажете при оформлении.
          </p>
        </>
      ) : (
        <>
          <div className="cart-lines">
            {cart.map(item => (
              <div key={item.variant.id} className="cart-line">
                <div className="cart-line-info">
                  <b>{item.product.name}</b>
                  <span className="cart-line-variant">
                    {formatVariant(item.variant)} · 1 шт.
                  </span>
                </div>
                <button
                  type="button"
                  className="cart-line-remove"
                  onClick={() => onRemove(item.variant.id)}
                  aria-label={`Удалить ${item.product.name}`}
                >
                  ×
                </button>
              </div>
            ))}
          </div>

          <div className="cart-form">
            <fieldset className="delivery-options">
              <legend className="form-label">Способ получения</legend>
              {deliveryOptions.map(option => {
                const isActive = option.value === deliveryType
                return (
                  <label
                    key={option.value}
                    className={`delivery-option${isActive ? ' is-on' : ''}${option.disabled ? ' is-disabled' : ''}`}
                  >
                    <input
                      type="radio"
                      name="delivery"
                      value={option.value}
                      checked={isActive}
                      disabled={option.disabled}
                      onChange={() => onDeliveryTypeChange(option.value as ActiveDeliveryType)}
                    />
                    <span className="delivery-option-body">
                      <b>{option.title}</b>
                      <span>{option.hint}</span>
                    </span>
                  </label>
                )
              })}
            </fieldset>

            {deliveryType === 'post' && (
              <>
                <label className="form-label">
                  Страна
                  <input
                    type="text"
                    className="form-input"
                    value={country}
                    onChange={e => onCountryChange(e.target.value)}
                    placeholder="Например: Узбекистан"
                  />
                </label>

                <label className="form-label">
                  Адрес доставки
                  <textarea
                    className="form-textarea"
                    value={deliveryAddress}
                    onChange={e => onDeliveryAddressChange(e.target.value)}
                    placeholder="Город, улица, дом, квартира, индекс"
                  />
                </label>
              </>
            )}

            <label className="form-label">
              Телефон
              <input
                type="tel"
                className="form-input"
                value={phone}
                onChange={e => onPhoneChange(e.target.value)}
                placeholder="+998 90 000-00-00"
                autoComplete="tel"
              />
            </label>

            <label className="form-label">
              Комментарий
              <textarea
                className="form-textarea"
                value={comment}
                onChange={e => onCommentChange(e.target.value)}
                placeholder="Если есть пожелания к заказу"
              />
            </label>

            {checkoutError && (
              <div className="form-error">{checkoutError}</div>
            )}

            <button
              type="button"
              className="checkout-btn"
              disabled={isSubmitting || !merchAccess.isAllowed}
              onClick={onCheckout}
            >
              {isSubmitting ? 'Оформляем…' : 'Оформить заказ →'}
            </button>
          </div>
        </>
      )}
    </aside>
  )
}

/* ─────────────────────────────────────────────────────────────────────────── */
/*  CheckoutSuccessCard                                                         */
/* ─────────────────────────────────────────────────────────────────────────── */

function CheckoutSuccessCard({ message }: { message: string }) {
  return (
    <div className="confirm-card">
      <div className="confirm-icon">✓</div>
      <div>
        <div className="confirm-kicker">Заявка оформлена</div>
        <h3 className="confirm-title">{message}</h3>
        <p className="confirm-text">
          Статус и QR-код для получения — в разделе «Мои заказы».
        </p>
        <div className="confirm-actions">
          <a href="/orders" className="confirm-primary-link">Мои заказы</a>
        </div>
      </div>
    </div>
  )
}

/* ─────────────────────────────────────────────────────────────────────────── */
/*  LogoutButton                                                                */
/* ─────────────────────────────────────────────────────────────────────────── */

function LogoutButton() {
  const [loggingOut, setLoggingOut] = useState(false)

  async function handleLogout() {
    setLoggingOut(true)
    try {
      await fetch('/api/auth/logout', { method: 'POST' })
    } finally {
      window.location.href = '/login'
    }
  }

  return (
    <button
      type="button"
      disabled={loggingOut}
      onClick={handleLogout}
      className="logout-btn"
    >
      {loggingOut ? 'Выходим…' : 'Выйти'}
    </button>
  )
}

/* ─────────────────────────────────────────────────────────────────────────── */
/*  Helper functions                                                            */
/* ─────────────────────────────────────────────────────────────────────────── */

function matchesSize(variant: CatalogVariant, size: string) {
  if (size === ALL) return true
  const variantSize = variant.size?.trim()
  return size === NO_SIZE ? !variantSize : variantSize === size
}

function compareSizes(a: string, b: string) {
  const ia = SIZE_ORDER.indexOf(a.toUpperCase())
  const ib = SIZE_ORDER.indexOf(b.toUpperCase())
  if (ia >= 0 && ib >= 0) return ia - ib
  if (ia >= 0) return -1
  if (ib >= 0) return 1
  return a.localeCompare(b, 'ru', { numeric: true })
}

function formatVariant(variant: CatalogVariant) {
  const size  = variant.size  || 'ONE SIZE'
  const color = variant.color || 'Без цвета'
  return `${size} · ${color}`
}

function getUserFirstName(fullName: string | null, email: string | null): string {
  const cleaned = fullName?.trim()
  if (cleaned) {
    const parts = cleaned.split(/\s+/).filter(Boolean)
    // ФИО = Фамилия Имя Отчество — берём второе слово как имя
    if (parts.length >= 2) return parts[1]!
    return parts[0] || 'коллега'
  }
  if (!email) return 'коллега'
  const local = email.split('@')[0] ?? 'коллега'
  return (
    local.split(/[._-]/).filter(Boolean)[0]
      ?.replace(/^./, l => l.toUpperCase()) ?? 'коллега'
  )
}

function getInitials(fullName: string | null, email: string | null): string {
  const cleaned = fullName?.trim()
  if (cleaned) {
    const parts = cleaned.split(/\s+/).filter(Boolean)
    // Фамилия Имя → берём первые буквы фамилии и имени
    const a = parts[0]?.[0] ?? ''
    const b = parts[1]?.[0] ?? ''
    const result = `${a}${b}`.toUpperCase()
    if (result) return result
  }
  if (!email) return 'U'
  const local = email.split('@')[0] ?? 'U'
  const parts  = local.split(/[._-]/).filter(Boolean)
  const a = parts[0]?.[0] ?? 'U'
  const b = parts[1]?.[0] ?? ''
  return `${a}${b}`.toUpperCase()
}

function getCheckoutErrorMessage(error: string, maxItems: number): string {
  if (error.includes('product_already_ordered'))
    return 'Один из товаров вы уже заказывали. Повторно этот товар заказать нельзя.'
  if (error.includes('one_unit_per_product_only'))
    return 'Можно заказать только 1 единицу одного товара.'
  if (error.includes('one_variant_per_product_only'))
    return 'Нельзя выбрать несколько вариантов одного товара.'
  if (error.includes('max_unique_products_exceeded'))
    return `Лимит — ${maxItems} ${decline(maxItems, ['позиция', 'позиции', 'позиций'])} на сотрудника, включая уже оформленные заказы.`
  if (error.includes('delivery_type_not_available'))
    return 'Этот способ получения пока недоступен. Выберите офис или почту.'
  if (error.includes('delivery_address_required'))
    return 'Укажите адрес, куда отправить посылку.'
  if (error.includes('phone_required'))
    return 'Укажите телефон для связи.'
  if (error.includes('employee_tenure_too_short'))
    return 'Мерч доступен сотрудникам, отработавшим больше 3 месяцев.'
  if (error.includes('employee_not_in_directory') || error.includes('employee_inactive'))
    return 'Ваш доступ к мерчу не найден в HR-реестре. Обратитесь к HR или администратору.'
  if (error.includes('product_is_not_available'))
    return 'Один из выбранных товаров закончился. Обновите страницу и выберите другой.'
  return error || 'Не удалось оформить заказ'
}

function getMerchAccessMessage(access: MerchAccess) {
  if (access.reason === 'employee_tenure_too_short') {
    return 'Мерч доступен сотрудникам, отработавшим больше 3 месяцев.'
  }

  if (access.reason === 'employee_not_in_directory') {
    return 'Ваш email не найден в HR-реестре сотрудников.'
  }

  if (access.reason === 'employee_inactive') {
    return 'Ваш доступ к мерчу отключён. Обратитесь к HR или администратору.'
  }

  return 'Сейчас оформление мерча недоступно. Обратитесь к HR или администратору.'
}
