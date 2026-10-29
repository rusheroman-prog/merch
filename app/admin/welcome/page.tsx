import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { needsPasswordSetup } from '@/lib/auth'
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

  const [{ data: invites, error: invitesError }, { count: orderCount }, { data: variants }, { data: welcomeProducts }] =
    await Promise.all([
      supabase
        .from('welcome_invites')
        .select('id, token, email, full_name, note, created_at, expires_at, used_at, used_order_id, orders:used_order_id ( order_number )')
        .order('created_at', { ascending: false })
        .limit(200),
      supabase.from('orders').select('id', { count: 'exact', head: true }),
      supabase.from('product_variants').select('total_qty, reserved_qty, is_active'),
      supabase.from('products').select('id').eq('is_active', true).in('audience', ['welcome', 'both']),
    ])

  const stockAlertCount = (variants ?? []).filter(
    (v) => v.is_active && Number(v.total_qty) - Number(v.reserved_qty) <= 4
  ).length

  return (
    <AdminWelcomeClient
      adminEmail={employee.email || user.email || 'admin'}
      orderCount={orderCount ?? 0}
      stockAlertCount={stockAlertCount}
      // До миграции merch-welcome-pack.sql таблицы нет — показываем подсказку.
      migrationReady={!invitesError}
      invites={(invites ?? []) as unknown as WelcomeInviteRow[]}
      welcomeProductCount={welcomeProducts?.length ?? 0}
    />
  )
}
