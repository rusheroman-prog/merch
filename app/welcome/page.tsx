import AppNav from '@/components/AppNav'
import Link from 'next/link'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { needsPasswordSetup } from '@/lib/auth'

/* ─────────────────────────────────────────────────────────────────────────── */
/*  Static content                                                              */
/* ─────────────────────────────────────────────────────────────────────────── */

const PACK_CONTENTS = [
  {
    emoji:       '👕',
    category:    'Одежда',
    name:        'Футболка базовая',
    description: 'Хлопковая унисекс-футболка с логотипом Uzum. Подберём ваш размер.',
  },
  {
    emoji:       '🛍',
    category:    'Аксессуары',
    name:        'Шоппер',
    description: 'Прочная эко-сумка из плотного холста. Подходит для ежедневных поездок.',
  },
  {
    emoji:       '📔',
    category:    'Канцелярия',
    name:        'Блокнот A5',
    description: 'Мягкая обложка, 96 листов в клетку. Удобен для заметок и планирования.',
  },
  {
    emoji:       '✏️',
    category:    'Канцелярия',
    name:        'Ручка Uzum',
    description: 'Металлический корпус с гравировкой логотипа. Синяя паста.',
  },
  {
    emoji:       '🎨',
    category:    'Стикеры',
    name:        'Стикерпак',
    description: 'Набор из 20 виниловых стикеров — персонажи и фразы из мира Uzum.',
  },
]

const FAQ = [
  {
    q: 'Можно поменять размер футболки?',
    a: 'Да, в течение 7 дней с момента получения. Напишите в HR-бот — обменяем на нужный размер.',
  },
  {
    q: 'Что если что-то не подошло?',
    a: 'Возврат через HR-бот или лично в офис. После 7 дней обмен невозможен.',
  },
  {
    q: 'Можно получить второй набор?',
    a: 'Welcome-pack — один на сотрудника. Но в каталоге можно выбрать любые позиции отдельно.',
  },
  {
    q: 'Работаю удалённо — куда привезут?',
    a: 'Курьером по адресу из вашего профиля. Срок — до 10 рабочих дней после оффера.',
  },
]

/* ─────────────────────────────────────────────────────────────────────────── */
/*  Page                                                                        */
/* ─────────────────────────────────────────────────────────────────────────── */

export default async function WelcomePage() {
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

  return (
    <div>
      {/* ── Header ── */}
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
            <span className="brand-sub">welcome-pack</span>
          </Link>

          <AppNav isAdmin={isAdmin} showLogout />
        </div>
      </header>

      <div className="welcome">

        {/* ── Hero ── */}
        <section className="welcome-hero">
          <div>
            <span className="kicker">Welcome-pack · для новичков</span>
            <h1 className="display">
              Здравствуйте,<br />мы вам кое-что собрали.
            </h1>
            <p className="lead">
              Каждый новый сотрудник в первую рабочую неделю получает стартовый набор.
              Его не нужно заказывать — он приедет в офис вместе с пропуском.
              Этот экран — просто чтобы знали, что ждать.
            </p>

            <div className="welcome-meta">
              <div className="welcome-meta-item">
                <span className="kicker">Доставка</span>
                <p>В первую неделю после оффера</p>
              </div>
              <div className="welcome-meta-item">
                <span className="kicker">Стоимость</span>
                <p>0 сум — компания дарит</p>
              </div>
              <div className="welcome-meta-item">
                <span className="kicker">Лимит</span>
                <p>Один набор на сотрудника</p>
              </div>
            </div>
          </div>

          <div className="welcome-box">
            <div className="welcome-box-inner">
              <div className="welcome-box-icon">🎁</div>
              <span className="welcome-box-label">
                крафтовая упаковка · формат A4
              </span>
            </div>
          </div>
        </section>

        {/* ── Box contents ── */}
        <section className="welcome-section">
          <h2 className="section-title">Внутри коробки</h2>
          <div className="welcome-grid">
            {PACK_CONTENTS.map(item => (
              <article key={item.name} className="welcome-card">
                <div className="welcome-card-art">{item.emoji}</div>
                <span className="kicker">{item.category}</span>
                <h3>{item.name}</h3>
                <p>{item.description}</p>
              </article>
            ))}
          </div>
        </section>

        {/* ── FAQ ── */}
        <section className="welcome-section">
          <h2 className="section-title">Часто спрашивают</h2>
          <div className="faq-grid">
            {FAQ.map(item => (
              <div key={item.q} className="faq-item">
                <h4>{item.q}</h4>
                <p>{item.a}</p>
              </div>
            ))}
          </div>
        </section>

        {/* ── CTA ── */}
        <div className="welcome-cta">
          <p>
            Хотите ещё мерча? В каталоге можно выбрать любые позиции.
          </p>
          <Link href="/catalog" className="btn btn-accent btn-lg">
            Перейти в каталог
          </Link>
        </div>

      </div>
    </div>
  )
}
