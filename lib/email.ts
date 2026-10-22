import QRCode from 'qrcode'
import { formatPickupCode, getBranch } from '@/lib/orderStatus'

/**
 * Order emails with the pickup QR, sent through the Resend API.
 * Off unless RESEND_API_KEY and MERCH_EMAIL_FROM are set (the sender domain
 * must be verified in Resend). Failures are logged and never break an order.
 */

export type EmailOrder = {
  order_number: string
  pickup_code: string
  email: string | null
  full_name: string | null
  delivery_type: string
  trip_until?: string | null
  items: Array<{ product_name: string; size: string | null; color: string | null }>
}

type HandoutInfo = {
  place?: string | null
  deadline?: string | null
}

const RESEND_URL = 'https://api.resend.com/emails'
const QR_CONTENT_ID = 'pickup-qr'

export function isEmailConfigured() {
  return Boolean(process.env.RESEND_API_KEY && process.env.MERCH_EMAIL_FROM)
}

export async function sendOrderEmail(kind: 'created' | 'ready', order: EmailOrder, handout: HandoutInfo = {}) {
  if (!isEmailConfigured() || !order.email) return

  const isPickup = getBranch(order.delivery_type) === 'pickup'
  // A post order has no pickup and no "ready" step, so no QR to send.
  if (kind === 'ready' && !isPickup) return

  try {
    const attachments = isPickup
      ? [{
          filename: `uzum-merch-${order.order_number}.png`,
          content: (await QRCode.toBuffer(order.pickup_code, {
            width: 360,
            margin: 1,
            color: { dark: '#1a0d3a', light: '#ffffff' },
          })).toString('base64'),
          content_id: QR_CONTENT_ID,
          content_type: 'image/png',
        }]
      : []

    const response = await fetch(RESEND_URL, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: process.env.MERCH_EMAIL_FROM,
        to: [order.email],
        subject: kind === 'created'
          ? `Заказ мерча #${order.order_number} оформлен`
          : `Заказ мерча #${order.order_number} можно забирать`,
        html: renderHtml(kind, order, handout, isPickup),
        attachments,
      }),
    })

    if (!response.ok) {
      console.error('[merch-email] send failed', response.status, await response.text())
    }
  } catch (error) {
    console.error('[merch-email] send failed', error)
  }
}

function renderHtml(kind: 'created' | 'ready', order: EmailOrder, handout: HandoutInfo, isPickup: boolean) {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, '')
  const firstName = order.full_name?.trim().split(/\s+/)[1] || order.full_name?.trim() || 'коллега'

  const items = order.items
    .map((item) => {
      const variant = [item.size, item.color].filter(Boolean).join(' · ')
      return `<li style="margin:0 0 4px">${escapeHtml(item.product_name)}${variant ? ` — ${escapeHtml(variant)}` : ''}</li>`
    })
    .join('')

  // Follows "Имя, …", hence the lowercase start.
  const lead = kind === 'ready'
    ? 'ваш заказ собран — его можно забирать.'
    : isPickup
      ? 'заявка принята. Когда заказ будет готов к выдаче, мы напишем ещё раз.'
      : 'заявка принята. Отправим заказ почтой, трек-номер появится в «Мои заказы».'

  const handoutLines = [
    handout.place ? `<b>Где:</b> ${escapeHtml(handout.place)}` : '',
    handout.deadline ? `<b>Когда:</b> ${escapeHtml(formatDateTime(handout.deadline))}` : '',
    order.trip_until ? `<b>Заберите до:</b> ${escapeHtml(formatDate(order.trip_until))}` : '',
  ].filter(Boolean).join('<br/>')

  const qrBlock = isPickup
    ? `<div style="margin:20px 0;padding:16px;border:1px solid #ece6fa;border-radius:16px;text-align:center">
         <img src="cid:${QR_CONTENT_ID}" width="180" height="180" alt="QR для получения" style="display:block;margin:0 auto"/>
         <div style="margin-top:8px;font:700 18px ui-monospace,Menlo,Consolas,monospace;color:#1a0d3a">${escapeHtml(formatPickupCode(order.pickup_code))}</div>
         <div style="margin-top:4px;color:#6b6585;font-size:13px">Покажите код на выдаче — с телефона или распечатанным</div>
       </div>`
    : ''

  return `<!doctype html><html><body style="margin:0;background:#f7f4ff;font-family:Arial,Helvetica,sans-serif;color:#1a0d3a">
    <div style="max-width:520px;margin:0 auto;padding:28px 20px">
      <div style="background:#ffffff;border:1px solid #ece6fa;border-radius:20px;padding:24px">
        <div style="font-size:12px;letter-spacing:.08em;text-transform:uppercase;color:#7000ff;font-weight:700">Uzum мерч</div>
        <h1 style="margin:8px 0 6px;font-size:22px">Заказ #${escapeHtml(order.order_number)}</h1>
        <p style="margin:0 0 14px;color:#6b6585;font-size:15px">${escapeHtml(firstName)}, ${lead}</p>
        ${handoutLines ? `<p style="margin:0 0 14px;font-size:14px;line-height:1.6">${handoutLines}</p>` : ''}
        ${qrBlock}
        <div style="font-size:12px;letter-spacing:.06em;text-transform:uppercase;color:#6b6585;font-weight:700">Состав</div>
        <ul style="margin:8px 0 0;padding-left:18px;font-size:14px">${items}</ul>
        ${appUrl ? `<p style="margin:20px 0 0"><a href="${appUrl}/orders" style="color:#7000ff;font-weight:700">Открыть «Мои заказы»</a></p>` : ''}
      </div>
    </div>
  </body></html>`
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

function formatDate(value: string) {
  return new Date(`${value}T00:00:00`).toLocaleDateString('ru-RU', { day: 'numeric', month: 'long' })
}

function formatDateTime(value: string) {
  return new Date(value).toLocaleString('ru-RU', {
    timeZone: 'Asia/Tashkent',
    day: 'numeric',
    month: 'long',
    hour: '2-digit',
    minute: '2-digit',
  })
}
