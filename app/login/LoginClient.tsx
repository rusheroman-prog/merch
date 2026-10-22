'use client'

import SupportLink from '@/components/SupportLink'
import { createClient } from '@/lib/supabase/client'
import type { SupportContact } from '@/lib/support'
import { useRouter, useSearchParams } from 'next/navigation'
import { useEffect, useMemo, useState } from 'react'

type Mode = 'login' | 'register' | 'reset'

const STEPS = [
  {
    title: 'Зарегистрируйтесь',
    text:  'Введите корпоративную почту и подтвердите доступ через письмо.',
  },
  {
    title: 'Создайте пароль',
    text:  'После перехода по ссылке из письма придумайте пароль для аккаунта.',
  },
  {
    title: 'Войдите в портал',
    text:  'Дальше входите по email и паролю — без ожидания писем.',
  },
]

export default function LoginClient({ support }: { support: SupportContact | null }) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const supabase = useMemo(() => createClient(), [])

  const [mode, setMode] = useState<Mode>('login')
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

  function switchMode(nextMode: Mode) {
    setMode(nextMode)
    setError(null)
    setSentEmail(null)
  }

  async function handleLogin(event: React.FormEvent<HTMLFormElement>) {
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
          'Неверный email или пароль. Если вы ещё не регистрировались — откройте вкладку «Регистрация».'
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

  /** Registration and password reset both confirm the mailbox with a link. */
  async function handleEmailLink(event: React.FormEvent<HTMLFormElement>) {
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
      const { error: sendError } = await supabase.auth.signInWithOtp({
        email: normalizedEmail,
        options: {
          emailRedirectTo: getEmailRedirectTo(),
          // A reset must not silently create an account for a typo.
          shouldCreateUser: mode === 'register',
        },
      })

      if (sendError) {
        setError(getSendErrorMessage(sendError.message, mode))
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
        <div className="login-left">
          <a href="/login" className="login-brand">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/brand/uzum-big-logo.webp" alt="Uzum" className="login-logo" />
            <span className="login-brand-text">
              uzum <span className="fw-regular">мерч</span>
            </span>
          </a>

          <div className="login-intro">
            <h1 className="login-title">Uzum Merch Shop</h1>
            <p className="login-lead">
              Внутренний портал для выбора и получения корпоративного мерча Uzum.
            </p>
          </div>

          <div className="login-howto">
            <h2 className="login-howto-title">Как начать пользоваться порталом</h2>
            <ol className="login-howto-list">
              {STEPS.map((step, index) => (
                <li key={step.title} className="login-howto-step">
                  <span className="login-howto-num">{index + 1}</span>
                  <span className="login-howto-body">
                    <b>{step.title}</b>
                    <span>{step.text}</span>
                  </span>
                </li>
              ))}
            </ol>
          </div>

          <HelpBlock support={support} />
        </div>

        <section className="login-card">
          <div className="login-card-head">
            <h2 className="login-card-title">Вход в Uzum Merch Shop</h2>
            <p className="login-card-text">
              Войдите в аккаунт или зарегистрируйтесь через корпоративную почту.
            </p>
          </div>

          <div className="login-tabs" role="tablist" aria-label="Вход или регистрация">
            <button
              type="button"
              role="tab"
              aria-selected={mode !== 'register'}
              className={`login-tab${mode !== 'register' ? ' is-active' : ''}`}
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

          {sentEmail ? (
            <section className="login-success">
              <div className="login-success-icon">✓</div>
              <h3 className="login-success-title">Письмо отправлено</h3>
              <p className="login-success-text">
                {mode === 'reset'
                  ? 'Ссылка для смены пароля отправлена на адрес:'
                  : 'Ссылка для подтверждения отправлена на адрес:'}
              </p>
              <div className="login-email-box">{sentEmail}</div>
              <p className="login-success-hint">
                Откройте письмо и перейдите по ссылке — после этого портал
                попросит {mode === 'reset' ? 'задать новый пароль' : 'создать пароль'}.
                Письма нет пару минут — проверьте папку «Спам».
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
                className="login-link-btn"
              >
                ← Вернуться ко входу
              </button>
            </section>
          ) : mode === 'login' ? (
            <form onSubmit={handleLogin} className="login-form">
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
                <span className="login-password">
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
                    className="login-password-toggle"
                    onClick={() => setShowPassword((value) => !value)}
                    aria-label={showPassword ? 'Скрыть пароль' : 'Показать пароль'}
                    aria-pressed={showPassword}
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
                className="login-link-btn"
              >
                Забыли пароль?
              </button>
            </form>
          ) : (
            <form onSubmit={handleEmailLink} className="login-form">
              {mode === 'reset' && (
                <div className="login-form-intro">
                  <b>Восстановление пароля</b>
                  <span>Пришлём ссылку — по ней вы зададите новый пароль.</span>
                </div>
              )}

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

              {error && <div className="login-error">{error}</div>}

              <button
                type="submit"
                disabled={isSubmitting}
                className="login-btn-primary"
              >
                {isSubmitting
                  ? 'Отправляем...'
                  : mode === 'reset' ? 'Отправить ссылку' : 'Получить письмо'}
              </button>

              {mode === 'register' ? (
                <p className="login-form-hint">
                  Пришлём ссылку для подтверждения почты. После перехода по ней
                  вы создадите пароль и сразу попадёте в каталог.
                </p>
              ) : (
                <button
                  type="button"
                  onClick={() => switchMode('login')}
                  className="login-link-btn"
                >
                  ← Вернуться ко входу
                </button>
              )}
            </form>
          )}

          <div className="login-help-mobile">
            <HelpBlock support={support} />
          </div>
        </section>
      </section>
    </main>
  )
}

function HelpBlock({ support }: { support: SupportContact | null }) {
  return (
    <div className="login-help">
      <span className="login-help-icon" aria-hidden="true">?</span>
      <span className="login-help-text">
        <b>Нужна помощь?</b>
        {support ? (
          <span>
            Свяжитесь с нами: <SupportLink contact={support} className="login-help-link" />
          </span>
        ) : (
          <span>Напишите HR-команде — поможем со входом.</span>
        )}
      </span>
    </div>
  )
}

function EyeIcon({ crossed }: { crossed: boolean }) {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12Z"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinejoin="round"
      />
      <circle cx="12" cy="12" r="3" stroke="currentColor" strokeWidth="1.8" />
      {crossed && (
        <path d="M4 4l16 16" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      )}
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

function getSendErrorMessage(message: string, mode: Mode) {
  const text = message.toLowerCase()

  if (mode === 'reset' && (text.includes('signups not allowed') || text.includes('not found'))) {
    return 'Аккаунт с таким email не найден. Откройте вкладку «Регистрация».'
  }

  if (text.includes('rate limit') || text.includes('security purposes')) {
    return 'Письмо уже отправлено недавно. Подождите минуту и попробуйте снова.'
  }

  return message || 'Не удалось отправить письмо'
}

function getUrlErrorMessage(error: string, description: string | null) {
  if (description?.includes('expired')) {
    return 'Ссылка из письма недействительна или истекла. Запросите новую.'
  }

  if (error === 'auth_failed') {
    return 'Не удалось выполнить вход. Попробуйте запросить новую ссылку.'
  }

  return description || 'Не удалось выполнить вход. Попробуйте ещё раз.'
}
