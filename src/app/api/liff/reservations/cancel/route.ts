import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabaseAdmin'
import { z } from 'zod'

const BodySchema = z.object({
  reservationId: z.string().uuid(),
  lineUserId: z.string().min(10)
})

export async function POST(request: NextRequest) {
  try {
    const json = await request.json().catch(() => ({}))
    const { reservationId, lineUserId } = BodySchema.parse(json)

    // 予約の本人確認
    const { data: reservation, error: reservationError } = await supabaseAdmin
      .from('reservations')
      .select('id, status, customers:customers(line_user_id)')
      .eq('id', reservationId)
      .single()

    if (reservationError || !reservation) {
      return NextResponse.json({ error: '予約が見つかりません。' }, { status: 404 })
    }

    const customerRel: any = Array.isArray((reservation as any).customers)
      ? (reservation as any).customers[0]
      : (reservation as any).customers

    if (!customerRel || customerRel.line_user_id !== lineUserId) {
      return NextResponse.json({ error: '権限がありません。' }, { status: 403 })
    }

    // 状態チェック（scheduledのみキャンセル可能）
    if ((reservation as any).status !== 'scheduled') {
      return NextResponse.json({ error: 'この予約はキャンセルできません。' }, { status: 400 })
    }

    const { error: updateError } = await supabaseAdmin
      .from('reservations')
      .update({ status: 'cancelled' })
      .eq('id', reservationId)

    if (updateError) {
      console.error('キャンセル更新エラー:', updateError)
      return NextResponse.json({ error: '更新に失敗しました。' }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (e: any) {
    console.error('LIFF cancel API error:', e)
    const message = typeof e?.message === 'string' ? e.message : '不正なリクエストです。'
    return NextResponse.json({ error: message }, { status: 400 })
  }
}


