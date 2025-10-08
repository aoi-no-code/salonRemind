import ReservationDetailClient from './ReservationDetailClient'
import { use } from 'react'

export default function StoreReservationDetail({ params }: any) {
  const awaited = use(params as Promise<{ id: string }>) as { id: string }
  const reservationId = awaited.id
  return <ReservationDetailClient reservationId={reservationId} />
}


