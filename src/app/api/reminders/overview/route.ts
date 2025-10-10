import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabaseAdmin'
import { getAuthUserFromRequest } from '@/lib/auth'

type ReminderKind = '7d_before' | '1d_before'

function subtractDays(dateIso: string, days: number): Date {
  const d = new Date(dateIso)
  d.setDate(d.getDate() - days)
  return d
}

export async function GET(request: NextRequest) {
  try {
    const user = await getAuthUserFromRequest(request)
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // 店舗解決（/api/stores/me のロジックを踏襲）
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
    if (!storeId) {
      return NextResponse.json({ error: 'Store not found' }, { status: 404 })
    }

    const now = new Date()

    // 予約取得（今後の予約のみ）
    const { data: reservationsRaw, error: reservationsError } = await supabaseAdmin
      .from('reservations')
      .select(`
        id,
        start_at,
        status,
        customers:customers(display_name)
      `)
      .eq('store_id', storeId)
      .eq('status', 'scheduled')
      .gte('start_at', now.toISOString())
      .order('start_at', { ascending: true })

    if (reservationsError) {
      return NextResponse.json({ error: 'Failed to fetch reservations' }, { status: 500 })
    }

    const reservations = (reservationsRaw || []).map((r: any) => ({
      reservationId: r.id as string,
      startAt: r.start_at as string,
      customerName: (Array.isArray(r.customers) ? r.customers[0]?.display_name : r.customers?.display_name) || null as string | null,
    }))

    const reservationIds = reservations.map(r => r.reservationId)

    // 既送信ログ（今後の重複回避用）
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

    // 送信予定（未来時刻のみ、未送信のもの）
    const schedule: Array<{
      kind: ReminderKind
      reservationId: string
      reservationStartAt: string
      sendAt: string
      customerName: string | null
    }> = []

    for (const r of reservations) {
      const sendAt7 = subtractDays(r.startAt, 7)
      if (sendAt7 >= now && !sent7d.has(r.reservationId)) {
        schedule.push({
          kind: '7d_before',
          reservationId: r.reservationId,
          reservationStartAt: r.startAt,
          sendAt: sendAt7.toISOString(),
          customerName: r.customerName,
        })
      }
      const sendAt1 = subtractDays(r.startAt, 1)
      if (sendAt1 >= now && !sent1d.has(r.reservationId)) {
        schedule.push({
          kind: '1d_before',
          reservationId: r.reservationId,
          reservationStartAt: r.startAt,
          sendAt: sendAt1.toISOString(),
          customerName: r.customerName,
        })
      }
    }
    schedule.sort((a, b) => a.sendAt.localeCompare(b.sendAt))

    // 履歴（直近300件）
    const { data: logsRaw, error: logsError } = await supabaseAdmin
      .from('reminder_logs')
      .select(`
        id,
        reservation_id,
        kind,
        channel,
        status,
        error,
        attempted_at,
        reservations!inner(start_at, customers:customers(display_name), store_id)
      `)
      .eq('reservations.store_id', storeId)
      .order('attempted_at', { ascending: false })
      .limit(300)

    if (logsError) {
      return NextResponse.json({ error: 'Failed to fetch reminder logs' }, { status: 500 })
    }

    const history = (logsRaw || []).map((l: any) => {
      const custRel: any = Array.isArray(l.reservations?.customers) ? l.reservations.customers[0] : l.reservations?.customers
      return {
        id: l.id as string,
        reservationId: l.reservation_id as string,
        kind: l.kind as ReminderKind,
        channel: l.channel as string,
        status: l.status as string,
        error: l.error as string | null,
        attemptedAt: l.attempted_at as string,
        reservationStartAt: l.reservations?.start_at as string,
        customerName: custRel?.display_name || null as string | null,
      }
    })

    return NextResponse.json({ storeId, schedule, history })
  } catch (e) {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}


