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
  adminOnly?: boolean
}

const navItems: NavItem[] = [
  { href: '/catalog',         label: 'Каталог'      },
  { href: '/orders',          label: 'Мои заказы'   },
  { href: '/welcome',         label: 'Welcome-pack' },
  { href: '/profile',         label: 'Профиль'      },
  { href: '/admin/orders',    label: 'Заказы',    adminOnly: true },
  { href: '/admin/products',  label: 'Товары',    adminOnly: true },
  { href: '/admin/employees', label: 'Сотрудники', adminOnly: true },
]

export default function AppNav({
  isAdmin    = false,
  showLogout = false,
}: AppNavProps) {
  const pathname      = usePathname()
  const [loggingOut, setLoggingOut] = useState(false)

  async function handleLogout() {
    setLoggingOut(true)
    try {
      await fetch('/api/auth/logout', { method: 'POST' })
    } finally {
      window.location.href = '/login'
    }
  }

  const visibleItems = navItems.filter(item => !item.adminOnly || isAdmin)

  return (
    <nav className="head-nav">
      {visibleItems.map(item => {
        const isActive =
          pathname === item.href || pathname.startsWith(`${item.href}/`)
        return (
          <Link
            key={item.href}
            href={item.href}
            className={`nav-link${isActive ? ' is-on' : ''}`}
          >
            {item.label}
          </Link>
        )
      })}

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
