'use client'

import AdminShell from '@/components/AdminShell'
import ProductImageUploader from '@/components/ProductImageUploader'
import { useRouter, useSearchParams } from 'next/navigation'
import { useEffect, useMemo, useState, type CSSProperties } from 'react'

export type AdminCategory = {
  id: string
  name: string
  sort: number
}

export type AdminVariant = {
  id: string
  product_id: string
  size: string | null
  color: string | null
  sku: string | null
  total_qty: number
  reserved_qty: number
  is_active: boolean
  created_at: string
  updated_at: string
}

export type AdminProduct = {
  id: string
  name: string
  description: string | null
  material: string | null
  category_id: string | null
  image_url: string | null
  images: string[]
  is_active: boolean
  created_at: string
  updated_at: string
  categories: AdminCategory | AdminCategory[] | null
  product_variants: AdminVariant[]
}

type Props = {
  products: AdminProduct[]
  categories: AdminCategory[]
  adminEmail: string
  orderCount: number
}

type StockFilter = 'all' | 'low' | 'zero' | 'normal'

export default function AdminProductsClient({
  products,
  categories,
  adminEmail,
  orderCount,
}: Props) {
  const searchParams = useSearchParams()
  const isCardsMode = searchParams.get('mode') === 'cards'
  const queryFromUrl = searchParams.get('q') ?? ''

  const [search, setSearch] = useState(queryFromUrl)
  const [selectedCategory, setSelectedCategory] = useState<string>('all')
  const [stockFilter, setStockFilter] = useState<StockFilter>('all')
  const [showInactive, setShowInactive] = useState(true)
  const [expandedProductId, setExpandedProductId] = useState<string | null>(null)
  const [editingProductId, setEditingProductId] = useState<string | null>(null)
  const [isCreateOpen, setIsCreateOpen] = useState(false)

  useEffect(() => {
    setSearch(queryFromUrl)
  }, [queryFromUrl])

  const filteredProducts = useMemo(() => {
    const value = search.trim().toLowerCase()

    return products.filter((product) => {
      const stats = getProductStats(product)

      const activeMatch = showInactive || product.is_active

      const categoryMatch =
        selectedCategory === 'all' || product.category_id === selectedCategory

      const stockMatch =
        stockFilter === 'all' ||
        (stockFilter === 'low' && stats.lowVariants > 0) ||
        (stockFilter === 'zero' && stats.zeroVariants > 0) ||
        (stockFilter === 'normal' &&
          stats.lowVariants === 0 &&
          stats.zeroVariants === 0 &&
          stats.availableQty > 0)

      const searchMatch =
        value.length === 0 ||
        product.name.toLowerCase().includes(value) ||
        product.description?.toLowerCase().includes(value) ||
        product.material?.toLowerCase().includes(value) ||
        getCategoryName(product).toLowerCase().includes(value) ||
        product.product_variants.some((variant) =>
          [
            variant.size,
            variant.color,
            variant.sku,
          ]
            .filter(Boolean)
            .join(' ')
            .toLowerCase()
            .includes(value)
        )

      return activeMatch && categoryMatch && stockMatch && searchMatch
    })
  }, [products, search, selectedCategory, stockFilter, showInactive])

  const totals = useMemo(() => {
    const totalProducts = products.length
    const activeProducts = products.filter((product) => product.is_active).length

    const totalVariants = products.reduce(
      (sum, product) => sum + product.product_variants.length,
      0
    )

    const totalQty = products.reduce(
      (sum, product) => sum + getProductStats(product).totalQty,
      0
    )

    const reservedQty = products.reduce(
      (sum, product) => sum + getProductStats(product).reservedQty,
      0
    )

    const availableQty = Math.max(0, totalQty - reservedQty)

    const lowVariants = products.reduce(
      (sum, product) => sum + getProductStats(product).lowVariants,
      0
    )

    return {
      totalProducts,
      activeProducts,
      totalVariants,
      totalQty,
      reservedQty,
      availableQty,
      lowVariants,
    }
  }, [products])

  return (
    <AdminShell
      adminEmail={adminEmail}
      title={isCardsMode ? 'Карточки товара' : 'Товары и остатки'}
      subtitle="Админ-панель · merch.uzum.tech"
      orderCount={orderCount}
      stockAlertCount={totals.lowVariants}
    >
      <section style={styles.pageBlock}>
        <section style={styles.categoryTabs}>
          <button
            type="button"
            onClick={() => setSelectedCategory('all')}
            style={{
              ...styles.categoryTab,
              ...(selectedCategory === 'all' ? styles.categoryTabActive : {}),
            }}
          >
            Все категории
          </button>

          {categories.map((category) => (
            <button
              key={category.id}
              type="button"
              onClick={() => setSelectedCategory(category.id)}
              style={{
                ...styles.categoryTab,
                ...(selectedCategory === category.id
                  ? styles.categoryTabActive
                  : {}),
              }}
            >
              {category.name}
            </button>
          ))}
        </section>

        <section style={styles.toolbar}>
          <div style={styles.searchBox}>
            <span style={styles.searchIcon}>⌕</span>

            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Поиск товара, материала, SKU..."
              style={styles.searchInput}
            />

            {search.trim().length > 0 && (
              <button
                type="button"
                onClick={() => setSearch('')}
                style={styles.clearSearchButton}
              >
                ×
              </button>
            )}
          </div>

          <div style={styles.toolbarRight}>
            <div style={styles.stockTabs}>
              <button
                type="button"
                onClick={() => setStockFilter('all')}
                style={{
                  ...styles.stockTab,
                  ...(stockFilter === 'all' ? styles.stockTabActive : {}),
                }}
              >
                Все
              </button>

              <button
                type="button"
                onClick={() => setStockFilter('low')}
                style={{
                  ...styles.stockTab,
                  ...(stockFilter === 'low' ? styles.stockTabActive : {}),
                }}
              >
                Низкие
              </button>

              <button
                type="button"
                onClick={() => setStockFilter('zero')}
                style={{
                  ...styles.stockTab,
                  ...(stockFilter === 'zero' ? styles.stockTabActive : {}),
                }}
              >
                В нуле
              </button>

              <button
                type="button"
                onClick={() => setStockFilter('normal')}
                style={{
                  ...styles.stockTab,
                  ...(stockFilter === 'normal' ? styles.stockTabActive : {}),
                }}
              >
                Норма
              </button>
            </div>

            <label style={styles.checkboxLabel}>
              <input
                type="checkbox"
                checked={showInactive}
                onChange={(event) => setShowInactive(event.target.checked)}
              />
              Показывать отключённые
            </label>

            <button
              type="button"
              onClick={() => setIsCreateOpen((value) => !value)}
              style={styles.newButton}
            >
              + Новый товар
            </button>
          </div>
        </section>

        <section style={isCardsMode ? styles.modeNoticeCards : styles.modeNoticeStock}>
          <div>
            <b>{isCardsMode ? 'Режим карточек товара' : 'Режим склада'}</b>
            <span>
              {isCardsMode
                ? 'Клик по строке открывает редактирование карточки, фото, описания и вариантов.'
                : 'Клик по строке раскрывает складские варианты и остатки.'}
            </span>
          </div>
        </section>

        {isCreateOpen && (
          <CreateProductCard
            categories={categories}
            onClose={() => setIsCreateOpen(false)}
          />
        )}

        <section style={styles.summaryStrip}>
          <SummaryMetric label="Товаров" value={String(totals.totalProducts)} />
          <SummaryMetric label="Активных" value={String(totals.activeProducts)} />
          <SummaryMetric label="Вариантов" value={String(totals.totalVariants)} />
          <SummaryMetric label="На складе" value={`${totals.totalQty} шт.`} />
          <SummaryMetric label="В резерве" value={`${totals.reservedQty} шт.`} />
          <SummaryMetric label="Доступно" value={`${totals.availableQty} шт.`} />
          <SummaryMetric label="Низкие" value={String(totals.lowVariants)} tone="pink" />
        </section>

        {filteredProducts.length === 0 ? (
          <section style={styles.emptyCard}>
            <div style={styles.emptyMark}>∅</div>

            <h2 style={styles.emptyTitle}>Товары не найдены</h2>

            <p style={styles.emptyText}>
              Измените поиск, категорию или складской фильтр.
            </p>
          </section>
        ) : isCardsMode ? (
          <>
            <section style={styles.cardsGrid}>
              {filteredProducts.map((product) => {
                const isEditing = editingProductId === product.id

                 return (
                   <ProductCardMode
                      key={product.id}
                      product={product}
                      isEditing={isEditing}
                      onEdit={() => {
                        setExpandedProductId(null)
                        setEditingProductId(isEditing ? null : product.id)
                      }}
                    />
                )
             })}
            </section>

            {editingProductId && (
              <ProductEditPanel
                product={filteredProducts.find((product) => product.id === editingProductId)!}
                categories={categories}
                onClose={() => setEditingProductId(null)}
              />
            )}
          </>
        ) : (
          <section style={styles.productList}>
            {filteredProducts.map((product) => {
              const isExpanded = expandedProductId === product.id
              const isEditing = editingProductId === product.id

               return (
                 <div key={product.id} style={styles.productGroup}>
                   <ProductRow
                      product={product}
                      isExpanded={isExpanded}
                      isEditing={isEditing}
                      isCardsMode={false}
                      onToggle={() => {
                        setEditingProductId(null)
                        setExpandedProductId(isExpanded ? null : product.id)
                      }}
                      onEdit={() => {
                        setExpandedProductId(null)
                        setEditingProductId(isEditing ? null : product.id)
                      }}
                    />

                    {isEditing && (
                      <ProductEditPanel
                        product={product}
                        categories={categories}
                        onClose={() => setEditingProductId(null)}
                      />
                    )}
                  </div>
                )
             })}
          </section>
        )}
      </section>
    </AdminShell>
  )
}

