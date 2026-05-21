'use client'

import AdminShell from '@/components/AdminShell'
import { useRouter, useSearchParams } from 'next/navigation'
import { useEffect, useMemo, useState, type CSSProperties } from 'react'

export type OrderStatus =
  | 'new'
  | 'review'
  | 'confirmed'
  | 'assembling'
  | 'shipped'
  | 'received'
  | 'cancelled'
  | 'rejected'

export type DeliveryType = 'office' | 'pvz' | 'pickup' | 'courier'

export type AdminOrderItem = {
  id: string
  product_name: string
  size: string | null
  color: string | null
  sku: string | null
  qty: number
}

export type AdminOrder = {
  id: string
  order_number: string
  employee_id: string
  status: OrderStatus
  delivery_type: DeliveryType
  delivery_address: string | null
  full_name: string | null
  phone: string | null
  email: string | null
  city: string | null
  department: string | null
  comment: string | null
  admin_comment: string | null
  tracking_number: string | null
  assigned_to: string | null
  created_at: string
  confirmed_at: string | null
  shipped_at: string | null
  received_at: string | null
  cancelled_at: string | null
  order_items: AdminOrderItem[]
}

type AdminOrdersClientProps = {
  orders: AdminOrder[]
  adminEmail: string
  stockAlertCount: number
}

type SortMode = 'date_desc' | 'date_asc' | 'number_desc' | 'number_asc'

const statusLabels: Record<OrderStatus, string> = {
  new: 'Новый',
  review: 'На проверке',
  confirmed: 'Подтверждён',
  assembling: 'Собирается',
  shipped: 'Отправлен',
  received: 'Получен',
  cancelled: 'Отменён',
  rejected: 'Отклонён',
}

const deliveryLabels: Record<DeliveryType, string> = {
  office: 'В офис',
  pvz: 'ПВЗ / филиал',
  pickup: 'Самовывоз',
  courier: 'Курьер',
}

const statusOptions: OrderStatus[] = [
  'new',
  'review',
  'confirmed',
  'assembling',
  'shipped',
  'received',
  'cancelled',
  'rejected',
]

