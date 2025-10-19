import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabaseAdmin'
import { getAuthUserFromRequest } from '@/lib/auth'
import { z } from 'zod'

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
  const utcMillis = Date.UTC(year, month, day, hour - 9, minute, second)
  return new Date(utcMillis)
}

const BodySchema = z.object({
  reservationId: z.string().uuid(),
  startAt: z.string().regex(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}$/),
})

export async function POST(request: Request) {
  try {
    const user = await getAuthUserFromRequest(request)
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const body = await request.json()
    const parsed = BodySchema.parse(body)

    const startUtc = localIsoJstToUtcDate(parsed.startAt)

    const { data: updated, error } = await supabaseAdmin
      .from('reservations')
      .update({ start_at: startUtc.toISOString() })
      .eq('id', parsed.reservationId)
      .select('id, start_at')
      .single()

    if (error) {
      console.error('予約更新エラー:', error)
      return NextResponse.json({ error: '予約の更新に失敗しました。' }, { status: 500 })
    }

    return NextResponse.json({ ok: true, reservation: updated })
  } catch (e: any) {
    if (e?.issues) {
      return NextResponse.json({ error: '入力が不正です', details: e.issues }, { status: 400 })
    }
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}


