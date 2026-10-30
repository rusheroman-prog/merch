import { countStockAlerts } from '@/lib/stockAlerts'
import { requireAdmin } from '@/lib/session'
import AdminEmployeesClient, { type DirectoryEmployee } from './AdminEmployeesClient'

export default async function AdminEmployeesPage() {
  const { supabase, user } = await requireAdmin()

  const [{ data: directoryData, error: directoryError }, { data: ordersData }, stockAlertCount] =
    await Promise.all([
      supabase
        .from('employee_directory')
        .select('id, email, full_name, business_unit, position, hired_at, is_active, created_at, updated_at')
        .order('full_name', { ascending: true }),
      supabase
        .from('orders')
        .select('id'),
      countStockAlerts(supabase),
    ])

  if (directoryError) {
    return (
      <main className="page-error">
        <section className="error-card">
          <div className="error-card-icon">!</div>
          <h1 className="error-title">Не удалось загрузить сотрудников</h1>
          <p className="error-text">{directoryError.message}</p>
        </section>
      </main>
    )
  }


  return (
    <AdminEmployeesClient
      employees={(directoryData ?? []) as DirectoryEmployee[]}
      adminEmail={user.email ?? ''}
      orderCount={ordersData?.length ?? 0}
      stockAlertCount={stockAlertCount}
    />
  )
}
