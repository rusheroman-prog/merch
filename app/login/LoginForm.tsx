'use client'

import { useState, type CSSProperties } from 'react'
import { createClient } from '@/lib/supabase/client'

export default function LoginForm() {
  const supabase = createClient()

  const [email, setEmail] = useState('')
  const [token, setToken] = useState('')
  const [step, setStep] = useState<'email' | 'code'>('email')
  const [isLoading, setIsLoading] = useState(false)
  const [localError, setLocalError] = useState<string | null>(null)
  const [successMessage, setSuccessMessage] = useState<string | null>(null)

  async function sendCode(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()

    setIsLoading(true)
    setLocalError(null)
    setSuccessMessage(null)

    const origin =
      typeof window !== 'undefined'
        ? window.location.origin
        : process.env.NEXT_PUBLIC_APP_URL

    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: {
        emailRedirectTo: `${origin}/auth/callback`,
        shouldCreateUser: true,
      },
    })

    setIsLoading(false)

    if (error) {
      setLocalError(error.message)
      return
    }

    setStep('code')
    setSuccessMessage('Код или ссылка для входа отправлены на почту.')
  }

  async function verifyCode(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()

    setIsLoading(true)
    setLocalError(null)
    setSuccessMessage(null)

    const { error } = await supabase.auth.verifyOtp({
      email,
      token,
      type: 'email',
    })

    setIsLoading(false)

    if (error) {
      setLocalError(error.message)
      return
    }

    window.location.href = '/catalog'
  }

  if (step === 'code') {
    return (
      <form onSubmit={verifyCode} style={styles.form}>
        <div style={styles.info}>
          Письмо отправлено на <b>{email}</b>. Введите код из письма или
          перейдите по ссылке.
        </div>

        <label style={styles.label}>
          Код из письма
          <input
            type="text"
            required
            inputMode="numeric"
            placeholder="Например: 123456"
            value={token}
            onChange={(event) => setToken(event.target.value.trim())}
            style={styles.input}
          />
        </label>

        {successMessage && <div style={styles.success}>{successMessage}</div>}
        {localError && <div style={styles.error}>{localError}</div>}

        <button type="submit" disabled={isLoading} style={styles.button}>
          {isLoading ? 'Проверяем...' : 'Войти по коду'}
        </button>

        <button
          type="button"
          onClick={() => {
            setStep('email')
            setToken('')
            setLocalError(null)
            setSuccessMessage(null)
          }}
          style={styles.secondaryButton}
        >
          Изменить email
        </button>
      </form>
    )
  }

  return (
    <form onSubmit={sendCode} style={styles.form}>
      <label style={styles.label}>
        Корпоративный email
        <input
          type="email"
          required
          placeholder="name@company.com"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          style={styles.input}
        />
      </label>

      {localError && <div style={styles.error}>{localError}</div>}

      <button type="submit" disabled={isLoading} style={styles.button}>
        {isLoading ? 'Отправляем...' : 'Получить ссылку для входа'}
      </button>
    </form>
  )
}

const styles: Record<string, CSSProperties> = {
  form: {
    display: 'flex',
    flexDirection: 'column',
    gap: '14px',
  },
  label: {
    display: 'flex',
    flexDirection: 'column',
    gap: '8px',
    color: '#4b4259',
    fontSize: '14px',
    fontWeight: 900,
  },
  input: {
    height: '50px',
    borderRadius: '16px',
    border: '1px solid rgba(109,40,217,0.16)',
    padding: '0 15px',
    fontSize: '15px',
    background: '#ffffff',
    color: '#18111f',
  },
  button: {
    height: '50px',
    borderRadius: '16px',
    border: 'none',
    background: 'linear-gradient(135deg, #7c3aed 0%, #5b21b6 100%)',
    color: '#ffffff',
    fontWeight: 950,
    cursor: 'pointer',
    boxShadow: '0 14px 28px rgba(109,40,217,0.28)',
  },
  secondaryButton: {
    height: '46px',
    borderRadius: '16px',
    border: '1px solid rgba(109,40,217,0.14)',
    background: '#ffffff',
    color: '#4b4259',
    fontWeight: 900,
    cursor: 'pointer',
  },
  info: {
    background: '#f5f3ff',
    color: '#4c1d95',
    padding: '12px',
    borderRadius: '16px',
    fontSize: '14px',
    lineHeight: 1.45,
    fontWeight: 700,
  },
  error: {
    background: '#fee2e2',
    color: '#991b1b',
    padding: '12px',
    borderRadius: '16px',
    fontSize: '14px',
    fontWeight: 750,
  },
  success: {
    background: '#dcfce7',
    color: '#166534',
    padding: '12px',
    borderRadius: '16px',
    fontSize: '14px',
    fontWeight: 750,
  },
}