import CustomerDetailClient from './CustomerDetailClient'
import { use } from 'react'
import RequireAuth from '@/components/RequireAuth'

export default function DashboardCustomerDetail(props: any) {
  const awaited = use(props.params as Promise<{ id: string }>) as { id: string }
  const customerId = awaited.id
  return (
    <RequireAuth>
      <CustomerDetailClient customerId={customerId} />
    </RequireAuth>
  )
}


