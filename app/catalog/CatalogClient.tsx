'use client'

import AppNav from '@/components/AppNav'
import { useMemo, useState, type CSSProperties } from 'react'

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

type DeliveryType = 'office' | 'pvz' | 'pickup' | 'courier'

type CheckoutDefaults = {
  deliveryType: DeliveryType
  deliveryAddress: string
  phone: string
}

type CatalogClientProps = {
  products: CatalogProduct[]
  userEmail: string | null
  isAdmin: boolean
  checkoutDefaults: CheckoutDefaults
}

const deliveryLabels: Record<DeliveryType, string> = {
  office: 'В офис',
  pvz: 'ПВЗ / филиал',
  pickup: 'Самовывоз',
  courier: 'Курьер',
}

function getCheckoutErrorMessage(error: string) {
  if (error.includes('product_already_ordered')) {
    return 'Один из выбранных товаров уже был заказан ранее. Повторный заказ этого товара недоступен.'
  }

  if (error.includes('one_unit_per_product_only')) {
    return 'Можно заказать только 1 единицу одного товара.'
  }

  if (error.includes('one_variant_per_product_only')) {
    return 'Нельзя выбрать несколько вариантов одного товара.'
  }

  if (error.includes('product_is_not_available')) {
    return 'Один из выбранных товаров сейчас недоступен для заказа.'
  }

  return error || 'Не удалось оформить заказ'
}