function CreateProductCard({
  categories,
  onClose,
}: {
  categories: AdminCategory[]
  onClose: () => void
}) {
  const router = useRouter()

  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [material, setMaterial] = useState('')
  const [categoryId, setCategoryId] = useState(categories[0]?.id ?? '')
  const [imageUrl, setImageUrl] = useState('')
  const [isSaving, setIsSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleCreate() {
    setIsSaving(true)
    setError(null)

    try {
      const response = await fetch('/api/admin/products', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'create_product',
          name,
          description,
          material,
          category_id: categoryId || null,
          image_url: imageUrl,
          is_active: true,
        }),
      })

      const result = await response.json()

      if (!response.ok) {
        setError(result.error || 'Не удалось создать товар')
        return
      }

      setName('')
      setDescription('')
      setMaterial('')
      setImageUrl('')
      onClose()
      router.refresh()
    } catch (createError) {
      setError(
        createError instanceof Error ? createError.message : 'Неизвестная ошибка'
      )
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <section style={styles.createCard}>
      <div style={styles.createHead}>
        <div>
          <h2 style={styles.panelTitle}>Новый товар</h2>
          <p style={styles.panelHint}>
            Создайте карточку. Варианты и остатки можно добавить после создания.
          </p>
        </div>

        <button type="button" onClick={onClose} style={styles.lightButton}>
          Свернуть
        </button>
      </div>

      <div style={styles.editGrid}>
        <label style={styles.label}>
          Название
          <input
            value={name}
            onChange={(event) => setName(event.target.value)}
            placeholder="Например: Худи «Команда»"
            style={styles.input}
          />
        </label>

        <label style={styles.label}>
          Категория
          <select
            value={categoryId}
            onChange={(event) => setCategoryId(event.target.value)}
            style={styles.input}
          >
            <option value="">Без категории</option>
            {categories.map((category) => (
              <option key={category.id} value={category.id}>
                {category.name}
              </option>
            ))}
          </select>
        </label>

        <label style={styles.label}>
          Материал
          <input
            value={material}
            onChange={(event) => setMaterial(event.target.value)}
            placeholder="Например: хлопок"
            style={styles.input}
          />
        </label>

        <label style={styles.labelWide}>
          Описание
          <textarea
            value={description}
            onChange={(event) => setDescription(event.target.value)}
            placeholder="Описание товара"
            style={styles.textarea}
          />
        </label>

        <div style={styles.labelWide}>
          <ProductImageUploader
            value={imageUrl}
            onChange={setImageUrl}
            label="Фото товара"
          />
        </div>
      </div>

      {error && <div style={styles.error}>{error}</div>}

      <button
        type="button"
        onClick={handleCreate}
        disabled={isSaving}
        style={{
          ...styles.saveButton,
          ...(isSaving ? styles.saveButtonDisabled : {}),
        }}
      >
        {isSaving ? 'Создаём...' : 'Создать товар'}
      </button>
    </section>
  )
}

