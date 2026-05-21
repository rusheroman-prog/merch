'use client'

import AppNav from '@/components/AppNav'
import { useState, type CSSProperties } from 'react'

export type EmployeeProfile = {
  id: string
  full_name: string
  email: string
  phone: string
  department: string
  position: string
  city: string
  office: string
  is_admin: boolean
}

type ProfileClientProps = {
  profile: EmployeeProfile
}

export default function ProfileClient({ profile }: ProfileClientProps) {
  const [fullName, setFullName] = useState(profile.full_name)
  const [phone, setPhone] = useState(profile.phone)
  const [department, setDepartment] = useState(profile.department)
  const [position, setPosition] = useState(profile.position)
  const [city, setCity] = useState(profile.city)
  const [office, setOffice] = useState(profile.office)

  const [isSaving, setIsSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  const profileCompletion = getProfileCompletion({
    fullName,
    phone,
    department,
    position,
    city,
    office,
  })

  async function handleSave() {
    setIsSaving(true)
    setError(null)
    setSuccess(null)

    try {
      const response = await fetch('/api/profile', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          full_name: fullName,
          phone,
          department,
          position,
          city,
          office,
        }),
      })

      const result = await response.json()

      if (!response.ok) {
        setError(result.error || 'Не удалось сохранить профиль')
        return
      }

      setSuccess('Профиль успешно сохранён')
    } catch (saveError) {
      const message =
        saveError instanceof Error ? saveError.message : 'Неизвестная ошибка'

      setError(message)
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <main style={styles.page}>
      <header style={styles.header}>
        <div>
          <div style={styles.badge}>Личный кабинет</div>

          <h1 style={styles.title}>Профиль сотрудника</h1>

          <p style={styles.subtitle}>
            Эти данные используются при оформлении заявок на корпоративный мерч.
            Заполните профиль один раз, чтобы не вводить контакты вручную.
          </p>

          <div style={styles.headerStats}>
            <HeaderStat title="Заполненность" value={`${profileCompletion}%`} />
            <HeaderStat
              title="Роль"
              value={profile.is_admin ? 'Админ' : 'Сотрудник'}
            />
            <HeaderStat title="Email" value={profile.email ? 'Есть' : 'Нет'} />
          </div>

          <p style={styles.userEmail}>Вы вошли как: {profile.email}</p>
        </div>

        <AppNav isAdmin={profile.is_admin} />
      </header>

      <section style={styles.layout}>
        <aside style={styles.sideCard}>
          <div style={styles.avatar}>
            {getInitials(fullName || profile.email)}
          </div>

          <h2 style={styles.sideName}>{fullName || 'Сотрудник'}</h2>

          <p style={styles.sideEmail}>{profile.email}</p>

          <div style={styles.rolePill}>
            {profile.is_admin ? 'Администратор' : 'Сотрудник'}
          </div>

          <div style={styles.progressBlock}>
            <div style={styles.progressHeader}>
              <span>Заполненность профиля</span>
              <b>{profileCompletion}%</b>
            </div>

            <div style={styles.progressTrack}>
              <div
                style={{
                  ...styles.progressFill,
                  width: `${profileCompletion}%`,
                }}
              />
            </div>
          </div>

          <div style={styles.sideInfo}>
            <MiniInfo label="Город" value={city || 'Не указан'} />
            <MiniInfo label="Офис / склад" value={office || 'Не указан'} />
            <MiniInfo label="Отдел" value={department || 'Не указан'} />
          </div>
        </aside>

        <section style={styles.card}>
          <div style={styles.cardHeader}>
            <div>
              <h2 style={styles.cardTitle}>Данные для заявки</h2>

              <p style={styles.cardSubtitle}>
                ФИО, телефон и точка получения автоматически подставляются в
                корзине.
              </p>
            </div>

            <div style={styles.cardIcon}>✦</div>
          </div>

          <div style={styles.formGrid}>
            <label style={styles.label}>
              ФИО
              <input
                type="text"
                value={fullName}
                onChange={(event) => setFullName(event.target.value)}
                placeholder="Например: Иванов Иван"
                style={styles.input}
              />
            </label>

            <label style={styles.label}>
              Телефон
              <input
                type="tel"
                value={phone}
                onChange={(event) => setPhone(event.target.value)}
                placeholder="+998..."
                style={styles.input}
              />
            </label>

            <label style={styles.label}>
              Отдел
              <input
                type="text"
                value={department}
                onChange={(event) => setDepartment(event.target.value)}
                placeholder="Например: Outbound"
                style={styles.input}
              />
            </label>

            <label style={styles.label}>
              Должность
              <input
                type="text"
                value={position}
                onChange={(event) => setPosition(event.target.value)}
                placeholder="Например: Технолог"
                style={styles.input}
              />
            </label>

            <label style={styles.label}>
              Город
              <input
                type="text"
                value={city}
                onChange={(event) => setCity(event.target.value)}
                placeholder="Например: Ташкент"
                style={styles.input}
              />
            </label>

            <label style={styles.label}>
              Офис / склад / филиал
              <input
                type="text"
                value={office}
                onChange={(event) => setOffice(event.target.value)}
                placeholder="Например: Сергели"
                style={styles.input}
              />
            </label>
          </div>

          <div style={styles.metaBox}>
            <div>
              <div style={styles.metaLabel}>Email аккаунта</div>
              <div style={styles.metaValue}>{profile.email}</div>
            </div>

            <div>
              <div style={styles.metaLabel}>ID пользователя</div>
              <div style={styles.metaValueSmall}>{profile.id}</div>
            </div>
          </div>

          {error && <div style={styles.error}>{error}</div>}

          {success && <div style={styles.success}>{success}</div>}

          <div style={styles.actions}>
            <button
              type="button"
              onClick={handleSave}
              disabled={isSaving}
              style={{
                ...styles.saveButton,
                ...(isSaving ? styles.saveButtonDisabled : {}),
              }}
            >
              {isSaving ? 'Сохраняем...' : 'Сохранить профиль'}
            </button>

            <div style={styles.actionHint}>
              После сохранения данные будут использоваться в новых заказах.
            </div>
          </div>
        </section>
      </section>
    </main>
  )
}

