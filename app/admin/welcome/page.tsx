import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { needsPasswordSetup } from '@/lib/auth'
import { countStockAlerts } from '@/lib/stockAlerts'
import AdminWelcomeClient, { type WelcomeInviteRow } from './AdminWelcomeClient'

export default async function AdminWelcomePage() {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')
  if (await needsPasswordSetup(supabase, user.id)) redirect('/set-password')

  const { data: employee } = await supabase
    .from('employees')
    .select('is_admin, email')
    .eq('id', user.id)
    .maybeSingle()

  if (!employee?.is_admin) redirect('/catalog')

  const [{ data: invites, error: invitesError }, { count: orderCount }, stockAlertCount, { data: welcomeProducts }] =
    await Promise.all([
      supabase
        .from('welcome_invites')
        .select('id, token, email, full_name, note, created_at, expires_at, used_at, used_order_id, orders:used_order_id ( order_number )')
        .order('created_at', { ascending: false })
        .limit(200),
      supabase.from('orders').select('id', { count: 'exact', head: true }),
      countStockAlerts(supabase),
      supabase.from('products').select('id').eq('is_active', true).in('audience', ['welcome', 'both']),
    ])

  return (
    <AdminWelcomeClient
      adminEmail={employee.email || user.email || 'admin'}
      orderCount={orderCount ?? 0}
      stockAlertCount={stockAlertCount}
      // До миграции 20261030000400_merch_welcome_pack.sql таблицы нет — показываем подсказку.
      migrationReady={!invitesError}
      invites={(invites ?? []) as unknown as WelcomeInviteRow[]}
      welcomeProductCount={welcomeProducts?.length ?? 0}
    />
  )
}