export default function CatalogClient({
  products,
  userEmail,
  isAdmin,
  checkoutDefaults,
}: CatalogClientProps) {
  const [cart, setCart] = useState<CartItem[]>([])

  const [deliveryType, setDeliveryType] = useState<DeliveryType>(
    checkoutDefaults.deliveryType
  )

  const [deliveryAddress, setDeliveryAddress] = useState(
    checkoutDefaults.deliveryAddress
  )

  const [phone, setPhone] = useState(checkoutDefaults.phone)
  const [comment, setComment] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [checkoutError, setCheckoutError] = useState<string | null>(null)
  const [checkoutSuccess, setCheckoutSuccess] = useState<string | null>(null)

  const [selectedCategory, setSelectedCategory] = useState<string>('Все')
  const [search, setSearch] = useState('')

  const categories = useMemo(() => {
    const uniqueCategories = Array.from(
      new Set(
        products
          .map((product) => product.category_name)
          .filter(Boolean) as string[]
      )
    )

    return ['Все', ...uniqueCategories]
  }, [products])

  const filteredProducts = useMemo(() => {
    return products.filter((product) => {
      const categoryMatch =
        selectedCategory === 'Все' || product.category_name === selectedCategory

      const searchValue = search.trim().toLowerCase()

      const searchMatch =
        searchValue.length === 0 ||
        product.name.toLowerCase().includes(searchValue) ||
        product.description?.toLowerCase().includes(searchValue) ||
        product.category_name?.toLowerCase().includes(searchValue) ||
        product.material?.toLowerCase().includes(searchValue)

      return categoryMatch && searchMatch
    })
  }, [products, selectedCategory, search])

  const totalQty = cart.length
  const firstName = getUserName(userEmail)
  const categoryCount = Math.max(0, categories.length - 1)

  function isProductInCart(productId: string) {
    return cart.some((item) => item.product.id === productId)
  }

  function addToCart(product: CatalogProduct, variant: CatalogVariant) {
    setCheckoutError(null)
    setCheckoutSuccess(null)

    if (variant.available_qty <= 0) {
      alert('Этот товар сейчас недоступен для заказа')
      return
    }

    if (isProductInCart(product.id)) {
      alert(
        'Этот товар уже добавлен в корзину. Можно заказать только 1 единицу одного товара.'
      )
      return
    }

    setCart((currentCart) => [...currentCart, { product, variant, qty: 1 }])
  }

  function removeFromCart(variantId: string) {
    setCart((currentCart) =>
      currentCart.filter((item) => item.variant.id !== variantId)
    )
  }

  async function handleCheckout() {
    if (cart.length === 0) {
      setCheckoutError('Корзина пустая')
      return
    }

    setIsSubmitting(true)
    setCheckoutError(null)
    setCheckoutSuccess(null)

    try {
      const response = await fetch('/api/orders', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          items: cart.map((item) => ({
            variant_id: item.variant.id,
            qty: 1,
          })),
          delivery_type: deliveryType,
          delivery_address: deliveryAddress,
          phone,
          comment,
        }),
      })

      const result = await response.json()

      if (!response.ok) {
        setCheckoutError(getCheckoutErrorMessage(result.error))
        return
      }

      const orderNumber = result.order?.order_number

      setCart([])
      setDeliveryAddress(checkoutDefaults.deliveryAddress)
      setPhone(checkoutDefaults.phone)
      setComment('')

      setCheckoutSuccess(
        orderNumber
          ? `Заказ #${orderNumber} успешно создан`
          : 'Заказ успешно создан'
      )
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Неизвестная ошибка'

      setCheckoutError(message)
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <main style={styles.page}>
      <header style={styles.siteHead}>
        <div style={styles.headInner}>
          <a href="/catalog" style={styles.brand}>
            <img src="/brand/uzum-logo.svg" alt="Uzum" style={styles.logo} />

            <span style={styles.brandName}>
              uzum <span style={styles.brandNameSoft}>мерч</span>
            </span>

            <span style={styles.brandSub}>внутренний портал</span>
          </a>

          <AppNav isAdmin={isAdmin} />
        </div>
      </header>

      <section style={styles.hero}>
        <div style={styles.heroGreeting}>
          <div style={styles.kicker}>Корпоративный магазин · Uzum</div>

          <h1 style={styles.display}>
            Привет, {firstName}.<br />
            <span style={styles.displayAccent}>Что-нибудь</span> подберём?
          </h1>

          <p style={styles.lead}>
            Здесь корпоративный мерч, канцелярия и подарочные наборы. Выберите
            товары и оформите заявку на получение.
          </p>

          <div style={styles.heroActions}>
            <button
              type="button"
              style={styles.primaryButton}
              onClick={() => {
                document
                  .getElementById('catalog-grid')
                  ?.scrollIntoView({ behavior: 'smooth' })
              }}
            >
              Посмотреть каталог ↓
            </button>

            <a href="/orders" style={styles.ghostButton}>
              Мои заказы →
            </a>
          </div>
        </div>

        <aside style={styles.profileMini}>
          <div style={styles.profileTop}>
            <span style={styles.kicker}>Профиль</span>

            <div style={styles.avatar}>{getInitials(userEmail)}</div>
          </div>

          <div style={styles.profileRows}>
            <ProfileRow label="Email" value={userEmail || 'Не указан'} />
            <ProfileRow label="Получение" value={deliveryLabels[deliveryType]} />
            <ProfileRow
              label="Адрес"
              value={deliveryAddress || 'Заполните в профиле'}
            />
          </div>

          <div style={styles.profileHint}>
            Данные можно изменить перед оформлением заказа.
          </div>
        </aside>
      </section>

      <nav style={styles.catNav} aria-label="Категории">
        {categories.map((category) => (
          <button
            key={category}
            type="button"
            style={{
              ...styles.catPill,
              ...(selectedCategory === category ? styles.catPillActive : {}),
            }}
            onClick={() => setSelectedCategory(category)}
          >
            {category}
          </button>
        ))}
      </nav>

      <section style={styles.catalogBody}>
        <aside style={styles.filters}>
          <div style={styles.filtersBlock}>
            <label style={styles.filtersLabel}>Поиск</label>

            <input
              style={styles.filtersInput}
              placeholder="Худи, шоппер, блокнот…"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
            />
          </div>

          <div style={styles.filtersNote}>
            <div style={styles.kicker}>Правило</div>
            <p style={styles.filtersText}>
              Один товар можно заказать только в количестве одной штуки.
            </p>
          </div>

          <div style={styles.filtersNote}>
            <div style={styles.kicker}>Каталог</div>
            <p style={styles.filtersText}>
              Сейчас доступно {products.length} товаров в {categoryCount}{' '}
              {decline(categoryCount, ['категории', 'категориях', 'категориях'])}.
            </p>
          </div>
        </aside>

        <main style={styles.gridWrap}>
          <div style={styles.gridHead}>
            <div style={styles.gridCount}>
              <span style={styles.num}>{filteredProducts.length}</span>{' '}
              {decline(filteredProducts.length, [
                'товар',
                'товара',
                'товаров',
              ])}
            </div>

            <div style={styles.gridSort}>
              <span style={styles.kicker}>Сортировка</span>

              <select style={styles.sortSelect} defaultValue="rec">
                <option value="rec">Рекомендуем</option>
                <option value="abc">По алфавиту</option>
              </select>
            </div>
          </div>

          <div id="catalog-grid" style={styles.layout}>
            <div style={styles.grid}>
              {filteredProducts.length === 0 ? (
                <div style={styles.empty}>
                  <div style={styles.emptyMark}>∅</div>
                  <h3 style={styles.emptyTitle}>Товары не найдены</h3>
                  <p style={styles.emptyText}>
                    Сбросьте поиск или выберите другую категорию.
                  </p>
                </div>
              ) : (
                filteredProducts.map((product) => (
                  <ProductCard
                    key={product.id}
                    product={product}
                    isInCart={isProductInCart(product.id)}
                    onAddToCart={addToCart}
                  />
                ))
              )}
            </div>

            <CartAside
              cart={cart}
              totalQty={totalQty}
              deliveryType={deliveryType}
              deliveryAddress={deliveryAddress}
              phone={phone}
              comment={comment}
              isSubmitting={isSubmitting}
              checkoutError={checkoutError}
              checkoutSuccess={checkoutSuccess}
              onRemove={removeFromCart}
              onDeliveryTypeChange={setDeliveryType}
              onDeliveryAddressChange={setDeliveryAddress}
              onPhoneChange={setPhone}
              onCommentChange={setComment}
              onCheckout={handleCheckout}
            />
          </div>
        </main>
      </section>
    </main>
  )
}

