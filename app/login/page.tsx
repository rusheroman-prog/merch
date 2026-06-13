'use client'

import { createClient } from '@/lib/supabase/client'
import { useRouter, useSearchParams } from 'next/navigation'
import { Suspense, useEffect, useMemo, useState } from 'react'

type LoginMode = 'password' | 'email'

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

  const [mode, setMode] = useState<LoginMode>('password')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
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
          'Не удалось войти по паролю. Если это первый вход, получите письмо.'
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
      const redirectTo = getEmailRedirectTo()

      const { error: signInError } = await supabase.auth.signInWithOtp({
        email: normalizedEmail,
        options: { emailRedirectTo: redirectTo },
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

          <div className="login-hero">
            <div className="kicker">Внутренний портал</div>
            <h1 className="login-title">
              Корпоративный мерч<br />для сотрудников Uzum
            </h1>
            <p className="login-lead">
              Первый вход подтвердите через письмо, создайте пароль и дальше
              входите без ожидания ссылки.
            </p>
          </div>

          <div className="login-steps">
            <LoginStep value="1" label="Первый вход по email" />
            <LoginStep value="2" label="Создание пароля" />
            <LoginStep value="3" label="Быстрый вход" />
          </div>
        </div>

        <section className="login-card">
          <div className="login-card-top">
            <div className="login-card-icon">↗</div>
            <div>
              <h2 className="login-card-title">Вход</h2>
              <p className="login-card-text">
                Войдите по паролю или получите письмо для первого входа.
              </p>
            </div>
          </div>

          <div className="login-mode-tabs" role="tablist" aria-label="Способ входа">
            <button
              type="button"
              className={`login-mode-tab${mode === 'password' ? ' is-active' : ''}`}
              onClick={() => switchMode('password')}
            >
              Пароль
            </button>
            <button
              type="button"
              className={`login-mode-tab${mode === 'email' ? ' is-active' : ''}`}
              onClick={() => switchMode('email')}
            >
              Письмо
            </button>
          </div>

          {sentEmail ? (
            <section className="login-success">
              <div className="login-success-icon">✓</div>
              <h3 className="login-success-title">Письмо отправлено</h3>
              <p className="login-success-text">
                Мы отправили ссылку для входа на адрес:
              </p>
              <div className="login-email-box">{sentEmail}</div>
              <p className="login-success-hint">
                Откройте письмо и перейдите по ссылке. После первого входа
                приложение попросит создать пароль.
              </p>
              <button
                type="button"
                onClick={() => { setSentEmail(null); setError(null) }}
                className="login-btn-secondary"
              >
                Отправить ещё раз
              </button>
            </section>
          ) : mode === 'password' ? (
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
                <input
                  type="password"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  autoComplete="current-password"
                  className="login-input"
                />
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
                onClick={() => switchMode('email')}
                className="login-btn-secondary"
              >
                Первый вход или забыли пароль?
              </button>
            </form>
          ) : (
            <form onSubmit={handleEmailSubmit} className="login-form">
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

              {error && <div className="login-error">{error}</div>}

              <button
                type="submit"
                disabled={isSubmitting}
                className="login-btn-primary"
              >
                {isSubmitting ? 'Отправляем...' : 'Получить письмо'}
              </button>
            </form>
          )}

          <div className="login-footer-note">
            Пароль создаётся только после подтверждения доступа к корпоративной почте.
          </div>
        </section>
      </section>
    </main>
  )
}

function LoginStep({ value, label }: { value: string; label: string }) {
  return (
    <div className="login-step">
      <b>{value}</b>
      <span>{label}</span>
    </div>
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
    return 'Ссылка для входа недействительна или истекла. Запросите новую ссылку.'
  }

  if (error === 'auth_failed') {
    return 'Не удалось выполнить вход. Попробуйте запросить новую ссылку.'
  }

  return description || 'Не удалось выполнить вход. Попробуйте ещё раз.'
}
