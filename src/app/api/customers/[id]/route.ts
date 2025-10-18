import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabaseAdmin'
import { getAuthUserFromRequest } from '@/lib/auth'

export async function GET(request: Request, context: any) {
  try {
    const params = (context as any)?.params as { id: string }
    const user = await getAuthUserFromRequest(request)
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    // 店舗権限に関しては、顧客が同店舗の予約を持つものに限定して取得
    const customerId = params?.id

    // 顧客情報
    const { data: customer, error: customerError } = await supabaseAdmin
      .from('customers')
      .select('id, display_name, phone_number, line_user_id')
      .eq('id', customerId)
      .single()

    if (customerError || !customer) {
      return NextResponse.json({ error: 'Customer not found' }, { status: 404 })
    }

    // 顧客の予約一覧（近日順）
    const { data: reservations, error: reservationsError } = await supabaseAdmin
      .from('reservations')
      .select(`
        id,
        start_at,
        duration_min,
        status,
        note,
        stores:stores(name)
      `)
      .eq('customer_id', customerId)
      .order('start_at', { ascending: true })

    if (reservationsError) {
      return NextResponse.json({ error: 'Failed to fetch reservations' }, { status: 500 })
    }

    const formatted = (reservations || []).map((r: any) => ({
      id: r.id as string,
      startAt: r.start_at as string,
      durationMin: r.duration_min as number | null,
      status: r.status as string,
      note: r.note as string | null,
      storeName: (Array.isArray(r.stores) ? r.stores[0]?.name : r.stores?.name) || null
    }))

    return NextResponse.json({
      customerId: customer.id,
      customerName: (customer as any).display_name || null,
      phoneNumber: (customer as any).phone_number || null,
      lineUserId: (customer as any).line_user_id || null,
      reservations: formatted
    })
  } catch (e) {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}


