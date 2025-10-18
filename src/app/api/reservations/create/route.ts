import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabaseAdmin'
import { lineClient } from '@/lib/line'
import * as line from '@line/bot-sdk'
import { z } from 'zod'

// ローカルタイムの ISO 形式 (秒付き) を許可: YYYY-MM-DDTHH:mm:ss
const LOCAL_ISO_PATTERN = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}$/

// ローカルISO(タイムゾーンなし, JSTの壁時計)をUTCのDateに変換
function localIsoJstToUtcDate(localIso: string): Date {
  const m = localIso.match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})$/)
  if (!m) return new Date(localIso)
  const year = Number(m[1])
  const month = Number(m[2]) - 1
  const day = Number(m[3])
  const hour = Number(m[4])
  const minute = Number(m[5])
  const second = Number(m[6])
  // JST(UTC+9) → UTC なので -9時間
  const utcMillis = Date.UTC(year, month, day, hour - 9, minute, second)
  return new Date(utcMillis)
}

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
    const minutes = Number(validatedData.startAt.slice(14,16))
    
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
    
    // 店舗情報を取得（Flex用に住所・電話も取得）
    const { data: store, error: storeError } = await supabaseAdmin
      .from('stores')
      .select('name, address, phone_number')
      .eq('id', validatedData.storeId)
      .single()
    
    if (storeError || !store) {
      return NextResponse.json({ 
        error: '店舗情報が見つかりません。' 
      }, { status: 404 })
    }
    
    // 保存用UTC値を算出
    const startUtc = localIsoJstToUtcDate(validatedData.startAt)
    const endUtc = new Date(startUtc.getTime() + validatedData.durationMin * 60 * 1000)
    
    // 予約作成
    const { data: reservation, error: reservationError } = await supabaseAdmin
      .from('reservations')
      .insert({
        customer_id: customer.id,
        store_id: validatedData.storeId,
        // DBは timestamptz のためUTC ISOで保存
        start_at: startUtc.toISOString(),
        end_at: endUtc.toISOString(),
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
    
    // LINE通知送信（顧客にLINEユーザーIDが登録されている場合）: 連携確定時と同じFlexに統一
    if (customer.line_user_id) {
      const formatDateTime = (s: string) => {
        const m = s.match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::\d{2})?$/)
        if (m) {
          const [_, y, mo, d, hh, mm] = m
          const weekdayIdx = new Date(`${y}-${mo}-${d}T00:00:00Z`).getUTCDay()
          const weekdays = ['日', '月', '火', '水', '木', '金', '土']
          const wk = weekdays[weekdayIdx]
          return `${y}/${mo}/${d}(${wk}) ${hh}:${mm}`
        }
        const date = new Date(s)
        const jst = new Date(date.getTime() + 9 * 60 * 60 * 1000)
        const y = jst.getFullYear()
        const mo = String(jst.getMonth() + 1).padStart(2, '0')
        const d = String(jst.getDate()).padStart(2, '0')
        const hh = String(jst.getHours()).padStart(2, '0')
        const mm = String(jst.getMinutes()).padStart(2, '0')
        const weekdays = ['日', '月', '火', '水', '木', '金', '土']
        const wk = weekdays[jst.getDay()]
        return `${y}/${mo}/${d}(${wk}) ${hh}:${mm}`
      }

      const liffId = process.env.NEXT_PUBLIC_LIFF_ID_MYPAGE || process.env.NEXT_PUBLIC_LIFF_ID
      const statePath = '/liff/mypage?view=reservations'
      const deeplinkUrl = liffId
        ? `https://liff.line.me/${liffId}?liff.state=${encodeURIComponent(statePath)}`
        : undefined

      const detailLines: string[] = []
      if (store.name) detailLines.push(`店舗: ${store.name}`)
      if ((store as any).address) detailLines.push(`住所: ${(store as any).address}`)
      if ((store as any).phone_number) detailLines.push(`電話: ${(store as any).phone_number}`)
      detailLines.push(`日時: ${formatDateTime(reservation.start_at)} 〜 ${reservation.duration_min}分`)

      const flex: line.FlexMessage = {
        type: 'flex',
        altText: '次回予約を受け付けました',
        contents: {
          type: 'bubble',
          body: {
            type: 'box',
            layout: 'vertical',
            spacing: 'md',
            contents: [
              { type: 'text', text: '次回予約を受け付けました', weight: 'bold', size: 'md' },
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

      try {
        await lineClient.pushMessage(customer.line_user_id, flex)
        console.log(`予約確定通知送信完了: ${customer.line_user_id}`)
      } catch (lineError: any) {
        console.error('LINE通知送信エラー:', lineError)
        // 友だち未追加などでPushに失敗 → アウトボックスにpending保存
        try {
          await supabaseAdmin
            .from('line_outbox')
            .insert({
              customer_id: customer.id,
              reservation_id: reservation.id,
              line_user_id: customer.line_user_id,
              message: flex,
              status: 'pending'
            })
        } catch (outboxError) {
          console.error('line_outbox への保存エラー:', outboxError)
        }
        // 通知失敗は予約作成成功に影響させない
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
