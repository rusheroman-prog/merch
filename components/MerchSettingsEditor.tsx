'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

type MerchSettingsEditorProps = {
  handoutDeadline: string | null
  handoutPlace: string | null
  handoutNote: string | null
  orderWindowStart: string | null
  maxItemsPerEmployee: number
  supportLabel: string | null
  supportUrl: string | null
}

/** Turns an ISO timestamp into a value for <input type="datetime-local">. */
function toLocalInput(iso: string | null) {
  if (!iso) return ''
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}

/**
 * Settings of the current distribution: when and where merch is handed out,
 * which orders count toward the per-employee limit, and who to contact.
 */
export default function MerchSettingsEditor(props: MerchSettingsEditorProps) {
  const router = useRouter()

  const [deadline,     setDeadline]     = useState(toLocalInput(props.handoutDeadline))
  const [place,        setPlace]        = useState(props.handoutPlace ?? '')
  const [note,         setNote]         = useState(props.handoutNote ?? '')
  const [windowStart,  setWindowStart]  = useState(toLocalInput(props.orderWindowStart))
  const [maxItems,     setMaxItems]     = useState(String(props.maxItemsPerEmployee))
  const [supportLabel, setSupportLabel] = useState(props.supportLabel ?? '')
  const [supportUrl,   setSupportUrl]   = useState(props.supportUrl ?? '')

  const [isSaving, setIsSaving] = useState(false)
  const [message,  setMessage]  = useState<string | null>(null)
  const [error,    setError]    = useState<string | null>(null)

  async function handleSave() {
    setIsSaving(true)
    setMessage(null)
    setError(null)

    try {
      const response = await fetch('/api/admin/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          handout_deadline:       deadline ? new Date(deadline).toISOString() : null,
          handout_place:          place,
          handout_note:           note,
          order_window_start:     windowStart ? new Date(windowStart).toISOString() : null,
          max_items_per_employee: Number(maxItems),
          support_label:          supportLabel,
          support_url:            supportUrl,
        }),
      })

      const result = await response.json()
      if (!response.ok) { setError(result.error || 'Не удалось сохранить'); return }

      setMessage('Сохранено')
      router.refresh()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Неизвестная ошибка')
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <div className="settings-editor">
      <fieldset className="settings-group">
        <legend>Ближайшая раздача</legend>
        <p className="settings-hint">Видно сотрудникам в «Мои заказы» и при выборе «Заберу в офисе».</p>
        <div className="settings-grid">
          <label className="deadline-field">
            Дата и время
            <input
              type="datetime-local"
              value={deadline}
              onChange={(e) => setDeadline(e.target.value)}
              className="deadline-input"
            />
          </label>
          <label className="deadline-field">
            Место
            <input
              type="text"
              value={place}
              onChange={(e) => setPlace(e.target.value)}
              placeholder="Например: офис Ташкент, 3 этаж"
              className="deadline-input"
            />
          </label>
          <label className="deadline-field">
            Примечание
            <input
              type="text"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Например: возьмите пропуск"
              className="deadline-input"
            />
          </label>
        </div>
      </fieldset>

      <fieldset className="settings-group">
        <legend>Лимиты</legend>
        <p className="settings-hint">
          В лимит входят активные заказы, оформленные начиная с этой даты. Пусто — учитываются все заказы.
          Перед новой раздачей нажмите «С сегодняшнего дня» — сотрудники снова смогут выбрать мерч.
        </p>
        <div className="settings-grid">
          <label className="deadline-field">
            Учитывать заказы с
            <span className="settings-inline">
              <input
                type="datetime-local"
                value={windowStart}
                onChange={(e) => setWindowStart(e.target.value)}
                className="deadline-input"
              />
              <button
                type="button"
                className="settings-inline-btn"
                onClick={() => setWindowStart(toLocalInput(new Date().toISOString()))}
              >
                С сегодняшнего дня
              </button>
            </span>
          </label>
          <label className="deadline-field">
            Позиций на сотрудника
            <input
              type="number"
              min={1}
              max={20}
              value={maxItems}
              onChange={(e) => setMaxItems(e.target.value)}
              className="deadline-input"
            />
          </label>
        </div>
      </fieldset>

      <fieldset className="settings-group">
        <legend>Контакт для вопросов</legend>
        <p className="settings-hint">
          Показываем на входе, в каталоге и в «Мои заказы». Ссылка: https://…, @telegram, email или телефон.
        </p>
        <div className="settings-grid">
          <label className="deadline-field">
            Текст
            <input
              type="text"
              value={supportLabel}
              onChange={(e) => setSupportLabel(e.target.value)}
              placeholder="Например: Telegram HR-команды"
              className="deadline-input"
            />
          </label>
          <label className="deadline-field">
            Ссылка
            <input
              type="text"
              value={supportUrl}
              onChange={(e) => setSupportUrl(e.target.value)}
              placeholder="@uzum_merch или https://…"
              className="deadline-input"
            />
          </label>
        </div>
      </fieldset>

      {error   && <div className="deadline-error">{error}</div>}
      {message && <div className="deadline-success">{message}</div>}

      <button type="button" onClick={handleSave} disabled={isSaving} className="deadline-save">
        {isSaving ? 'Сохраняем...' : 'Сохранить настройки'}
      </button>
    </div>
  )
}