function ProductCardMode({
  product,
  isEditing,
  onEdit,
}: {
  product: AdminProduct
  isEditing: boolean
  onEdit: () => void
}) {
  const stats = getProductStats(product)
  const imageUrl = product.image_url || product.images?.[0] || ''

  return (
    <article
      style={{
        ...styles.cardMode,
        ...(isEditing ? styles.cardModeActive : {}),
      }}
    >
      <div style={styles.cardModeImageWrap}>
        {imageUrl ? (
          <img src={imageUrl} alt={product.name} style={styles.cardModeImage} />
        ) : (
          <div style={styles.cardModePlaceholder}>
            {getProductLetter(product.name)}
          </div>
        )}

        <span
          style={
            product.is_active
              ? styles.cardModeStatusActive
              : styles.cardModeStatusInactive
          }
        >
          {product.is_active ? 'Опубликован' : 'Отключён'}
        </span>
      </div>

      <div style={styles.cardModeBody}>
        <div style={styles.cardModeCategory}>{getCategoryName(product)}</div>

        <h3 style={styles.cardModeTitle}>{product.name}</h3>

        <p style={styles.cardModeDescription}>
          {product.description || 'Описание товара пока не заполнено.'}
        </p>

        <div style={styles.cardModeMeta}>
          <div style={styles.cardModeMetaItem}>
            <span>Материал</span>
            <b>{product.material || 'Не указан'}</b>
          </div>

          <div style={styles.cardModeMetaItem}>
            <span>Вариантов</span>
            <b>{product.product_variants.length}</b>
          </div>

          <div style={styles.cardModeMetaItem}>
            <span>Доступно</span>
            <b>{stats.availableQty} шт.</b>
          </div>
        </div>

        <button
          type="button"
          onClick={onEdit}
          style={{
            ...styles.cardModeButton,
            ...(isEditing ? styles.cardModeButtonActive : {}),
          }}
        >
          {isEditing ? 'Редактируется' : 'Редактировать карточку'}
        </button>
      </div>
    </article>
  )
}

function ProductRow({
  product,
  isExpanded,
  isEditing,
  isCardsMode,
  onToggle,
  onEdit,
}: {
  product: AdminProduct
  isExpanded: boolean
  isEditing: boolean
  isCardsMode: boolean
  onToggle: () => void
  onEdit: () => void
}) {
  const stats = getProductStats(product)
  const imageUrl = product.image_url || product.images?.[0] || ''

  return (
    <article
      style={{
        ...styles.productCard,
        ...(isExpanded ? styles.productCardExpanded : {}),
        ...(isEditing ? styles.productCardEditing : {}),
      }}
    >
      <div
        role="button"
        tabIndex={0}
        onClick={onToggle}
        onKeyDown={(event) => {
          if (event.key === 'Enter' || event.key === ' ') {
            event.preventDefault()
            onToggle()
          }
        }}
        style={{
          ...styles.productRow,
          ...(isExpanded || isEditing ? styles.productRowActive : {}),
        }}
      >
        <div style={styles.productArt}>
          {imageUrl ? (
            <img src={imageUrl} alt={product.name} style={styles.productImage} />
          ) : (
            <div style={styles.productPlaceholder}>
              {getProductLetter(product.name)}
            </div>
          )}
        </div>

        <div style={styles.productNameCell}>
          <span>{getCategoryName(product)}</span>
          <b>{product.name}</b>
          {!product.is_active && <small>Отключён</small>}
        </div>

        <Metric label="Всего на складе" value={`${stats.totalQty} шт.`} />
        <Metric label="Вариантов в нуле" value={String(stats.zeroVariants)} tone="pink" />
        <Metric label="Низкие остатки" value={String(stats.lowVariants)} tone="pink" />
        <Metric label="Вариантов" value={String(product.product_variants.length)} />

        <div style={styles.rowActions}>
          {!isCardsMode && (
            <button
              type="button"
              style={{
                ...styles.lightButton,
                ...(isExpanded ? styles.lightButtonActive : {}),
              }}
              onClick={(event) => {
                event.stopPropagation()
                onToggle()
              }}
            >
              Остатки
            </button>
          )}

          <button
            type="button"
            style={{
              ...styles.lightButton,
              ...(isEditing || isCardsMode ? styles.lightButtonActive : {}),
            }}
            onClick={(event) => {
              event.stopPropagation()
              onEdit()
            }}
          >
            Редактировать
          </button>

          <span style={styles.chevron}>
            {isCardsMode
              ? isEditing
                ? '⌃'
                : '→'
              : isExpanded
                ? '⌃'
                : '⌄'}
          </span>
        </div>
      </div>

      {isExpanded && <InventoryExpanded product={product} />}
    </article>
  )
}

function InventoryExpanded({ product }: { product: AdminProduct }) {
  return (
    <section style={styles.inventoryExpanded}>
      <VariantsEditor product={product} />
    </section>
  )
}

function ProductEditPanel({
  product,
  categories,
  onClose,
}: {
  product: AdminProduct
  categories: AdminCategory[]
  onClose: () => void
}) {
  const stats = getProductStats(product)
  const imageUrl = product.image_url || product.images?.[0] || ''

  return (
    <section style={styles.productEditPanel}>
      <div style={styles.editHero}>
        <div style={styles.editHeroLeft}>
          <div style={styles.productArt}>
            {imageUrl ? (
              <img src={imageUrl} alt={product.name} style={styles.productImage} />
            ) : (
              <div style={styles.productPlaceholder}>
                {getProductLetter(product.name)}
              </div>
            )}
          </div>

          <div>
            <div style={styles.editBreadcrumb}>
              Склад / {product.name}
            </div>

            <h2 style={styles.editTitle}>{product.name}</h2>

            <div style={styles.editMetrics}>
              <Metric label="Всего на складе" value={`${stats.totalQty} шт.`} />
              <Metric label="Резерв" value={`${stats.reservedQty} шт.`} />
              <Metric label="Доступно" value={`${stats.availableQty} шт.`} />
              <Metric
                label="Вариантов"
                value={String(product.product_variants.length)}
              />
            </div>
          </div>
        </div>

        <div style={styles.editHeroActions}>
          <button type="button" style={styles.lightButton}>
            Дублировать
          </button>

          <button type="button" style={styles.dangerButton}>
            Снять с публикации
          </button>

          <button type="button" onClick={onClose} style={styles.darkButton}>
            Закрыть
          </button>
        </div>
      </div>

      <section style={styles.expanded}>
        <ProductMainEditor product={product} categories={categories} />

        <VariantsEditor product={product} />
      </section>
    </section>
  )
}

