import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabaseAdmin'
import { lineClient } from '@/lib/line'
import { formatJst } from '@/lib/time'
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
        const dataStr = event.postback?.data || ''
        if (dataStr.includes('action=view_reservations') || dataStr.includes('menu=reservations')) {
          await handleViewReservations(event)
        } else {
          await handlePostback(event)
        }
      } else if (event.type === 'follow') {
        await handleFollow(event)
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
    
    // LIFF以外からの変更/キャンセルは不可にする
    if (parsed.remind === 'change' || parsed.remind === 'cancel') {
      const liffUrl = process.env.NEXT_PUBLIC_LIFF_ID
        ? `https://liff.line.me/${process.env.NEXT_PUBLIC_LIFF_ID}?view=reservations`
        : undefined
      const guide = liffUrl
        ? `変更・キャンセルはLIFFアプリ内からのみ可能です。\n下のリンクを開いてお手続きください。\n${liffUrl}`
        : '変更・キャンセルはLIFFアプリ内からのみ可能です。LIFFアプリ内の予約画面からお手続きください。'
      await sendReply(event.replyToken, guide)
      return
    }

    // 来店予定: visit_planned へ更新
    if (parsed.remind === 'visit') {
      const { error: updateError } = await supabaseAdmin
        .from('reservations')
        .update({ status: 'visit_planned' })
        .eq('id', parsed.rid)

      if (updateError) {
        console.error('visit_planned 更新エラー:', updateError)
        await sendReply(event.replyToken, '処理中にエラーが発生しました。お手数ですが店舗までお電話ください。')
        return
      }

      await sendReply(event.replyToken, '「来店予定」を受け付けました。\n前日にもリマインドをお送りします。\n当日のご来店をお待ちしております。')
      console.log(`予約visit_planned更新完了: ${parsed.rid}`)
      return
    }
    
  } catch (error: any) {
    console.error('Postback処理エラー:', error?.response?.data || error)
    try {
      await sendReply(event.replyToken, '処理中にエラーが発生しました。お手数ですが店舗までお電話ください。')
    } catch (replyError) {
      console.error('返信送信エラー:', replyError)
    }
  }
}

async function handleFollow(event: line.FollowEvent) {
  try {
    const userId = event.source.userId
    if (!userId) {
      console.error('User ID not found in follow event')
      return
    }

    // 未配信の保留を取得
    const { data: pendings, error } = await supabaseAdmin
      .from('line_outbox')
      .select('id, message')
      .eq('line_user_id', userId)
      .eq('status', 'pending')

    if (error) {
      console.error('line_outbox取得エラー:', error)
      return
    }

    // ウェルカムメッセージ
    try {
      await lineClient.pushMessage(userId, {
        type: 'text',
        text: '友だち追加ありがとうございます。直近のご予約情報をお送りします。'
      } as any)
    } catch (welcomeError) {
      console.error('welcome push 失敗:', welcomeError)
    }

    if (!pendings || pendings.length === 0) return

    for (const p of pendings) {
      try {
        await lineClient.pushMessage(userId, (p as any).message)
        await supabaseAdmin
          .from('line_outbox')
          .update({ status: 'sent', sent_at: new Date().toISOString(), last_error: null })
          .eq('id', (p as any).id)
      } catch (e: any) {
        const errorText = typeof e?.message === 'string' ? e.message : JSON.stringify(e)
        await supabaseAdmin
          .from('line_outbox')
          .update({ status: 'failed', last_error: errorText, attempted_at: new Date().toISOString() })
          .eq('id', (p as any).id)
      }
    }
  } catch (err) {
    console.error('Follow処理エラー:', err)
  }
}

async function handleViewReservations(event: line.PostbackEvent) {
  try {
    const userId = event.source.userId
    if (!userId) return

    // 直近の予約を3件まで取得
    const { data: reservations, error } = await supabaseAdmin
      .from('reservations')
      .select(`id, start_at, duration_min, status, stores:stores(name)`) // storesは配列の可能性に注意
      .in('status', ['scheduled', 'visit_planned'])
      .order('start_at', { ascending: true })
      .limit(3)
      .eq('customers.line_user_id', userId) as any

    if (error) {
      console.error('予約取得エラー(view_reservations):', error)
      await sendReply(event.replyToken, '予約情報の取得に失敗しました。')
      return
    }

    if (!reservations || reservations.length === 0) {
      await sendReply(event.replyToken, '現在、今後のご予約はありません。')
      return
    }

    const bubbles = (reservations as any[]).map((r) => {
      const storeRel = Array.isArray(r.stores) ? r.stores[0] : r.stores
      return {
        type: 'bubble',
        body: {
          type: 'box',
          layout: 'vertical',
          spacing: 'sm',
          contents: [
            { type: 'text', text: storeRel?.name || '店舗', weight: 'bold', size: 'md' },
            { type: 'text', text: `${formatJst(r.start_at)} 〜 ${r.duration_min}分`, size: 'sm', color: '#333333', wrap: true }
          ]
        }
      } as any
    })

    const message: any = {
      type: 'flex',
      altText: 'ご予約一覧',
      contents: bubbles.length === 1 ? bubbles[0] : { type: 'carousel', contents: bubbles }
    }

    await lineClient.pushMessage(userId, message)
  } catch (e) {
    console.error('handleViewReservations error:', e)
    try { await sendReply(event.replyToken, 'エラーが発生しました。') } catch {}
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
