import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabaseAdmin'
import { lineClient } from '@/lib/line'
import * as line from '@line/bot-sdk'
import { z } from 'zod'

const PostbackDataSchema = z.object({
  remind: z.enum(['visit', 'change', 'cancel']),
  rid: z.string().uuid()
})

export async function POST(request: NextRequest) {
  try {
    const body = await request.text()
    const signature = request.headers.get('x-line-signature')
    
    if (!signature) {
      console.error('LINE signature not found')
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    
    // 署名検証
    const valid = line.validateSignature(
      body,
      process.env.LINE_CHANNEL_SECRET!,
      signature
    )
    if (!valid) {
      console.error('LINE signature verification failed')
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    
    const events: line.WebhookEvent[] = JSON.parse(body).events
    
    for (const event of events) {
      if (event.type === 'postback') {
        await handlePostback(event)
      }
    }
    
    return NextResponse.json({ success: true })
    
  } catch (error) {
    console.error('LINE webhook error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

async function handlePostback(event: line.PostbackEvent) {
  try {
    const userId = event.source.userId
    if (!userId) {
      console.error('User ID not found in postback event')
      return
    }
    
    // postback dataをパース
    const data = new URLSearchParams(event.postback.data)
    const parsed = PostbackDataSchema.parse({
      remind: data.get('remind'),
      rid: data.get('rid')
    })
    
    console.log(`Postback received: ${parsed.remind} for reservation ${parsed.rid} by user ${userId}`)
    
    // 予約情報を取得
    const { data: reservation, error: reservationError } = await supabaseAdmin
      .from('reservations')
      .select(`
        id,
        status,
        customers!inner(line_user_id),
        stores!inner(phone_number)
      `)
      .eq('id', parsed.rid)
      .single()
    
    if (reservationError || !reservation) {
      console.error('予約取得エラー:', reservationError)
      await sendReply(event.replyToken, '予約が見つかりませんでした。')
      return
    }
    
    // 本人確認（リレーションが単一/配列どちらでも扱えるようにする）
    const customerRel: any = Array.isArray((reservation as any).customers)
      ? (reservation as any).customers[0]
      : (reservation as any).customers
    if (!customerRel || customerRel.line_user_id !== userId) {
      console.error('本人確認失敗:', userId, customerRel?.line_user_id)
      await sendReply(event.replyToken, 'この予約を変更する権限がありません。')
      return
    }
    
    // 既に処理済みかチェック
    if (parsed.remind === 'visit' && reservation.status === 'scheduled') {
      // 予約は元々 scheduled のため重複チェックはスキップしても良いが、
      // 連打抑止のため一応メッセージを返す
      await sendReply(event.replyToken, 'ご来店予定のご回答ありがとうございます。ご来店をお待ちしております。')
      return
    }
    if (parsed.remind === 'change' && reservation.status === 'change_requested') {
      await sendReply(event.replyToken, '変更希望は既に受け付けています。店舗からご連絡をお待ちください。')
      return
    }
    
    if (parsed.remind === 'cancel' && reservation.status === 'cancelled') {
      await sendReply(event.replyToken, 'この予約は既にキャンセルされています。')
      return
    }
    
    // ステータス更新
    let newStatus: string
    let replyMessage: string
    
    if (parsed.remind === 'visit') {
      newStatus = 'scheduled'
      replyMessage = 'ご来店予定のご回答ありがとうございます。ご来店をお待ちしております。'
    } else if (parsed.remind === 'change') {
      newStatus = 'change_requested'
      const storeRel: any = Array.isArray((reservation as any).stores)
        ? (reservation as any).stores[0]
        : (reservation as any).stores
      replyMessage = `変更希望を受け付けました。\nお手数ですが店舗（TEL: ${storeRel?.phone_number || '不明'}）までお電話ください。`
    } else {
      newStatus = 'cancelled'
      replyMessage = 'キャンセルを承りました。\nまたのご利用をお待ちしております。'
    }
    
    const { error: updateError } = await supabaseAdmin
      .from('reservations')
      .update({ status: newStatus })
      .eq('id', parsed.rid)
    
    if (updateError) {
      console.error('予約更新エラー:', updateError)
      await sendReply(event.replyToken, '処理中にエラーが発生しました。お手数ですが店舗までお電話ください。')
      return
    }
    
    // 返信送信
    await sendReply(event.replyToken, replyMessage)
    
    console.log(`予約${parsed.remind}処理完了: ${parsed.rid}`)
    
  } catch (error) {
    console.error('Postback処理エラー:', error)
    try {
      await sendReply(event.replyToken, '処理中にエラーが発生しました。お手数ですが店舗までお電話ください。')
    } catch (replyError) {
      console.error('返信送信エラー:', replyError)
    }
  }
}

async function sendReply(replyToken: string, message: string) {
  try {
    await lineClient.replyMessage(replyToken, {
      type: 'text',
      text: message
    })
  } catch (error) {
    console.error('返信送信エラー:', error)
    throw error
  }
}
