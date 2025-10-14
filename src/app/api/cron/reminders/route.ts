import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabaseAdmin'
import { lineClient } from '@/lib/line'
import { formatJst, getJstDate, formatJstDate, getUtcBoundsForJstDate } from '@/lib/time'

export async function GET(request: NextRequest) {
  try {
    const today = new Date()
    const CHANNEL = 'line'
    
    // 1週間後の予約を取得
    const oneWeekLater = getJstDate(today, 7)
    const oneWeekLaterStr = formatJstDate(oneWeekLater)
    
    // 明日の予約を取得
    const tomorrow = getJstDate(today, 1)
    const tomorrowStr = formatJstDate(tomorrow)
    
    console.log(`リマインド配信開始: 1週間後=${oneWeekLaterStr}, 明日=${tomorrowStr}`)
    
    // 1週間後の予約を取得（テーブル結合で取得）
    const oneWeekBounds = getUtcBoundsForJstDate(oneWeekLater)
    const { data: oneWeekRaw, error: oneWeekError } = await supabaseAdmin
      .from('reservations')
      .select(`
        id,
        start_at,
        status,
        stores:stores(name),
        customers:customers(line_user_id)
      `)
      .in('status', ['scheduled', 'visit_planned'])
      .gte('start_at', oneWeekBounds.startIso)
      .lt('start_at', oneWeekBounds.endIso)
      .order('start_at', { ascending: true })
    const oneWeekReservations = (oneWeekRaw || []).map((r: any) => ({
      reservation_id: r.id,
      start_at: r.start_at,
      store_name: r.stores?.name ?? '',
      line_user_id: r.customers?.line_user_id ?? null
    }))
    
    if (oneWeekError) {
      console.error('1週間後予約取得エラー:', oneWeekError)
    }
    
    // 明日の予約を取得（テーブル結合で取得）
    const tomorrowBounds = getUtcBoundsForJstDate(tomorrow)
    const { data: tomorrowRaw, error: tomorrowError } = await supabaseAdmin
      .from('reservations')
      .select(`
        id,
        start_at,
        status,
        stores:stores(name),
        customers:customers(line_user_id)
      `)
      .in('status', ['scheduled', 'visit_planned'])
      .gte('start_at', tomorrowBounds.startIso)
      .lt('start_at', tomorrowBounds.endIso)
      .order('start_at', { ascending: true })
    const tomorrowReservations = (tomorrowRaw || []).map((r: any) => ({
      reservation_id: r.id,
      start_at: r.start_at,
      store_name: r.stores?.name ?? '',
      line_user_id: r.customers?.line_user_id ?? null
    }))
    
    if (tomorrowError) {
      console.error('明日予約取得エラー:', tomorrowError)
    }
    
    // 重複送信防止のため、既にsentなログを取得
    const oneWeekIds = (oneWeekReservations || []).map(r => r.reservation_id)
    const tomorrowIds = (tomorrowReservations || []).map(r => r.reservation_id)

    let sentOneWeekSet = new Set<string>()
    let sentTomorrowSet = new Set<string>()

    if (oneWeekIds.length > 0) {
      const { data: sentLogs7d, error: sentLogs7dError } = await supabaseAdmin
        .from('reminder_logs')
        .select('reservation_id,status')
        .in('reservation_id', oneWeekIds)
        .eq('kind', '7d_before')
        .eq('channel', CHANNEL)
      if (sentLogs7dError) {
        console.error('reminder_logs取得エラー(7d_before):', sentLogs7dError)
      }
      sentOneWeekSet = new Set((sentLogs7d || []).filter((l: any) => l.status === 'sent').map((l: any) => l.reservation_id))
    }

    if (tomorrowIds.length > 0) {
      const { data: sentLogs1d, error: sentLogs1dError } = await supabaseAdmin
        .from('reminder_logs')
        .select('reservation_id,status')
        .in('reservation_id', tomorrowIds)
        .eq('kind', '1d_before')
        .eq('channel', CHANNEL)
      if (sentLogs1dError) {
        console.error('reminder_logs取得エラー(1d_before):', sentLogs1dError)
      }
      sentTomorrowSet = new Set((sentLogs1d || []).filter((l: any) => l.status === 'sent').map((l: any) => l.reservation_id))
    }

    // 1週間前リマインド送信（来店予定ボタンのみ）
    if (oneWeekReservations && oneWeekReservations.length > 0) {
      for (const reservation of oneWeekReservations) {
        if (!reservation.line_user_id) continue
        if (sentOneWeekSet.has(reservation.reservation_id)) continue
        
        const message: Parameters<typeof lineClient.pushMessage>[1] = {
          type: 'flex',
          altText: `ご予約日が近づいてまいりました。\n${formatJst(reservation.start_at)} に ${reservation.store_name} のご予約です。`,
          contents: {
            type: 'bubble',
            body: {
              type: 'box',
              layout: 'vertical',
              spacing: 'md',
              contents: [
                { type: 'text', text: 'こんにちは💐', size: 'md' },
                { type: 'text', text: 'ご予約日が近づいてまいりました。', size: 'sm' },
                {
                  type: 'box',
                  layout: 'vertical',
                  spacing: 'sm',
                  margin: 'md',
                  contents: [
                    { type: 'text', text: `📍店舗：${reservation.store_name}`, wrap: true, size: 'sm' },
                    { type: 'text', text: `🗓 ご予約日：${formatJst(reservation.start_at)}〜`, wrap: true, size: 'sm' }
                  ]
                },
                { type: 'text', text: 'このままご来店予定でしたら、\n下のボタンから「来店予定」を押してください🌸', wrap: true, size: 'sm', margin: 'md' },
                { type: 'text', text: '※変更やキャンセルはマイページから可能です。', wrap: true, size: 'xs', color: '#8c8c8c', margin: 'md' }
              ]
            },
            footer: {
              type: 'box',
              layout: 'vertical',
              spacing: 'lg',
              contents: [
                {
                  type: 'button',
                  style: 'primary',
                  action: {
                    type: 'postback',
                    label: '来店予定',
                    data: `remind=visit&rid=${reservation.reservation_id}`
                  }
                }
              ]
            }
          }
        } as any
        
        try {
          await lineClient.pushMessage(reservation.line_user_id, message)
          console.log(`1週間前リマインド送信完了: ${reservation.line_user_id}`)
          await supabaseAdmin
            .from('reminder_logs')
            .upsert({
              reservation_id: reservation.reservation_id,
              kind: '7d_before',
              channel: CHANNEL,
              status: 'sent',
              message_id: null
            }, { onConflict: 'reservation_id,kind,channel', ignoreDuplicates: true })
        } catch (error: any) {
          console.error(`1週間前リマインド送信エラー: ${reservation.line_user_id}`, error?.response?.data || error)
          const errorText = typeof error?.message === 'string' ? error.message : JSON.stringify(error)
          await supabaseAdmin
            .from('reminder_logs')
            .upsert({
              reservation_id: reservation.reservation_id,
              kind: '7d_before',
              channel: CHANNEL,
              status: 'failed',
              error: errorText,
              attempted_at: new Date().toISOString()
            }, { onConflict: 'reservation_id,kind,channel' })
        }
      }
    }
    
    // 前日リマインド送信（テキストのみ）
    if (tomorrowReservations && tomorrowReservations.length > 0) {
      for (const reservation of tomorrowReservations) {
        if (!reservation.line_user_id) continue
        if (sentTomorrowSet.has(reservation.reservation_id)) continue
        
        const message: Parameters<typeof lineClient.pushMessage>[1] = {
          type: 'text',
          text: `【前日リマインド】\n明日 ${formatJst(reservation.start_at)} に ${reservation.store_name} のご予約があります。\n変更・キャンセルはリマインドのボタン、またはお電話でお願いします。`
        }
        
        try {
          await lineClient.pushMessage(reservation.line_user_id, message)
          console.log(`前日リマインド送信完了: ${reservation.line_user_id}`)
          await supabaseAdmin
            .from('reminder_logs')
            .upsert({
              reservation_id: reservation.reservation_id,
              kind: '1d_before',
              channel: CHANNEL,
              status: 'sent',
              message_id: null
            }, { onConflict: 'reservation_id,kind,channel', ignoreDuplicates: true })
        } catch (error: any) {
          console.error(`前日リマインド送信エラー: ${reservation.line_user_id}`, error)
          const errorText = typeof error?.message === 'string' ? error.message : JSON.stringify(error)
          await supabaseAdmin
            .from('reminder_logs')
            .upsert({
              reservation_id: reservation.reservation_id,
              kind: '1d_before',
              channel: CHANNEL,
              status: 'failed',
              error: errorText,
              attempted_at: new Date().toISOString()
            }, { onConflict: 'reservation_id,kind,channel' })
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
