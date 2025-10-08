import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { supabaseAdmin } from '@/lib/supabaseAdmin'

const BodySchema = z.object({
  reservationId: z.string().uuid(),
  token: z.string().min(10),
  lineUserId: z.string().min(10),
})

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { reservationId, token, lineUserId } = BodySchema.parse(body)

    // 予約取得（リンク項目と顧客）
    const { data: reservation, error: reservationError } = await supabaseAdmin
      .from('reservations')
      .select('id, customer_id, link_token, link_status, link_expires_at')
      .eq('id', reservationId)
      .single()

    if (reservationError || !reservation) {
      return NextResponse.json({ ok: false, message: '予約が見つかりません。' }, { status: 404 })
    }

    // 既にリンク済みなら冪等に成功返す
    if (reservation.link_status === 'linked') {
      return NextResponse.json({ ok: true, message: '既に連携済みです。' })
    }

    // トークン検証
    if (!reservation.link_token || reservation.link_token !== token) {
      return NextResponse.json({ ok: false, message: '無効なトークンです。' }, { status: 400 })
    }
    const expiresAt = reservation.link_expires_at ? new Date(reservation.link_expires_at) : null
    if (!expiresAt || expiresAt.getTime() <= Date.now()) {
      return NextResponse.json({ ok: false, message: 'トークンの有効期限が切れています。' }, { status: 400 })
    }

    // 顧客のLINE ID確認/更新
    if (reservation.customer_id) {
      const { data: customer, error: customerError } = await supabaseAdmin
        .from('customers')
        .select('id, line_user_id')
        .eq('id', reservation.customer_id)
        .single()
      if (customerError || !customer) {
        return NextResponse.json({ ok: false, message: '顧客が見つかりません。' }, { status: 404 })
      }

      if (!customer.line_user_id) {
        const { error: updateCustomerError } = await supabaseAdmin
          .from('customers')
          .update({ line_user_id: lineUserId })
          .eq('id', reservation.customer_id)
        if (updateCustomerError) {
          return NextResponse.json({ ok: false, message: '顧客の更新に失敗しました。' }, { status: 500 })
        }
      } else if (customer.line_user_id !== lineUserId) {
        return NextResponse.json({ ok: false, message: '別のLINEアカウントと既に連携済みです。' }, { status: 409 })
      }
    }

    // 予約のリンク状態をlinkedに更新し、トークンを無効化
    const { error: updateReservationError } = await supabaseAdmin
      .from('reservations')
      .update({ link_status: 'linked', link_token: null })
      .eq('id', reservationId)
    if (updateReservationError) {
      return NextResponse.json({ ok: false, message: '予約の更新に失敗しました。' }, { status: 500 })
    }

    return NextResponse.json({ ok: true })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ ok: false, message: '入力が不正です', details: error.issues }, { status: 400 })
    }
    console.error('link confirm error:', error)
    return NextResponse.json({ ok: false, message: 'Internal server error' }, { status: 500 })
  }
}


