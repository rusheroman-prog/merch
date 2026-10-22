'use client'

import { createClient } from '@/lib/supabase/client'
import { SUPPORT_LABEL, SUPPORT_URL } from '@/lib/support'
import { useRouter, useSearchParams } from 'next/navigation'
import { Suspense, useEffect, useMemo, useState } from 'react'

/**
 * login    — вход по email + пароль
 * register — первый вход: письмо со ссылкой → создание пароля
 * reset    — «Забыли пароль?»: то же письмо → новый пароль
 *
 * register и reset используют один и тот же Supabase OTP-флоу:
 * /auth/hash-callback отправит нового пользователя на /set-password,
 * а пользователя с паролем — на /set-password?reset=1.
 */
type LoginMode = 'login' | 'register' | 'reset'

const STEPS = [
  {
    title: 'Зарегистрируйтесь',
    text: 'Введите корпоративную почту и подтвердите доступ через письмо.',
  },
  {
    title: 'Создайте пароль',
    text: 'После перехода по ссылке из письма придумайте пароль для аккаунта.',
  },
  {
    title: 'Войдите в портал',
    text: 'Дальше входите по email и паролю — без ожидания письма.',
  },
]

const CARD_COPY: Record<LoginMode, { title: string; text: string }> = {
  login: {
    title: 'Вход в Uzum Merch Shop',
    text: 'Войдите в аккаунт или зарегистрируйтесь через корпоративную почту.',
  },
  register: {
    title: 'Вход в Uzum Merch Shop',
    text: 'Войдите в аккаунт или зарегистрируйтесь через корпоративную почту.',
  },
  reset: {
    title: 'Восстановление пароля',
    text: 'Пришлём ссылку на корпоративную почту — по ней вы зададите новый пароль.',
  },
}

export default function LoginPage() {
  return (
    <Suspense>
      <LoginContent />
    </Suspense>
  )
}

function LoginContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const supabase = useMemo(() => createClient(), [])

  const [mode, setMode] = useState<LoginMode>('login')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isMounted, setIsMounted] = useState(false)
  const [sentEmail, setSentEmail] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const urlError = searchParams.get('error')
  const urlDescription = searchParams.get('description')

  useEffect(() => {
    setIsMounted(true)
  }, [])

  useEffect(() => {
    async function checkSession() {
      const {
        data: { user },
      } = await supabase.auth.getUser()

      if (!user) {
        return
      }

      const { data: employee } = await supabase
        .from('employees')
        .select('password_set_at')
        .eq('id', user.id)
        .maybeSingle()

      router.replace(employee?.password_set_at ? '/catalog' : '/set-password')
    }

    checkSession()
  }, [router, supabase])

  useEffect(() => {
    if (urlError) {
      setError(getUrlErrorMessage(urlError, urlDescription))
    }
  }, [urlError, urlDescription])

  function switchMode(nextMode: LoginMode) {
    setMode(nextMode)
    setError(null)
    setSentEmail(null)
  }

  async function handlePasswordSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()

    const normalizedEmail = email.trim().toLowerCase()
    if (!normalizedEmail || !password) {
      setError('Введите email и пароль')
      return
    }

    setIsSubmitting(true)
    setError(null)

    try {
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email: normalizedEmail,
        password,
      })

      if (signInError) {
        setError(
          'Неверный email или пароль. Если вы ещё не создавали пароль — пройдите регистрацию.'
        )
        return
      }

      const {
        data: { user },
      } = await supabase.auth.getUser()

      if (user) {
        const { data: employee } = await supabase
          .from('employees')
          .select('password_set_at')
          .eq('id', user.id)
          .maybeSingle()

        router.replace(employee?.password_set_at ? '/catalog' : '/set-password')
        return
      }

      router.replace('/catalog')
    } catch (loginError) {
      setError(
        loginError instanceof Error ? loginError.message : 'Неизвестная ошибка'
      )
    } finally {
      setIsSubmitting(false)
    }
  }

  async function handleEmailSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()

    const normalizedEmail = email.trim().toLowerCase()
    if (!normalizedEmail) {
      setError('Введите корпоративный email')
      return
    }

    setIsSubmitting(true)
    setError(null)
    setSentEmail(null)

    try {
      const { error: signInError } = await supabase.auth.signInWithOtp({
        email: normalizedEmail,
        options: { emailRedirectTo: getEmailRedirectTo() },
      })

      if (signInError) {
        setError(signInError.message || 'Не удалось отправить письмо')
        return
      }

      setSentEmail(normalizedEmail)
    } catch (sendError) {
      setError(
        sendError instanceof Error ? sendError.message : 'Неизвестная ошибка'
      )
    } finally {
      setIsSubmitting(false)
    }
  }

  const copy = CARD_COPY[mode]

  if (!isMounted) {
    return (
      <main className="login-page">
        <section className="login-shell">
          <div className="login-left" />
          <section className="login-card" aria-busy="true" />
        </section>
      </main>
    )
  }

  return (
    <main className="login-page">
      <section className="login-shell">
        {/* ── Левая колонка: что это и как начать ── */}
        <aside className="login-left">
          <a href="/login" className="login-brand">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/brand/uzum-big-logo.webp" alt="Uzum" className="login-logo" />
            <span className="login-brand-text">
              uzum <span className="fw-regular">merch</span>
            </span>
          </a>

          <h1 className="login-heading">Uzum Merch Shop</h1>
          <p className="login-sub">
            Внутренний портал для выбора и получения корпоративного мерча Uzum.
          </p>

          <h2 className="login-guide-title">Как начать пользоваться порталом</h2>
          <ol className="login-guide">
            {STEPS.map((step, index) => (
              <li key={step.title} className="login-guide-step">
                <span className="login-guide-num" aria-hidden="true">{index + 1}</span>
                <span className="login-guide-body">
                  <b>{step.title}</b>
                  <span>{step.text}</span>
                </span>
              </li>
            ))}
          </ol>

          <SupportBlock />
        </aside>

        {/* ── Правая колонка: форма ── */}
        <section className="login-card">
          <h2 className="login-card-title">{copy.title}</h2>
          <p className="login-card-text">{copy.text}</p>

          {mode !== 'reset' && (
            <div className="login-tabs" role="tablist" aria-label="Вход или регистрация">
              <button
                type="button"
                role="tab"
                aria-selected={mode === 'login'}
                className={`login-tab${mode === 'login' ? ' is-active' : ''}`}
                onClick={() => switchMode('login')}
              >
                Войти
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={mode === 'register'}
                className={`login-tab${mode === 'register' ? ' is-active' : ''}`}
                onClick={() => switchMode('register')}
              >
                Регистрация
              </button>
            </div>
          )}

          {sentEmail ? (
            <section className="login-success">
              <div className="login-success-icon">✓</div>
              <h3 className="login-success-title">Письмо отправлено</h3>
              <p className="login-success-text">Ссылка ушла на адрес:</p>
              <div className="login-email-box">{sentEmail}</div>
              <p className="login-success-hint">
                {mode === 'reset'
                  ? 'Перейдите по ссылке из письма и задайте новый пароль.'
                  : 'Перейдите по ссылке из письма — портал попросит создать пароль.'}{' '}
                Письма нет больше 5 минут — проверьте «Спам».
              </p>
              <button
                type="button"
                onClick={() => { setSentEmail(null); setError(null) }}
                className="login-btn-secondary"
              >
                Отправить ещё раз
              </button>
              <button
                type="button"
                onClick={() => switchMode('login')}
                className="login-link"
              >
                ← Вернуться ко входу
              </button>
            </section>
          ) : mode === 'login' ? (
            <form onSubmit={handlePasswordSubmit} className="login-form">
              <label className="login-label">
                Email
                <input
                  type="email"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  placeholder="name@uzum.com"
                  autoComplete="email"
                  className="login-input"
                />
              </label>

              <label className="login-label">
                Пароль
                <span className="login-input-wrap">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={(event) => setPassword(event.target.value)}
                    placeholder="Введите пароль"
                    autoComplete="current-password"
                    className="login-input"
                  />
                  <button
                    type="button"
                    className="login-eye"
                    onClick={() => setShowPassword((value) => !value)}
                    aria-label={showPassword ? 'Скрыть пароль' : 'Показать пароль'}
                  >
                    <EyeIcon crossed={showPassword} />
                  </button>
                </span>
              </label>

              {error && <div className="login-error">{error}</div>}

              <button
                type="submit"
                disabled={isSubmitting}
                className="login-btn-primary"
              >
                {isSubmitting ? 'Входим...' : 'Войти'}
              </button>

              <button
                type="button"
                onClick={() => switchMode('reset')}
                className="login-link"
              >
                Забыли пароль?
              </button>
            </form>
          ) : (
            <form onSubmit={handleEmailSubmit} className="login-form">
              <label className="login-label">
                Корпоративный email
                <input
                  type="email"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  placeholder="name@uzum.com"
                  autoComplete="email"
                  className="login-input"
                />
              </label>

              <p className="login-hint">
                {mode === 'register'
                  ? 'Пришлём письмо со ссылкой. После перехода по ней вы создадите пароль и попадёте в каталог.'
                  : 'Пришлём письмо со ссылкой для смены пароля.'}
              </p>

              {error && <div className="login-error">{error}</div>}

              <button
                type="submit"
                disabled={isSubmitting}
                className="login-btn-primary"
              >
                {isSubmitting ? 'Отправляем...' : 'Получить письмо'}
              </button>

              {mode === 'reset' && (
                <button
                  type="button"
                  onClick={() => switchMode('login')}
                  className="login-link"
                >
                  ← Вернуться ко входу
                </button>
              )}
            </form>
          )}
        </section>
      </section>
    </main>
  )
}

