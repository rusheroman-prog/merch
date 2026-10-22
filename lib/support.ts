/**
 * Support contact ("Нужна помощь?") configured by admins in merch_settings.
 * Admins may type a full URL, a Telegram handle, an email or a phone number;
 * only safe schemes ever reach an href.
 */

export type SupportContact = {
  label: string
  href: string | null
}

type SupportSettings = {
  support_label?: string | null
  support_url?: string | null
} | null | undefined

const SAFE_PROTOCOLS = new Set(['https:', 'http:', 'mailto:', 'tel:'])

export function normalizeSupportUrl(raw: string | null | undefined): string | null {
  const value = raw?.trim()
  if (!value) return null

  if (/^@[A-Za-z0-9_]{4,}$/.test(value)) {
    return `https://t.me/${value.slice(1)}`
  }

  if (/^[^\s@/:]+@[^\s@/]+\.[^\s@/]+$/.test(value)) {
    return `mailto:${value}`
  }

  if (/^\+?[0-9][0-9\s()-]{6,}$/.test(value)) {
    return `tel:${value.replace(/[\s()-]/g, '')}`
  }

  try {
    const url = new URL(value)
    return SAFE_PROTOCOLS.has(url.protocol) ? url.toString() : null
  } catch {
    return null
  }
}

export function getSupportContact(settings: SupportSettings): SupportContact | null {
  const href = normalizeSupportUrl(settings?.support_url)
  const label = settings?.support_label?.trim() || (href ? describeHref(href) : '')

  if (!label) return null
  return { label, href }
}

/** Human-readable text for a link when the admin left the label empty. */
function describeHref(href: string) {
  if (href.startsWith('mailto:')) return href.slice('mailto:'.length)
  if (href.startsWith('tel:')) return href.slice('tel:'.length)

  try {
    const url = new URL(href)
    if (url.hostname === 't.me') return `@${url.pathname.replace(/^\//, '')}`
    return `${url.hostname}${url.pathname === '/' ? '' : url.pathname}`
  } catch {
    return href
  }
}
