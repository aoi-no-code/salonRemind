import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabaseAdmin'
import { getAuthUserFromRequest } from '@/lib/auth'

type ReminderKind = '7d_before' | '1d_before'

export async function GET(request: NextRequest) {
  try {
    const user = await getAuthUserFromRequest(request)
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    // 店舗解決（/api/reminders/overview と同様のロジック）
    let storeId: string | null = null
    {
      const { data: byUser } = await supabaseAdmin
        .from('stores')
        .select('id')
        .eq('user_id', user.id)
        .single()
      if (byUser?.id) storeId = byUser.id
    }
    if (!storeId && user.email) {
      const { data: byEmail } = await supabaseAdmin
        .from('stores')
        .select('id')
        .eq('email', user.email)
        .single()
      if (byEmail?.id) storeId = byEmail.id
    }
    if (!storeId) {
      const { data: firstStore } = await supabaseAdmin
        .from('stores')
        .select('id')
        .limit(1)
        .single()
      if (firstStore?.id) storeId = firstStore.id
    }
    if (!storeId) return NextResponse.json({ error: 'Store not found' }, { status: 404 })

    const nowIso = new Date().toISOString()

    // 店舗の今後の予約を顧客単位で収集
    const { data: reservations, error: reservationsError } = await supabaseAdmin
      .from('reservations')
      .select(`
        id,
        start_at,
        status,
        customers:customers(id, display_name, phone_number)
      `)
      .eq('store_id', storeId)
      .in('status', ['scheduled', 'visit_planned'])
      .gte('start_at', nowIso)
      .order('start_at', { ascending: true })

    if (reservationsError) {
      return NextResponse.json({ error: 'Failed to fetch reservations' }, { status: 500 })
    }

    type CustomerRow = {
      customerId: string
      customerName: string | null
      phoneNumber: string | null
      nextReservationAt: string | null
      reservationId: string | null
      status?: string | null
    }

    const perCustomer = new Map<string, CustomerRow>()

    for (const r of reservations as any[]) {
      const custRel = Array.isArray(r.customers) ? r.customers[0] : r.customers
      const cId: string | undefined = custRel?.id
      if (!cId) continue
      const existing = perCustomer.get(cId)
      const nextAt = r.start_at as string
      if (!existing) {
        perCustomer.set(cId, {
          customerId: cId,
          customerName: custRel?.display_name || null,
          phoneNumber: custRel?.phone_number || null,
          nextReservationAt: nextAt,
          reservationId: r.id as string,
          status: r.status as string | null,
        })
      } else {
        // 既にあるものより早い予約があれば更新
        if (existing.nextReservationAt && nextAt < existing.nextReservationAt) {
          existing.nextReservationAt = nextAt
          existing.reservationId = r.id as string
          existing.status = r.status as string | null
        }
      }
    }

    const rows = Array.from(perCustomer.values())

    // リマインド送信済み状況を取得
    const reservationIds = rows.map(r => r.reservationId).filter(Boolean) as string[]
    let sent7d = new Set<string>()
    let sent1d = new Set<string>()
    if (reservationIds.length > 0) {
      const { data: logs7d } = await supabaseAdmin
        .from('reminder_logs')
        .select('reservation_id,status,kind')
        .in('reservation_id', reservationIds)
        .eq('kind', '7d_before')
        .eq('status', 'sent')
      if (logs7d) sent7d = new Set(logs7d.map((l: any) => l.reservation_id))

      const { data: logs1d } = await supabaseAdmin
        .from('reminder_logs')
        .select('reservation_id,status,kind')
        .in('reservation_id', reservationIds)
        .eq('kind', '1d_before')
        .eq('status', 'sent')
      if (logs1d) sent1d = new Set(logs1d.map((l: any) => l.reservation_id))
    }

    const result = rows.map(r => ({
      customerId: r.customerId,
      customerName: r.customerName,
      phoneNumber: r.phoneNumber,
      nextReservationAt: r.nextReservationAt,
      status: r.status || 'scheduled',
      sent7d: r.reservationId ? sent7d.has(r.reservationId) : false,
      sent1d: r.reservationId ? sent1d.has(r.reservationId) : false,
    }))

    return NextResponse.json({ customers: result })
  } catch (e) {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}


