'use client'

import AppNav from '@/components/AppNav'
import ProductImage from '@/components/ProductImage'
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
  qty: number
}

type SortMode = 'rec' | 'abc'

/** Способы, которые можно выбрать в корзине. ПВЗ и курьер показаны неактивными. */
type CheckoutDeliveryType = 'office' | 'post'

type CheckoutDefaults = {
  deliveryType: CheckoutDeliveryType
  deliveryAddress: string
  phone: string
  country: string
}

type HandoutInfo = {
  place: string | null
  deadline: string | null
}

type MerchAccess = {
  isAllowed: boolean
  reason: string
  hiredAt: string | null
  monthsWorked: number | null
}

type CatalogClientProps = {
  products: CatalogProduct[]
  userEmail: string | null
  userName: string | null
  isAdmin: boolean
  checkoutDefaults: CheckoutDefaults
  handout: HandoutInfo
  merchAccess: MerchAccess
}

/* ─────────────────────────────────────────────────────────────────────────── */
/*  Constants                                                                   */
/* ─────────────────────────────────────────────────────────────────────────── */

const MAX_UNIQUE_PRODUCTS = 3

const ALL = 'all'
const ONE_SIZE = 'ONE SIZE'
const SIZE_ORDER = ['XXS', 'XS', 'S', 'M', 'L', 'XL', 'XXL', '2XL', 'XXXL', '3XL', '4XL']

const DELIVERY_OPTIONS: Array<{
  value: CheckoutDeliveryType | 'pvz' | 'courier'
  title: string
  hint: string
  disabled?: boolean
}> = [
  { value: 'office',  title: 'В офисе',     hint: 'Заберёте по коду заказа' },
  { value: 'post',    title: 'Почтой BTS',  hint: 'Для удалёнщиков' },
  { value: 'pvz',     title: 'ПВЗ',         hint: 'Скоро',  disabled: true },
  { value: 'courier', title: 'Курьер',      hint: 'Скоро',  disabled: true },
]

const RULES = [
  `До ${MAX_UNIQUE_PRODUCTS} уникальных позиций в заказе`,
  'Один товар — одна штука',
  'Разные размеры одного товара считаются одной позицией',
  'Получение — в офисе или почтой для удалёнщиков',
  'Доступно сотрудникам со стажем от 3 месяцев',
]

/* ─────────────────────────────────────────────────────────────────────────── */
/*  CatalogClient                                                               */
/* ─────────────────────────────────────────────────────────────────────────── */

