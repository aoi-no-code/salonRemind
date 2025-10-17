import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { supabaseAdmin } from '@/lib/supabaseAdmin'
import QRCode from 'qrcode'

const BodySchema = z.object({
  reservationId: z.string().uuid()
})

function formatYmdHm(date: Date): string {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  const hh = String(date.getHours()).padStart(2, '0')
  const mm = String(date.getMinutes()).padStart(2, '0')
  return `${y}${m}${d}${hh}${mm}`
}

async function ensureQrBucket() {
  const { data } = await supabaseAdmin.storage.getBucket('qrs')
  if (!data) {
    await supabaseAdmin.storage.createBucket('qrs', { public: true })
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { reservationId } = BodySchema.parse(body)
    console.log('[generate-qr] reservationId:', reservationId)

    const { data: reservation, error: reservationError } = await supabaseAdmin
      .from('reservations')
      .select('id, store_id')
      .eq('id', reservationId)
      .single()
    console.log('[generate-qr] reservation select:', { reservationError, reservation })
    if (reservationError || !reservation) {
      return NextResponse.json({ error: '予約が見つかりません。' }, { status: 404 })
    }

    const linkToken = crypto.randomUUID()
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000)

    const liffId = process.env.NEXT_PUBLIC_LIFF_ID
    if (!liffId) {
      return NextResponse.json({ error: 'NEXT_PUBLIC_LIFF_ID が未設定です。' }, { status: 500 })
    }
    // 方式A: liff.state を用いて必ず /liff/link に遷移させる
    const statePath = `/liff/link?rid=${encodeURIComponent(reservationId)}&t=${encodeURIComponent(linkToken)}`
    const liffUrl = `https://liff.line.me/${liffId}?liff.state=${encodeURIComponent(statePath)}`

    const pngBuffer = await QRCode.toBuffer(liffUrl, { type: 'png', width: 600, errorCorrectionLevel: 'M' })

    await ensureQrBucket()

    const filename = `reservation_${reservationId}_${formatYmdHm(new Date())}.png`
    const { error: uploadError } = await supabaseAdmin.storage
      .from('qrs')
      .upload(filename, pngBuffer, { contentType: 'image/png', upsert: true })
    if (uploadError) {
      console.error('QR upload error:', uploadError)
      return NextResponse.json({ error: 'QRの保存に失敗しました。' }, { status: 500 })
    }

    const { data: publicUrlData } = supabaseAdmin.storage.from('qrs').getPublicUrl(filename)
    const qrUrl = publicUrlData.publicUrl

    const { error: updateError } = await supabaseAdmin
      .from('reservations')
      .update({
        link_token: linkToken,
        link_status: 'pending',
        link_qr_url: qrUrl,
        link_expires_at: expiresAt.toISOString(),
      })
      .eq('id', reservationId)
    if (updateError) {
      // 列未定義やスキーマ差異は致命的にせずログのみ出す
      console.warn('[generate-qr] reservation update warning (ignored):', updateError)
    }

    return NextResponse.json({ qrUrl, linkToken, linkExpiresAt: expiresAt.toISOString() })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: '入力が不正です', details: error.issues }, { status: 400 })
    }
    console.error('generate-qr error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}