function ProductCard({
  product,
  isInCart,
  onAddToCart,
}: {
  product: CatalogProduct
  isInCart: boolean
  onAddToCart: (product: CatalogProduct, variant: CatalogVariant) => void
}) {
  const [selectedVariantId, setSelectedVariantId] = useState(
    product.variants[0]?.id ?? ''
  )

  const selectedVariant =
    product.variants.find((variant) => variant.id === selectedVariantId) ??
    product.variants[0]

  const imageUrl = product.image_url || product.images?.[0] || ''
  const hasMultipleVariants = product.variants.length > 1

  return (
    <article style={styles.card}>
      <div style={styles.cardArt}>
        {imageUrl ? (
          <img src={imageUrl} alt={product.name} style={styles.productImage} />
        ) : (
          <div style={styles.productArtPlaceholder}>
            <div style={styles.productArtShape}>{getProductLetter(product.name)}</div>
          </div>
        )}

        {isInCart && <span style={styles.cardBadgeCart}>В корзине</span>}
      </div>

      <div style={styles.cardBody}>
        <div style={styles.cardTop}>
          <span style={styles.cardKind}>
            {product.category_name || 'Мерч'}
          </span>

          <span style={styles.cardVariants}>
            {product.variants.length}{' '}
            {decline(product.variants.length, [
              'вариант',
              'варианта',
              'вариантов',
            ])}
          </span>
        </div>

        <h3 style={styles.cardName}>{product.name}</h3>

        <p style={styles.cardDescription}>
          {product.description || 'Описание товара пока не заполнено.'}
        </p>

        {product.material && (
          <div style={styles.cardMeta}>
            <span style={styles.metaChip}>Материал: {product.material}</span>
          </div>
        )}

        <label style={styles.variantLabel}>
          {hasMultipleVariants ? 'Выберите вариант' : 'Вариант'}
          <select
            value={selectedVariantId}
            onChange={(event) => setSelectedVariantId(event.target.value)}
            style={styles.variantSelect}
            disabled={isInCart}
          >
            {product.variants.map((variant) => (
              <option key={variant.id} value={variant.id}>
                {formatVariant(variant)}
              </option>
            ))}
          </select>
        </label>

        <button
          type="button"
          style={{
            ...styles.cardButton,
            ...(isInCart || !selectedVariant || selectedVariant.available_qty <= 0
              ? styles.cardButtonDisabled
              : {}),
          }}
          disabled={isInCart || !selectedVariant || selectedVariant.available_qty <= 0}
          onClick={() => onAddToCart(product, selectedVariant)}
        >
          {isInCart ? 'Уже в корзине' : 'Добавить'}
        </button>
      </div>
    </article>
  )
}

