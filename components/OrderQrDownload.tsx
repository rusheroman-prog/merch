'use client'

import { useState } from 'react'
import QRCode from 'qrcode'

type OrderQrDownloadProps = {
  /** Value encoded in the QR. */
  value: string
  /** Order number printed under the code and used in the file name. */
  orderNumber: string
}

const SIZE = 640
const PADDING = 48
const CAPTION_HEIGHT = 120

/**
 * Saves the pickup QR as a PNG with the order number under it, so it can be
 * shown from the phone's gallery at handout without opening the portal.
 */
export default function OrderQrDownload({ value, orderNumber }: OrderQrDownloadProps) {
  const [isBusy, setIsBusy] = useState(false)

  async function handleDownload() {
    setIsBusy(true)
    try {
      const qrCanvas = document.createElement('canvas')
      await QRCode.toCanvas(qrCanvas, value, {
        width: SIZE - PADDING * 2,
        margin: 1,
        color: { dark: '#1a0d3a', light: '#ffffff' },
      })

      const canvas = document.createElement('canvas')
      canvas.width = SIZE
      canvas.height = SIZE + CAPTION_HEIGHT
      const ctx = canvas.getContext('2d')
      if (!ctx) return

      ctx.fillStyle = '#ffffff'
      ctx.fillRect(0, 0, canvas.width, canvas.height)
      ctx.drawImage(qrCanvas, PADDING, PADDING)

      ctx.fillStyle = '#1a0d3a'
      ctx.textAlign = 'center'
      ctx.font = '800 44px ui-monospace, SFMono-Regular, Menlo, Consolas, monospace'
      ctx.fillText(`#${orderNumber}`, SIZE / 2, SIZE + 30)
      ctx.fillStyle = '#6b6585'
      ctx.font = '600 24px system-ui, -apple-system, Segoe UI, sans-serif'
      ctx.fillText('Uzum мерч · покажите код на выдаче', SIZE / 2, SIZE + 76)

      const link = document.createElement('a')
      link.href = canvas.toDataURL('image/png')
      link.download = `uzum-merch-${orderNumber}.png`
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
    } finally {
      setIsBusy(false)
    }
  }

  return (
    <button
      type="button"
      className="order-qr-download"
      onClick={handleDownload}
      disabled={isBusy}
    >
      {isBusy ? 'Готовим…' : 'Скачать QR'}
    </button>
  )
}
