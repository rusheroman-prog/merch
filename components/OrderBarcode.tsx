'use client'

import { useEffect, useState } from 'react'
import QRCode from 'qrcode'

type OrderBarcodeProps = {
  /** Value encoded in the QR — the order number is enough to identify a pickup. */
  value: string
  size?: number
}

/**
 * Renders a scannable QR code for order pickup. The employee shows it at
 * handout; staff scan or match it against the order number.
 */
export default function OrderBarcode({ value, size = 132 }: OrderBarcodeProps) {
  const [dataUrl, setDataUrl] = useState<string | null>(null)

  useEffect(() => {
    let active = true
    QRCode.toDataURL(value, {
      width: size,
      margin: 1,
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
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={dataUrl}
      alt={`Код заказа ${value}`}
      width={size}
      height={size}
      className="order-qr-img"
    />
  )
}