export default function AdminOrdersClient({
  orders,
  adminEmail,
  stockAlertCount,
}: AdminOrdersClientProps) {
  const searchParams = useSearchParams()
  const queryFromUrl = searchParams.get('q') ?? ''

  const [statusFilter, setStatusFilter] = useState<OrderStatus | 'all'>('all')
  const [search, setSearch] = useState(queryFromUrl)
  const [sortMode, setSortMode] = useState<SortMode>('date_desc')
  const [expandedOrderId, setExpandedOrderId] = useState<string | null>(null)

  useEffect(() => {
    setSearch(queryFromUrl)
  }, [queryFromUrl])

  const counters = useMemo(() => {
    return orders.reduce<Record<string, number>>((acc, order) => {
      acc.all = (acc.all ?? 0) + 1
      acc[order.status] = (acc[order.status] ?? 0) + 1
      return acc
    }, {})
  }, [orders])

  const filteredOrders = useMemo(() => {
    const searchValue = search.trim().toLowerCase()

    const result = orders.filter((order) => {
      const statusMatch =
        statusFilter === 'all' || order.status === statusFilter

      const itemsMatch = order.order_items.some((item) =>
        [
          item.product_name,
          item.size,
          item.color,
          item.sku,
        ]
          .filter(Boolean)
          .join(' ')
          .toLowerCase()
          .includes(searchValue)
      )

      const searchMatch =
        searchValue.length === 0 ||
        order.order_number.toLowerCase().includes(searchValue) ||
        order.full_name?.toLowerCase().includes(searchValue) ||
        order.email?.toLowerCase().includes(searchValue) ||
        order.phone?.toLowerCase().includes(searchValue) ||
        order.department?.toLowerCase().includes(searchValue) ||
        order.delivery_address?.toLowerCase().includes(searchValue) ||
        itemsMatch

      return statusMatch && searchMatch
    })

    return [...result].sort((a, b) => {
      if (sortMode === 'date_desc') {
        return new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      }

      if (sortMode === 'date_asc') {
        return new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
      }

      if (sortMode === 'number_desc') {
        return Number(b.order_number) - Number(a.order_number)
      }

      return Number(a.order_number) - Number(b.order_number)
    })
  }, [orders, search, sortMode, statusFilter])

  function handleExportCsv() {
    const rows = filteredOrders.map((order) => {
      const itemsText = order.order_items
        .map((item) => {
          return `${item.product_name} / ${formatVariant(item)} / ${item.qty} шт. / SKU: ${item.sku || '—'}`
        })
        .join('; ')

      return {
        order_number: order.order_number,
        status: statusLabels[order.status],
        created_at: formatDateTime(order.created_at),
        full_name: order.full_name || '',
        email: order.email || '',
        phone: order.phone || '',
        department: order.department || '',
        city: order.city || '',
        delivery_type: deliveryLabels[order.delivery_type],
        delivery_address: order.delivery_address || '',
        items_qty: String(getTotalQty(order)),
        items: itemsText,
        comment: order.comment || '',
        admin_comment: order.admin_comment || '',
        tracking_number: order.tracking_number || '',
      }
    })

    const csv = toCsv(rows)

    const blob = new Blob([`\uFEFF${csv}`], {
      type: 'text/csv;charset=utf-8;',
    })

    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')

    link.href = url
    link.download = `uzum-merch-orders-${getExportDate()}.csv`
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)

    URL.revokeObjectURL(url)
  }

  return (
    <AdminShell
      adminEmail={adminEmail}
      title="Заказы сотрудников"
      subtitle="Админ-панель · merch.uzum.tech"
      orderCount={orders.length}
      stockAlertCount={stockAlertCount}
    >
      <section style={styles.pageBlock}>
        <StatusTabs
          activeStatus={statusFilter}
          counters={counters}
          onChange={setStatusFilter}
        />

        <section style={styles.toolbar}>
          <div style={styles.searchBox}>
            <span style={styles.searchIcon}>⌕</span>

            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Поиск: номер, ФИО, email, телефон, отдел, товар"
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
            <label style={styles.sortLabel}>
              Сортировка:
              <select
                value={sortMode}
                onChange={(event) => setSortMode(event.target.value as SortMode)}
                style={styles.sortSelect}
              >
                <option value="date_desc">По дате ↓</option>
                <option value="date_asc">По дате ↑</option>
                <option value="number_desc">По номеру ↓</option>
                <option value="number_asc">По номеру ↑</option>
              </select>
            </label>

            <button
              type="button"
              style={
                filteredOrders.length === 0
                  ? { ...styles.exportButton, ...styles.exportButtonDisabled }
                  : styles.exportButton
              }
              onClick={handleExportCsv}
              disabled={filteredOrders.length === 0}
            >
              Экспорт CSV
            </button>
          </div>
        </section>

        {filteredOrders.length === 0 ? (
          <section style={styles.emptyCard}>
            <div style={styles.emptyMark}>∅</div>

            <h2 style={styles.emptyTitle}>Заказы не найдены</h2>

            <p style={styles.emptyText}>
              Измените поиск или выберите другой статус.
            </p>
          </section>
        ) : (
          <section style={styles.tableCard}>
            <div style={styles.tableHeader}>
              <div style={styles.checkboxCell}>
                <input type="checkbox" readOnly />
              </div>
              <div>№</div>
              <div>Получатель</div>
              <div>Отдел · контакт</div>
              <div>Состав</div>
              <div>Доставка</div>
              <div>Создан</div>
              <div>Статус</div>
              <div />
            </div>

            <div style={styles.tableBody}>
              {filteredOrders.map((order) => {
                const isExpanded = expandedOrderId === order.id

                return (
                  <div key={order.id} style={styles.orderGroup}>
                    <button
                      type="button"
                      style={{
                        ...styles.tableRow,
                        ...(isExpanded ? styles.tableRowExpanded : {}),
                      }}
                      onClick={() =>
                        setExpandedOrderId(isExpanded ? null : order.id)
                      }
                    >
                      <div style={styles.checkboxCell}>
                        <input type="checkbox" readOnly />
                      </div>

                      <div style={styles.orderNumber}>#{order.order_number}</div>

                      <div style={styles.receiverCell}>
                        <div style={styles.avatar}>
                          {getInitials(order.full_name, order.email)}
                        </div>

                        <div style={styles.receiverText}>
                          <b>{order.full_name || 'Сотрудник'}</b>
                          <span>{order.city || 'Город не указан'}</span>
                        </div>
                      </div>

                      <div style={styles.contactCell}>
                        <b>{order.department || 'Отдел не указан'}</b>
                        <span>{order.email || order.phone || 'Контакт не указан'}</span>
                      </div>

                      <div style={styles.itemsCell}>
                        <div style={styles.itemMarks}>
                          {order.order_items.slice(0, 3).map((item, index) => (
                            <span key={item.id} style={getItemMarkStyle(index)}>
                              {getProductLetter(item.product_name)}
                            </span>
                          ))}
                        </div>

                        <span style={styles.itemsQty}>
                          {getTotalQty(order)} шт.
                        </span>
                      </div>

                      <div style={styles.deliveryCell}>
                        {deliveryLabels[order.delivery_type]}
                      </div>

                      <div style={styles.dateCell}>
                        {formatRelativeDate(order.created_at)}
                      </div>

                      <div>
                        <span style={getStatusBadgeStyle(order.status)}>
                          {statusLabels[order.status]}
                        </span>
                      </div>

                      <div style={styles.arrowCell}>
                        {isExpanded ? '↑' : '→'}
                      </div>
                    </button>

                    {isExpanded && <OrderDetail order={order} />}
                  </div>
                )
              })}
            </div>
          </section>
        )}
      </section>
    </AdminShell>
  )
}

