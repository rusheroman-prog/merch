'use client'

import AdminShell from '@/components/AdminShell'
import { getExportDate, toCsv } from '@/lib/utils'

export type HandedRow = {
  product: string
  size: string
  color: string
  office: number
  post: number
}

export type StockRow = {
  product: string
  size: string
  color: string
  sku: string
  total: number
  reserved: number
  available: number
  threshold: number
  hidden: boolean
}

type Props = {
  adminEmail: string
  orderCount: number
  stockAlertCount: number
  from: string
  to: string
  summary: { created: number; received: number; cancelled: number; unitsOut: number }
  handed: HandedRow[]
  stock: StockRow[]
}

export default function ReportClient({
  adminEmail, orderCount, stockAlertCount, from, to, summary, handed, stock,
}: Props) {
  function download(name: string, rows: Array<Record<string, string>>) {
    const csv  = toCsv(rows)
    const blob = new Blob([`﻿${csv}`], { type: 'text/csv;charset=utf-8;' })
    const url  = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `uzum-merch-${name}-${getExportDate()}.csv`
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    URL.revokeObjectURL(url)
  }

  const totalStock = stock.reduce(
    (acc, row) => ({ total: acc.total + row.total, reserved: acc.reserved + row.reserved, available: acc.available + row.available }),
    { total: 0, reserved: 0, available: 0 }
  )

  return (
    <AdminShell
      adminEmail={adminEmail}
      title="Отчёт"
      subtitle="Админ-панель · merch.uzum.tech"
      orderCount={orderCount}
      stockAlertCount={stockAlertCount}
    >
      <section className="rp-page">
        <form className="rp-period" method="get">
          <label>
            С
            <input type="date" name="from" defaultValue={from} />
          </label>
          <label>
            По
            <input type="date" name="to" defaultValue={to} />
          </label>
          <button type="submit">Показать</button>
        </form>

        <section className="dash-kpi-grid">
          <Kpi label="Оформлено заказов" value={summary.created} />
          <Kpi label="Выдано / получено" value={summary.received} hint={`${summary.unitsOut} шт. товара`} />
          <Kpi label="Отменено и отклонено" value={summary.cancelled} />
          <Kpi label="На складе сейчас" value={totalStock.available} hint={`доступно · всего ${totalStock.total}, в резерве ${totalStock.reserved}`} />
        </section>

        <section className="dash-card">
          <div className="dash-card-head">
            <h2 className="dash-card-title">Выдано за период</h2>
            <button
              type="button"
              className="rp-export"
              disabled={handed.length === 0}
              onClick={() => download(`handed-${from}-${to}`, handed.map(row => ({
                product: row.product, size: row.size, color: row.color,
                office: String(row.office), post: String(row.post), total: String(row.office + row.post),
              })))}
            >
              Экспорт CSV
            </button>
          </div>
          {handed.length === 0 ? (
            <p className="dash-empty-text">За период ничего не выдано.</p>
          ) : (
            <div className="rp-table-wrap">
              <table className="rp-table">
                <thead>
                  <tr><th>Товар</th><th>Размер</th><th>Цвет</th><th>В офисе</th><th>Почтой</th><th>Всего</th></tr>
                </thead>
                <tbody>
                  {handed.map(row => (
                    <tr key={`${row.product}-${row.size}-${row.color}`}>
                      <td>{row.product}</td><td>{row.size}</td><td>{row.color}</td>
                      <td>{row.office}</td><td>{row.post}</td><td><b>{row.office + row.post}</b></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

        <section className="dash-card">
          <div className="dash-card-head">
            <h2 className="dash-card-title">Остатки по размерам</h2>
            <button
              type="button"
              className="rp-export"
              disabled={stock.length === 0}
              onClick={() => download('stock', stock.map(row => ({
                product: row.product, size: row.size, color: row.color, sku: row.sku,
                total: String(row.total), reserved: String(row.reserved), available: String(row.available),
                beacon: String(row.threshold), hidden: row.hidden ? 'скрыт' : '',
              })))}
            >
              Экспорт CSV
            </button>
          </div>
          <div className="rp-table-wrap">
            <table className="rp-table">
              <thead>
                <tr><th>Товар</th><th>Размер</th><th>Цвет</th><th>Всего</th><th>Резерв</th><th>Доступно</th></tr>
              </thead>
              <tbody>
                {stock.map(row => (
                  <tr key={`${row.product}-${row.sku}-${row.size}-${row.color}`} className={row.available <= row.threshold ? 'rp-row-low' : ''}>
                    <td>{row.product}{row.hidden && <small className="rp-hidden"> скрыт</small>}</td>
                    <td>{row.size}</td><td>{row.color}</td>
                    <td>{row.total}</td><td>{row.reserved}</td>
                    <td><b>{row.available}</b>{row.available <= row.threshold && <small className="rp-beacon"> ≤ {row.threshold}</small>}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      </section>
    </AdminShell>
  )
}

function Kpi({ label, value, hint }: { label: string; value: number; hint?: string }) {
  return (
    <div className="dash-kpi">
      <span>{label}</span>
      <b>{value}</b>
      {hint && <small>{hint}</small>}
    </div>
  )
}
