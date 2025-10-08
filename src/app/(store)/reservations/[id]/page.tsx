import ReservationDetailClient from './ReservationDetailClient'

export default async function StoreReservationDetail({ params }: { params: { id: string } }) {
  const reservationId = params.id
  return <ReservationDetailClient reservationId={reservationId} />
}