export default function CatalogClient({
  products,
  userEmail,
  userName,
  isAdmin,
  checkoutDefaults,
  handout,
  merchAccess,
}: CatalogClientProps) {
  /* Cart */
  const [cart, setCart] = useState<CartItem[]>([])

  /* Checkout form */
  const [deliveryType,    setDeliveryType]    = useState<CheckoutDeliveryType>(checkoutDefaults.deliveryType)
  const [deliveryAddress, setDeliveryAddress] = useState(checkoutDefaults.deliveryAddress)
  const [phone,           setPhone]           = useState(checkoutDefaults.phone)
  const [country,         setCountry]         = useState(checkoutDefaults.country)
  const [comment,         setComment]         = useState('')
  const [isSubmitting,    setIsSubmitting]    = useState(false)
  const [checkoutError,   setCheckoutError]   = useState<string | null>(null)
  const [checkoutSuccess, setCheckoutSuccess] = useState<string | null>(null)

  /* Filters */
  const [category, setCategory] = useState<string>(ALL)
  const [size,     setSize]     = useState<string>(ALL)
  const [search,   setSearch]   = useState('')
  const [sortMode, setSortMode] = useState<SortMode>('rec')

  /* Derived */
  const categories = useMemo(
    () =>
      Array.from(new Set(products.map(p => p.category_name).filter(Boolean) as string[]))
        .sort((a, b) => a.localeCompare(b, 'ru')),
    [products]
  )

  const sizes = useMemo(
    () =>
      Array.from(new Set(products.flatMap(p => p.variants.map(getSizeKey))))
        .sort(compareSizes),
    [products]
  )

  const filteredProducts = useMemo(() => {
    const q = search.trim().toLowerCase()
    const filtered = products.filter(p => {
      const catMatch  = category === ALL || p.category_name === category
      const sizeMatch = size === ALL || p.variants.some(v => getSizeKey(v) === size)
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

  const hasFilters = category !== ALL || size !== ALL || search.trim().length > 0
  const firstName  = getUserFirstName(userName, userEmail)
  const initials   = getInitials(userName, userEmail)

  function resetFilters() {
    setCategory(ALL)
    setSize(ALL)
    setSearch('')
  }

  /* Cart actions */
  function isProductInCart(productId: string) {
    return cart.some(item => item.product.id === productId)
  }

  function addToCart(product: CatalogProduct, variant: CatalogVariant) {
    setCheckoutError(null)
    setCheckoutSuccess(null)
    if (variant.available_qty <= 0) {
      setCheckoutError('Этот товар сейчас недоступен для заказа.')
      return
    }
    if (isProductInCart(product.id)) {
      setCheckoutError('Этот товар уже в корзине. Можно заказать только 1 единицу одного товара.')
      return
    }
    if (cart.length >= MAX_UNIQUE_PRODUCTS) {
      setCheckoutError(`Можно выбрать не больше ${MAX_UNIQUE_PRODUCTS} уникальных позиций.`)
      return
    }
    setCart(cur => [...cur, { product, variant, qty: 1 }])
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
    if (cart.length > MAX_UNIQUE_PRODUCTS) {
      setCheckoutError(`Можно выбрать не больше ${MAX_UNIQUE_PRODUCTS} уникальных позиций.`)
      return
    }
    if (deliveryType === 'post' && (!country.trim() || !deliveryAddress.trim() || !phone.trim())) {
      setCheckoutError('Для отправки почтой укажите страну, адрес и телефон.')
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
          phone,
          comment,
          country:          deliveryType === 'post' ? country : null,
        }),
      })

      const result = await res.json()

      if (!res.ok) {
        setCheckoutError(getCheckoutErrorMessage(result.error))
        return
      }

      // Телефон и адрес не сбрасываем — при следующем заказе они подставятся снова.
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

            <div className="head-user" title={userEmail ?? undefined}>
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
        <div className="catalog-body">

          {/* Filters sidebar */}
          <aside className="filters" aria-label="Фильтры">
            <label className="filters-block">
              <span className="filters-label">Поиск</span>
              <input
                className="filters-input"
                placeholder="Худи, шоппер, блокнот…"
                value={search}
                onChange={e => setSearch(e.target.value)}
              />
            </label>

            <label className="filters-block">
              <span className="filters-label">Категория</span>
              <select
                className="filters-input filters-select"
                value={category}
                onChange={e => setCategory(e.target.value)}
              >
                <option value={ALL}>Все категории</option>
                {categories.map(cat => (
                  <option key={cat} value={cat}>{cat}</option>
                ))}
              </select>
            </label>

            {sizes.length > 1 && (
              <label className="filters-block">
                <span className="filters-label">Размер</span>
                <select
                  className="filters-input filters-select"
                  value={size}
                  onChange={e => setSize(e.target.value)}
                >
                  <option value={ALL}>Все размеры</option>
                  {sizes.map(s => (
                    <option key={s} value={s}>{s}</option>
                  ))}
                </select>
              </label>
            )}

            {hasFilters && (
              <button type="button" className="filters-reset" onClick={resetFilters}>
                Сбросить фильтры
              </button>
            )}

            <div className="filters-note">
              <span className="kicker">Правила</span>
              <ol className="rules-list">
                {RULES.map((rule, index) => (
                  <li key={rule}>
                    <span className="rules-num">{index + 1}</span>
                    {rule}
                  </li>
                ))}
              </ol>
            </div>
          </aside>

          {/* Grid area */}
          <main className="grid-wrap">
            {!merchAccess.isAllowed && (
              <div className="form-error catalog-access">
                {getMerchAccessMessage(merchAccess)}
              </div>
            )}

            <div className="grid-head">
              <div className="grid-count">
                Выбрано <span className="num">{cart.length}</span> из{' '}
                <span className="num num-accent">{MAX_UNIQUE_PRODUCTS}</span>
                <span className="grid-count-mute">
                  {' '}· {filteredProducts.length}{' '}
                  {decline(filteredProducts.length, ['товар', 'товара', 'товаров'])}
                </span>
              </div>
              <label className="grid-sort">
                <span className="kicker">Сортировка</span>
                <select
                  className="sort-select"
                  value={sortMode}
                  onChange={e => setSortMode(e.target.value as SortMode)}
                >
                  <option value="rec">Рекомендуем</option>
                  <option value="abc">По алфавиту</option>
                </select>
              </label>
            </div>

            <div id="catalog-grid" className="grid-layout">
              <div className="grid grid-cols">
                {filteredProducts.length === 0 ? (
                  <div className="empty">
                    <div className="empty-mark">∅</div>
                    <h3>Товары не найдены</h3>
                    <p>Измените фильтры или сбросьте их.</p>
                    {hasFilters && (
                      <button type="button" className="filters-reset" onClick={resetFilters}>
                        Сбросить фильтры
                      </button>
                    )}
                  </div>
                ) : (
                  filteredProducts.map(product => (
                    <ProductCard
                      // При смене фильтра размера карточка пересоздаётся и
                      // подставляет вариант этого размера по умолчанию.
                      key={`${product.id}:${size}`}
                      product={product}
                      preferredSize={size === ALL ? null : size}
                      isInCart={isProductInCart(product.id)}
                      isBlocked={!merchAccess.isAllowed || cart.length >= MAX_UNIQUE_PRODUCTS}
                      onAddToCart={addToCart}
                    />
                  ))
                )}
              </div>

              <CartAside
                cart={cart}
                deliveryType={deliveryType}
                deliveryAddress={deliveryAddress}
                phone={phone}
                country={country}
                comment={comment}
                handout={handout}
                isSubmitting={isSubmitting}
                checkoutError={checkoutError}
                checkoutSuccess={checkoutSuccess}
                merchAccess={merchAccess}
                onRemove={removeFromCart}
                onDeliveryTypeChange={setDeliveryType}
                onDeliveryAddressChange={setDeliveryAddress}
                onPhoneChange={setPhone}
                onCountryChange={setCountry}
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

function ProductCard({
  product,
  preferredSize,
  isInCart,
  isBlocked,
  onAddToCart,
}: {
  product: CatalogProduct
  preferredSize: string | null
  isInCart: boolean
  isBlocked: boolean
  onAddToCart: (product: CatalogProduct, variant: CatalogVariant) => void
}) {
  const [selectedVariantId, setSelectedVariantId] = useState(
    (preferredSize && product.variants.find(v => getSizeKey(v) === preferredSize)?.id) ||
      product.variants[0]?.id ||
      ''
  )

  const selectedVariant =
    product.variants.find(v => v.id === selectedVariantId) ??
    product.variants[0]

  const imageUrl = product.image_url || product.images?.[0] || ''
  const hasMultipleVariants = product.variants.length > 1

  const totalAvail  = product.variants.reduce((s, v) => s + v.available_qty, 0)
  const stockClass  = totalAvail > 4 ? 'card-stock-ok' : totalAvail > 0 ? 'card-stock-low' : 'card-stock-out'
  const stockText   = totalAvail > 0 ? `${totalAvail} шт.` : 'Нет в наличии'

  const canAdd = !isBlocked && !isInCart && !!selectedVariant && selectedVariant.available_qty > 0

  return (
    <article className="card">
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
        {isInCart && <span className="card-badge card-badge-cart">В корзине</span>}
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
            value={selectedVariantId}
            onChange={e => setSelectedVariantId(e.target.value)}
            disabled={isInCart}
          >
            {product.variants.map(v => (
              <option key={v.id} value={v.id}>{formatVariant(v)}</option>
            ))}
          </select>
        </label>

        <button
          type="button"
          className={`card-btn${isInCart ? ' in-cart' : ''}`}
          disabled={!canAdd}
          onClick={() => selectedVariant && onAddToCart(product, selectedVariant)}
        >
          {isInCart ? 'Уже в корзине' : 'Добавить'}
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
  deliveryType,
  deliveryAddress,
  phone,
  country,
  comment,
  handout,
  isSubmitting,
  checkoutError,
  checkoutSuccess,
  merchAccess,
  onRemove,
  onDeliveryTypeChange,
  onDeliveryAddressChange,
  onPhoneChange,
  onCountryChange,
  onCommentChange,
  onCheckout,
}: {
  cart: CartItem[]
  deliveryType: CheckoutDeliveryType
  deliveryAddress: string
  phone: string
  country: string
  comment: string
  handout: HandoutInfo
  isSubmitting: boolean
  checkoutError: string | null
  checkoutSuccess: string | null
  merchAccess: MerchAccess
  onRemove: (variantId: string) => void
  onDeliveryTypeChange: (value: CheckoutDeliveryType) => void
  onDeliveryAddressChange: (value: string) => void
  onPhoneChange: (value: string) => void
  onCountryChange: (value: string) => void
  onCommentChange: (value: string) => void
  onCheckout: () => void
}) {
  const isPost = deliveryType === 'post'

  return (
    <aside className="cart-aside" id="cart-aside">
      <div className="cart-header">
        <p className="aside-title">Корзина</p>
        <span className="cart-limit">
          {cart.length} / {MAX_UNIQUE_PRODUCTS}{' '}
          {decline(MAX_UNIQUE_PRODUCTS, ['позиция', 'позиции', 'позиций'])}
        </span>
      </div>

      {checkoutSuccess && <CheckoutSuccessCard message={checkoutSuccess} />}

      {cart.length === 0 ? (
        <>
          <div className="cart-empty">
            <div className="cart-empty-mark">+</div>
            <p className="cart-empty-title">Пока пусто</p>
            <p className="cart-empty-text">
              Добавьте до {MAX_UNIQUE_PRODUCTS} позиций из каталога.
            </p>
          </div>
          {checkoutError && <div className="form-error">{checkoutError}</div>}
          <p className="cart-note">Способ получения укажете при оформлении.</p>
          <button type="button" className="checkout-btn" disabled>
            Оформить заказ
          </button>
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
              {DELIVERY_OPTIONS.map(option => {
                const isOn = option.value === deliveryType
                return (
                  <label
                    key={option.value}
                    className={`delivery-option${isOn ? ' is-on' : ''}${option.disabled ? ' is-disabled' : ''}`}
                  >
                    <input
                      type="radio"
                      name="delivery-type"
                      value={option.value}
                      checked={isOn}
                      disabled={option.disabled}
                      onChange={() => onDeliveryTypeChange(option.value as CheckoutDeliveryType)}
                    />
                    <span className="delivery-option-body">
                      <b>{option.title}</b>
                      <span>{option.hint}</span>
                    </span>
                  </label>
                )
              })}
            </fieldset>

            {!isPost && (handout.place || handout.deadline) && (
              <div className="delivery-info">
                {handout.place && <span><b>Где:</b> {handout.place}</span>}
                {handout.deadline && <span><b>Когда:</b> {formatDateTime(handout.deadline)}</span>}
              </div>
            )}

            {isPost && (
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
                  Город и адрес
                  <input
                    type="text"
                    className="form-input"
                    value={deliveryAddress}
                    onChange={e => onDeliveryAddressChange(e.target.value)}
                    placeholder="Самарканд, ул. …, дом, кв."
                  />
                </label>
              </>
            )}

            <label className="form-label">
              Телефон{isPost ? '' : ' (необязательно)'}
              <input
                type="tel"
                className="form-input"
                value={phone}
                onChange={e => onPhoneChange(e.target.value)}
                placeholder="+998..."
              />
            </label>

            <label className="form-label">
              Комментарий
              <textarea
                className="form-textarea"
                value={comment}
                onChange={e => onCommentChange(e.target.value)}
                placeholder="Комментарий к заказу"
              />
            </label>

            {checkoutError && (
              <div className="form-error">{checkoutError}</div>
            )}
            {!merchAccess.isAllowed && (
              <div className="form-error">{getMerchAccessMessage(merchAccess)}</div>
            )}

            <button
              type="button"
              className="checkout-btn"
              disabled={isSubmitting || !merchAccess.isAllowed}
              onClick={onCheckout}
            >
              {isSubmitting ? 'Оформляем…' : 'Оформить заказ'}
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
          Мы сохранили вашу заявку. Статус обработки можно отслеживать в разделе «Мои заказы».
        </p>
        <div className="confirm-actions">
          <a href="/orders" className="confirm-primary-link">Перейти в мои заказы</a>
          <a href="#catalog-grid" className="confirm-ghost-link">Продолжить выбор</a>
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

function formatVariant(variant: CatalogVariant) {
  const size  = variant.size  || ONE_SIZE
  const color = variant.color || 'Без цвета'
  return `${size} · ${color}`
}

function getSizeKey(variant: CatalogVariant) {
  return variant.size?.trim().toUpperCase() || ONE_SIZE
}

/** XS → S → M → L → XL …, затем прочие по алфавиту, ONE SIZE — в конце. */
function compareSizes(a: string, b: string) {
  if (a === ONE_SIZE) return 1
  if (b === ONE_SIZE) return -1
  const ia = SIZE_ORDER.indexOf(a)
  const ib = SIZE_ORDER.indexOf(b)
  if (ia !== -1 && ib !== -1) return ia - ib
  if (ia !== -1) return -1
  if (ib !== -1) return 1
  return a.localeCompare(b, 'ru', { numeric: true })
}

function formatDateTime(iso: string) {
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return iso
  return date.toLocaleString('ru-RU', {
    day: 'numeric',
    month: 'long',
    hour: '2-digit',
    minute: '2-digit',
    timeZone: 'Asia/Tashkent',
  })
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

function getCheckoutErrorMessage(error: string): string {
  if (error.includes('product_already_ordered'))
    return 'Один из выбранных товаров уже был заказан ранее. Повторный заказ недоступен.'
  if (error.includes('one_unit_per_product_only'))
    return 'Можно заказать только 1 единицу одного товара.'
  if (error.includes('one_variant_per_product_only'))
    return 'Нельзя выбрать несколько вариантов одного товара.'
  if (error.includes('max_unique_products_exceeded'))
    return 'Можно выбрать не больше трех уникальных позиций мерча.'
  if (error.includes('employee_tenure_too_short'))
    return 'Мерч доступен сотрудникам, отработавшим больше 3 месяцев.'
  if (error.includes('employee_not_in_directory') || error.includes('employee_inactive'))
    return 'Ваш доступ к мерчу не найден в HR-реестре. Обратитесь к HR или администратору.'
  if (error.includes('delivery_type_unavailable'))
    return 'Этот способ получения пока недоступен. Выберите «В офисе» или «Почтой BTS».'
  if (error.includes('post_details_required'))
    return 'Для отправки почтой укажите страну, адрес и телефон.'
  if (error.includes('invalid input value for enum'))
    return 'Отправка почтой ещё не включена на сервере. Обратитесь к администратору.'
  if (error.includes('product_is_not_available'))
    return 'Один из выбранных товаров сейчас недоступен для заказа.'
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
    return 'Ваш доступ к мерчу отключен. Обратитесь к HR или администратору.'
  }

  return 'Сейчас оформление мерча недоступно. Обратитесь к HR или администратору.'
}