function ProductMainEditor({
  product,
  categories,
}: {
  product: AdminProduct
  categories: AdminCategory[]
}) {
  const router = useRouter()

  const [name, setName] = useState(product.name)
  const [description, setDescription] = useState(product.description ?? '')
  const [material, setMaterial] = useState(product.material ?? '')
  const [categoryId, setCategoryId] = useState(product.category_id ?? '')
  const [imageUrl, setImageUrl] = useState(product.image_url ?? '')
  const [isActive, setIsActive] = useState(product.is_active)

  const [isSaving, setIsSaving] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  async function handleUpdateProduct() {
    setIsSaving(true)
    setMessage(null)
    setError(null)

    try {
      const response = await fetch('/api/admin/products', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'update_product',
          product_id: product.id,
          name,
          description,
          material,
          category_id: categoryId || null,
          image_url: imageUrl,
          is_active: isActive,
        }),
      })

      const result = await response.json()

      if (!response.ok) {
        setError(result.error || 'Не удалось обновить товар')
        return
      }

      setMessage('Товар обновлён')
      router.refresh()
    } catch (updateError) {
      setError(
        updateError instanceof Error ? updateError.message : 'Неизвестная ошибка'
      )
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <section style={styles.editorCard}>
      <div style={styles.panelHead}>
        <div>
          <h3 style={styles.panelTitle}>Основное</h3>
          <p style={styles.panelHint}>ACTION: UPDATE_PRODUCT</p>
        </div>

        <label style={styles.switchLabel}>
          <input
            type="checkbox"
            checked={isActive}
            onChange={(event) => setIsActive(event.target.checked)}
          />
          Видим в каталоге
        </label>
      </div>

      <div style={styles.editGrid}>
        <label style={styles.labelWide}>
          Название
          <input
            value={name}
            onChange={(event) => setName(event.target.value)}
            style={styles.input}
          />
        </label>

        <label style={styles.labelWide}>
          Описание
          <textarea
            value={description}
            onChange={(event) => setDescription(event.target.value)}
            style={styles.textarea}
          />
        </label>

        <label style={styles.label}>
          Категория · CATEGORY_ID
          <select
            value={categoryId}
            onChange={(event) => setCategoryId(event.target.value)}
            style={styles.input}
          >
            <option value="">Без категории</option>
            {categories.map((category) => (
              <option key={category.id} value={category.id}>
                {category.name}
              </option>
            ))}
          </select>
        </label>

        <label style={styles.label}>
          Материал
          <input
            value={material}
            onChange={(event) => setMaterial(event.target.value)}
            style={styles.input}
          />
        </label>

        <div style={styles.labelWide}>
          <ProductImageUploader
            value={imageUrl}
            onChange={setImageUrl}
            productId={product.id}
            label="IMAGE_URL"
          />
        </div>
      </div>

      {error && <div style={styles.error}>{error}</div>}
      {message && <div style={styles.success}>{message}</div>}

      <button
        type="button"
        onClick={handleUpdateProduct}
        disabled={isSaving}
        style={{
          ...styles.saveButton,
          ...(isSaving ? styles.saveButtonDisabled : {}),
        }}
      >
        {isSaving ? 'Сохраняем...' : 'Сохранить товар'}
      </button>
    </section>
  )
}

function VariantsEditor({ product }: { product: AdminProduct }) {
  const router = useRouter()

  const [size, setSize] = useState('')
  const [color, setColor] = useState('')
  const [sku, setSku] = useState('')
  const [initialQty, setInitialQty] = useState('0')
  const [isCreating, setIsCreating] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const sortedVariants = [...product.product_variants].sort((a, b) =>
    String(a.sku ?? '').localeCompare(String(b.sku ?? ''))
  )

  async function handleCreateVariant() {
    setIsCreating(true)
    setError(null)

    try {
      const response = await fetch('/api/admin/products', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'create_variant',
          product_id: product.id,
          size,
          color,
          sku,
          initial_qty: Number(initialQty),
          is_active: true,
        }),
      })

      const result = await response.json()

      if (!response.ok) {
        setError(result.error || 'Не удалось создать вариант')
        return
      }

      setSize('')
      setColor('')
      setSku('')
      setInitialQty('0')
      router.refresh()
    } catch (createError) {
      setError(
        createError instanceof Error ? createError.message : 'Неизвестная ошибка'
      )
    } finally {
      setIsCreating(false)
    }
  }

  return (
    <section style={styles.editorCard}>
      <div style={styles.panelHead}>
        <div>
          <h3 style={styles.panelTitle}>Варианты и остатки</h3>
          <p style={styles.panelHint}>
            ACTION: CREATE_VARIANT · UPDATE_VARIANT · ADD_STOCK
          </p>
        </div>
      </div>

      <div style={styles.createVariantBox}>
        <input
          value={size}
          onChange={(event) => setSize(event.target.value)}
          placeholder="SIZE"
          style={styles.input}
        />

        <input
          value={color}
          onChange={(event) => setColor(event.target.value)}
          placeholder="COLOR"
          style={styles.input}
        />

        <input
          value={sku}
          onChange={(event) => setSku(event.target.value)}
          placeholder="SKU"
          style={styles.input}
        />

        <input
          value={initialQty}
          onChange={(event) => setInitialQty(event.target.value)}
          placeholder="Начальный остаток"
          type="number"
          style={styles.input}
        />

        <button
          type="button"
          onClick={handleCreateVariant}
          disabled={isCreating || sku.trim().length === 0}
          style={{
            ...styles.darkButton,
            ...(isCreating || sku.trim().length === 0
              ? styles.saveButtonDisabled
              : {}),
          }}
        >
          + Вариант
        </button>
      </div>

      {error && <div style={styles.error}>{error}</div>}

      {sortedVariants.length === 0 ? (
        <div style={styles.emptyVariant}>Вариантов пока нет.</div>
      ) : (
        <div style={styles.variantTable}>
          <div style={styles.variantHeader}>
            <div>Размер</div>
            <div>Цвет</div>
            <div>SKU</div>
            <div>Всего</div>
            <div>Резерв</div>
            <div>Доступно</div>
            <div>Статус</div>
            <div>Действия</div>
          </div>

          {sortedVariants.map((variant) => (
            <VariantRow key={variant.id} variant={variant} />
          ))}
        </div>
      )}
    </section>
  )
}