function HeaderStat({ title, value }: { title: string; value: string }) {
  return (
    <div style={styles.headerStat}>
      <span>{title}</span>
      <b>{value}</b>
    </div>
  )
}

function MiniInfo({ label, value }: { label: string; value: string }) {
  return (
    <div style={styles.miniInfo}>
      <span>{label}</span>
      <b>{value}</b>
    </div>
  )
}

function getInitials(value: string) {
  const prepared = value.trim()

  if (!prepared) {
    return 'U'
  }

  const parts = prepared
    .replace('@', ' ')
    .split(' ')
    .filter(Boolean)

  const first = parts[0]?.[0] ?? 'U'
  const second = parts[1]?.[0] ?? ''

  return `${first}${second}`.toUpperCase()
}

function getProfileCompletion(values: {
  fullName: string
  phone: string
  department: string
  position: string
  city: string
  office: string
}) {
  const fields = [
    values.fullName,
    values.phone,
    values.department,
    values.position,
    values.city,
    values.office,
  ]

  const filled = fields.filter((field) => field.trim().length > 0).length

  return Math.round((filled / fields.length) * 100)
}

const styles: Record<string, CSSProperties> = {
  page: {
    minHeight: '100vh',
    padding: '32px',
  },
  header: {
    maxWidth: '1200px',
    margin: '0 auto 24px',
    display: 'grid',
    gridTemplateColumns: '1fr auto',
    gap: '24px',
    alignItems: 'start',
  },
  badge: {
    display: 'inline-flex',
    width: 'fit-content',
    background: 'rgba(237,233,254,0.9)',
    color: '#6d28d9',
    borderRadius: '999px',
    padding: '7px 13px',
    fontSize: '13px',
    fontWeight: 950,
    marginBottom: '14px',
    border: '1px solid rgba(109,40,217,0.12)',
  },
  title: {
    margin: 0,
    maxWidth: '760px',
    fontSize: 'clamp(36px, 5vw, 60px)',
    lineHeight: 0.96,
    letterSpacing: '-0.055em',
    fontWeight: 950,
    color: '#18111f',
  },
  subtitle: {
    maxWidth: '720px',
    margin: '16px 0 0',
    color: '#6b6078',
    fontSize: '16px',
    lineHeight: 1.62,
  },
  headerStats: {
    display: 'flex',
    gap: '10px',
    flexWrap: 'wrap',
    marginTop: '18px',
  },
  headerStat: {
    minWidth: '126px',
    padding: '12px 14px',
    borderRadius: '18px',
    background: 'rgba(255,255,255,0.72)',
    border: '1px solid rgba(109,40,217,0.12)',
    boxShadow: '0 12px 30px rgba(44,20,76,0.07)',
    display: 'flex',
    flexDirection: 'column',
    gap: '4px',
    color: '#5f566b',
    fontSize: '13px',
    fontWeight: 850,
  },
  userEmail: {
    margin: '14px 0 0',
    color: '#5f566b',
    fontSize: '14px',
    fontWeight: 750,
  },
  layout: {
    maxWidth: '1200px',
    margin: '0 auto',
    display: 'grid',
    gridTemplateColumns: '340px minmax(0, 1fr)',
    gap: '24px',
    alignItems: 'start',
  },
  sideCard: {
    position: 'sticky',
    top: '24px',
    background: 'rgba(255,255,255,0.88)',
    border: '1px solid rgba(109,40,217,0.12)',
    borderRadius: '30px',
    padding: '24px',
    boxShadow: '0 20px 60px rgba(44,20,76,0.12)',
    backdropFilter: 'blur(18px)',
  },
  avatar: {
    width: '76px',
    height: '76px',
    borderRadius: '24px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    background: 'linear-gradient(135deg, #7c3aed 0%, #5b21b6 100%)',
    color: '#ffffff',
    fontSize: '28px',
    fontWeight: 950,
    boxShadow: '0 16px 34px rgba(109,40,217,0.26)',
    marginBottom: '16px',
  },
  sideName: {
    margin: 0,
    color: '#18111f',
    fontSize: '24px',
    lineHeight: 1.15,
    fontWeight: 950,
    letterSpacing: '-0.035em',
  },
  sideEmail: {
    margin: '7px 0 0',
    color: '#6b6078',
    fontSize: '14px',
    fontWeight: 750,
    wordBreak: 'break-word',
  },
  rolePill: {
    display: 'inline-flex',
    width: 'fit-content',
    marginTop: '14px',
    borderRadius: '999px',
    padding: '8px 12px',
    background: '#ede9fe',
    color: '#6d28d9',
    fontSize: '13px',
    fontWeight: 950,
  },
  progressBlock: {
    marginTop: '22px',
    padding: '14px',
    borderRadius: '20px',
    background: '#f8f7ff',
    border: '1px solid rgba(109,40,217,0.08)',
  },
  progressHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    gap: '12px',
    color: '#5f566b',
    fontSize: '13px',
    fontWeight: 900,
    marginBottom: '10px',
  },
  progressTrack: {
    height: '10px',
    borderRadius: '999px',
    background: '#e9ddff',
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: '999px',
    background: 'linear-gradient(135deg, #7c3aed 0%, #5b21b6 100%)',
    transition: 'width 0.2s ease',
  },
  sideInfo: {
    marginTop: '14px',
    display: 'flex',
    flexDirection: 'column',
    gap: '10px',
  },
  miniInfo: {
    borderRadius: '18px',
    background: '#ffffff',
    border: '1px solid rgba(109,40,217,0.08)',
    padding: '12px',
    display: 'flex',
    flexDirection: 'column',
    gap: '5px',
    color: '#6b6078',
    fontSize: '12px',
    fontWeight: 850,
  },
  card: {
    background: 'rgba(255,255,255,0.88)',
    border: '1px solid rgba(109,40,217,0.12)',
    borderRadius: '30px',
    padding: '24px',
    boxShadow: '0 20px 60px rgba(44,20,76,0.12)',
    backdropFilter: 'blur(18px)',
  },
  cardHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: '18px',
    marginBottom: '20px',
  },
  cardTitle: {
    margin: 0,
    color: '#18111f',
    fontSize: '24px',
    fontWeight: 950,
    letterSpacing: '-0.035em',
  },
  cardSubtitle: {
    margin: '7px 0 0',
    color: '#6b6078',
    fontSize: '14px',
    lineHeight: 1.5,
    fontWeight: 750,
  },
  cardIcon: {
    width: '46px',
    height: '46px',
    borderRadius: '16px',
    background: '#ede9fe',
    color: '#6d28d9',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: '22px',
    fontWeight: 950,
    flex: '0 0 auto',
  },
  formGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
    gap: '14px',
  },
  label: {
    display: 'flex',
    flexDirection: 'column',
    gap: '8px',
    color: '#4b4259',
    fontSize: '14px',
    fontWeight: 950,
  },
  input: {
    height: '48px',
    borderRadius: '16px',
    border: '1px solid rgba(109,40,217,0.14)',
    padding: '0 13px',
    fontSize: '15px',
    background: '#ffffff',
    color: '#18111f',
    fontWeight: 750,
  },
  metaBox: {
    marginTop: '18px',
    background: '#f8f7ff',
    borderRadius: '22px',
    padding: '16px',
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
    gap: '14px',
    border: '1px solid rgba(109,40,217,0.08)',
  },
  metaLabel: {
    color: '#8a8197',
    fontSize: '11px',
    fontWeight: 950,
    textTransform: 'uppercase',
    letterSpacing: '0.04em',
    marginBottom: '6px',
  },
  metaValue: {
    color: '#18111f',
    fontSize: '15px',
    fontWeight: 900,
    wordBreak: 'break-word',
  },
  metaValueSmall: {
    color: '#4b4259',
    fontSize: '13px',
    fontWeight: 800,
    wordBreak: 'break-all',
  },
  error: {
    marginTop: '16px',
    background: '#fee2e2',
    color: '#991b1b',
    padding: '12px',
    borderRadius: '16px',
    fontSize: '14px',
    fontWeight: 800,
  },
  success: {
    marginTop: '16px',
    background: '#dcfce7',
    color: '#166534',
    padding: '12px',
    borderRadius: '16px',
    fontSize: '14px',
    fontWeight: 800,
  },
  actions: {
    marginTop: '18px',
    display: 'flex',
    alignItems: 'center',
    gap: '14px',
    flexWrap: 'wrap',
  },
  saveButton: {
    minHeight: '50px',
    borderRadius: '16px',
    border: 'none',
    background: 'linear-gradient(135deg, #7c3aed 0%, #5b21b6 100%)',
    color: '#ffffff',
    fontWeight: 950,
    padding: '0 18px',
    cursor: 'pointer',
    boxShadow: '0 14px 28px rgba(109,40,217,0.26)',
  },
  saveButtonDisabled: {
    background: '#9ca3af',
    cursor: 'not-allowed',
    boxShadow: 'none',
  },
  actionHint: {
    color: '#6b6078',
    fontSize: '13px',
    fontWeight: 750,
    lineHeight: 1.4,
  },
}