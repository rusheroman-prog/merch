'use client'

import Link from 'next/link'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import {
  useEffect,
  useState,
  type CSSProperties,
  type FormEvent,
  type ReactNode,
} from 'react'

type AdminShellProps = {
  children: ReactNode
  adminEmail: string
  title?: string
  subtitle?: string
  orderCount?: number
  stockAlertCount?: number
}

const navItems = [
  {
    key: 'dashboard',
    href: '/admin',
    label: 'Дашборд',
    description: 'Сводка',
    icon: '⌂',
  },
  {
    key: 'orders',
    href: '/admin/orders',
    label: 'Заказы',
    description: 'Заявки и статусы',
    icon: '◇',
  },
  {
    key: 'stock',
    href: '/admin/products',
    label: 'Склад',
    description: 'Остатки товаров',
    icon: '▦',
  },
  {
    key: 'products',
    href: '/admin/products?mode=cards',
    label: 'Товары',
    description: 'Карточки и фото',
    icon: '⌑',
  },
]

export default function AdminShell({
  children,
  adminEmail,
  title = 'Сводка',
  subtitle = 'Админ-панель · merch.uzum.tech',
  orderCount,
  stockAlertCount,
}: AdminShellProps) {
  const pathname = usePathname()
  const router = useRouter()
  const searchParams = useSearchParams()
  const mode = searchParams.get('mode')

  const [isLoggingOut, setIsLoggingOut] = useState(false)
  const [topSearch, setTopSearch] = useState('')

  useEffect(() => {
    setTopSearch(searchParams.get('q') ?? '')
  }, [searchParams])

  function getBadge(itemKey: string) {
    if (itemKey === 'orders' && typeof orderCount === 'number') {
      return orderCount
    }

    if (itemKey === 'stock' && typeof stockAlertCount === 'number') {
      return stockAlertCount
    }

    return null
  }

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

  function handleTopSearchSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()

    const query = topSearch.trim()
    const params = new URLSearchParams(searchParams.toString())

    if (query) {
      params.set('q', query)
    } else {
      params.delete('q')
    }

    const nextQuery = params.toString()
    const suffix = nextQuery ? `?${nextQuery}` : ''

    if (pathname === '/admin/orders') {
      router.push(`/admin/orders${suffix}`)
      return
    }

    if (pathname === '/admin/products') {
      router.push(`/admin/products${suffix}`)
      return
    }

    router.push(query ? `/admin/orders?q=${encodeURIComponent(query)}` : '/admin/orders')
  }

  return (
    <main className="admin-shell" style={styles.shell}>
      <aside className="admin-shell__sidebar" style={styles.sidebar}>
        <Link href="/admin" style={styles.brand}>
          <img src="/brand/uzum-logo.svg" alt="Uzum" style={styles.brandLogo} />

          <div>
            <div style={styles.brandText}>uzum мерч</div>
          </div>

          <span style={styles.adminBadge}>ADMIN</span>
        </Link>

        <nav style={styles.nav}>
          {navItems.map((item, index) => {
            const active =
                (item.key === 'dashboard' && pathname === '/admin') ||
                (item.key === 'orders' && pathname === '/admin/orders') ||
                (item.key === 'stock' && pathname === '/admin/products' && mode !== 'cards') ||
                (item.key === 'products' && pathname === '/admin/products' && mode === 'cards')
            const badge = getBadge(item.key)

            return (
              <Link
                key={`${item.label}-${index}`}
                href={item.href}
                style={active ? styles.navItemActive : styles.navItem}
              >
                <span style={styles.navIcon}>{item.icon}</span>

                <span style={styles.navText}>
                  <b>{item.label}</b>
                  <small>{item.description}</small>
                </span>

                {badge !== null && badge > 0 && (
                  <span style={active ? styles.navBadgeActive : styles.navBadge}>
                    {badge}
                  </span>
                )}
              </Link>
            )
          })}
        </nav>

        <div style={styles.sidebarFooter}>
          <div style={styles.adminUser}>
            <div style={styles.adminAvatar}>{getInitials(adminEmail)}</div>

            <div style={styles.adminUserText}>
              <b>Администратор</b>
              <span>{adminEmail}</span>
            </div>
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
            {isLoggingOut ? 'Выходим...' : 'Выход →'}
          </button>
        </div>
      </aside>

      <section className="admin-shell__main" style={styles.main}>
        <header className="admin-shell__topbar" style={styles.topbar}>
          <div>
            <div style={styles.topbarSubtitle}>{subtitle}</div>
            <h1 style={styles.topbarTitle}>{title}</h1>
          </div>

          <div className="admin-shell__topbarActions" style={styles.topbarActions}>
            <form className="admin-shell__searchForm" style={styles.searchBox} onSubmit={handleTopSearchSubmit}>
            <span style={styles.searchIcon}>⌕</span>

            <input
              type="text"
              value={topSearch}
              onChange={(event) => setTopSearch(event.target.value)}
              placeholder="Поиск: номер, ФИО, email, телефон"
              style={styles.searchInput}
            />

            <span style={styles.shortcut}>Enter</span>
          </form>

            <button type="button" style={styles.bellButton}>
              ◌
            </button>
          </div>
        </header>

        <div style={styles.content}>{children}</div>
      </section>
    </main>
  )
}

function getInitials(email: string) {
  const local = email.split('@')[0] || 'admin'
  const parts = local.split(/[._-]/).filter(Boolean)

  const first = parts[0]?.[0] ?? 'A'
  const second = parts[1]?.[0] ?? ''

  return `${first}${second}`.toUpperCase()
}

