'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useState, type CSSProperties } from 'react'

type AppNavProps = {
  isAdmin?: boolean
}

type NavItem = {
  href: string
  label: string
  adminOnly?: boolean
}

const navItems: NavItem[] = [
  {
    href: '/catalog',
    label: 'Каталог',
  },
  {
    href: '/orders',
    label: 'Мои заказы',
  },
  {
    href: '/profile',
    label: 'Профиль',
  },
  {
    href: '/admin/orders',
    label: 'Заказы',
    adminOnly: true,
  },
  {
    href: '/admin/products',
    label: 'Товары',
    adminOnly: true,
  },
]

export default function AppNav({ isAdmin = false }: AppNavProps) {
  const pathname = usePathname()
  const [isLoggingOut, setIsLoggingOut] = useState(false)

  async function handleLogout() {
    setIsLoggingOut(true)

    try {
      await fetch('/api/auth/logout', {
        method: 'POST',
      })

      window.location.href = '/login'
    } catch {
      window.location.href = '/login'
    }
  }

  return (
    <nav style={styles.nav}>
      <div style={styles.links}>
        {navItems
          .filter((item) => !item.adminOnly || isAdmin)
          .map((item) => {
            const isActive =
              pathname === item.href || pathname.startsWith(`${item.href}/`)

            return (
              <Link
                key={item.href}
                href={item.href}
                style={isActive ? styles.navLinkActive : styles.navLink}
              >
                {item.label}
              </Link>
            )
          })}
      </div>

      <button
        type="button"
        onClick={handleLogout}
        disabled={isLoggingOut}
        style={{
          ...styles.logoutButton,
          ...(isLoggingOut ? styles.logoutButtonDisabled : {}),
        }}
      >
        {isLoggingOut ? 'Выходим...' : 'Выйти'}
      </button>
    </nav>
  )
}

const styles: Record<string, CSSProperties> = {
  nav: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: '10px',
    flexWrap: 'wrap',
  },
  links: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: '4px',
    flexWrap: 'wrap',
    padding: '5px',
    borderRadius: '999px',
    background: '#ffffff',
    border: '1px solid #ece6fa',
    boxShadow: '0 10px 26px rgba(26, 13, 58, 0.08)',
  },
  navLink: {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: '38px',
    color: '#5f566b',
    borderRadius: '999px',
    padding: '0 14px',
    fontSize: '14px',
    fontWeight: 800,
    textDecoration: 'none',
    whiteSpace: 'nowrap',
  },
  navLinkActive: {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: '38px',
    color: '#ffffff',
    borderRadius: '999px',
    padding: '0 16px',
    fontSize: '14px',
    fontWeight: 900,
    textDecoration: 'none',
    background: '#7000ff',
    boxShadow: '0 8px 18px rgba(112, 0, 255, 0.26)',
    whiteSpace: 'nowrap',
  },
  logoutButton: {
    minHeight: '48px',
    border: '1px solid #ffd6d6',
    background: '#fff5f5',
    color: '#d71920',
    borderRadius: '999px',
    padding: '0 18px',
    fontSize: '14px',
    fontWeight: 900,
    cursor: 'pointer',
    boxShadow: '0 10px 24px rgba(215, 25, 32, 0.08)',
    whiteSpace: 'nowrap',
  },
  logoutButtonDisabled: {
    background: '#f3f4f6',
    color: '#6b7280',
    cursor: 'not-allowed',
    opacity: 0.7,
  },
}