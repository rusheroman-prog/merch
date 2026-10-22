'use client'

import { useEffect, useState } from 'react'
import QRCode from 'qrcode'

type OrderBarcodeProps = {
  /** Value encoded in the QR — the order number is enough to identify a pickup. */
  value: string
  size?: number
  /** When set, shows a "Скачать QR" link that saves the code as a PNG. */
  downloadName?: string
}

/**
 * Renders a scannable QR code for order pickup. The employee shows it at
 * handout; staff scan or match it against the order number. With
 * `downloadName` the employee can save the PNG to their phone.
 */
export default function OrderBarcode({ value, size = 132, downloadName }: OrderBarcodeProps) {
  const [dataUrl, setDataUrl] = useState<string | null>(null)

  useEffect(() => {
    let active = true
    QRCode.toDataURL(value, {
      width: Math.max(size, 320), // render crisp so the saved PNG is scannable
      margin: 2,
      color: { dark: '#1a0d3a', light: '#ffffff' },
    })
      .then((url) => { if (active) setDataUrl(url) })
      .catch(() => { /* QR rendering is best-effort; the order number stays visible */ })
    return () => { active = false }
  }, [value, size])

  if (!dataUrl) {
    return <div className="order-qr-img order-qr-placeholder" style={{ width: size, height: size }} />
  }

  return (
    <div className="order-qr">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={dataUrl}
        alt={`Код заказа ${value}`}
        width={size}
        height={size}
        className="order-qr-img"
      />
      {downloadName && (
        <a href={dataUrl} download={`${downloadName}.png`} className="order-qr-download">
          Скачать QR
        </a>
      )}
    </div>
  )
}
