'use client'

import AdminShell from '@/components/AdminShell'
import { useEffect, useMemo, useState, type ChangeEvent } from 'react'
import { useSearchParams } from 'next/navigation'
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
    { key: 'all',      label: 'Все',      count: totals.total },
    { key: 'active',   label: 'Активные', count: totals.active },
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
          <SummaryMetric label="Всего в реестре"  value={String(totals.total)} />
          <SummaryMetric label="Активных"         value={String(totals.active)} />
          <SummaryMetric label="Уволенных"        value={String(totals.inactive)} />
          <SummaryMetric label="Подразделений"    value={String(totals.units)} />
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
          </div>
        </section>

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
            </div>

            <div className="ae-table-body">
              {filtered.map((employee) => (
                <div key={employee.id} className="ae-row">
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
                </div>
              ))}
            </div>
          </section>
        )}

      </section>
    </AdminShell>
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
