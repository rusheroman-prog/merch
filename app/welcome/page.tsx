import AppNav from '@/components/AppNav'
import Link from 'next/link'
import type { ReactNode } from 'react'
import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { needsPasswordSetup } from '@/lib/auth'
import { SUPPORT_LABEL, SUPPORT_URL } from '@/lib/support'
import { getWelcomeInvite, WELCOME_COOKIE } from '@/lib/welcome'
import CatalogClient from '../catalog/CatalogClient'
import { loadCatalogData } from '../catalog/loadCatalog'

/**
 * Welcome pack (правка #4): открывается только по спецссылке /w/<token>
 * от онбординг-менеджера. По ней видны лишь товары набора, остальной каталог — нет.
 */
export default async function WelcomePage({
  searchParams,
}: {
  searchParams: Promise<{ t?: string }>
}) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')
  if (await needsPasswordSetup(supabase, user.id)) redirect('/set-password')

  const { data: employee } = await supabase
    .from('employees')
    .select('is_admin')
    .eq('id', user.id)
    .maybeSingle()
  const isAdmin = Boolean(employee?.is_admin)

  const token = (await searchParams).t ?? (await cookies()).get(WELCOME_COOKIE)?.value

  if (!token) {
    return (
      <WelcomeNotice isAdmin={isAdmin} title="Welcome pack открывается по ссылке">
        Ссылку на стартовый набор присылает онбординг-менеджер в первые дни работы.
        Если вы новый сотрудник и ещё не получили её — напишите команде мерча.
      </WelcomeNotice>
    )
  }

  const invite = await getWelcomeInvite(supabase, token)

  if (!invite) {
    return (
      <WelcomeNotice isAdmin={isAdmin} title="Welcome pack скоро заработает">
        Выдача стартовых наборов ещё настраивается. Попробуйте открыть ссылку чуть позже.
      </WelcomeNotice>
    )
  }

  if (invite.status === 'used') {
    return (
      <WelcomeNotice isAdmin={isAdmin} title="Набор уже оформлен">
        Ваш welcome pack оформлен{invite.orderNumber ? ` — заказ #${invite.orderNumber}` : ''}.
        Статус и код для получения — в разделе «Мои заказы».
        <div className="welcome-notice-actions">
          <Link href="/orders" className="btn btn-accent btn-md">Мои заказы</Link>
        </div>
      </WelcomeNotice>
    )
  }

  if (invite.status === 'wrong_email') {
    return (
      <WelcomeNotice isAdmin={isAdmin} title="Ссылка выдана на другой email">
        Вы вошли как <b>{user.email}</b>, а приглашение оформлено на другой адрес.
        Выйдите и войдите под корпоративным email, на который пришла ссылка.
      </WelcomeNotice>
    )
  }

  if (invite.status !== 'ok') {
    return (
      <WelcomeNotice isAdmin={isAdmin} title={invite.status === 'expired' ? 'Срок ссылки истёк' : 'Ссылка недействительна'}>
        Попросите онбординг-менеджера прислать новую ссылку на welcome pack.
      </WelcomeNotice>
    )
  }

  const { error, props } = await loadCatalogData(supabase, user, 'welcome')

  if (error || props.products.length === 0) {
    return (
      <WelcomeNotice isAdmin={isAdmin} title="Набор пока собирается">
        {error ?? 'Товары для welcome pack ещё не добавлены или закончились. Мы сообщим, когда всё будет готово.'}
      </WelcomeNotice>
    )
  }

  return (
    <CatalogClient
      {...props}
      merchAccess={{ isAllowed: true, reason: 'ok', hiredAt: null, monthsWorked: null }}
      welcome={{ token }}
    />
  )
}

function WelcomeNotice({
  isAdmin,
  title,
  children,
}: {
  isAdmin: boolean
  title: string
  children: ReactNode
}) {
  return (
    <div>
      <header className="site-head">
        <div className="site-head-glass" aria-hidden="true" />
        <div className="head-inner">
          <Link href="/welcome" className="brand">
            <span className="brand-mark">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/brand/uzum-big-logo.webp" alt="Uzum" />
            </span>
            <span className="brand-name">
              uzum <span className="brand-name-soft">мерч</span>
            </span>
            <span className="brand-sub">welcome pack</span>
          </Link>
          <AppNav isAdmin={isAdmin} minimal showLogout />
        </div>
      </header>

      <main className="welcome-notice">
        <span className="kicker">Welcome pack</span>
        <h1 className="section-title">{title}</h1>
        <div className="welcome-notice-text">{children}</div>
        {SUPPORT_URL && (
          <p className="welcome-notice-help">
            Нужна помощь? <a href={SUPPORT_URL} target="_blank" rel="noreferrer">{SUPPORT_LABEL}</a>
          </p>
        )}
        {isAdmin && (
          <p className="welcome-notice-help">
            Вы администратор: ссылки для новичков создаются в разделе{' '}
            <Link href="/admin/welcome">Админ-панель → Welcome pack</Link>.
          </p>
        )}
      </main>
    </div>
  )
}
