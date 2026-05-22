'use client'

import AdminShell from '@/components/AdminShell'
import { useRouter, useSearchParams } from 'next/navigation'
import { useEffect, useMemo, useState, type ChangeEvent } from 'react'
import type { DeliveryType, OrderStatus } from '@/lib/supabase/types'
import { getExportDate, getProductLetter, toCsv } from '@/lib/utils'

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
  const [selectedOrders, setSelectedOrders] = useState<string[]>([])

  function toggleOrderSelection(orderId: string) {
    setSelectedOrders((current) =>
      current.includes(orderId)
        ? current.filter((id) => id !== orderId)
        : [...current, orderId]
    )
  }

  function handleSelectAll(event: ChangeEvent<HTMLInputElement>) {
    if (event.target.checked) {
      setSelectedOrders(filteredOrders.map((order) => order.id))
      return
    }
    setSelectedOrders([])
  }

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
        [item.product_name, item.size, item.color, item.sku]
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
      if (sortMode === 'date_desc')
        return new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      if (sortMode === 'date_asc')
        return new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
      if (sortMode === 'number_desc')
        return Number(b.order_number) - Number(a.order_number)
      return Number(a.order_number) - Number(b.order_number)
    })
  }, [orders, search, sortMode, statusFilter])

  function handleExportCsv() {
    const rows = filteredOrders.map((order) => {
      const itemsText = order.order_items
        .map((item) =>
          `${item.product_name} / ${formatVariant(item)} / ${item.qty} шт. / SKU: ${item.sku || '—'}`
        )
        .join('; ')

      return {
        order_number:     order.order_number,
        status:           statusLabels[order.status],
        created_at:       formatDateTime(order.created_at),
        full_name:        order.full_name || '',
        email:            order.email || '',
        phone:            order.phone || '',
        department:       order.department || '',
        city:             order.city || '',
        delivery_type:    deliveryLabels[order.delivery_type],
        delivery_address: order.delivery_address || '',
        items_qty:        String(getTotalQty(order)),
        items:            itemsText,
        comment:          order.comment || '',
        admin_comment:    order.admin_comment || '',
        tracking_number:  order.tracking_number || '',
      }
    })

    const csv  = toCsv(rows)
    const blob = new Blob([`﻿${csv}`], { type: 'text/csv;charset=utf-8;' })
    const url  = URL.createObjectURL(blob)
    const link = document.createElement('a')

    link.href     = url
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
      <section className="ao-page">
        <StatusTabs
          activeStatus={statusFilter}
          counters={counters}
          onChange={setStatusFilter}
        />

        <section className="ao-toolbar">
          <div className="ao-search-box">
            <span className="ao-search-icon">⌕</span>
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Поиск: номер, ФИО, email, телефон, отдел, товар"
              className="ao-search-input"
            />
            {search.trim().length > 0 && (
              <button
                type="button"
                onClick={() => setSearch('')}
                className="ao-clear-btn"
              >
                ×
              </button>
            )}
          </div>

          <div className="ao-toolbar-right">
            <label className="ao-sort-label">
              Сортировка:
              <select
                value={sortMode}
                onChange={(e) => setSortMode(e.target.value as SortMode)}
                className="ao-sort-select"
              >
                <option value="date_desc">По дате ↓</option>
                <option value="date_asc">По дате ↑</option>
                <option value="number_desc">По номеру ↓</option>
                <option value="number_asc">По номеру ↑</option>
              </select>
            </label>

            <button
              type="button"
              className="ao-export-btn"
              onClick={handleExportCsv}
              disabled={filteredOrders.length === 0}
            >
              Экспорт CSV
            </button>
          </div>
        </section>

        {filteredOrders.length === 0 ? (
          <section className="ao-empty-card">
            <div className="ao-empty-mark">∅</div>
            <h2 className="ao-empty-title">Заказы не найдены</h2>
            <p className="ao-empty-text">
              Измените поиск или выберите другой статус.
            </p>
          </section>
        ) : (
          <section className="ao-table-card">
            <div className="ao-table-header">
              <div className="ao-checkbox-cell">
                <input
                  type="checkbox"
                  checked={
                    filteredOrders.length > 0 &&
                    selectedOrders.length === filteredOrders.length
                  }
                  onChange={handleSelectAll}
                />
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

            <div className="ao-table-body">
              {filteredOrders.map((order) => {
                const isExpanded = expandedOrderId === order.id

                return (
                  <div key={order.id} className="ao-order-group">
                    <button
                      type="button"
                      className={`ao-row${isExpanded ? ' ao-row-expanded' : ''}`}
                      onClick={() =>
                        setExpandedOrderId(isExpanded ? null : order.id)
                      }
                    >
                      <div className="ao-checkbox-cell">
                        <input
                          type="checkbox"
                          checked={selectedOrders.includes(order.id)}
                          onChange={() => toggleOrderSelection(order.id)}
                          onClick={(e) => e.stopPropagation()}
                        />
                      </div>

                      <div className="ao-order-number">#{order.order_number}</div>

                      <div className="ao-receiver-cell">
                        <div className="ao-avatar">
                          {getInitials(order.full_name, order.email)}
                        </div>
                        <div className="ao-receiver-text">
                          <b>{order.full_name || 'Сотрудник'}</b>
                          <span>{order.city || 'Город не указан'}</span>
                        </div>
                      </div>

                      <div className="ao-contact-cell">
                        <b>{order.department || 'Отдел не указан'}</b>
                        <span>{order.email || order.phone || 'Контакт не указан'}</span>
                      </div>

                      <div className="ao-items-cell">
                        <div className="ao-item-marks">
                          {order.order_items.slice(0, 3).map((item, index) => (
                            <span key={item.id} className={getItemMarkClass(index)}>
                              {getProductLetter(item.product_name)}
                            </span>
                          ))}
                        </div>
                        <span className="ao-items-qty">
                          {getTotalQty(order)} шт.
                        </span>
                      </div>

                      <div className="ao-delivery-cell">
                        {deliveryLabels[order.delivery_type]}
                      </div>

                      <div className="ao-date-cell">
                        {formatRelativeDate(order.created_at)}
                      </div>

                      <div>
                        <span className={getStatusBadgeClass(order.status)}>
                          {statusLabels[order.status]}
                        </span>
                      </div>

                      <div className="ao-arrow-cell">
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

/* ─────────────────────────────────────────────────────────────────────────── */
/*  StatusTabs                                                                  */
/* ─────────────────────────────────────────────────────────────────────────── */

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
    <section className="ao-status-tabs">
      <button
        type="button"
        onClick={() => onChange('all')}
        className={`ao-status-tab${activeStatus === 'all' ? ' ao-status-tab-active' : ''}`}
      >
        Все
        <span>{counters.all ?? 0}</span>
      </button>

      {statusOptions.map((status) => (
        <button
          key={status}
          type="button"
          onClick={() => onChange(status)}
          className={`ao-status-tab${activeStatus === status ? ' ao-status-tab-active' : ''}`}
        >
          {statusLabels[status]}
          <span>{counters[status] ?? 0}</span>
        </button>
      ))}
    </section>
  )
}

/* ─────────────────────────────────────────────────────────────────────────── */
/*  OrderDetail                                                                 */
/* ─────────────────────────────────────────────────────────────────────────── */

function OrderDetail({ order }: { order: AdminOrder }) {
  const router = useRouter()

  const [status, setStatus] = useState<OrderStatus>(order.status)
  const [adminComment, setAdminComment] = useState(order.admin_comment ?? '')
  const [trackingNumber, setTrackingNumber] = useState(order.tracking_number ?? '')

  const [isSaving, setIsSaving] = useState(false)
  const [error,    setError]    = useState<string | null>(null)
  const [success,  setSuccess]  = useState<string | null>(null)

  async function handleSave() {
    setIsSaving(true)
    setError(null)
    setSuccess(null)

    try {
      const response = await fetch(`/api/admin/orders/${order.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
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
      setError(
        saveError instanceof Error ? saveError.message : 'Неизвестная ошибка'
      )
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <section className="ao-detail-panel">
      <div className="ao-detail-grid">

        {/* Получатель */}
        <div className="ao-detail-card">
          <div className="ao-card-head">
            <h3 className="ao-card-title">Получатель</h3>
          </div>
          <div className="ao-info-grid">
            <Info label="ФИО"      value={order.full_name || 'Не указан'} />
            <Info label="Email"    value={order.email || 'Не указан'} />
            <Info label="Телефон"  value={order.phone || 'Не указан'} />
            <Info label="Отдел"    value={order.department || 'Не указан'} />
            <Info label="Доставка" value={deliveryLabels[order.delivery_type] ?? order.delivery_type} />
            <Info label="Адрес"    value={order.delivery_address || 'Не указан'} />
          </div>
          {order.comment && (
            <div className="ao-note-box">
              <span>Комментарий сотрудника</span>
              <p>{order.comment}</p>
            </div>
          )}
        </div>

        {/* Состав заказа */}
        <div className="ao-detail-card">
          <div className="ao-card-head">
            <h3 className="ao-card-title">Состав заказа</h3>
            <span className="ao-card-hint">{getTotalQty(order)} шт.</span>
          </div>
          <div className="ao-items-list">
            {order.order_items.map((item, index) => (
              <div key={item.id} className="ao-detail-item">
                <span className={getItemMarkClass(index)}>
                  {getProductLetter(item.product_name)}
                </span>
                <div className="ao-detail-item-main">
                  <b>{item.product_name}</b>
                  <span>{formatVariant(item)} · SKU: {item.sku || '—'}</span>
                </div>
                <strong>{item.qty} шт.</strong>
              </div>
            ))}
          </div>
        </div>

      </div>

      {/* Управление */}
      <div className="ao-manage-panel">
        <div className="ao-manage-head">
          <h3 className="ao-card-title">Управление заказом</h3>
          <p className="ao-manage-text">
            Изменение статуса может повлиять на резерв и движение остатков.
          </p>
        </div>

        <div className="ao-manage-grid">
          <label className="ao-label">
            Статус
            <select
              value={status}
              onChange={(e) => setStatus(e.target.value as OrderStatus)}
              className="ao-input"
            >
              {statusOptions.map((opt) => (
                <option key={opt} value={opt}>{statusLabels[opt]}</option>
              ))}
            </select>
          </label>

          <label className="ao-label">
            Трек-номер
            <input
              type="text"
              value={trackingNumber}
              onChange={(e) => setTrackingNumber(e.target.value)}
              placeholder="Если есть"
              className="ao-input"
            />
          </label>

          <label className="ao-label-wide">
            Комментарий администратора
            <textarea
              value={adminComment}
              onChange={(e) => setAdminComment(e.target.value)}
              placeholder="Например: передано на сборку / отправлено курьером"
              className="ao-textarea"
            />
          </label>

          {error   && <div className="ao-error">{error}</div>}
          {success && <div className="ao-success">{success}</div>}

          <button
            type="button"
            className="ao-save-btn"
            onClick={handleSave}
            disabled={isSaving}
          >
            {isSaving ? 'Сохраняем...' : 'Сохранить изменения'}
          </button>
        </div>
      </div>
    </section>
  )
}

/* ─────────────────────────────────────────────────────────────────────────── */
/*  Info                                                                        */
/* ─────────────────────────────────────────────────────────────────────────── */

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div className="ao-info">
      <span>{label}</span>
      <b>{value}</b>
    </div>
  )
}

/* ─────────────────────────────────────────────────────────────────────────── */
/*  Helpers                                                                     */
/* ─────────────────────────────────────────────────────────────────────────── */

function getTotalQty(order: AdminOrder) {
  return order.order_items.reduce((sum, item) => sum + Number(item.qty), 0)
}

function formatVariant(item: AdminOrderItem) {
  return `${item.color || 'Без цвета'} · ${item.size || 'ONE SIZE'}`
}

function formatRelativeDate(value: string) {
  const date     = new Date(value)
  const diffMs   = Date.now() - date.getTime()
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24))

  if (diffDays <= 0) return 'сегодня'
  if (diffDays === 1) return 'вчера'
  if (diffDays < 7)   return `${diffDays} дн. назад`

  return date.toLocaleDateString('ru-RU', {
    timeZone: 'Asia/Tashkent',
    day: 'numeric',
    month: 'short',
  })
}

function formatDateTime(value: string) {
  return new Date(value).toLocaleString('ru-RU', {
    timeZone: 'Asia/Tashkent',
    year:     'numeric',
    month:    '2-digit',
    day:      '2-digit',
    hour:     '2-digit',
    minute:   '2-digit',
  })
}

function getInitials(name: string | null, email: string | null) {
  const source = name?.trim() || email?.split('@')[0] || 'U'
  const parts  = source.split(/[ ._-]/).filter(Boolean)
  return `${parts[0]?.[0] ?? 'U'}${parts[1]?.[0] ?? ''}`.toUpperCase()
}

function getItemMarkClass(index: number): string {
  const mod = index % 4
  return mod === 0 ? 'ao-item-mark' : `ao-item-mark ao-item-mark-${mod}`
}

function getStatusBadgeClass(status: OrderStatus): string {
  if (status === 'shipped'   || status === 'received')   return 'ao-badge ao-badge-green'
  if (status === 'confirmed' || status === 'assembling') return 'ao-badge ao-badge-blue'
  if (status === 'cancelled' || status === 'rejected')   return 'ao-badge ao-badge-red'
  return 'ao-badge'
}
