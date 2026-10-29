import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { needsPasswordSetup } from '@/lib/auth'
import { getWelcomeInvite, WELCOME_COOKIE } from '@/lib/welcome'
import CatalogClient from './CatalogClient'
import { loadCatalogData } from './loadCatalog'

export default async function CatalogPage() {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  if (await needsPasswordSetup(supabase, user.id)) {
    redirect('/set-password')
  }

  const { data: accessRows } = await supabase.rpc('get_employee_merch_access', {
    p_email: user.email ?? '',
  })
  const access = Array.isArray(accessRows) ? accessRows[0] : null

  // Новичок пришёл по ссылке на welcome pack и уже вошёл: обычный каталог ему
  // ещё недоступен (стаж), поэтому сразу ведём в его набор.
  const welcomeToken = (await cookies()).get(WELCOME_COOKIE)?.value
  if (welcomeToken && !access?.is_allowed) {
    const invite = await getWelcomeInvite(supabase, welcomeToken)
    if (invite?.status === 'ok') redirect('/welcome')
  }

  const { error, employee, props } = await loadCatalogData(supabase, user, 'catalog')

  if (error) {
    return (
      <main className="page-error">
        <section className="error-card">
          <div className="error-card-icon">!</div>
          <h1 className="error-title">Не удалось загрузить каталог</h1>
          <p className="error-text">{error}</p>
        </section>
      </main>
    )
  }

  return (
    <CatalogClient
      {...props}
      merchAccess={{
        isAllowed: Boolean(access?.is_allowed),
        reason: access?.reason ?? 'employee_not_in_directory',
        hiredAt: access?.hired_at ?? employee?.hired_at ?? null,
        monthsWorked: access?.months_worked ?? null,
      }}
    />
  )
}
