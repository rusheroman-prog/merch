import LoginForm from './LoginForm'
import type { CSSProperties } from 'react'

type LoginPageProps = {
  searchParams: Promise<{
    error?: string
    message?: string
    description?: string
  }>
}

export default async function LoginPage({ searchParams }: LoginPageProps) {
  const params = await searchParams

  const error = params.error
  const message = params.message
  const description = params.description

  return (
    <main style={styles.page}>
      <section style={styles.left}>
        <div style={styles.logoMark}>U</div>

        <div>
          <div style={styles.badge}>Внутренний мерч-магазин</div>

          <h1 style={styles.heroTitle}>
            Корпоративный мерч для сотрудников
          </h1>

          <p style={styles.heroText}>
            Выбирайте доступные товары, оформляйте заявку и отслеживайте статус
            выдачи в личном кабинете.
          </p>
        </div>

        <div style={styles.features}>
          <div style={styles.featureItem}>
            <span style={styles.featureDot} />
            Каталог с остатками и размерами
          </div>

          <div style={styles.featureItem}>
            <span style={styles.featureDot} />
            История заказов и статусы
          </div>

          <div style={styles.featureItem}>
            <span style={styles.featureDot} />
            Админка для склада и HR
          </div>
        </div>
      </section>

      <section style={styles.right}>
        <div style={styles.card}>
          <div style={styles.cardHeader}>
            <div style={styles.cardIcon}>→</div>

            <div>
              <h2 style={styles.title}>Вход</h2>

              <p style={styles.subtitle}>
                Введите корпоративный email. Мы отправим ссылку или код для
                входа.
              </p>
            </div>
          </div>

          {error === 'auth_failed' && (
            <div style={styles.error}>
              Не удалось выполнить вход.
              {description ? ` ${description}` : ' Попробуйте запросить новую ссылку.'}
            </div>
          )}

          {message === 'check_email' && (
            <div style={styles.success}>
              Ссылка для входа отправлена на вашу почту.
            </div>
          )}

          <LoginForm />
        </div>
      </section>
    </main>
  )
}

const styles: Record<string, CSSProperties> = {
  page: {
    minHeight: '100vh',
    display: 'grid',
    gridTemplateColumns: '1fr 480px',
    gap: '32px',
    padding: '32px',
    background:
      'radial-gradient(circle at 10% 0%, rgba(124,58,237,0.22), transparent 30%), radial-gradient(circle at 90% 12%, rgba(236,72,153,0.15), transparent 26%), linear-gradient(135deg, #fbfaff 0%, #f6f3ff 48%, #f1edff 100%)',
  },
  left: {
    minHeight: 'calc(100vh - 64px)',
    borderRadius: '32px',
    padding: '42px',
    display: 'flex',
    flexDirection: 'column',
    justifyContent: 'space-between',
    background:
      'linear-gradient(135deg, rgba(109,40,217,0.96) 0%, rgba(91,33,182,0.94) 45%, rgba(76,29,149,0.96) 100%)',
    color: '#ffffff',
    boxShadow: '0 28px 90px rgba(76,29,149,0.28)',
    overflow: 'hidden',
  },
  logoMark: {
    width: '58px',
    height: '58px',
    borderRadius: '18px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    background: 'rgba(255,255,255,0.16)',
    border: '1px solid rgba(255,255,255,0.22)',
    color: '#ffffff',
    fontSize: '28px',
    fontWeight: 950,
    boxShadow: '0 16px 40px rgba(0,0,0,0.18)',
  },
  badge: {
    display: 'inline-flex',
    width: 'fit-content',
    borderRadius: '999px',
    padding: '8px 13px',
    background: 'rgba(255,255,255,0.14)',
    color: '#f5f3ff',
    fontSize: '13px',
    fontWeight: 900,
    marginBottom: '18px',
  },
  heroTitle: {
    margin: 0,
    maxWidth: '760px',
    fontSize: 'clamp(38px, 5vw, 72px)',
    lineHeight: 0.95,
    letterSpacing: '-0.055em',
    fontWeight: 950,
  },
  heroText: {
    maxWidth: '640px',
    margin: '22px 0 0',
    color: 'rgba(255,255,255,0.78)',
    fontSize: '18px',
    lineHeight: 1.6,
  },
  features: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))',
    gap: '12px',
  },
  featureItem: {
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
    minHeight: '54px',
    padding: '12px 14px',
    borderRadius: '18px',
    background: 'rgba(255,255,255,0.11)',
    border: '1px solid rgba(255,255,255,0.13)',
    color: 'rgba(255,255,255,0.86)',
    fontSize: '14px',
    fontWeight: 800,
  },
  featureDot: {
    width: '9px',
    height: '9px',
    borderRadius: '50%',
    background: '#c4b5fd',
    boxShadow: '0 0 0 5px rgba(196,181,253,0.16)',
    flex: '0 0 auto',
  },
  right: {
    minHeight: 'calc(100vh - 64px)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  card: {
    width: '100%',
    maxWidth: '460px',
    background: 'rgba(255,255,255,0.86)',
    border: '1px solid rgba(109,40,217,0.14)',
    borderRadius: '30px',
    padding: '28px',
    boxShadow: '0 24px 80px rgba(44,20,76,0.16)',
    backdropFilter: 'blur(18px)',
  },
  cardHeader: {
    display: 'flex',
    gap: '14px',
    alignItems: 'flex-start',
    marginBottom: '22px',
  },
  cardIcon: {
    width: '44px',
    height: '44px',
    borderRadius: '16px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    background: '#ede9fe',
    color: '#6d28d9',
    fontSize: '22px',
    fontWeight: 950,
  },
  title: {
    margin: 0,
    color: '#18111f',
    fontSize: '28px',
    fontWeight: 950,
    letterSpacing: '-0.03em',
  },
  subtitle: {
    margin: '6px 0 0',
    color: '#6b6078',
    fontSize: '14px',
    lineHeight: 1.55,
  },
  error: {
    background: '#fee2e2',
    color: '#991b1b',
    padding: '12px',
    borderRadius: '16px',
    marginBottom: '16px',
    fontSize: '14px',
    fontWeight: 750,
    lineHeight: 1.45,
  },
  success: {
    background: '#dcfce7',
    color: '#166534',
    padding: '12px',
    borderRadius: '16px',
    marginBottom: '16px',
    fontSize: '14px',
    fontWeight: 750,
  },
}