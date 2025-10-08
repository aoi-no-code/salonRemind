import ReservationDetailClient from './ReservationDetailClient'
import { use } from 'react'

export default function StoreReservationDetail({ params }: { params: Promise<{ id: string }> }) {
  const awaited = use(params)
  const reservationId = awaited.id
  return <ReservationDetailClient reservationId={reservationId} />
}


