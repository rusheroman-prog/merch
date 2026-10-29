'use client'

import AdminShell from '@/components/AdminShell'
import { decline } from '@/lib/utils'
import { welcomeInviteUrl } from '@/lib/welcome'
import { useRouter } from 'next/navigation'
import { useState, type FormEvent } from 'react'

export type WelcomeInviteRow = {
  id: string
  token: string
  email: string
  full_name: string | null
  note: string | null
  created_at: string
  expires_at: string
  used_at: string | null
  used_order_id: string | null
  orders: { order_number: string } | { order_number: string }[] | null
}

type Props = {
  adminEmail: string
  orderCount: number
  stockAlertCount: number
  migrationReady: boolean
  invites: WelcomeInviteRow[]
  welcomeProductCount: number
}

export default function AdminWelcomeClient({
  adminEmail,
  orderCount,
  stockAlertCount,
  migrationReady,
  invites,
  welcomeProductCount,
}: Props) {
  const router = useRouter()
  const [email,    setEmail]    = useState('')
  const [fullName, setFullName] = useState('')
  const [note,     setNote]     = useState('')
  const [isSaving, setIsSaving] = useState(false)
  const [error,    setError]    = useState<string | null>(null)
  const [created,  setCreated]  = useState<string | null>(null)
  const [copiedId, setCopiedId] = useState<string | null>(null)

  async function handleCreate(event: FormEvent) {
    event.preventDefault()
    setIsSaving(true); setError(null); setCreated(null)
    try {
      const response = await fetch('/api/admin/welcome', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, full_name: fullName, note }),
      })
      const result = await response.json()
      if (!response.ok) { setError(result.error || 'Не удалось создать ссылку'); return }
      const url = welcomeInviteUrl(window.location.origin, result.invite.token)
      setCreated(url)
      await copy(url, 'new')
      setEmail(''); setFullName(''); setNote('')
      router.refresh()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Неизвестная ошибка')
    } finally {
      setIsSaving(false)
    }
  }

  async function handleDelete(invite: WelcomeInviteRow) {
    if (!window.confirm(`Отозвать ссылку для ${invite.email}?`)) return
    const response = await fetch('/api/admin/welcome', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: invite.id }),
    })
    if (!response.ok) {
      const result = await response.json().catch(() => ({}))
      window.alert(result.error || 'Не удалось отозвать ссылку')
      return
    }
    router.refresh()
  }

  async function copy(text: string, id: string) {
    try {
      await navigator.clipboard.writeText(text)
      setCopiedId(id)
      window.setTimeout(() => setCopiedId((cur) => (cur === id ? null : cur)), 1600)
    } catch { /* буфер обмена может быть недоступен — ссылка видна на экране */ }
  }

  return (
    <AdminShell
      adminEmail={adminEmail}
      title="Welcome pack"
      subtitle="Ссылки для новых сотрудников"
      orderCount={orderCount}
      stockAlertCount={stockAlertCount}
    >
      <section className="aw-page">
        {!migrationReady ? (
          <section className="ap-empty-card">
            <div className="ap-empty-mark">!</div>
            <h2 className="ap-empty-title">Нужна миграция</h2>
            <p className="ap-empty-text">
              Прогоните <b>merch-welcome-pack.sql</b> в Supabase SQL Editor — после этого здесь можно
              будет создавать ссылки на welcome pack.
            </p>
          </section>
        ) : (
          <>
            <section className="aw-card">
              <div>
                <h2 className="ao-card-title">Новая ссылка</h2>
                <p className="ao-manage-text">
                  Ссылка одноразовая и работает только для указанного email. По ней новичок видит
                  только товары welcome pack — правило «стаж от 3 месяцев» не действует.
                  {' '}Сейчас в наборе: <b>{welcomeProductCount}</b> {decline(welcomeProductCount, ['товар', 'товара', 'товаров'])}
                  {' '}(отмечаются в карточке товара → «Где показывать»).
                </p>
              </div>

              <form className="aw-form" onSubmit={handleCreate}>
                <label className="ao-label">
                  Email новичка
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="name.surname@uzum.com"
                    className="ao-input"
                  />
                </label>
                <label className="ao-label">
                  ФИО (необязательно)
                  <input value={fullName} onChange={(e) => setFullName(e.target.value)} className="ao-input" />
                </label>
                <label className="ao-label">
                  Заметка
                  <input
                    value={note}
                    onChange={(e) => setNote(e.target.value)}
                    placeholder="Например: выход 3 ноября, Ташкент"
                    className="ao-input"
                  />
                </label>
                <button type="submit" className="ao-save-btn aw-submit" disabled={isSaving}>
                  {isSaving ? 'Создаём…' : 'Создать ссылку'}
                </button>
              </form>

              {error && <div className="ao-error">{error}</div>}
              {created && (
                <div className="aw-created">
                  <span>Ссылка {copiedId === 'new' ? 'скопирована' : 'готова'} — отправьте её новичку:</span>
                  <code>{created}</code>
                </div>
              )}
            </section>

            <section className="aw-card">
              <h2 className="ao-card-title">Выданные ссылки</h2>
              {invites.length === 0 ? (
                <p className="ao-manage-text">Пока ни одной ссылки.</p>
              ) : (
                <div className="aw-list">
                  {invites.map((invite) => {
                    const state = getInviteState(invite)
                    return (
                      <div key={invite.id} className="aw-row">
                        <div className="aw-row-main">
                          <b>{invite.full_name || invite.email}</b>
                          <span>
                            {invite.full_name ? `${invite.email} · ` : ''}создана {formatDate(invite.created_at)}
                            {invite.note ? ` · ${invite.note}` : ''}
                          </span>
                        </div>
                        <span className={`dash-badge dash-badge-${state.tone}`}>{state.label}</span>
                        <div className="aw-row-actions">
                          {state.key === 'active' && (
                            <>
                              <button type="button" className="ap-light-btn" onClick={() => copy(welcomeInviteUrl(window.location.origin, invite.token), invite.id)}>
                                {copiedId === invite.id ? 'Скопировано' : 'Копировать ссылку'}
                              </button>
                              <button type="button" className="ap-light-btn" onClick={() => handleDelete(invite)}>
                                Отозвать
                              </button>
                            </>
                          )}
                          {state.key === 'used' && state.orderNumber && (
                            <a className="ap-light-btn" href={`/admin/orders?q=${encodeURIComponent(state.orderNumber)}`}>
                              Заказ #{state.orderNumber}
                            </a>
                          )}
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </section>
          </>
        )}
      </section>
    </AdminShell>
  )
}

function getInviteState(invite: WelcomeInviteRow) {
  const order = Array.isArray(invite.orders) ? invite.orders[0] : invite.orders
  if (invite.used_at) {
    return { key: 'used' as const, label: 'Оформлен', tone: 'green' as const, orderNumber: order?.order_number ?? null }
  }
  if (new Date(invite.expires_at).getTime() < Date.now()) {
    return { key: 'expired' as const, label: 'Истекла', tone: 'red' as const, orderNumber: null }
  }
  return { key: 'active' as const, label: `Действует до ${formatDate(invite.expires_at)}`, tone: 'blue' as const, orderNumber: null }
}

function formatDate(value: string) {
  return new Date(value).toLocaleDateString('ru-RU', {
    timeZone: 'Asia/Tashkent',
    day: 'numeric',
    month: 'short',
  })
}