function VariantRow({ variant }: { variant: AdminVariant }) {
  const router = useRouter()

  const [size, setSize] = useState(variant.size ?? '')
  const [color, setColor] = useState(variant.color ?? '')
  const [sku, setSku] = useState(variant.sku ?? '')
  const [isActive, setIsActive] = useState(variant.is_active)

  const [movementType, setMovementType] = useState<'income' | 'adjustment'>(
    'income'
  )

  const [qty, setQty] = useState('')
  const [comment, setComment] = useState('')
  const [isSaving, setIsSaving] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const availableQty = Math.max(
    0,
    Number(variant.total_qty) - Number(variant.reserved_qty)
  )

  async function handleUpdateVariant() {
    setIsSaving(true)
    setMessage(null)
    setError(null)

    try {
      const response = await fetch('/api/admin/products', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'update_variant',
          variant_id: variant.id,
          size,
          color,
          sku,
          is_active: isActive,
        }),
      })

      const result = await response.json()

      if (!response.ok) {
        setError(result.error || 'Не удалось обновить вариант')
        return
      }

      setMessage('Вариант обновлён')
      router.refresh()
    } catch (updateError) {
      setError(
        updateError instanceof Error ? updateError.message : 'Неизвестная ошибка'
      )
    } finally {
      setIsSaving(false)
    }
  }

  async function handleAddStock() {
    setIsSaving(true)
    setMessage(null)
    setError(null)

    try {
      const response = await fetch('/api/admin/products', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'add_stock',
          variant_id: variant.id,
          movement_type: movementType,
          qty: Number(qty),
          comment,
        }),
      })

      const result = await response.json()

      if (!response.ok) {
        setError(result.error || 'Не удалось изменить остаток')
        return
      }

      setQty('')
      setComment('')
      setMessage('Остаток обновлён')
      router.refresh()
    } catch (stockError) {
      setError(
        stockError instanceof Error ? stockError.message : 'Неизвестная ошибка'
      )
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <div style={styles.variantRowWrap}>
      <div style={styles.variantRow}>
        <input
          value={size}
          onChange={(event) => setSize(event.target.value)}
          placeholder="SIZE"
          style={styles.variantInput}
        />

        <input
          value={color}
          onChange={(event) => setColor(event.target.value)}
          placeholder="COLOR"
          style={styles.variantInput}
        />

        <input
          value={sku}
          onChange={(event) => setSku(event.target.value)}
          placeholder="SKU"
          style={styles.variantInput}
        />

        <b>{variant.total_qty}</b>
        <span>{variant.reserved_qty}</span>
        <b style={availableQty <= 4 ? styles.lowQty : undefined}>
          {availableQty}
        </b>

        <label style={styles.activeLabel}>
          <input
            type="checkbox"
            checked={isActive}
            onChange={(event) => setIsActive(event.target.checked)}
          />
          {isActive ? 'Активен' : 'Отключён'}
        </label>

        <div style={styles.variantActions}>
          <button
            type="button"
            onClick={handleUpdateVariant}
            disabled={isSaving}
            style={styles.smallAction}
          >
            Сохранить
          </button>
        </div>
      </div>

      <div style={styles.stockActionRow}>
        <select
          value={movementType}
          onChange={(event) =>
            setMovementType(event.target.value as 'income' | 'adjustment')
          }
          style={styles.input}
        >
          <option value="income">income — Поступление</option>
          <option value="adjustment">adjustment — Коррекция</option>
        </select>

        <input
          value={qty}
          onChange={(event) => setQty(event.target.value)}
          type="number"
          placeholder={movementType === 'income' ? 'qty > 0' : 'можно +/-'}
          style={styles.input}
        />

        <input
          value={comment}
          onChange={(event) => setComment(event.target.value)}
          placeholder="Комментарий"
          style={styles.input}
        />

        <button
          type="button"
          onClick={handleAddStock}
          disabled={isSaving || qty.trim().length === 0}
          style={{
            ...styles.smallActionDark,
            ...(isSaving || qty.trim().length === 0
              ? styles.saveButtonDisabled
              : {}),
          }}
        >
          Провести движение
        </button>
      </div>

      {error && <div style={styles.error}>{error}</div>}
      {message && <div style={styles.success}>{message}</div>}
    </div>
  )
}

function SummaryMetric({
  label,
  value,
  tone,
}: {
  label: string
  value: string
  tone?: 'pink'
}) {
  return (
    <div style={styles.summaryMetric}>
      <span>{label}</span>
      <b style={tone === 'pink' ? styles.pinkText : undefined}>{value}</b>
    </div>
  )
}

function Metric({
  label,
  value,
  tone,
}: {
  label: string
  value: string
  tone?: 'pink'
}) {
  return (
    <div style={styles.metric}>
      <span>{label}</span>
      <b style={tone === 'pink' ? styles.pinkText : undefined}>{value}</b>
    </div>
  )
}

function getProductStats(product: AdminProduct) {
  const totalQty = product.product_variants.reduce(
    (sum, variant) => sum + Number(variant.total_qty),
    0
  )

  const reservedQty = product.product_variants.reduce(
    (sum, variant) => sum + Number(variant.reserved_qty),
    0
  )

  const activeVariants = product.product_variants.filter(
    (variant) => variant.is_active
  )

  const zeroVariants = activeVariants.filter((variant) => {
    const available = Number(variant.total_qty) - Number(variant.reserved_qty)
    return available <= 0
  }).length

  const lowVariants = activeVariants.filter((variant) => {
    const available = Number(variant.total_qty) - Number(variant.reserved_qty)
    return available > 0 && available <= 4
  }).length

  return {
    totalQty,
    reservedQty,
    availableQty: Math.max(0, totalQty - reservedQty),
    zeroVariants,
    lowVariants,
  }
}

