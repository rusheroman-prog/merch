'use client'

import AdminShell from '@/components/AdminShell'
import { formatPickupCode, getBranch, getStatusLabel, getStatusTone, isClosed } from '@/lib/orderStatus'
import type { DeliveryType, OrderStatus } from '@/lib/supabase/types'
import jsQR from 'jsqr'
import { useCallback, useEffect, useRef, useState, type FormEvent } from 'react'

export type HandedOutOrder = {
  id: string
  order_number: string
  full_name: string | null
  handed_to: string | null
  received_at: string | null
}

type FoundOrder = {
  id: string
  order_number: string
  pickup_code: string
  status: OrderStatus
  delivery_type: DeliveryType
  full_name: string | null
  email: string | null
  phone: string | null
  department: string | null
  storage_location: string | null
  handed_to: string | null
  received_at: string | null
  trip_until: string | null
  comment: string | null
  order_items: Array<{ id: string; product_name: string; size: string | null; color: string | null; qty: number }>
}

type Props = {
  adminEmail: string
  orderCount: number
  stockAlertCount: number
  handedToday: HandedOutOrder[]
}

const AUTO_KEY = 'merch-handout-auto'

/**
 * Handout desk. A USB/Bluetooth scanner types the QR content into the focused
 * field and presses Enter; the phone camera is the alternative. With
 * "Выдавать сразу после скана" a valid pickup QR is handed out without a click.
 * Enter on an empty field confirms the order on screen.
 */
export default function HandoutClient({ adminEmail, orderCount, stockAlertCount, handedToday }: Props) {
  const inputRef = useRef<HTMLInputElement>(null)

  const [code,       setCode]       = useState('')
  const [order,      setOrder]      = useState<FoundOrder | null>(null)
  const [matchedBy,  setMatchedBy]  = useState<'code' | 'number'>('code')
  const [handedTo,   setHandedTo]   = useState('')
  const [autoMode,   setAutoMode]   = useState(false)
  const [isBusy,     setIsBusy]     = useState(false)
  const [isCamera,   setIsCamera]   = useState(false)
  const [error,      setError]      = useState<string | null>(null)
  const [success,    setSuccess]    = useState<string | null>(null)
  const [log,        setLog]        = useState<HandedOutOrder[]>(handedToday)

  useEffect(() => {
    try { setAutoMode(window.localStorage.getItem(AUTO_KEY) === '1') } catch { /* storage unavailable */ }
    inputRef.current?.focus()
  }, [])

  function toggleAuto(value: boolean) {
    setAutoMode(value)
    try { window.localStorage.setItem(AUTO_KEY, value ? '1' : '0') } catch { /* storage unavailable */ }
    inputRef.current?.focus()
  }

  const handOut = useCallback(async (target: FoundOrder, recipient: string) => {
    setIsBusy(true)
    setError(null)
    try {
      const response = await fetch('/api/admin/handout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ order_id: target.id, handed_to: recipient }),
      })
      const result = await response.json()
      if (!response.ok) {
        setError(result.error || 'Не удалось отметить выдачу')
        beep('error')
        return
      }

      beep('ok')
      setSuccess(`Заказ #${target.order_number} выдан${target.full_name ? ` · ${target.full_name}` : ''}`)
      setLog(current => [{
        id: target.id,
        order_number: target.order_number,
        full_name: target.full_name,
        handed_to: recipient || null,
        received_at: new Date().toISOString(),
      }, ...current.filter(item => item.id !== target.id)])
      setOrder(null)
      setHandedTo('')
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Неизвестная ошибка')
      beep('error')
    } finally {
      setIsBusy(false)
      inputRef.current?.focus()
    }
  }, [])

  const lookup = useCallback(async (raw: string) => {
    const value = raw.trim()
    if (!value) return

    setIsBusy(true)
    setError(null)
    setSuccess(null)
    setOrder(null)

    try {
      const response = await fetch(`/api/admin/handout?code=${encodeURIComponent(value)}`)
      const result = await response.json()
      if (!response.ok) {
        setError(result.error || 'Заказ не найден')
        beep('error')
        return
      }

      const found = result.order as FoundOrder
      const by = result.matchedBy as 'code' | 'number'
      setMatchedBy(by)
      setOrder(found)
      setHandedTo('')

      const canAuto = autoMode && by === 'code' &&
        getBranch(found.delivery_type) === 'pickup' && !isClosed(found.status)

      if (canAuto) {
        await handOut(found, '')
      } else if (isClosed(found.status) || getBranch(found.delivery_type) === 'post') {
        beep('error')
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Неизвестная ошибка')
      beep('error')
    } finally {
      setIsBusy(false)
      setCode('')
      inputRef.current?.focus()
    }
  }, [autoMode, handOut])

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (isBusy) return
    // Enter on an empty field confirms the order on screen.
    if (!code.trim() && order && canHandOut(order)) {
      void handOut(order, handedTo.trim())
      return
    }
    void lookup(code)
  }

  const handleCameraCode = useCallback((value: string) => {
    setIsCamera(false)
    void lookup(value)
  }, [lookup])

  return (
    <AdminShell
      adminEmail={adminEmail}
      title="Выдача заказов"
      subtitle="Админ-панель · merch.uzum.tech"
      orderCount={orderCount}
      stockAlertCount={stockAlertCount}
    >
      <section className="ho-page">
        <div className="ho-scan-card">
          <form className="ho-scan-form" onSubmit={handleSubmit}>
            <label className="ho-scan-label" htmlFor="handout-code">
              Отсканируйте QR сотрудника или введите номер заказа
            </label>
            <div className="ho-scan-row">
              <input
                id="handout-code"
                ref={inputRef}
                value={code}
                onChange={e => setCode(e.target.value)}
                className="ho-scan-input"
                placeholder="Код с QR или номер заказа"
                autoComplete="off"
                spellCheck={false}
                disabled={isCamera}
              />
              <button type="submit" className="ho-scan-btn" disabled={isBusy || isCamera}>
                {isBusy ? 'Ищем…' : 'Найти'}
              </button>
              <button
                type="button"
                className="ho-camera-btn"
                onClick={() => setIsCamera(value => !value)}
                aria-pressed={isCamera}
              >
                {isCamera ? 'Закрыть камеру' : 'Камера'}
              </button>
            </div>
          </form>

          <label className="ho-auto">
            <input type="checkbox" checked={autoMode} onChange={e => toggleAuto(e.target.checked)} />
            <span>
              <b>Выдавать сразу после скана</b>
              <small>Статус «Отдали заказ» ставится автоматически, если QR верный и заказ не закрыт</small>
            </span>
          </label>

          {isCamera && <CameraScanner onDetected={handleCameraCode} onClose={() => setIsCamera(false)} />}

          {error   && <div className="ho-alert ho-alert-error">{error}</div>}
          {success && <div className="ho-alert ho-alert-success">✓ {success}</div>}
        </div>

        {order && (
          <OrderCard
            order={order}
            matchedBy={matchedBy}
            handedTo={handedTo}
            isBusy={isBusy}
            onHandedToChange={setHandedTo}
            onHandOut={() => handOut(order, handedTo.trim())}
          />
        )}

        <section className="ho-log">
          <div className="ho-log-head">
            <h2 className="ho-title">Выдано сегодня</h2>
            <span className="ho-log-count">{log.length}</span>
          </div>
          {log.length === 0 ? (
            <p className="ho-muted">Пока ничего не выдано.</p>
          ) : (
            <ul className="ho-log-list">
              {log.map(item => (
                <li key={item.id}>
                  <b>#{item.order_number}</b>
                  <span>{item.full_name || 'Сотрудник'}{item.handed_to ? ` → ${item.handed_to}` : ''}</span>
                  <small>{item.received_at ? formatTime(item.received_at) : ''}</small>
                </li>
              ))}
            </ul>
          )}
        </section>
      </section>
    </AdminShell>
  )
}

