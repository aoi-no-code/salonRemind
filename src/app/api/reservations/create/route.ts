import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabaseAdmin'
import { lineClient } from '@/lib/line'
import * as line from '@line/bot-sdk'
import { z } from 'zod'

// ローカルタイムの ISO 形式 (秒付き) を許可: YYYY-MM-DDTHH:mm:ss
const LOCAL_ISO_PATTERN = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}$/

const CreateReservationSchema = z.object({
  // どちらか必須: customerId or customerName
  customerId: z.string().uuid().optional(),
  customerName: z.string().min(1, 'お客様名は必須です').optional(),
  storeId: z.string().uuid(),
  startAt: z.string().regex(LOCAL_ISO_PATTERN, 'startAtはYYYY-MM-DDTHH:mm:ss形式で指定してください'),
  durationMin: z.number().multipleOf(30).min(30),
  note: z.string().optional()
}).refine((v) => Boolean(v.customerId || v.customerName), {
  message: 'customerId もしくは customerName のいずれかが必要です',
  path: ['customerName']
})

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    console.log('[reservations/create] request body:', body)
    const validatedData = CreateReservationSchema.parse(body)
    
    // 開始時刻のバリデーション（JSTで00/30分）
    const startDate = new Date(validatedData.startAt)
    const jstDate = new Date(startDate.getTime() + (9 * 60 * 60 * 1000)) // UTC+9
    const minutes = jstDate.getMinutes()
    
    if (minutes !== 0 && minutes !== 30) {
      return NextResponse.json({ 
        error: '予約時間は30分刻み（00分または30分）で設定してください。' 
      }, { status: 400 })
    }
    
    // 権限チェックは別途導入予定（現状はスキップ）
    
    // 顧客の解決（IDまたは新規作成）
    let customerIdToUse = validatedData.customerId as string | undefined
    if (!customerIdToUse && validatedData.customerName) {
      const { data: createdCustomer, error: createCustomerError } = await supabaseAdmin
        .from('customers')
        .insert({ display_name: validatedData.customerName })
        .select('id, line_user_id, display_name')
        .single()
      if (createCustomerError || !createdCustomer) {
        return NextResponse.json({ 
          error: '顧客の作成に失敗しました。' 
        }, { status: 500 })
      }
      customerIdToUse = createdCustomer.id
    }

    // 顧客情報を取得（LINE通知用）
    const { data: customer, error: customerError } = await supabaseAdmin
      .from('customers')
      .select('id, line_user_id, display_name')
      .eq('id', customerIdToUse)
      .single()
    
    if (customerError || !customer) {
      return NextResponse.json({ 
        error: '顧客情報が見つかりません。' 
      }, { status: 404 })
    }
    
    // 店舗情報を取得
    const { data: store, error: storeError } = await supabaseAdmin
      .from('stores')
      .select('name')
      .eq('id', validatedData.storeId)
      .single()
    
    if (storeError || !store) {
      return NextResponse.json({ 
        error: '店舗情報が見つかりません。' 
      }, { status: 404 })
    }
    
    // 終了時刻を計算
    const endAt = new Date(startDate.getTime() + (validatedData.durationMin * 60 * 1000))
    
    // 予約作成
    const { data: reservation, error: reservationError } = await supabaseAdmin
      .from('reservations')
      .insert({
        customer_id: customer.id,
        store_id: validatedData.storeId,
        start_at: validatedData.startAt,
        end_at: endAt.toISOString(),
        duration_min: validatedData.durationMin,
        status: 'scheduled',
        note: validatedData.note
      })
      .select()
      .single()
    
    if (reservationError) {
      console.error('予約作成エラー:', reservationError)
      
      // 重複エラーの場合
      if (reservationError.code === '23505') {
        return NextResponse.json({ 
          error: '指定された時間帯には既に予約が入っています。' 
        }, { status: 409 })
      }
      
      return NextResponse.json({ 
        error: '予約の作成に失敗しました。' 
      }, { status: 500 })
    }
    
    // LINE通知送信（顧客にLINEユーザーIDが登録されている場合）
    if (customer.line_user_id) {
      try {
        const formatDateTime = (dateStr: string) => {
          const date = new Date(dateStr)
          const jstDate = new Date(date.getTime() + (9 * 60 * 60 * 1000))
          const year = jstDate.getFullYear()
          const month = String(jstDate.getMonth() + 1).padStart(2, '0')
          const day = String(jstDate.getDate()).padStart(2, '0')
          const hours = String(jstDate.getHours()).padStart(2, '0')
          const minutes = String(jstDate.getMinutes()).padStart(2, '0')
          
          const weekdays = ['日', '月', '火', '水', '木', '金', '土']
          const weekday = weekdays[jstDate.getDay()]
          
          return `${year}/${month}/${day}(${weekday}) ${hours}:${minutes}`
        }
        
        const message: line.TextMessage = {
          type: 'text',
          text: `【予約確定】\n${formatDateTime(reservation.start_at)} に ${store.name} のご予約を承りました。\n\n予約内容:\n・時間: ${formatDateTime(reservation.start_at)}〜\n・所要時間: ${reservation.duration_min}分${reservation.note ? `\n・備考: ${reservation.note}` : ''}\n\nご来店をお待ちしております。`
        }
        
        await lineClient.pushMessage(customer.line_user_id, message)
        console.log(`予約確定通知送信完了: ${customer.line_user_id}`)
      } catch (lineError) {
        console.error('LINE通知送信エラー:', lineError)
        // LINE通知失敗は予約作成成功に影響しない
      }
    }
    
    return NextResponse.json({ 
      success: true, 
      reservation,
      lineNotificationSent: !!customer.line_user_id
    })
    
  } catch (error) {
    console.error('予約作成API エラー:', error)
    
    if (error instanceof z.ZodError) {
      return NextResponse.json({ 
        error: '入力データが正しくありません。',
        details: error.issues 
      }, { status: 400 })
    }
    
    return NextResponse.json({ 
      error: 'Internal server error' 
    }, { status: 500 })
  }
}