const styles: Record<string, CSSProperties> = {
  shell: {
    minHeight: '100vh',
    display: 'grid',
    background: '#f7f4ff',
    color: 'var(--ink)',
  },
  sidebar: {
    minHeight: '100vh',
    position: 'sticky',
    top: 0,
    alignSelf: 'start',
    background: '#ffffff',
    borderRight: '1px solid var(--border)',
    padding: '28px 18px',
    display: 'flex',
    flexDirection: 'column',
    gap: '26px',
  },
  brand: {
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
    color: 'var(--ink)',
  },
  brandLogo: {
    width: '40px',
    height: '40px',
    objectFit: 'contain',
  },
  brandText: {
    fontFamily: 'var(--font-display)',
    fontSize: '20px',
    fontWeight: 700,
    letterSpacing: '-0.02em',
    whiteSpace: 'nowrap',
  },
  adminBadge: {
    marginLeft: 'auto',
    minHeight: '24px',
    display: 'inline-flex',
    alignItems: 'center',
    borderRadius: '9px',
    padding: '0 8px',
    background: 'var(--accent)',
    color: '#ffffff',
    fontSize: '11px',
    fontWeight: 900,
  },
  nav: {
    display: 'flex',
    flexDirection: 'column',
    gap: '8px',
  },
  navItem: {
    minHeight: '54px',
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
    padding: '10px 12px',
    borderRadius: '14px',
    color: 'var(--ink)',
  },
  navItemActive: {
    minHeight: '54px',
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
    padding: '10px 12px',
    borderRadius: '14px',
    color: '#ffffff',
    background: 'linear-gradient(135deg, #7000ff 0%, #8a00ff 100%)',
    boxShadow: '0 16px 32px rgba(112, 0, 255, 0.26)',
  },
  navIcon: {
    width: '28px',
    height: '28px',
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: '18px',
    flex: '0 0 auto',
  },
  navText: {
    display: 'flex',
    flexDirection: 'column',
    gap: '1px',
    fontSize: '14px',
    lineHeight: 1.2,
  },
  navBadge: {
    marginLeft: 'auto',
    minWidth: '24px',
    height: '24px',
    borderRadius: '999px',
    background: '#f1ebff',
    color: 'var(--accent)',
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '0 7px',
    fontSize: '12px',
    fontWeight: 900,
  },
  navBadgeActive: {
    marginLeft: 'auto',
    minWidth: '24px',
    height: '24px',
    borderRadius: '999px',
    background: 'rgba(255,255,255,0.22)',
    color: '#ffffff',
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '0 7px',
    fontSize: '12px',
    fontWeight: 900,
  },
  sidebarFooter: {
    marginTop: 'auto',
    borderTop: '1px solid var(--border)',
    paddingTop: '20px',
    display: 'flex',
    flexDirection: 'column',
    gap: '14px',
  },
  adminUser: {
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
  },
  adminAvatar: {
    width: '34px',
    height: '34px',
    borderRadius: '50%',
    background: 'var(--accent)',
    color: '#ffffff',
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: '12px',
    fontWeight: 900,
    flex: '0 0 auto',
  },
  adminUserText: {
    minWidth: 0,
    display: 'flex',
    flexDirection: 'column',
    gap: '2px',
    fontSize: '13px',
    color: 'var(--ink)',
  },
  logoutButton: {
    width: 'fit-content',
    border: 0,
    background: 'transparent',
    color: 'var(--inkMute)',
    fontSize: '13px',
    fontWeight: 800,
    cursor: 'pointer',
    padding: 0,
  },
  logoutButtonDisabled: {
    opacity: 0.6,
    cursor: 'not-allowed',
  },
  main: {
    minWidth: 0,
  },
  topbar: {
    minHeight: '98px',
    background: '#f7f4ff',
    borderBottom: '1px solid var(--border)',
    padding: '18px 32px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: '24px',
  },
  topbarSubtitle: {
    color: 'var(--inkMute)',
    textTransform: 'uppercase',
    letterSpacing: '0.08em',
    fontSize: '12px',
    fontWeight: 900,
  },
  topbarTitle: {
    margin: '2px 0 0',
    fontFamily: 'var(--font-display)',
    color: 'var(--ink)',
    fontSize: '24px',
    lineHeight: 1,
    letterSpacing: '-0.02em',
    fontWeight: 700,
  },
  topbarActions: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
  },
  searchBox: {
    width: '340px',
    height: '46px',
    borderRadius: '999px',
    background: '#ffffff',
    border: '1px solid var(--border)',
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
    padding: '0 12px',
  },
  searchIcon: {
    color: 'var(--inkMute)',
    fontSize: '18px',
    fontWeight: 900,
  },
  searchInput: {
    flex: 1,
    minWidth: 0,
    border: 0,
    background: 'transparent',
    color: 'var(--ink)',
    fontSize: '14px',
    fontWeight: 700,
  },
  shortcut: {
    borderRadius: '9px',
    background: '#f1ebff',
    color: 'var(--inkMute)',
    padding: '4px 7px',
    fontSize: '12px',
    fontWeight: 900,
    whiteSpace: 'nowrap',
  },
  bellButton: {
    width: '46px',
    height: '46px',
    borderRadius: '50%',
    border: '1px solid var(--border)',
    background: '#ffffff',
    color: 'var(--ink)',
    fontWeight: 900,
    cursor: 'pointer',
  },
  content: {
    padding: '32px',
  },
}