function CartAside({
  cart,
  totalQty,
  deliveryType,
  deliveryAddress,
  phone,
  comment,
  isSubmitting,
  checkoutError,
  checkoutSuccess,
  onRemove,
  onDeliveryTypeChange,
  onDeliveryAddressChange,
  onPhoneChange,
  onCommentChange,
  onCheckout,
}: {
  cart: CartItem[]
  totalQty: number
  deliveryType: DeliveryType
  deliveryAddress: string
  phone: string
  comment: string
  isSubmitting: boolean
  checkoutError: string | null
  checkoutSuccess: string | null
  onRemove: (variantId: string) => void
  onDeliveryTypeChange: (value: DeliveryType) => void
  onDeliveryAddressChange: (value: string) => void
  onPhoneChange: (value: string) => void
  onCommentChange: (value: string) => void
  onCheckout: () => void
}) {
  return (
    <aside style={styles.cart}>
      <div style={styles.cartHeader}>
        <div>
          <div style={styles.asideTitle}>Корзина</div>

          <p style={styles.asideSubtitle}>
            {cart.length > 0
              ? `${cart.length} ${decline(cart.length, [
                  'товар',
                  'товара',
                  'товаров',
                ])}`
              : 'Пока пусто'}
          </p>
        </div>

        <div style={styles.cartCounter}>{totalQty}</div>
      </div>

      {checkoutSuccess && (
        <CheckoutSuccessCard message={checkoutSuccess} />
      )}

      {cart.length === 0 ? (
        <div style={styles.cartEmpty}>
          <div style={styles.cartEmptyMark}>+</div>
          <p style={styles.cartEmptyText}>
            Добавьте товары из каталога, чтобы оформить заявку.
          </p>
        </div>
      ) : (
        <>
          <div style={styles.cartLines}>
            {cart.map((item) => (
              <div key={item.variant.id} style={styles.cartLine}>
                <div style={styles.cartLineInfo}>
                  <b>{item.product.name}</b>
                  <span>{formatVariant(item.variant)} · 1 шт.</span>
                </div>

                <button
                  type="button"
                  style={styles.removeButton}
                  onClick={() => onRemove(item.variant.id)}
                >
                  ×
                </button>
              </div>
            ))}
          </div>

          <div style={styles.cartSummary}>
            <SummaryRow label="Товаров" value={String(cart.length)} />
            <SummaryRow label="Количество" value={`${cart.length} шт.`} />
            <SummaryRow label="Получение" value={deliveryLabels[deliveryType]} />
          </div>

          <div style={styles.checkoutForm}>
            <label style={styles.checkoutLabel}>
              Способ получения
              <select
                value={deliveryType}
                onChange={(event) =>
                  onDeliveryTypeChange(event.target.value as DeliveryType)
                }
                style={styles.checkoutInput}
              >
                <option value="office">В офис</option>
                <option value="pvz">ПВЗ / филиал</option>
                <option value="pickup">Самовывоз</option>
                <option value="courier">Курьер</option>
              </select>
            </label>

            <label style={styles.checkoutLabel}>
              Адрес / офис / точка получения
              <input
                type="text"
                value={deliveryAddress}
                onChange={(event) =>
                  onDeliveryAddressChange(event.target.value)
                }
                placeholder="Например: Ташкент, офис Сергели"
                style={styles.checkoutInput}
              />
            </label>

            <label style={styles.checkoutLabel}>
              Телефон
              <input
                type="tel"
                value={phone}
                onChange={(event) => onPhoneChange(event.target.value)}
                placeholder="+998..."
                style={styles.checkoutInput}
              />
            </label>

            <label style={styles.checkoutLabel}>
              Комментарий
              <textarea
                value={comment}
                onChange={(event) => onCommentChange(event.target.value)}
                placeholder="Комментарий к заказу"
                style={styles.checkoutTextarea}
              />
            </label>

            {checkoutError && (
              <div style={styles.checkoutError}>{checkoutError}</div>
            )}

            <button
              type="button"
              style={{
                ...styles.checkoutButton,
                ...(isSubmitting ? styles.checkoutButtonDisabled : {}),
              }}
              disabled={isSubmitting}
              onClick={onCheckout}
            >
              {isSubmitting ? 'Оформляем...' : 'Оформить заказ'}
            </button>
          </div>
        </>
      )}
    </aside>
  )
}
function CheckoutSuccessCard({ message }: { message: string }) {
  return (
    <div style={styles.confirmCard}>
      <div style={styles.confirmIcon}>✓</div>

      <div style={styles.confirmContent}>
        <div style={styles.confirmKicker}>Заявка оформлена</div>

        <h3 style={styles.confirmTitle}>{message}</h3>

        <p style={styles.confirmText}>
          Мы сохранили вашу заявку. Статус обработки можно отслеживать в разделе
          “Мои заказы”.
        </p>

        <div style={styles.confirmActions}>
          <a href="/orders" style={styles.confirmPrimaryLink}>
            Перейти в мои заказы
          </a>

          <a href="#catalog-grid" style={styles.confirmGhostLink}>
            Продолжить выбор
          </a>
        </div>
      </div>
    </div>
  )
}
function ProfileRow({ label, value }: { label: string; value: string }) {
  return (
    <div style={styles.profileRow}>
      <span>{label}</span>
      <b>{value}</b>
    </div>
  )
}