/* ─────────────────────────────────────────────────────────────────────────── */

function OrderCard({
  order,
  matchedBy,
  handedTo,
  isBusy,
  onHandedToChange,
  onHandOut,
}: {
  order: FoundOrder
  matchedBy: 'code' | 'number'
  handedTo: string
  isBusy: boolean
  onHandedToChange: (value: string) => void
  onHandOut: () => void
}) {
  const isPost = getBranch(order.delivery_type) === 'post'
  const closed = isClosed(order.status)
  const notReady = order.status === 'new' || order.status === 'assembling'

  return (
    <article className="ho-order">
      <header className="ho-order-head">
        <div>
          <span className="kicker">Заказ</span>
          <h2 className="ho-order-number">#{order.order_number}</h2>
          <span className="ho-code">{formatPickupCode(order.pickup_code)}</span>
        </div>
        <span className={`ho-status ho-status-${getStatusTone(order.status)}`}>
          {getStatusLabel(order.status, order.delivery_type, 'admin')}
        </span>
      </header>

      <div className="ho-person">
        <b>{order.full_name || 'Сотрудник'}</b>
        <span>{[order.department, order.email, order.phone].filter(Boolean).join(' · ')}</span>
      </div>

      {matchedBy === 'number' && (
        <div className="ho-warning">Найдено по номеру заказа, а не по QR — сверьте ФИО сотрудника.</div>
      )}
      {isPost && <div className="ho-warning ho-warning-strong">Заказ отправляется почтой — выдавать на месте не нужно.</div>}
      {closed && (
        <div className="ho-warning ho-warning-strong">
          {order.status === 'received'
            ? `Заказ уже выдан${order.received_at ? ` ${formatDateTime(order.received_at)}` : ''}${order.handed_to ? ` · получил(а): ${order.handed_to}` : ''}.`
            : 'Заказ отменён или отклонён — выдавать нельзя.'}
        </div>
      )}
      {!closed && !isPost && notReady && (
        <div className="ho-warning">Заказ ещё не отмечен как собранный — проверьте, что всё на месте.</div>
      )}

      <ul className="ho-items">
        {order.order_items.map(item => (
          <li key={item.id}>
            <b>{item.product_name}</b>
            <span>{[item.size || 'ONE SIZE', item.color].filter(Boolean).join(' · ')} · {item.qty} шт.</span>
          </li>
        ))}
      </ul>

      <div className="ho-meta">
        <span><b>Где лежит:</b> {order.storage_location || 'не указано'}</span>
        {order.trip_until && <span><b>Командировка:</b> выдать до {formatDate(order.trip_until)}</span>}
        {order.comment && <span><b>Комментарий:</b> {order.comment}</span>}
      </div>

      {canHandOut(order) && (
        <div className="ho-actions">
          <label className="ho-recipient">
            Кому отдаём, если не самому сотруднику
            <input
              value={handedTo}
              onChange={e => onHandedToChange(e.target.value)}
              placeholder="ФИО коллеги (необязательно)"
              className="ho-recipient-input"
            />
          </label>
          <button type="button" className="ho-handout-btn" onClick={onHandOut} disabled={isBusy}>
            {isBusy ? 'Отмечаем…' : 'Отдать заказ'}
          </button>
          <small className="ho-hint">Или нажмите Enter в поле сканера</small>
        </div>
      )}
    </article>
  )
}

