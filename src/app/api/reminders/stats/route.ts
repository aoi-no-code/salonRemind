import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabaseAdmin'
import { getAuthUserFromRequest } from '@/lib/auth'
import { toJst } from '@/lib/time'

function getJstMonthUtcBounds(d: Date) {
  const jst = toJst(d)
  const y = jst.getFullYear()
  const m0 = jst.getMonth()
  const startThisUtc = new Date(Date.UTC(y, m0, 1, -9, 0, 0))
  const startNextUtc = new Date(Date.UTC(y, m0 + 1, 1, -9, 0, 0))
  const startNextNextUtc = new Date(Date.UTC(y, m0 + 2, 1, -9, 0, 0))
  return {
    thisStartIso: startThisUtc.toISOString(),
    nextStartIso: startNextUtc.toISOString(),
    nextNextStartIso: startNextNextUtc.toISOString(),
  }
}

export async function GET(request: Request) {
  try {
    const user = await getAuthUserFromRequest(request)
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    // 店舗解決（他APIと同様のロジック）
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

    const { thisStartIso, nextStartIso, nextNextStartIso } = getJstMonthUtcBounds(new Date())

    const [{ count: thisCount, error: e1 }, { count: nextCount, error: e2 }] = await Promise.all([
      supabaseAdmin
        .from('reservations')
        .select('id', { count: 'exact', head: true })
        .eq('store_id', storeId)
        .in('status', ['scheduled', 'visit_planned'])
        .gte('start_at', thisStartIso)
        .lt('start_at', nextStartIso),
      supabaseAdmin
        .from('reservations')
        .select('id', { count: 'exact', head: true })
        .eq('store_id', storeId)
        .in('status', ['scheduled', 'visit_planned'])
        .gte('start_at', nextStartIso)
        .lt('start_at', nextNextStartIso)
    ])

    if (e1 || e2) return NextResponse.json({ error: 'Failed to fetch stats' }, { status: 500 })

    return NextResponse.json({
      thisMonth: thisCount || 0,
      nextMonth: nextCount || 0,
    })
  } catch (e) {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}


