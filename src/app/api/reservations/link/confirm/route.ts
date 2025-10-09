import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { supabaseAdmin } from '@/lib/supabaseAdmin'
import { lineClient } from '@/lib/line'
import * as line from '@line/bot-sdk'
import { formatJst } from '@/lib/time'

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
      .select('id, customer_id, link_token, link_status, link_expires_at, start_at, duration_min, stores!inner(name, address, phone_number)')
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

    // 連携完了のPush（Flex）を送信
    try {
      const liffId = process.env.NEXT_PUBLIC_LIFF_ID
      const deeplinkUrl = liffId ? `https://liff.line.me/${liffId}?view=reservations` : undefined

      const storeRel: any = Array.isArray((reservation as any).stores)
        ? (reservation as any).stores[0]
        : (reservation as any).stores
      const storeName: string | undefined = storeRel?.name
      const storeAddress: string | undefined = storeRel?.address
      const storePhone: string | undefined = storeRel?.phone_number
      const startAt = reservation.start_at ? formatJst(reservation.start_at) : undefined
      const duration = reservation.duration_min

      const detailLines: string[] = []
      if (storeName) detailLines.push(`店舗: ${storeName}`)
      if (storeAddress) detailLines.push(`住所: ${storeAddress}`)
      if (storePhone) detailLines.push(`電話: ${storePhone}`)
      if (startAt) detailLines.push(`日時: ${startAt} 〜 ${duration ?? ''}分`)

      const flex: line.FlexMessage = {
        type: 'flex',
        altText: '予約の連携が完了しました',
        contents: {
          type: 'bubble',
          body: {
            type: 'box',
            layout: 'vertical',
            spacing: 'md',
            contents: [
              { type: 'text', text: '連携が完了しました', weight: 'bold', size: 'md' },
              ...(detailLines.length > 0
                ? [{ type: 'text', text: detailLines.join('\n'), wrap: true, size: 'sm', color: '#333333' } as any]
                : []),
              { type: 'text', text: '「予約を確認する」から詳細を確認できます。', wrap: true, size: 'sm', color: '#555555' }
            ]
          },
          footer: {
            type: 'box',
            layout: 'vertical',
            spacing: 'sm',
            contents: [
              deeplinkUrl
                ? { type: 'button', style: 'primary', action: { type: 'uri', label: '予約を確認する', uri: deeplinkUrl } }
                : { type: 'button', style: 'primary', action: { type: 'uri', label: '予約を確認する', uri: 'https://liff.line.me' } },
            ]
          }
        }
      }

      await lineClient.pushMessage(lineUserId, flex)
    } catch (pushError) {
      console.error('Push送信エラー（連携完了通知）:', pushError)
      // Push失敗は致命ではないため、API自体は成功を返す
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


