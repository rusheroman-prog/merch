import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { needsPasswordSetup } from '@/lib/auth'
import { countLowStockVariants } from '@/lib/stock'
import HandoutClient, { type HandedOutOrder } from './HandoutClient'

export default async function AdminHandoutPage() {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) redirect('/login')
  if (await needsPasswordSetup(supabase, user.id)) redirect('/set-password')

  const { data: employee } = await supabase
    .from('employees')
    .select('is_admin, email')
    .eq('id', user.id)
    .maybeSingle()

  if (!employee?.is_admin) redirect('/catalog')

  // "Today" in Tashkent time: the server itself usually runs in UTC.
  const todayTashkent = new Date().toLocaleDateString('sv-SE', { timeZone: 'Asia/Tashkent' })
  const startOfDay = new Date(`${todayTashkent}T00:00:00+05:00`)

  const [{ count: orderCount }, { data: productsForStock }, { data: handedToday }] = await Promise.all([
    supabase.from('orders').select('id', { count: 'exact', head: true }),
    supabase
      .from('products')
      .select('id, is_active, archived_at, low_stock_threshold, product_variants ( id, total_qty, reserved_qty, is_active )'),
    supabase
      .from('orders')
      .select('id, order_number, full_name, handed_to, received_at')
      .eq('status', 'received')
      .neq('delivery_type', 'post')
      .gte('received_at', startOfDay.toISOString())
      .order('received_at', { ascending: false })
      .limit(20),
  ])

  return (
    <HandoutClient
      adminEmail={employee.email || user.email || 'admin'}
      orderCount={orderCount ?? 0}
      stockAlertCount={countLowStockVariants(productsForStock ?? [])}
      handedToday={(handedToday ?? []) as HandedOutOrder[]}
    />
  )
}
