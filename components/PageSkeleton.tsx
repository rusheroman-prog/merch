/**
 * Мгновенный экран загрузки для loading.tsx: при переходе по вкладкам сразу
 * видна шапка и контуры страницы, пока сервер собирает данные.
 */
export default function PageSkeleton({ variant = 'grid' }: { variant?: 'grid' | 'list' }) {
  return (
    <div aria-busy="true" aria-label="Загрузка">
      <header className="site-head">
        <div className="site-head-glass" aria-hidden="true" />
        <div className="head-inner">
          <span className="brand">
            <span className="brand-mark">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/brand/uzum-big-logo.webp" alt="Uzum" />
            </span>
            <span className="brand-name">
              uzum <span className="brand-name-soft">мерч</span>
            </span>
          </span>
        </div>
      </header>

      <div className="skeleton-page">
        <div className="skeleton skeleton-title" />
        {variant === 'grid' ? (
          <div className="skeleton-grid">
            {Array.from({ length: 6 }, (_, i) => <div key={i} className="skeleton skeleton-card" />)}
          </div>
        ) : (
          <div className="skeleton-list">
            {Array.from({ length: 3 }, (_, i) => <div key={i} className="skeleton skeleton-row" />)}
          </div>
        )}
      </div>
    </div>
  )
}

/** То же внутри админки: меню остаётся на месте, скелет — в области контента. */
export function AdminSkeletonBody() {
  return (
    <div className="skeleton-list" aria-busy="true" aria-label="Загрузка">
      <div className="skeleton-kpis">
        {Array.from({ length: 4 }, (_, i) => <div key={i} className="skeleton skeleton-kpi" />)}
      </div>
      {Array.from({ length: 3 }, (_, i) => <div key={i} className="skeleton skeleton-row" />)}
    </div>
  )
}