function StatusTabs({
  activeStatus,
  counters,
  onChange,
}: {
  activeStatus: OrderStatus | 'all'
  counters: Record<string, number>
  onChange: (status: OrderStatus | 'all') => void
}) {
  return (
    <section style={styles.statusTabs}>
      <button
        type="button"
        onClick={() => onChange('all')}
        style={{
          ...styles.statusTab,
          ...(activeStatus === 'all' ? styles.statusTabActive : {}),
        }}
      >
        Все
        <span>{counters.all ?? 0}</span>
      </button>

      {statusOptions.map((status) => (
        <button
          key={status}
          type="button"
          onClick={() => onChange(status)}
          style={{
            ...styles.statusTab,
            ...(activeStatus === status ? styles.statusTabActive : {}),
          }}
        >
          {statusLabels[status]}
          <span>{counters[status] ?? 0}</span>
        </button>
      ))}
    </section>
  )
}

function OrderDetail({ order }: { order: AdminOrder }) {
  const router = useRouter()

  const [status, setStatus] = useState<OrderStatus>(order.status)
  const [adminComment, setAdminComment] = useState(order.admin_comment ?? '')
  const [trackingNumber, setTrackingNumber] = useState(
    order.tracking_number ?? ''
  )

  const [isSaving, setIsSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  async function handleSave() {
    setIsSaving(true)
    setError(null)
    setSuccess(null)

    try {
      const response = await fetch(`/api/admin/orders/${order.id}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          status,
          admin_comment: adminComment,
          tracking_number: trackingNumber,
        }),
      })

      const result = await response.json()

      if (!response.ok) {
        setError(result.error || 'Не удалось обновить заказ')
        return
      }

      setSuccess('Заказ обновлён')
      router.refresh()
    } catch (saveError) {
      const message =
        saveError instanceof Error ? saveError.message : 'Неизвестная ошибка'

      setError(message)
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <section style={styles.detailPanel}>
      <div style={styles.detailGrid}>
        <div style={styles.detailCard}>
          <div style={styles.cardHead}>
            <h3 style={styles.cardTitle}>Получатель</h3>
          </div>

          <div style={styles.infoGrid}>
            <Info label="ФИО" value={order.full_name || 'Не указан'} />
            <Info label="Email" value={order.email || 'Не указан'} />
            <Info label="Телефон" value={order.phone || 'Не указан'} />
            <Info label="Отдел" value={order.department || 'Не указан'} />
            <Info
              label="Доставка"
              value={deliveryLabels[order.delivery_type] ?? order.delivery_type}
            />
            <Info
              label="Адрес"
              value={order.delivery_address || 'Не указан'}
            />
          </div>

          {order.comment && (
            <div style={styles.noteBox}>
              <span>Комментарий сотрудника</span>
              <p>{order.comment}</p>
            </div>
          )}
        </div>

        <div style={styles.detailCard}>
          <div style={styles.cardHead}>
            <h3 style={styles.cardTitle}>Состав заказа</h3>
            <span style={styles.cardHint}>{getTotalQty(order)} шт.</span>
          </div>

          <div style={styles.itemsList}>
            {order.order_items.map((item, index) => (
              <div key={item.id} style={styles.detailItem}>
                <span style={getItemMarkStyle(index)}>
                  {getProductLetter(item.product_name)}
                </span>

                <div style={styles.detailItemMain}>
                  <b>{item.product_name}</b>
                  <span>
                    {formatVariant(item)} · SKU: {item.sku || '—'}
                  </span>
                </div>

                <strong>{item.qty} шт.</strong>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div style={styles.managePanel}>
        <div style={styles.manageHead}>
          <div>
            <h3 style={styles.cardTitle}>Управление заказом</h3>
            <p style={styles.manageText}>
              Изменение статуса может повлиять на резерв и движение остатков.
            </p>
          </div>
        </div>

        <div style={styles.manageGrid}>
          <label style={styles.label}>
            Статус
            <select
              value={status}
              onChange={(event) => setStatus(event.target.value as OrderStatus)}
              style={styles.input}
            >
              {statusOptions.map((statusOption) => (
                <option key={statusOption} value={statusOption}>
                  {statusLabels[statusOption]}
                </option>
              ))}
            </select>
          </label>

          <label style={styles.label}>
            Трек-номер
            <input
              type="text"
              value={trackingNumber}
              onChange={(event) => setTrackingNumber(event.target.value)}
              placeholder="Если есть"
              style={styles.input}
            />
          </label>

          <label style={styles.labelWide}>
            Комментарий администратора
            <textarea
              value={adminComment}
              onChange={(event) => setAdminComment(event.target.value)}
              placeholder="Например: передано на сборку / отправлено курьером"
              style={styles.textarea}
            />
          </label>

          {error && <div style={styles.error}>{error}</div>}
          {success && <div style={styles.success}>{success}</div>}

          <button
            type="button"
            onClick={handleSave}
            disabled={isSaving}
            style={{
              ...styles.saveButton,
              ...(isSaving ? styles.saveButtonDisabled : {}),
            }}
          >
            {isSaving ? 'Сохраняем...' : 'Сохранить изменения'}
          </button>
        </div>
      </div>
    </section>
  )
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div style={styles.info}>
      <span>{label}</span>
      <b>{value}</b>
    </div>
  )
}

function getTotalQty(order: AdminOrder) {
  return order.order_items.reduce((sum, item) => sum + Number(item.qty), 0)
}

function formatVariant(item: AdminOrderItem) {
  const size = item.size || 'ONE SIZE'
  const color = item.color || 'Без цвета'

  return `${color} · ${size}`
}

function formatRelativeDate(value: string) {
  const date = new Date(value)
  const now = new Date()
  const diffMs = now.getTime() - date.getTime()
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24))

  if (diffDays <= 0) return 'сегодня'
  if (diffDays === 1) return 'вчера'
  if (diffDays < 7) return `${diffDays} дн. назад`

  return date.toLocaleDateString('ru-RU', {
    timeZone: 'Asia/Tashkent',
    day: 'numeric',
    month: 'short',
  })
}

function formatDateTime(value: string) {
  return new Date(value).toLocaleString('ru-RU', {
    timeZone: 'Asia/Tashkent',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  })
}

function getExportDate() {
  const date = new Date()

  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  const hours = String(date.getHours()).padStart(2, '0')
  const minutes = String(date.getMinutes()).padStart(2, '0')

  return `${year}-${month}-${day}_${hours}-${minutes}`
}

function toCsv(rows: Array<Record<string, string>>) {
  if (rows.length === 0) {
    return ''
  }

  const headers = Object.keys(rows[0])

  const headerLabels: Record<string, string> = {
    order_number: 'Номер заказа',
    status: 'Статус',
    created_at: 'Дата создания',
    full_name: 'ФИО',
    email: 'Email',
    phone: 'Телефон',
    department: 'Отдел',
    city: 'Город',
    delivery_type: 'Способ получения',
    delivery_address: 'Адрес / точка получения',
    items_qty: 'Количество товаров',
    items: 'Состав заказа',
    comment: 'Комментарий сотрудника',
    admin_comment: 'Комментарий администратора',
    tracking_number: 'Трек-номер',
  }

  const headerRow = headers.map((header) => escapeCsv(headerLabels[header] ?? header))

  const dataRows = rows.map((row) =>
    headers.map((header) => escapeCsv(row[header] ?? '')).join(';')
  )

  return [headerRow.join(';'), ...dataRows].join('\n')
}

function escapeCsv(value: string) {
  const normalizedValue = String(value)
    .replace(/\r?\n|\r/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()

  const escapedValue = normalizedValue.replace(/"/g, '""')

  return `"${escapedValue}"`
}

function getInitials(name: string | null, email: string | null) {
  const source = name?.trim() || email?.split('@')[0] || 'U'
  const parts = source.split(/[ ._-]/).filter(Boolean)

  const first = parts[0]?.[0] ?? 'U'
  const second = parts[1]?.[0] ?? ''

  return `${first}${second}`.toUpperCase()
}

function getProductLetter(name: string) {
  return name.trim()[0]?.toUpperCase() ?? 'U'
}

function getItemMarkStyle(index: number): CSSProperties {
  const backgrounds = [
    'linear-gradient(135deg, #f1ebff 0%, #ffffff 100%)',
    'linear-gradient(135deg, #ffe7f7 0%, #ffffff 100%)',
    'linear-gradient(135deg, #e7f8ff 0%, #ffffff 100%)',
    'linear-gradient(135deg, #fff4dd 0%, #ffffff 100%)',
  ]

  return {
    width: '32px',
    height: '32px',
    borderRadius: '9px',
    background: backgrounds[index % backgrounds.length],
    border: '1px solid var(--border)',
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    color: 'var(--accent)',
    fontFamily: 'var(--font-display)',
    fontSize: '14px',
    fontWeight: 800,
    flex: '0 0 auto',
  }
}

function getStatusBadgeStyle(status: OrderStatus): CSSProperties {
  const base: CSSProperties = {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: '104px',
    borderRadius: '999px',
    padding: '7px 12px',
    fontSize: '12px',
    fontWeight: 900,
    whiteSpace: 'nowrap',
  }

  if (status === 'shipped' || status === 'received') {
    return {
      ...base,
      background: '#dcfce7',
      color: '#166534',
    }
  }

  if (status === 'confirmed' || status === 'assembling') {
    return {
      ...base,
      background: '#dbeafe',
      color: '#1d4ed8',
    }
  }

  if (status === 'cancelled' || status === 'rejected') {
    return {
      ...base,
      background: '#fee2e2',
      color: '#dc2626',
    }
  }

  return {
    ...base,
    background: '#fef3c7',
    color: '#92400e',
  }
}

const styles: Record<string, CSSProperties> = {
  pageBlock: {
    display: 'flex',
    flexDirection: 'column',
    gap: '16px',
  },
  statusTabs: {
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
    flexWrap: 'wrap',
    paddingBottom: '16px',
    borderBottom: '1px solid var(--border)',
  },
  statusTab: {
    minHeight: '38px',
    border: 0,
    borderRadius: '999px',
    background: 'transparent',
    color: 'var(--inkMute)',
    padding: '0 12px',
    fontSize: '13px',
    fontWeight: 800,
    display: 'inline-flex',
    alignItems: 'center',
    gap: '8px',
    cursor: 'pointer',
  },
  statusTabActive: {
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
  sortLabel: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '8px',
    color: 'var(--inkMute)',
    fontSize: '13px',
    fontWeight: 800,
  },
  sortSelect: {
    height: '38px',
    borderRadius: '999px',
    border: '1px solid var(--border)',
    background: '#ffffff',
    color: 'var(--ink)',
    padding: '0 12px',
    fontSize: '13px',
    fontWeight: 800,
  },
  exportButton: {
    height: '38px',
    borderRadius: '999px',
    border: '1px solid var(--border)',
    background: '#ffffff',
    color: 'var(--ink)',
    padding: '0 14px',
    fontSize: '13px',
    fontWeight: 800,
    cursor: 'pointer',
  },
  exportButtonDisabled: {
    opacity: 0.55,
    cursor: 'not-allowed',
  },

  tableCard: {
    overflow: 'hidden',
    borderRadius: '18px',
    border: '1px solid var(--border)',
    background: '#ffffff',
  },
  tableHeader: {
    minHeight: '48px',
    display: 'grid',
    gridTemplateColumns: '40px 110px 196px 220px 150px 124px 90px 126px 44px',
    alignItems: 'center',
    gap: '0',
    padding: '0 18px',
    background: '#f1ebff',
    color: 'var(--inkMute)',
    fontSize: '11px',
    fontWeight: 900,
    textTransform: 'uppercase',
    letterSpacing: '0.04em',
  },
  tableBody: {
    display: 'flex',
    flexDirection: 'column',
  },
  orderGroup: {
    borderTop: '1px solid var(--border)',
  },
  tableRow: {
    width: '100%',
    minHeight: '68px',
    display: 'grid',
    gridTemplateColumns: '40px 110px 196px 220px 150px 124px 90px 126px 44px',
    alignItems: 'center',
    padding: '0 18px',
    border: 0,
    background: '#ffffff',
    color: 'var(--ink)',
    textAlign: 'left',
    cursor: 'pointer',
  },
  tableRowExpanded: {
    background: '#fbfaff',
  },
  checkboxCell: {
    display: 'flex',
    alignItems: 'center',
  },
  orderNumber: {
    color: 'var(--ink)',
    fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace',
    fontSize: '13px',
    fontWeight: 800,
  },
  receiverCell: {
    minWidth: 0,
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
  },
  avatar: {
    width: '30px',
    height: '30px',
    borderRadius: '50%',
    background: 'var(--chip)',
    color: 'var(--ink)',
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: '11px',
    fontWeight: 900,
    flex: '0 0 auto',
  },
  receiverText: {
    minWidth: 0,
    display: 'flex',
    flexDirection: 'column',
    gap: '2px',
    fontSize: '13px',
  },
  contactCell: {
    minWidth: 0,
    display: 'flex',
    flexDirection: 'column',
    gap: '3px',
    fontSize: '13px',
  },
  itemsCell: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
  },
  itemMarks: {
    display: 'flex',
    alignItems: 'center',
    gap: '4px',
  },
  itemsQty: {
    color: 'var(--inkMute)',
    fontSize: '13px',
    fontWeight: 800,
  },
  deliveryCell: {
    color: 'var(--inkMute)',
    fontSize: '13px',
    fontWeight: 800,
  },
  dateCell: {
    color: 'var(--inkMute)',
    fontSize: '13px',
    fontWeight: 800,
  },
  arrowCell: {
    color: 'var(--inkMute)',
    fontSize: '16px',
    fontWeight: 900,
    textAlign: 'right',
  },

  detailPanel: {
    padding: '18px',
    background: '#fbfaff',
    borderTop: '1px solid var(--border)',
    display: 'flex',
    flexDirection: 'column',
    gap: '16px',
  },
  detailGrid: {
    display: 'grid',
    gridTemplateColumns: 'minmax(0, 0.95fr) minmax(0, 1.05fr)',
    gap: '14px',
  },
  detailCard: {
    borderRadius: '16px',
    border: '1px solid var(--border)',
    background: '#ffffff',
    padding: '16px',
  },
  cardHead: {
    display: 'flex',
    justifyContent: 'space-between',
    gap: '12px',
    alignItems: 'center',
    marginBottom: '12px',
  },
  cardTitle: {
    margin: 0,
    color: 'var(--ink)',
    fontFamily: 'var(--font-display)',
    fontSize: '18px',
    fontWeight: 700,
    letterSpacing: '-0.02em',
  },
  cardHint: {
    color: 'var(--inkMute)',
    fontSize: '13px',
    fontWeight: 800,
  },
  infoGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
    gap: '10px',
  },
  info: {
    background: '#fbfaff',
    border: '1px solid var(--border)',
    borderRadius: '12px',
    padding: '10px',
    display: 'flex',
    flexDirection: 'column',
    gap: '4px',
    color: 'var(--inkMute)',
    fontSize: '12px',
    fontWeight: 800,
  },
  noteBox: {
    marginTop: '12px',
    borderRadius: '12px',
    background: '#fbfaff',
    border: '1px solid var(--border)',
    padding: '12px',
    color: 'var(--inkMute)',
    fontSize: '13px',
  },
  itemsList: {
    display: 'flex',
    flexDirection: 'column',
    gap: '8px',
  },
  detailItem: {
    display: 'grid',
    gridTemplateColumns: '32px minmax(0, 1fr) auto',
    gap: '10px',
    alignItems: 'center',
    borderRadius: '12px',
    background: '#fbfaff',
    border: '1px solid var(--border)',
    padding: '10px',
  },
  detailItemMain: {
    minWidth: 0,
    display: 'flex',
    flexDirection: 'column',
    gap: '3px',
    color: 'var(--ink)',
    fontSize: '13px',
  },

  managePanel: {
    borderRadius: '16px',
    border: '1px solid var(--border)',
    background: '#ffffff',
    padding: '16px',
  },
  manageHead: {
    marginBottom: '14px',
  },
  manageText: {
    margin: '5px 0 0',
    color: 'var(--inkMute)',
    fontSize: '13px',
    fontWeight: 700,
    lineHeight: 1.45,
  },
  manageGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
    gap: '12px',
    alignItems: 'end',
  },
  label: {
    display: 'flex',
    flexDirection: 'column',
    gap: '7px',
    color: 'var(--inkMute)',
    fontSize: '13px',
    fontWeight: 800,
  },
  labelWide: {
    display: 'flex',
    flexDirection: 'column',
    gap: '7px',
    color: 'var(--inkMute)',
    fontSize: '13px',
    fontWeight: 800,
    gridColumn: '1 / -1',
  },
  input: {
    height: '42px',
    borderRadius: '12px',
    border: '1px solid var(--border)',
    background: '#ffffff',
    color: 'var(--ink)',
    padding: '0 12px',
    fontSize: '13px',
    fontWeight: 700,
  },
  textarea: {
    minHeight: '82px',
    borderRadius: '12px',
    border: '1px solid var(--border)',
    background: '#ffffff',
    color: 'var(--ink)',
    padding: '10px 12px',
    fontSize: '13px',
    fontWeight: 700,
    resize: 'vertical',
  },
  saveButton: {
    minHeight: '42px',
    borderRadius: '999px',
    border: 0,
    background: '#1f1238',
    color: '#ffffff',
    fontSize: '13px',
    fontWeight: 900,
    padding: '0 16px',
    cursor: 'pointer',
  },
  saveButtonDisabled: {
    background: '#9ca3af',
    cursor: 'not-allowed',
  },
  error: {
    gridColumn: '1 / -1',
    background: '#fee2e2',
    color: '#991b1b',
    padding: '11px 12px',
    borderRadius: '12px',
    fontSize: '13px',
    fontWeight: 800,
  },
  success: {
    gridColumn: '1 / -1',
    background: '#dcfce7',
    color: '#166534',
    padding: '11px 12px',
    borderRadius: '12px',
    fontSize: '13px',
    fontWeight: 800,
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