/* ─────────────────────────────────────────────────────────────────────────── */

function CameraScanner({ onDetected, onClose }: { onDetected: (value: string) => void; onClose: () => void }) {
  const videoRef  = useRef<HTMLVideoElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let stream: MediaStream | null = null
    let timer = 0
    let stopped = false

    async function start() {
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: { ideal: 'environment' } },
          audio: false,
        })
        const video = videoRef.current
        if (!video || stopped) return
        video.srcObject = stream
        video.setAttribute('playsinline', 'true')
        await video.play()
        scan()
      } catch {
        setError('Нет доступа к камере. Разрешите доступ в браузере или используйте сканер.')
      }
    }

    // ~7 frames per second, downscaled: enough for a QR held to the camera.
    function scan() {
      if (stopped) return
      const video = videoRef.current
      const canvas = canvasRef.current
      if (video && canvas && video.readyState >= video.HAVE_ENOUGH_DATA && video.videoWidth > 0) {
        const scale = Math.min(1, 640 / video.videoWidth)
        const width = Math.round(video.videoWidth * scale)
        const height = Math.round(video.videoHeight * scale)
        canvas.width = width
        canvas.height = height
        const context = canvas.getContext('2d', { willReadFrequently: true })
        if (context) {
          context.drawImage(video, 0, 0, width, height)
          const image = context.getImageData(0, 0, width, height)
          const result = jsQR(image.data, width, height, { inversionAttempts: 'dontInvert' })
          if (result?.data) {
            stopped = true
            onDetected(result.data)
            return
          }
        }
      }
      timer = window.setTimeout(scan, 140)
    }

    void start()

    return () => {
      stopped = true
      window.clearTimeout(timer)
      stream?.getTracks().forEach(track => track.stop())
    }
  }, [onDetected])

  return (
    <div className="ho-camera">
      {error ? (
        <div className="ho-alert ho-alert-error">{error}</div>
      ) : (
        <>
          <video ref={videoRef} className="ho-camera-video" muted playsInline />
          <span className="ho-camera-frame" aria-hidden="true" />
        </>
      )}
      <canvas ref={canvasRef} hidden />
      <button type="button" className="ho-camera-close" onClick={onClose}>Закрыть</button>
    </div>
  )
}

/* ─────────────────────────────────────────────────────────────────────────── */

function canHandOut(order: FoundOrder) {
  return getBranch(order.delivery_type) === 'pickup' && !isClosed(order.status)
}

/** Short confirmation tone, so the desk hears the result without looking. */
function beep(kind: 'ok' | 'error') {
  try {
    const AudioCtx = window.AudioContext ||
      (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
    if (!AudioCtx) return
    const context = new AudioCtx()
    const oscillator = context.createOscillator()
    const gain = context.createGain()
    oscillator.frequency.value = kind === 'ok' ? 880 : 220
    gain.gain.value = 0.08
    oscillator.connect(gain)
    gain.connect(context.destination)
    oscillator.start()
    oscillator.stop(context.currentTime + (kind === 'ok' ? 0.12 : 0.3))
    oscillator.onended = () => { void context.close() }
  } catch {
    /* sound is optional */
  }
}

function formatTime(value: string) {
  return new Date(value).toLocaleTimeString('ru-RU', { timeZone: 'Asia/Tashkent', hour: '2-digit', minute: '2-digit' })
}

function formatDateTime(value: string) {
  return new Date(value).toLocaleString('ru-RU', {
    timeZone: 'Asia/Tashkent', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit',
  })
}

function formatDate(value: string) {
  return new Date(`${value}T00:00:00`).toLocaleDateString('ru-RU', { day: 'numeric', month: 'long' })
}