function SummaryRow({ label, value }: { label: string; value: string }) {
  return (
    <div style={styles.summaryRow}>
      <span>{label}</span>
      <b>{value}</b>
    </div>
  )
}

function formatVariant(variant: CatalogVariant) {
  const size = variant.size || 'ONE SIZE'
  const color = variant.color || 'Без цвета'

  return `${size} · ${color}`
}

function getUserName(email: string | null) {
  if (!email) {
    return 'коллега'
  }

  const localPart = email.split('@')[0] ?? 'коллега'

  return localPart
    .split(/[._-]/)
    .filter(Boolean)[0]
    ?.replace(/^./, (letter) => letter.toUpperCase()) ?? 'коллега'
}

function getInitials(email: string | null) {
  if (!email) {
    return 'U'
  }

  const localPart = email.split('@')[0] ?? 'U'
  const parts = localPart.split(/[._-]/).filter(Boolean)

  const first = parts[0]?.[0] ?? 'U'
  const second = parts[1]?.[0] ?? ''

  return `${first}${second}`.toUpperCase()
}

function getProductLetter(name: string) {
  return name.trim()[0]?.toUpperCase() ?? 'U'
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

  hero: {
    maxWidth: '1320px',
    margin: '0 auto',
    padding: '64px 48px 28px',
    display: 'grid',
    gridTemplateColumns: 'minmax(0, 1fr) 360px',
    gap: '28px',
    alignItems: 'stretch',
  },
  heroGreeting: {
    background:
      'radial-gradient(circle at 18% 10%, rgba(112,0,255,0.12), transparent 34%), var(--surface)',
    border: '1px solid var(--border)',
    borderRadius: 'var(--r-card)',
    padding: '34px',
    boxShadow: 'var(--shadow-card)',
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
    fontSize: 'clamp(40px, 5vw, 72px)',
    lineHeight: 1.02,
    letterSpacing: '-0.025em',
    margin: '12px 0 20px',
    color: 'var(--ink)',
  },
  displayAccent: {
    color: 'var(--accent)',
  },
  lead: {
    fontSize: '17px',
    color: 'var(--inkMute)',
    maxWidth: '64ch',
    margin: '0 0 24px',
    lineHeight: 1.55,
  },
  heroActions: {
    display: 'flex',
    gap: '10px',
    flexWrap: 'wrap',
  },
  primaryButton: {
    border: 0,
    background: 'var(--accent)',
    color: 'var(--accentInk)',
    borderRadius: 'var(--r-pill)',
    padding: '12px 18px',
    fontWeight: 800,
    cursor: 'pointer',
    boxShadow: '0 12px 26px rgba(112,0,255,0.18)',
  },
  ghostButton: {
    border: '1px solid var(--border)',
    background: 'var(--surface)',
    color: 'var(--ink)',
    borderRadius: 'var(--r-pill)',
    padding: '12px 18px',
    fontWeight: 800,
    cursor: 'pointer',
  },

  profileMini: {
    background: 'var(--surface)',
    border: '1px solid var(--border)',
    borderRadius: 'var(--r-card)',
    padding: '20px',
    boxShadow: 'var(--shadow-card)',
  },
  profileTop: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: '12px',
    marginBottom: '14px',
  },
  avatar: {
    width: '42px',
    height: '42px',
    borderRadius: '50%',
    background: 'var(--accent)',
    color: 'var(--accentInk)',
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontWeight: 800,
    fontSize: '13px',
  },
  profileRows: {
    display: 'flex',
    flexDirection: 'column',
    gap: '10px',
  },
  profileRow: {
    display: 'grid',
    gridTemplateColumns: '88px minmax(0, 1fr)',
    gap: '12px',
    alignItems: 'start',
    padding: '10px 0',
    borderBottom: '1px solid var(--border)',
    color: 'var(--inkMute)',
    fontSize: '13px',
  },
  profileHint: {
    marginTop: '14px',
    borderRadius: 'var(--r-md)',
    background: 'var(--chip)',
    color: 'var(--inkMute)',
    padding: '12px',
    fontSize: '13px',
    lineHeight: 1.45,
  },

  catNav: {
    maxWidth: '1320px',
    margin: '0 auto',
    padding: '0 48px 22px',
    display: 'flex',
    gap: '8px',
    flexWrap: 'wrap',
  },
  catPill: {
    border: '1px solid var(--border)',
    background: 'var(--surface)',
    color: 'var(--inkMute)',
    borderRadius: 'var(--r-pill)',
    padding: '10px 15px',
    fontSize: '14px',
    fontWeight: 800,
    cursor: 'pointer',
  },
  catPillActive: {
    background: 'var(--accent)',
    color: 'var(--accentInk)',
    borderColor: 'var(--accent)',
  },

  catalogBody: {
    maxWidth: '1320px',
    margin: '0 auto',
    padding: '0 48px',
    display: 'grid',
    gridTemplateColumns: '260px minmax(0, 1fr)',
    gap: '24px',
    alignItems: 'start',
  },
  filters: {
    position: 'sticky',
    top: '92px',
    display: 'flex',
    flexDirection: 'column',
    gap: '12px',
  },
  filtersBlock: {
    background: 'var(--surface)',
    border: '1px solid var(--border)',
    borderRadius: 'var(--r-card)',
    padding: '16px',
    boxShadow: 'var(--shadow-soft)',
  },
  filtersLabel: {
    display: 'block',
    marginBottom: '8px',
    color: 'var(--inkMute)',
    fontSize: '13px',
    fontWeight: 800,
  },
  filtersInput: {
    width: '100%',
    height: '42px',
    borderRadius: 'var(--r-md)',
    border: '1px solid var(--border)',
    background: 'var(--surface)',
    color: 'var(--ink)',
    padding: '0 12px',
    fontSize: '14px',
    fontWeight: 600,
  },
  filtersNote: {
    background: 'var(--surfaceAlt)',
    border: '1px solid var(--border)',
    borderRadius: 'var(--r-card)',
    padding: '16px',
  },
  filtersText: {
    margin: '8px 0 0',
    color: 'var(--inkMute)',
    fontSize: '14px',
    lineHeight: 1.5,
  },

  gridWrap: {
    minWidth: 0,
  },
  gridHead: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: '14px',
    marginBottom: '16px',
  },
  gridCount: {
    color: 'var(--inkMute)',
    fontSize: '15px',
    fontWeight: 700,
  },
  num: {
    fontFamily: 'var(--font-display)',
    fontSize: '32px',
    fontWeight: 700,
    color: 'var(--ink)',
  },
  gridSort: {
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
  },
  sortSelect: {
    height: '38px',
    borderRadius: 'var(--r-pill)',
    border: '1px solid var(--border)',
    background: 'var(--surface)',
    color: 'var(--ink)',
    padding: '0 12px',
    fontSize: '14px',
    fontWeight: 700,
  },
  layout: {
    display: 'grid',
    gridTemplateColumns: 'minmax(0, 1fr) 330px',
    gap: '20px',
    alignItems: 'start',
  },
  grid: {
    minWidth: 0,
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(245px, 1fr))',
    gap: '18px',
  },

  card: {
    background: 'var(--surface)',
    border: '1px solid var(--border)',
    borderRadius: 'var(--r-card)',
    overflow: 'hidden',
    boxShadow: 'var(--shadow-card)',
  },
  cardArt: {
    position: 'relative',
    height: '220px',
    background: 'var(--surfaceAlt)',
    overflow: 'hidden',
  },
  productImage: {
    width: '100%',
    height: '100%',
    objectFit: 'cover',
  },
  productArtPlaceholder: {
    width: '100%',
    height: '100%',
    background:
      'radial-gradient(circle at 25% 12%, rgba(112,0,255,0.15), transparent 30%), linear-gradient(135deg, var(--chip) 0%, var(--surface) 100%)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  productArtShape: {
    width: '92px',
    height: '92px',
    borderRadius: '28px',
    background: 'var(--accent)',
    color: 'var(--accentInk)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontFamily: 'var(--font-display)',
    fontSize: '42px',
    fontWeight: 800,
    boxShadow: '0 18px 40px rgba(112,0,255,0.2)',
  },
  cardBadgeCart: {
    position: 'absolute',
    left: '12px',
    top: '12px',
    background: 'var(--accent)',
    color: 'var(--accentInk)',
    borderRadius: 'var(--r-pill)',
    padding: '7px 11px',
    fontSize: '12px',
    fontWeight: 800,
  },
  cardBody: {
    padding: '16px',
  },
  cardTop: {
    display: 'flex',
    justifyContent: 'space-between',
    gap: '10px',
    alignItems: 'center',
    marginBottom: '8px',
  },
  cardKind: {
    color: 'var(--inkMute)',
    fontSize: '13px',
    fontWeight: 800,
  },
  cardVariants: {
    color: 'var(--inkMute)',
    background: 'var(--chip)',
    borderRadius: 'var(--r-pill)',
    padding: '5px 9px',
    fontSize: '12px',
    fontWeight: 800,
    whiteSpace: 'nowrap',
  },
  cardName: {
    fontFamily: 'var(--font-display)',
    fontWeight: 700,
    fontSize: '22px',
    lineHeight: 1.12,
    letterSpacing: '-0.02em',
    color: 'var(--ink)',
    margin: '0 0 8px',
  },
  cardDescription: {
    minHeight: '44px',
    margin: '0 0 12px',
    color: 'var(--inkMute)',
    fontSize: '14px',
    lineHeight: 1.45,
  },
  cardMeta: {
    display: 'flex',
    gap: '8px',
    flexWrap: 'wrap',
    marginBottom: '12px',
  },
  metaChip: {
    borderRadius: 'var(--r-pill)',
    background: 'var(--chip)',
    color: 'var(--inkMute)',
    padding: '6px 9px',
    fontSize: '12px',
    fontWeight: 800,
  },
  variantLabel: {
    display: 'flex',
    flexDirection: 'column',
    gap: '7px',
    color: 'var(--inkMute)',
    fontSize: '13px',
    fontWeight: 800,
  },
  variantSelect: {
    height: '42px',
    borderRadius: 'var(--r-md)',
    border: '1px solid var(--border)',
    background: 'var(--surface)',
    color: 'var(--ink)',
    padding: '0 12px',
    fontWeight: 700,
  },
  cardButton: {
    width: '100%',
    height: '44px',
    marginTop: '12px',
    borderRadius: 'var(--r-pill)',
    border: 0,
    background: 'var(--accent)',
    color: 'var(--accentInk)',
    fontWeight: 800,
    cursor: 'pointer',
  },
  cardButtonDisabled: {
    background: '#9ca3af',
    cursor: 'not-allowed',
  },

  cart: {
    position: 'sticky',
    top: '92px',
    background: 'var(--surface)',
    border: '1px solid var(--border)',
    borderRadius: 'var(--r-card)',
    padding: '16px',
    boxShadow: 'var(--shadow-card)',
  },
  cartHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    gap: '14px',
    alignItems: 'flex-start',
    marginBottom: '14px',
  },
  asideTitle: {
    fontFamily: 'var(--font-display)',
    color: 'var(--ink)',
    fontSize: '24px',
    fontWeight: 700,
    letterSpacing: '-0.02em',
  },
  asideSubtitle: {
    margin: '4px 0 0',
    color: 'var(--inkMute)',
    fontSize: '13px',
    fontWeight: 700,
  },
  cartCounter: {
    minWidth: '36px',
    height: '36px',
    borderRadius: '50%',
    background: 'var(--accent)',
    color: 'var(--accentInk)',
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontWeight: 800,
  },
  cartEmpty: {
    borderRadius: 'var(--r-card)',
    background: 'var(--surfaceAlt)',
    border: '1px dashed var(--border-strong)',
    padding: '20px',
    textAlign: 'center',
  },
  cartEmptyMark: {
    width: '42px',
    height: '42px',
    borderRadius: '16px',
    margin: '0 auto 10px',
    background: 'var(--chip)',
    color: 'var(--accent)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: '24px',
    fontWeight: 800,
  },
  cartEmptyText: {
    margin: 0,
    color: 'var(--inkMute)',
    fontSize: '14px',
    lineHeight: 1.45,
  },
  cartLines: {
    display: 'flex',
    flexDirection: 'column',
    gap: '10px',
  },
  cartLine: {
    display: 'flex',
    justifyContent: 'space-between',
    gap: '10px',
    alignItems: 'flex-start',
    border: '1px solid var(--border)',
    borderRadius: 'var(--r-md)',
    padding: '12px',
  },
  cartLineInfo: {
    minWidth: 0,
    display: 'flex',
    flexDirection: 'column',
    gap: '4px',
    color: 'var(--ink)',
    fontSize: '14px',
  },
  removeButton: {
    width: '28px',
    height: '28px',
    borderRadius: '50%',
    border: 0,
    background: '#fff5f5',
    color: '#d71920',
    fontSize: '18px',
    fontWeight: 800,
    cursor: 'pointer',
    flex: '0 0 auto',
  },
  cartSummary: {
    marginTop: '12px',
    padding: '12px',
    borderRadius: 'var(--r-md)',
    background: 'var(--surfaceAlt)',
    display: 'flex',
    flexDirection: 'column',
    gap: '8px',
  },
  summaryRow: {
    display: 'flex',
    justifyContent: 'space-between',
    gap: '10px',
    color: 'var(--inkMute)',
    fontSize: '13px',
    fontWeight: 700,
  },
  checkoutForm: {
    marginTop: '14px',
    display: 'flex',
    flexDirection: 'column',
    gap: '10px',
  },
  checkoutLabel: {
    display: 'flex',
    flexDirection: 'column',
    gap: '6px',
    color: 'var(--inkMute)',
    fontSize: '13px',
    fontWeight: 800,
  },
  checkoutInput: {
    height: '42px',
    borderRadius: 'var(--r-md)',
    border: '1px solid var(--border)',
    background: 'var(--surface)',
    color: 'var(--ink)',
    padding: '0 12px',
    fontWeight: 700,
  },
  checkoutTextarea: {
    minHeight: '76px',
    borderRadius: 'var(--r-md)',
    border: '1px solid var(--border)',
    background: 'var(--surface)',
    color: 'var(--ink)',
    padding: '10px 12px',
    fontWeight: 700,
    resize: 'vertical',
  },
  checkoutButton: {
    height: '46px',
    borderRadius: 'var(--r-pill)',
    border: 0,
    background: 'var(--accent)',
    color: 'var(--accentInk)',
    fontWeight: 800,
    cursor: 'pointer',
  },
  checkoutButtonDisabled: {
    background: '#9ca3af',
    cursor: 'not-allowed',
  },
  checkoutError: {
    background: '#fee2e2',
    color: '#991b1b',
    padding: '11px 12px',
    borderRadius: 'var(--r-md)',
    fontSize: '13px',
    fontWeight: 800,
    lineHeight: 1.45,
  },
  checkoutSuccess: {
    background: '#dcfce7',
    color: '#166534',
    padding: '11px 12px',
    borderRadius: 'var(--r-md)',
    fontSize: '13px',
    fontWeight: 800,
    lineHeight: 1.45,
    marginBottom: '12px',
  },

  empty: {
    gridColumn: '1 / -1',
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
    confirmCard: {
    marginBottom: '14px',
    display: 'grid',
    gridTemplateColumns: '46px minmax(0, 1fr)',
    gap: '12px',
    padding: '14px',
    borderRadius: 'var(--r-card)',
    background:
      'linear-gradient(135deg, rgba(220,252,231,0.98) 0%, rgba(240,253,244,0.98) 100%)',
    border: '1px solid rgba(22,101,52,0.14)',
    boxShadow: '0 12px 28px rgba(22,101,52,0.08)',
  },
  confirmIcon: {
    width: '46px',
    height: '46px',
    borderRadius: '18px',
    background: '#16a34a',
    color: '#ffffff',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: '24px',
    fontWeight: 900,
    boxShadow: '0 12px 24px rgba(22,101,52,0.22)',
  },
  confirmContent: {
    minWidth: 0,
  },
  confirmKicker: {
    color: '#166534',
    fontSize: '11px',
    fontWeight: 900,
    textTransform: 'uppercase',
    letterSpacing: '0.1em',
    marginBottom: '5px',
  },
  confirmTitle: {
    margin: 0,
    color: '#14532d',
    fontFamily: 'var(--font-display)',
    fontSize: '20px',
    lineHeight: 1.12,
    letterSpacing: '-0.02em',
    fontWeight: 800,
  },
  confirmText: {
    margin: '8px 0 12px',
    color: '#166534',
    fontSize: '13px',
    lineHeight: 1.45,
    fontWeight: 700,
  },
  confirmActions: {
    display: 'flex',
    gap: '8px',
    flexWrap: 'wrap',
  },
  confirmPrimaryLink: {
    minHeight: '38px',
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 'var(--r-pill)',
    padding: '0 13px',
    background: '#16a34a',
    color: '#ffffff',
    fontSize: '13px',
    fontWeight: 900,
    textDecoration: 'none',
  },
  confirmGhostLink: {
    minHeight: '38px',
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 'var(--r-pill)',
    padding: '0 13px',
    background: '#ffffff',
    color: '#166534',
    border: '1px solid rgba(22,101,52,0.16)',
    fontSize: '13px',
    fontWeight: 900,
    textDecoration: 'none',
  },
}