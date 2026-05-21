import { redirect } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import ProfileClient, { type EmployeeProfile } from './ProfileClient'
import type { CSSProperties } from 'react'

export default async function ProfilePage() {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  const { data, error } = await supabase
    .from('employees')
    .select(
      `
      id,
      full_name,
      email,
      phone,
      department,
      position,
      city,
      office,
      is_admin
    `
    )
    .eq('id', user.id)
    .maybeSingle()

  if (error) {
    return (
      <main style={styles.page}>
        <section style={styles.errorCard}>
          <h1 style={styles.errorTitle}>Не удалось загрузить профиль</h1>
          <p style={styles.errorText}>{error.message}</p>

          <Link href="/catalog" style={styles.backLink}>
            Вернуться в каталог
          </Link>
        </section>
      </main>
    )
  }

  const profile: EmployeeProfile = {
    id: user.id,
    full_name:
      data?.full_name ||
      user.user_metadata?.full_name ||
      user.email?.split('@')[0] ||
      '',
    email: data?.email || user.email || '',
    phone: data?.phone || '',
    department: data?.department || '',
    position: data?.position || '',
    city: data?.city || '',
    office: data?.office || '',
    is_admin: Boolean(data?.is_admin),
  }

  return <ProfileClient profile={profile} />
}

const styles: Record<string, CSSProperties> = {
  page: {
    minHeight: '100vh',
    background: '#f5f5f7',
    padding: '32px',
    fontFamily:
      'Inter, Arial, system-ui, -apple-system, BlinkMacSystemFont, sans-serif',
  },
  errorCard: {
    maxWidth: '640px',
    margin: '80px auto',
    background: '#ffffff',
    borderRadius: '20px',
    padding: '28px',
    boxShadow: '0 14px 40px rgba(0,0,0,0.07)',
  },
  errorTitle: {
    margin: '0 0 12px',
    fontSize: '24px',
    fontWeight: 800,
    color: '#991b1b',
  },
  errorText: {
    margin: '0 0 16px',
    color: '#374151',
    fontSize: '15px',
    lineHeight: 1.5,
  },
  backLink: {
    color: '#7c3aed',
    fontWeight: 800,
    textDecoration: 'none',
  },
}