'use client'

import AdminShell from '@/components/AdminShell'
import { useEffect, useMemo, useState, type ChangeEvent } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { getExportDate, toCsv } from '@/lib/utils'

export type DirectoryEmployee = {
  id: string
  email: string
  full_name: string
  business_unit: string | null
  position: string | null
  hired_at: string
  is_active: boolean
  created_at: string
  updated_at: string
}

type Props = {
  employees: DirectoryEmployee[]
  adminEmail: string
  orderCount: number
  stockAlertCount: number
}

type StatusFilter = 'all' | 'active' | 'inactive'

export default function AdminEmployeesClient({
  employees,
  adminEmail,
  orderCount,
  stockAlertCount,
}: Props) {
  const searchParams = useSearchParams()
  const queryFromUrl = searchParams.get('q') ?? ''

  const [search,       setSearch]       = useState(queryFromUrl)
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all')
  const [unitFilter,   setUnitFilter]   = useState<string>('all')
  const [editingId,    setEditingId]    = useState<string | null>(null)
  const [isCreateOpen, setIsCreateOpen] = useState(false)

  useEffect(() => { setSearch(queryFromUrl) }, [queryFromUrl])

  const units = useMemo(() => {
    const set = new Set<string>()
    employees.forEach((e) => { if (e.business_unit) set.add(e.business_unit) })
    return [...set].sort((a, b) => a.localeCompare(b, 'ru'))
  }, [employees])

  const totals = useMemo(() => {
    const total    = employees.length
    const active   = employees.filter((e) => e.is_active).length
    const inactive = total - active
    return { total, active, inactive, units: units.length }
  }, [employees, units])

  const filtered = useMemo(() => {
    const value = search.trim().toLowerCase()

    return employees.filter((e) => {
      const statusMatch =
        statusFilter === 'all' ||
        (statusFilter === 'active'   && e.is_active) ||
        (statusFilter === 'inactive' && !e.is_active)

      const unitMatch = unitFilter === 'all' || e.business_unit === unitFilter

      const searchMatch =
        value.length === 0 ||
        e.full_name.toLowerCase().includes(value) ||
        e.email.toLowerCase().includes(value) ||
        e.position?.toLowerCase().includes(value) ||
        e.business_unit?.toLowerCase().includes(value)

      return statusMatch && unitMatch && searchMatch
    })
  }, [employees, search, statusFilter, unitFilter])

  function handleExportCsv() {
    const rows = filtered.map((e) => ({
      full_name:     e.full_name,
      email:         e.email,
      business_unit: e.business_unit || '',
      position:      e.position || '',
      hired_at:      formatDate(e.hired_at),
      status:        e.is_active ? 'Активен' : 'Уволен',
    }))

    const csv  = toCsv(rows)
    const blob = new Blob([`﻿${csv}`], { type: 'text/csv;charset=utf-8;' })
    const url  = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href     = url
    link.download = `uzum-merch-employees-${getExportDate()}.csv`
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    URL.revokeObjectURL(url)
  }

  function handleUnitChange(event: ChangeEvent<HTMLSelectElement>) {
    setUnitFilter(event.target.value)
  }

  const statusTabs: { key: StatusFilter; label: string; count: number }[] = [
    { key: 'all',      label: 'Все',       count: totals.total },
    { key: 'active',   label: 'Активные',  count: totals.active },
    { key: 'inactive', label: 'Уволенные', count: totals.inactive },
  ]

  return (
    <AdminShell
      adminEmail={adminEmail}
      title="Сотрудники"
      subtitle="Админ-панель · merch.uzum.tech"
      orderCount={orderCount}
      stockAlertCount={stockAlertCount}
    >
      <section className="ae-page">

        {/* Summary */}
        <section className="ae-summary-strip">
          <SummaryMetric label="Всего в реестре" value={String(totals.total)} />
          <SummaryMetric label="Активных"        value={String(totals.active)} />
          <SummaryMetric label="Уволенных"       value={String(totals.inactive)} />
          <SummaryMetric label="Подразделений"   value={String(totals.units)} />
        </section>

        {/* Status tabs */}
        <section className="ae-status-tabs">
          {statusTabs.map((tab) => (
            <button
              key={tab.key}
              type="button"
              onClick={() => setStatusFilter(tab.key)}
              className={`ae-status-tab${statusFilter === tab.key ? ' ae-status-tab-active' : ''}`}
            >
              {tab.label}
              <span>{tab.count}</span>
            </button>
          ))}
        </section>

        {/* Toolbar */}
        <section className="ae-toolbar">
          <div className="ae-search-box">
            <span className="ae-search-icon">⌕</span>
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Поиск: ФИО, email, должность, подразделение"
              className="ae-search-input"
            />
            {search.trim().length > 0 && (
              <button type="button" onClick={() => setSearch('')} className="ae-clear-btn">×</button>
            )}
          </div>

          <div className="ae-toolbar-right">
            <select value={unitFilter} onChange={handleUnitChange} className="ae-unit-select">
              <option value="all">Все подразделения</option>
              {units.map((unit) => <option key={unit} value={unit}>{unit}</option>)}
            </select>

            <button
              type="button"
              className="ae-export-btn"
              onClick={handleExportCsv}
              disabled={filtered.length === 0}
            >
              Экспорт CSV
            </button>

            <button
              type="button"
              className="ae-new-btn"
              onClick={() => { setEditingId(null); setIsCreateOpen((v) => !v) }}
            >
              + Добавить сотрудника
            </button>
          </div>
        </section>

        {/* Create panel */}
        {isCreateOpen && (
          <EmployeeEditor mode="create" onClose={() => setIsCreateOpen(false)} />
        )}

        {/* Table / empty */}
        {filtered.length === 0 ? (
          <section className="ae-empty-card">
            <div className="ae-empty-mark">∅</div>
            <h2 className="ae-empty-title">Сотрудники не найдены</h2>
            <p className="ae-empty-text">Измените поиск, статус или подразделение.</p>
          </section>
        ) : (
          <section className="ae-table-card">
            <div className="ae-table-header">
              <div>Сотрудник</div>
              <div>Email</div>
              <div>Подразделение</div>
              <div>Должность</div>
              <div>Принят</div>
              <div>Статус</div>
              <div />
            </div>

            <div className="ae-table-body">
              {filtered.map((employee) => {
                const isEditing = editingId === employee.id
                return (
                  <div key={employee.id} className="ae-row-group">
                    <button
                      type="button"
                      onClick={() => { setIsCreateOpen(false); setEditingId(isEditing ? null : employee.id) }}
                      className={`ae-row ae-row-button${isEditing ? ' ae-row-active' : ''}`}
                    >
                      <div className="ae-name-cell">
                        <div className="ae-avatar">{getInitials(employee.full_name, employee.email)}</div>
                        <div className="ae-name-text">
                          <b>{employee.full_name || 'Без имени'}</b>
                          <span>В реестре с {formatDate(employee.created_at)}</span>
                        </div>
                      </div>

                      <div className="ae-cell-mute">{employee.email}</div>
                      <div className="ae-cell-ink">{employee.business_unit || '—'}</div>
                      <div className="ae-cell-mute">{employee.position || '—'}</div>
                      <div className="ae-cell-mute">{formatDate(employee.hired_at)}</div>

                      <div>
                        <span className={`ae-badge${employee.is_active ? '' : ' ae-badge-off'}`}>
                          {employee.is_active ? 'Активен' : 'Уволен'}
                        </span>
                      </div>

                      <div className="ae-row-caret">{isEditing ? '⌃' : '⌄'}</div>
                    </button>

                    {isEditing && (
                      <EmployeeEditor
                        mode="edit"
                        employee={employee}
                        onClose={() => setEditingId(null)}
                      />
                    )}
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
/*  EmployeeEditor — shared create/edit form                                     */
/* ─────────────────────────────────────────────────────────────────────────── */

function EmployeeEditor({
  mode,
  employee,
  onClose,
}: {
  mode: 'create' | 'edit'
  employee?: DirectoryEmployee
  onClose: () => void
}) {
  const router = useRouter()
  const isCreate = mode === 'create'

  const [fullName, setFullName] = useState(employee?.full_name ?? '')
  const [email,    setEmail]    = useState(employee?.email ?? '')
  const [unit,     setUnit]     = useState(employee?.business_unit ?? '')
  const [position, setPosition] = useState(employee?.position ?? '')
  const [hiredAt,  setHiredAt]  = useState(employee?.hired_at?.slice(0, 10) ?? '')
  const [isActive, setIsActive] = useState(employee?.is_active ?? true)

  const [isSaving, setIsSaving] = useState(false)
  const [error,    setError]    = useState<string | null>(null)

  async function handleSave() {
    setIsSaving(true)
    setError(null)

    try {
      const response = await fetch('/api/admin/employees', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: isCreate ? 'create_employee' : 'update_employee',
          id: employee?.id,
          full_name: fullName,
          email,
          business_unit: unit,
          position,
          hired_at: hiredAt,
          is_active: isActive,
        }),
      })

      const result = await response.json()
      if (!response.ok) { setError(result.error || 'Не удалось сохранить'); return }

      onClose()
      router.refresh()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Неизвестная ошибка')
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <section className={isCreate ? 'ae-editor ae-editor-create' : 'ae-editor'}>
      {isCreate && (
        <div className="ae-editor-head">
          <h3 className="ae-editor-title">Новый сотрудник</h3>
          <p className="ae-editor-hint">Запись попадёт в HR-реестр и синхронизируется с аккаунтом по email.</p>
        </div>
      )}

      <div className="ae-editor-grid">
        <label className="ae-field">
          ФИО
          <input value={fullName} onChange={(e) => setFullName(e.target.value)} placeholder="Иван Иванов" className="ae-input" />
        </label>

        <label className="ae-field">
          Email
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="ivan@uzum.uz"
            disabled={!isCreate}
            className="ae-input"
          />
          {!isCreate && <span className="ae-field-note">Email менять нельзя — это ключ привязки к аккаунту</span>}
        </label>

        <label className="ae-field">
          Подразделение
          <input value={unit} onChange={(e) => setUnit(e.target.value)} placeholder="IT" className="ae-input" />
        </label>

        <label className="ae-field">
          Должность
          <input value={position} onChange={(e) => setPosition(e.target.value)} placeholder="Developer" className="ae-input" />
        </label>

        <label className="ae-field">
          Дата найма
          <input type="date" value={hiredAt} onChange={(e) => setHiredAt(e.target.value)} className="ae-input" />
        </label>

        <label className="ae-switch">
          <input type="checkbox" checked={isActive} onChange={(e) => setIsActive(e.target.checked)} />
          Активен (работает в компании)
        </label>
      </div>

      {error && <div className="ae-error">{error}</div>}

      <div className="ae-editor-actions">
        <button type="button" onClick={onClose} className="ae-cancel-btn">Отмена</button>
        <button type="button" onClick={handleSave} disabled={isSaving} className="ae-save-btn">
          {isSaving ? 'Сохраняем...' : isCreate ? 'Добавить' : 'Сохранить'}
        </button>
      </div>
    </section>
  )
}

/* ─────────────────────────────────────────────────────────────────────────── */
/*  SummaryMetric                                                                */
/* ─────────────────────────────────────────────────────────────────────────── */

function SummaryMetric({ label, value }: { label: string; value: string }) {
  return (
    <div className="ae-summary-metric">
      <span>{label}</span>
      <b>{value}</b>
    </div>
  )
}

/* ─────────────────────────────────────────────────────────────────────────── */
/*  Helpers                                                                      */
/* ─────────────────────────────────────────────────────────────────────────── */

function getInitials(name: string, email: string) {
  const source = name?.trim() || email?.split('@')[0] || 'U'
  const parts  = source.split(/[ ._-]/).filter(Boolean)
  return `${parts[0]?.[0] ?? 'U'}${parts[1]?.[0] ?? ''}`.toUpperCase()
}

function formatDate(value: string) {
  return new Date(value).toLocaleDateString('ru-RU', {
    timeZone: 'Asia/Tashkent',
    day:   'numeric',
    month: 'short',
    year:  'numeric',
  })
}
