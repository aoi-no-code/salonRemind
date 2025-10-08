import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabaseAdmin'
import { lineClient } from '@/lib/line'
import { formatJst, getJstDate, formatJstDate } from '@/lib/time'

export async function GET(request: NextRequest) {
  try {
    const today = new Date()
    
    // 1週間後の予約を取得
    const oneWeekLater = getJstDate(today, 7)
    const oneWeekLaterStr = formatJstDate(oneWeekLater)
    
    // 明日の予約を取得
    const tomorrow = getJstDate(today, 1)
    const tomorrowStr = formatJstDate(tomorrow)
    
    console.log(`リマインド配信開始: 1週間後=${oneWeekLaterStr}, 明日=${tomorrowStr}`)
    
    // 1週間後の予約を取得
    const { data: oneWeekReservations, error: oneWeekError } = await supabaseAdmin
      .rpc('get_reservations_on_date_with_customer', {
        target_date: oneWeekLaterStr
      })
    
    if (oneWeekError) {
      console.error('1週間後予約取得エラー:', oneWeekError)
    }
    
    // 明日の予約を取得
    const { data: tomorrowReservations, error: tomorrowError } = await supabaseAdmin
      .rpc('get_reservations_on_date_with_customer', {
        target_date: tomorrowStr
      })
    
    if (tomorrowError) {
      console.error('明日予約取得エラー:', tomorrowError)
    }
    
    // 1週間前リマインド送信（ボタン付き）
    if (oneWeekReservations && oneWeekReservations.length > 0) {
      for (const reservation of oneWeekReservations) {
        if (!reservation.line_user_id) continue
        
        const message = {
          type: 'template',
          altText: `【1週間前リマインド】\n${formatJst(reservation.start_at)} に ${reservation.store_name} のご予約があります。`,
          template: {
            type: 'buttons',
            text: `【1週間前リマインド】\n${formatJst(reservation.start_at)} に ${reservation.store_name} のご予約があります。`,
            actions: [
              {
                type: 'postback',
                label: '時間を変更したい',
                data: `remind=change&rid=${reservation.reservation_id}`
              },
              {
                type: 'postback',
                label: 'キャンセルしたい',
                data: `remind=cancel&rid=${reservation.reservation_id}`
              }
            ]
          }
        }
        
        try {
          await lineClient.pushMessage(reservation.line_user_id, message)
          console.log(`1週間前リマインド送信完了: ${reservation.line_user_id}`)
        } catch (error) {
          console.error(`1週間前リマインド送信エラー: ${reservation.line_user_id}`, error)
        }
      }
    }
    
    // 前日リマインド送信（テキストのみ）
    if (tomorrowReservations && tomorrowReservations.length > 0) {
      for (const reservation of tomorrowReservations) {
        if (!reservation.line_user_id) continue
        
        const message = {
          type: 'text',
          text: `【前日リマインド】\n明日 ${formatJst(reservation.start_at)} に ${reservation.store_name} のご予約があります。\n変更・キャンセルはリマインドのボタン、またはお電話でお願いします。`
        }
        
        try {
          await lineClient.pushMessage(reservation.line_user_id, message)
          console.log(`前日リマインド送信完了: ${reservation.line_user_id}`)
        } catch (error) {
          console.error(`前日リマインド送信エラー: ${reservation.line_user_id}`, error)
        }
      }
    }
    
    return NextResponse.json({ 
      success: true, 
      oneWeekCount: oneWeekReservations?.length || 0,
      tomorrowCount: tomorrowReservations?.length || 0
    })
    
  } catch (error) {
    console.error('リマインド配信エラー:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
