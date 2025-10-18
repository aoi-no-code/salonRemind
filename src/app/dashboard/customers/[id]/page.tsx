import CustomerDetailClient from './CustomerDetailClient'
import { use } from 'react'

export default function DashboardCustomerDetail(props: any) {
  const awaited = use(props.params as Promise<{ id: string }>) as { id: string }
  const customerId = awaited.id
  return <CustomerDetailClient customerId={customerId} />
}


