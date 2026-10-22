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
}

// Welcome pack is reachable only by an onboarding link, and the profile page
// is gone: contacts and delivery are entered in the cart for every order.
const navItems: NavItem[] = [
  { href: '/catalog', label: 'Каталог'    },
  { href: '/orders',  label: 'Мои заказы' },
]

export default function AppNav({
  isAdmin    = false,
  showLogout = false,
}: AppNavProps) {
  const pathname = usePathname()
  const [loggingOut, setLoggingOut] = useState(false)

  function isItemActive(href: string) {
    return pathname === href || pathname.startsWith(`${href}/`)
  }

  async function handleLogout() {
    setLoggingOut(true)
    try {
      await fetch('/api/auth/logout', { method: 'POST' })
    } finally {
      window.location.href = '/login'
    }
  }

  return (
    <nav className="head-nav">
      {navItems.map(item => (
        <Link
          key={item.href}
          href={item.href}
          className={`nav-link${isItemActive(item.href) ? ' is-on' : ''}`}
        >
          {item.label}
        </Link>
      ))}

      {isAdmin && (
        <Link
          href="/admin"
          className={`nav-link${isItemActive('/admin') ? ' is-on' : ''}`}
        >
          Админ-панель
        </Link>
      )}

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
