import AppNav from '@/components/AppNav'
import SupportLink from '@/components/SupportLink'
import Link from 'next/link'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { needsPasswordSetup } from '@/lib/auth'
import { getSupportContact } from '@/lib/support'
import { isClosed } from '@/lib/orderStatus'
import OrderCard, { formatDateTime, type Order } from './OrderCard'

/* ─────────────────────────────────────────────────────────────────────────── */
/*  Page                                                                        */
/* ─────────────────────────────────────────────────────────────────────────── */

export default async function OrdersPage() {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')
  if (await needsPasswordSetup(supabase, user.id)) redirect('/set-password')

  const { data: employee } = await supabase
    .from('employees')
    .select('is_admin')
    .eq('id', user.id)
    .maybeSingle()

  const { data: rawOrders, error } = await supabase
    .from('orders')
    .select(`
      id, order_number, status, delivery_type, delivery_address,
      full_name, phone, email, city, department,
      comment, admin_comment, tracking_number, is_remote, country,
      pickup_code, trip_from, trip_until, ready_at,
      created_at, confirmed_at, shipped_at, received_at, cancelled_at,
      order_items ( id, product_id, product_name, size, color, sku, qty )
    `)
    .eq('employee_id', user.id)
    .order('created_at', { ascending: false })

  const { data: settings } = await supabase
    .from('merch_settings')
    .select('handout_deadline, handout_place, handout_note, support_label, support_url')
    .eq('id', 1)
    .maybeSingle()

  const isAdmin = Boolean(employee?.is_admin)
  const support = getSupportContact(settings)

  /* ── Error state ───────────────────────────────────────────────────────── */
  if (error) {
    return (
      <div>
        <PageHeader isAdmin={isAdmin} />
        <div className="orders-content">
          <div className="orders-empty orders-empty-narrow">
            <div className="empty-mark">!</div>
            <h1 className="section-title">Не удалось загрузить заказы</h1>
            <p>{error.message}</p>
            <Link href="/catalog" className="btn btn-accent btn-md">Вернуться в каталог</Link>
          </div>
        </div>
      </div>
    )
  }

  const orders        = (rawOrders ?? []) as Order[]
  const activeOrders  = orders.filter(o => !isClosed(o.status)).length
  const doneOrders    = orders.filter(o => o.status === 'received').length

  /* ── Main render ───────────────────────────────────────────────────────── */
  return (
    <div>
      <PageHeader isAdmin={isAdmin} />

      <div className="orders-content">

        {/* ── Heading ── */}
        <header className="orders-head">
          <div>
            <span className="kicker">Мои заказы</span>
            <h1 className="display">
              История и статусы
            </h1>
            <p className="lead">
              Ваши заявки на корпоративный мерч, текущий статус обработки и детали получения.
            </p>
          </div>
          <Link href="/catalog" className="btn btn-ghost btn-md">
            ← В каталог
          </Link>
        </header>

        {/* ── Stats ── */}
        <div className="stat-row">
          <StatCard label="Всего заказов"  value={orders.length} />
          <StatCard label="В работе"       value={activeOrders} />
          <StatCard label="Получено"       value={doneOrders} />
        </div>

        {/* ── Handout deadline / place ── */}
        {settings && (settings.handout_deadline || settings.handout_place || settings.handout_note) && (
          <div className="handout-banner">
            <span className="kicker">Раздача мерча</span>
            {settings.handout_deadline && (
              <span><b>Когда:</b> {formatDateTime(settings.handout_deadline)}</span>
            )}
            {settings.handout_place && (
              <span><b>Где:</b> {settings.handout_place}</span>
            )}
            {settings.handout_note && <span>{settings.handout_note}</span>}
          </div>
        )}

        {support && (
          <div className="support-card">
            <span className="support-card-icon" aria-hidden="true">?</span>
            <span>
              <b>Вопросы по заказу?</b>{' '}
              Напишите нам: <SupportLink contact={support} className="support-link" />
            </span>
          </div>
        )}

        {/* ── Orders list ── */}
        {orders.length === 0 ? (
          <div className="orders-empty">
            <div className="empty-mark">+</div>
            <h2 className="section-title">Заказов пока нет</h2>
            <p>
              Перейдите в каталог, выберите мерч и оформите первую заявку.
            </p>
            <Link href="/catalog" className="btn btn-accent btn-md">Перейти в каталог</Link>
          </div>
        ) : (
          <div className="orders-list">
            {orders.map(order => (
              <OrderCard
                key={order.id}
                order={order}
                support={support}
                handoutPlace={settings?.handout_place ?? null}
                handoutDeadline={settings?.handout_deadline ?? null}
              />
            ))}
          </div>
        )}

      </div>
    </div>
  )
}

/* ─────────────────────────────────────────────────────────────────────────── */
/*  PageHeader — server-renderable site header                                 */
/* ─────────────────────────────────────────────────────────────────────────── */

function PageHeader({ isAdmin }: { isAdmin: boolean }) {
  return (
    <header className="site-head">
      <div className="site-head-glass" aria-hidden="true" />
      <div className="head-inner">
        <Link href="/catalog" className="brand">
          <span className="brand-mark">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/brand/uzum-big-logo.webp" alt="Uzum" />
          </span>
          <span className="brand-name">
            uzum <span className="brand-name-soft">мерч</span>
          </span>
          <span className="brand-sub">внутренний портал</span>
        </Link>

        {/* AppNav renders <nav className="head-nav"> — centres itself in the 1fr column */}
        <AppNav isAdmin={isAdmin} showLogout />
      </div>
    </header>
  )
}

/* ─────────────────────────────────────────────────────────────────────────── */
/*  StatCard                                                                    */
/* ─────────────────────────────────────────────────────────────────────────── */

function StatCard({ label, value }: { label: string; value: number }) {
  return (
    <div className="stat-card">
      <span>{label}</span>
      <b>{value}</b>
    </div>
  )
}
