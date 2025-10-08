import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabaseAdmin'
import { z } from 'zod'

const QuerySchema = z.object({
  lineUserId: z.string()
})

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const validatedQuery = QuerySchema.parse({
      lineUserId: searchParams.get('lineUserId')
    })
    
    // 顧客の予約一覧を取得（近日順）
    const { data: reservations, error } = await supabaseAdmin
      .from('reservations')
      .select(`
        id,
        start_at,
        duration_min,
        status,
        note,
        stores!inner(name)
      `)
      .eq('customers.line_user_id', validatedQuery.lineUserId)
      .order('start_at', { ascending: true })
    
    if (error) {
      console.error('予約一覧取得エラー:', error)
      return NextResponse.json({ 
        error: '予約一覧の取得に失敗しました。' 
      }, { status: 500 })
    }
    
    // レスポンス用にデータを整形
    const formattedReservations = reservations?.map(reservation => ({
      id: reservation.id,
      startAt: reservation.start_at,
      durationMin: reservation.duration_min,
      status: reservation.status,
      note: reservation.note,
      storeName: reservation.stores.name
    })) || []
    
    return NextResponse.json({ 
      success: true,
      reservations: formattedReservations
    })
    
  } catch (error) {
    console.error('予約一覧API エラー:', error)
    
    if (error instanceof z.ZodError) {
      return NextResponse.json({ 
        error: 'パラメータが正しくありません。',
        details: error.errors 
      }, { status: 400 })
    }
    
    return NextResponse.json({ 
      error: 'Internal server error' 
    }, { status: 500 })
  }
}
