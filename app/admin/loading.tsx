import { Suspense } from 'react'
import AdminShell from '@/components/AdminShell'
import { AdminSkeletonBody } from '@/components/PageSkeleton'

// Меню админки видно сразу, данные подгружаются следом. AdminShell читает
// searchParams, поэтому при предварительном рендере ему нужна граница Suspense.
export default function Loading() {
  return (
    <Suspense fallback={<AdminSkeletonBody />}>
      <AdminShell adminEmail="" title="Загрузка…">
        <AdminSkeletonBody />
      </AdminShell>
    </Suspense>
  )
}