function getCategoryName(product: AdminProduct) {
  if (Array.isArray(product.categories)) {
    return product.categories[0]?.name ?? 'Без категории'
  }

  return product.categories?.name ?? 'Без категории'
}

function getProductLetter(name: string) {
  return name.trim()[0]?.toUpperCase() ?? 'U'
}

const styles: Record<string, CSSProperties> = {
  pageBlock: {
    display: 'flex',
    flexDirection: 'column',
    gap: '16px',
  },
  categoryTabs: {
    display: 'flex',
    gap: '10px',
    flexWrap: 'wrap',
  },
  categoryTab: {
    minHeight: '38px',
    border: 0,
    borderRadius: '999px',
    background: 'transparent',
    color: 'var(--inkMute)',
    padding: '0 14px',
    fontSize: '13px',
    fontWeight: 800,
    cursor: 'pointer',
  },
  categoryTabActive: {
    background: '#1f1238',
    color: '#ffffff',
  },
  toolbar: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: '16px',
    flexWrap: 'wrap',
  },
  searchBox: {
    width: 'min(100%, 430px)',
    height: '38px',
    borderRadius: '999px',
    background: '#ffffff',
    border: '1px solid var(--border)',
    display: 'flex',
    alignItems: 'center',
    gap: '9px',
    padding: '0 12px',
  },
  searchIcon: {
    color: 'var(--inkMute)',
    fontSize: '17px',
    fontWeight: 900,
  },
  searchInput: {
    flex: 1,
    minWidth: 0,
    border: 0,
    background: 'transparent',
    color: 'var(--ink)',
    fontSize: '13px',
    fontWeight: 700,
  },
  clearSearchButton: {
    width: '24px',
    height: '24px',
    border: 0,
    borderRadius: '999px',
    background: '#f1ebff',
    color: 'var(--inkMute)',
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: '16px',
    fontWeight: 900,
    cursor: 'pointer',
    flex: '0 0 auto',
  },
  toolbarRight: {
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
    flexWrap: 'wrap',
  },
  stockTabs: {
    display: 'flex',
    gap: '4px',
    padding: '4px',
    borderRadius: '999px',
    background: '#f1ebff',
  },
  stockTab: {
    minHeight: '30px',
    border: 0,
    borderRadius: '999px',
    background: 'transparent',
    color: 'var(--inkMute)',
    padding: '0 12px',
    fontSize: '12px',
    fontWeight: 800,
    cursor: 'pointer',
  },
  stockTabActive: {
    background: '#ffffff',
    color: 'var(--ink)',
    boxShadow: 'var(--shadow-soft)',
  },
  checkboxLabel: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '8px',
    color: 'var(--inkMute)',
    fontSize: '13px',
    fontWeight: 800,
  },
  newButton: {
    height: '38px',
    border: 0,
    borderRadius: '999px',
    background: '#1f1238',
    color: '#ffffff',
    padding: '0 16px',
    fontSize: '13px',
    fontWeight: 900,
    cursor: 'pointer',
  },
  summaryStrip: {
    display: 'grid',
    gridTemplateColumns: 'repeat(7, minmax(0, 1fr))',
    gap: '10px',
  },
  summaryMetric: {
    background: '#ffffff',
    border: '1px solid var(--border)',
    borderRadius: '14px',
    padding: '12px',
    display: 'flex',
    flexDirection: 'column',
    gap: '4px',
    color: 'var(--inkMute)',
    fontSize: '11px',
    fontWeight: 900,
    textTransform: 'uppercase',
  },
  pinkText: {
    color: '#ff62d2',
  },
  productList: {
    display: 'flex',
    flexDirection: 'column',
    gap: '10px',
  },
  productCard: {
  overflow: 'hidden',
  borderRadius: '16px',
  borderWidth: '1px',
  borderStyle: 'solid',
  borderColor: 'var(--border)',
  background: '#ffffff',
},
productCardExpanded: {
  borderColor: 'var(--accent)',
},
productCardEditing: {
  borderColor: 'var(--accent)',
  boxShadow: '0 0 0 1px rgba(112,0,255,0.16), 0 18px 42px rgba(112,0,255,0.1)',
},
  productRow: {
    width: '100%',
    minHeight: '92px',
    display: 'grid',
    gridTemplateColumns:
      '66px minmax(240px, 1fr) 110px 110px 110px 100px auto',
    gap: '18px',
    alignItems: 'center',
    padding: '14px 18px',
    border: 0,
    background: '#ffffff',
    color: 'var(--ink)',
    textAlign: 'left',
    cursor: 'pointer',
  },
  productArt: {
    width: '64px',
    height: '64px',
    borderRadius: '12px',
    overflow: 'hidden',
    background: '#f1ebff',
    flex: '0 0 auto',
  },
  productImage: {
    width: '100%',
    height: '100%',
    objectFit: 'cover',
  },
  productPlaceholder: {
    width: '100%',
    height: '100%',
    background:
      'linear-gradient(135deg, #f1ebff 0%, #ffffff 100%)',
    color: 'var(--accent)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontFamily: 'var(--font-display)',
    fontSize: '24px',
    fontWeight: 800,
  },
  productNameCell: {
    minWidth: 0,
    display: 'flex',
    flexDirection: 'column',
    gap: '4px',
  },
  metric: {
    display: 'flex',
    flexDirection: 'column',
    gap: '4px',
    color: 'var(--inkMute)',
    fontSize: '11px',
    fontWeight: 900,
    textTransform: 'uppercase',
  },
  rowActions: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: '8px',
    flexWrap: 'wrap',
  },
  productRowActive: {
    background: '#fbf8ff',
  },
  lightButtonActive: {
    background: '#1f1238',
    borderColor: '#1f1238',
    color: '#ffffff',
    boxShadow: '0 10px 22px rgba(31,18,56,0.18)',
  },
  productGroup: {
    display: 'flex',
    flexDirection: 'column',
    gap: '10px',
  },
  cardsGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(250px, 1fr))',
    gap: '14px',
    alignItems: 'stretch',
  },
  cardMode: {
    overflow: 'hidden',
    borderRadius: '18px',
    borderWidth: '1px',
    borderStyle: 'solid',
    borderColor: 'var(--border)',
    background: '#ffffff',
    boxShadow: 'var(--shadow-soft)',
    display: 'flex',
    flexDirection: 'column',
    minHeight: '360px',
  },
  cardModeActive: {
    borderColor: 'var(--accent)',
    boxShadow:
      '0 0 0 1px rgba(112,0,255,0.16), 0 18px 42px rgba(112,0,255,0.1)',
  },
  cardModeImageWrap: {
    position: 'relative',
    height: '150px',
    background: '#f1ebff',
    overflow: 'hidden',
    flex: '0 0 auto',
  },
  cardModeImage: {
    width: '100%',
    height: '100%',
    objectFit: 'cover',
  },
  cardModePlaceholder: {
    width: '100%',
    height: '100%',
    background:
      'radial-gradient(circle at 20% 10%, rgba(112,0,255,0.16), transparent 30%), linear-gradient(135deg, #f1ebff 0%, #ffffff 100%)',
    color: 'var(--accent)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontFamily: 'var(--font-display)',
    fontSize: '42px',
    fontWeight: 800,
  },
  cardModeStatusActive: {
    position: 'absolute',
    left: '12px',
    top: '12px',
    borderRadius: '999px',
    background: '#dcfce7',
    color: '#166534',
    padding: '6px 10px',
    fontSize: '12px',
    fontWeight: 900,
  },
  cardModeStatusInactive: {
    position: 'absolute',
    left: '12px',
    top: '12px',
    borderRadius: '999px',
    background: '#fee2e2',
    color: '#dc2626',
    padding: '6px 10px',
    fontSize: '12px',
    fontWeight: 900,
  },
  cardModeBody: {
    padding: '14px',
    display: 'flex',
    flexDirection: 'column',
    flex: 1,
  },
  cardModeCategory: {
    color: 'var(--inkMute)',
    fontSize: '12px',
    fontWeight: 900,
    textTransform: 'uppercase',
    letterSpacing: '0.06em',
    marginBottom: '8px',
  },
  cardModeTitle: {
    margin: 0,
    color: 'var(--ink)',
    fontFamily: 'var(--font-display)',
    fontSize: '19px',
    lineHeight: 1.16,
    fontWeight: 700,
    letterSpacing: '-0.02em',
  },
  cardModeDescription: {
    minHeight: '42px',
    margin: '10px 0 14px',
    color: 'var(--inkMute)',
    fontSize: '13px',
    lineHeight: 1.45,
    fontWeight: 700,
  },
  cardModeMeta: {
    display: 'grid',
    gridTemplateColumns: 'repeat(3, minmax(0, 1fr))',
    gap: '8px',
    marginBottom: '14px',
  },
  cardModeMetaItem: {
    minWidth: 0,
    display: 'flex',
    flexDirection: 'column',
    gap: '3px',
    color: 'var(--inkMute)',
    fontSize: '11px',
    fontWeight: 800,
  },
  cardModeButton: {
    width: '100%',
    minHeight: '42px',
    marginTop: 'auto',
    border: 0,
    borderRadius: '999px',
    background: '#1f1238',
    color: '#ffffff',
    fontSize: '13px',
    fontWeight: 900,
    cursor: 'pointer',
  },
  cardModeButtonActive: {
    background: 'var(--accent)',
  },
  modeNoticeStock: {
    borderRadius: '14px',
    border: '1px solid var(--border)',
    background: '#ffffff',
    padding: '12px 16px',
    color: 'var(--inkMute)',
    fontSize: '13px',
    fontWeight: 700,
  },
  modeNoticeCards: {
    borderRadius: '14px',
    border: '1px solid rgba(112,0,255,0.22)',
    background: '#fbf8ff',
    padding: '12px 16px',
    color: 'var(--inkMute)',
    fontSize: '13px',
    fontWeight: 700,
  },
  inventoryExpanded: {
    padding: '0 18px 18px',
  },
  productEditPanel: {
    borderRadius: '18px',
    border: '1px solid var(--border)',
    background: '#ffffff',
    padding: '24px',
  },
  editHero: {
    minHeight: '118px',
    borderRadius: '16px',
    border: '1px solid var(--border)',
    background: '#ffffff',
    padding: '20px',
    marginBottom: '20px',
    display: 'flex',
    justifyContent: 'space-between',
    gap: '20px',
    alignItems: 'center',
  },
  editHeroLeft: {
    display: 'flex',
    alignItems: 'center',
    gap: '18px',
    minWidth: 0,
  },
  editBreadcrumb: {
    color: 'var(--inkMute)',
    fontSize: '13px',
    fontWeight: 800,
    marginBottom: '8px',
  },
  editTitle: {
    margin: '0 0 12px',
    fontFamily: 'var(--font-display)',
    color: 'var(--ink)',
    fontSize: '28px',
    fontWeight: 700,
    letterSpacing: '-0.02em',
  },
  editMetrics: {
    display: 'grid',
    gridTemplateColumns: 'repeat(4, minmax(90px, 1fr))',
    gap: '20px',
  },
  editHeroActions: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: '8px',
    flexWrap: 'wrap',
  },
  dangerButton: {
    minHeight: '32px',
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    border: '1px solid #ffc4d6',
    background: '#ffffff',
    color: '#e11d48',
    borderRadius: '999px',
    padding: '0 12px',
    fontSize: '12px',
    fontWeight: 800,
    cursor: 'pointer',
    whiteSpace: 'nowrap',
  },
  lightButton: {
    minHeight: '32px',
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: '1px',
    borderStyle: 'solid',
    borderColor: 'var(--border)',
    background: '#ffffff',
    color: 'var(--ink)',
    borderRadius: '999px',
    padding: '0 12px',
    fontSize: '12px',
    fontWeight: 800,
    cursor: 'pointer',
    whiteSpace: 'nowrap',
  },
  chevron: {
    color: 'var(--inkMute)',
    fontSize: '16px',
    fontWeight: 900,
  },
  expanded: {
    padding: '0 18px 18px',
    display: 'grid',
    gridTemplateColumns: 'minmax(0, 0.95fr) minmax(0, 1.05fr)',
    gap: '18px',
  },
  createCard: {
    background: '#ffffff',
    border: '1px solid var(--border)',
    borderRadius: '16px',
    padding: '18px',
  },
  createHead: {
    display: 'flex',
    justifyContent: 'space-between',
    gap: '14px',
    marginBottom: '14px',
  },
  editorCard: {
    background: '#ffffff',
    border: '1px solid var(--border)',
    borderRadius: '16px',
    padding: '24px',
  },
  panelHead: {
    display: 'flex',
    justifyContent: 'space-between',
    gap: '14px',
    alignItems: 'flex-start',
    marginBottom: '16px',
  },
  panelTitle: {
    margin: 0,
    fontFamily: 'var(--font-display)',
    color: 'var(--ink)',
    fontSize: '18px',
    fontWeight: 700,
    letterSpacing: '-0.02em',
  },
  panelHint: {
    margin: '5px 0 0',
    color: 'var(--inkMute)',
    fontSize: '12px',
    fontWeight: 900,
    letterSpacing: '0.06em',
    textTransform: 'uppercase',
  },
  editGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
    gap: '14px',
  },
  label: {
    display: 'flex',
    flexDirection: 'column',
    gap: '7px',
    color: 'var(--inkMute)',
    fontSize: '12px',
    fontWeight: 900,
    textTransform: 'uppercase',
  },
  labelWide: {
    display: 'flex',
    flexDirection: 'column',
    gap: '7px',
    color: 'var(--inkMute)',
    fontSize: '12px',
    fontWeight: 900,
    textTransform: 'uppercase',
    gridColumn: '1 / -1',
  },
  input: {
    height: '44px',
    border: 0,
    borderRadius: '10px',
    background: '#f1ebff',
    color: 'var(--ink)',
    padding: '0 14px',
    fontSize: '14px',
    fontWeight: 700,
    textTransform: 'none',
  },
  textarea: {
    minHeight: '108px',
    border: 0,
    borderRadius: '10px',
    background: '#f1ebff',
    color: 'var(--ink)',
    padding: '12px 14px',
    fontSize: '14px',
    fontWeight: 700,
    resize: 'vertical',
    textTransform: 'none',
  },
  switchLabel: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '8px',
    color: 'var(--inkMute)',
    fontSize: '13px',
    fontWeight: 800,
  },
  saveButton: {
    marginTop: '14px',
    minHeight: '42px',
    border: 0,
    borderRadius: '999px',
    background: '#1f1238',
    color: '#ffffff',
    padding: '0 16px',
    fontSize: '13px',
    fontWeight: 900,
    cursor: 'pointer',
  },
  darkButton: {
    minHeight: '42px',
    border: 0,
    borderRadius: '999px',
    background: '#1f1238',
    color: '#ffffff',
    padding: '0 16px',
    fontSize: '13px',
    fontWeight: 900,
    cursor: 'pointer',
  },
  saveButtonDisabled: {
    background: '#9ca3af',
    cursor: 'not-allowed',
  },
  createVariantBox: {
    display: 'grid',
    gridTemplateColumns: 'repeat(5, minmax(0, 1fr))',
    gap: '10px',
    marginBottom: '14px',
  },
  variantTable: {
    overflow: 'hidden',
    borderRadius: '14px',
    border: '1px solid var(--border)',
  },
  variantHeader: {
    minHeight: '38px',
    display: 'grid',
    gridTemplateColumns: '90px 110px minmax(160px, 1fr) 74px 74px 86px 118px 110px',
    alignItems: 'center',
    background: '#f1ebff',
    color: 'var(--inkMute)',
    padding: '0 12px',
    fontSize: '11px',
    fontWeight: 900,
    textTransform: 'uppercase',
  },
  variantRowWrap: {
    borderTop: '1px solid var(--border)',
  },
  variantRow: {
    minHeight: '48px',
    display: 'grid',
    gridTemplateColumns: '90px 110px minmax(160px, 1fr) 74px 74px 86px 118px 110px',
    alignItems: 'center',
    gap: '0',
    padding: '8px 12px',
    background: '#ffffff',
    color: 'var(--ink)',
    fontSize: '13px',
  },
  variantInput: {
    width: 'calc(100% - 8px)',
    height: '34px',
    border: 0,
    borderRadius: '9px',
    background: '#f7f4ff',
    color: 'var(--ink)',
    padding: '0 10px',
    fontSize: '13px',
    fontWeight: 700,
  },
  activeLabel: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '6px',
    color: 'var(--inkMute)',
    fontSize: '12px',
    fontWeight: 800,
  },
  lowQty: {
    color: '#ff62d2',
  },
  variantActions: {
    display: 'flex',
    justifyContent: 'flex-end',
  },
  smallAction: {
    minHeight: '32px',
    border: 0,
    borderRadius: '999px',
    background: '#f1ebff',
    color: 'var(--ink)',
    padding: '0 10px',
    fontSize: '12px',
    fontWeight: 800,
    cursor: 'pointer',
  },
  smallActionDark: {
    minHeight: '38px',
    border: 0,
    borderRadius: '999px',
    background: '#1f1238',
    color: '#ffffff',
    padding: '0 12px',
    fontSize: '12px',
    fontWeight: 900,
    cursor: 'pointer',
  },
  stockActionRow: {
    display: 'grid',
    gridTemplateColumns: '180px 110px minmax(180px, 1fr) 160px',
    gap: '10px',
    padding: '0 12px 12px',
    background: '#ffffff',
  },
  emptyVariant: {
    color: 'var(--inkMute)',
    fontSize: '13px',
    fontWeight: 800,
  },
  error: {
    marginTop: '12px',
    background: '#fee2e2',
    color: '#991b1b',
    padding: '11px 12px',
    borderRadius: '12px',
    fontSize: '13px',
    fontWeight: 800,
    textTransform: 'none',
  },
  success: {
    marginTop: '12px',
    background: '#dcfce7',
    color: '#166534',
    padding: '11px 12px',
    borderRadius: '12px',
    fontSize: '13px',
    fontWeight: 800,
    textTransform: 'none',
  },
  emptyCard: {
    background: '#ffffff',
    border: '1px solid var(--border)',
    borderRadius: '18px',
    padding: '42px',
    textAlign: 'center',
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
}