function SupportBlock() {
  const content = (
    <>
      <span className="login-help-icon" aria-hidden="true">?</span>
      <span className="login-help-body">
        <b>Нужна помощь?</b>
        <span>{SUPPORT_LABEL}</span>
      </span>
    </>
  )

  return SUPPORT_URL ? (
    <a href={SUPPORT_URL} target="_blank" rel="noreferrer" className="login-help">
      {content}
    </a>
  ) : (
    <div className="login-help">{content}</div>
  )
}

function EyeIcon({ crossed }: { crossed: boolean }) {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12Z" />
      <circle cx="12" cy="12" r="3" />
      {crossed && <path d="M4 4l16 16" />}
    </svg>
  )
}

function getEmailRedirectTo() {
  const currentOrigin = typeof window !== 'undefined' ? window.location.origin : undefined
  const configuredOrigin = normalizeOrigin(process.env.NEXT_PUBLIC_APP_URL)

  if (configuredOrigin && (!isLocalOrigin(configuredOrigin) || isLocalOrigin(currentOrigin))) {
    return `${configuredOrigin}/auth/hash-callback`
  }

  if (currentOrigin) {
    return `${currentOrigin}/auth/hash-callback`
  }

  return '/auth/hash-callback'
}

function normalizeOrigin(value: string | undefined) {
  if (!value) {
    return null
  }

  try {
    return new URL(value).origin
  } catch {
    return null
  }
}

function isLocalOrigin(value: string | null | undefined) {
  if (!value) {
    return false
  }

  try {
    const hostname = new URL(value).hostname
    return hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '::1'
  } catch {
    return false
  }
}

function getUrlErrorMessage(error: string, description: string | null) {
  if (description?.includes('expired')) {
    return 'Ссылка из письма недействительна или истекла. Запросите новую.'
  }

  if (error === 'auth_failed') {
    return 'Не удалось выполнить вход. Попробуйте запросить новое письмо.'
  }

  return description || 'Не удалось выполнить вход. Попробуйте ещё раз.'
}
