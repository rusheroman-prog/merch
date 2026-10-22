'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useState } from 'react'

type AppNavProps = {
  isAdmin?: boolean
  /** When true, renders a "Выйти" button alongside the nav links (default: false). */
  showLogout?: boolean
}

type NavItem = {
  href: string
  label: string
  /** Prefix that marks the item active (defaults to href). */
  match?: string
}

const navItems: NavItem[] = [
  { href: '/catalog', label: 'Каталог'      },
  { href: '/orders',  label: 'Мои заказы'   },
  { href: '/welcome', label: 'Welcome-pack' },
]

// Админ-панель — сразу дашборд; разделы админки открываются из её боковой навигации.
const adminItem: NavItem = { href: '/admin', label: 'Админ-панель', match: '/admin' }

export default function AppNav({
  isAdmin    = false,
  showLogout = false,
}: AppNavProps) {
  const pathname = usePathname()
  const [loggingOut, setLoggingOut] = useState(false)

  function isItemActive(item: NavItem) {
    const prefix = item.match ?? item.href
    return pathname === prefix || pathname.startsWith(`${prefix}/`)
  }

  async function handleLogout() {
    setLoggingOut(true)
    try {
      await fetch('/api/auth/logout', { method: 'POST' })
    } finally {
      window.location.href = '/login'
    }
  }

  const items = isAdmin ? [...navItems, adminItem] : navItems

  return (
    <nav className="head-nav">
      {items.map(item => (
        <Link
          key={item.href}
          href={item.href}
          className={`nav-link${isItemActive(item) ? ' is-on' : ''}`}
        >
          {item.label}
        </Link>
      ))}

      {showLogout && (
        <button
          type="button"
          onClick={handleLogout}
          disabled={loggingOut}
          className="nav-link nav-link-logout"
        >
          {loggingOut ? 'Выходим…' : 'Выйти'}
        </button>
      )}
    </nav>
  )
}
