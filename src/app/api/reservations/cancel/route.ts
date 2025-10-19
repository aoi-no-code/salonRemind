import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabaseAdmin'
import { getAuthUserFromRequest } from '@/lib/auth'
import { z } from 'zod'

const BodySchema = z.object({
  reservationId: z.string().uuid(),
})

export async function POST(request: Request) {
  try {
    const user = await getAuthUserFromRequest(request)
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const body = await request.json()
    const parsed = BodySchema.parse(body)

    const { data: reservation, error: findError } = await supabaseAdmin
      .from('reservations')
      .select('id, status')
      .eq('id', parsed.reservationId)
      .single()
    if (findError || !reservation) {
      return NextResponse.json({ error: '予約が見つかりません。' }, { status: 404 })
    }

    if (!['scheduled', 'visit_planned', 'change_requested'].includes((reservation as any).status)) {
      return NextResponse.json({ error: 'この予約はキャンセルできません。' }, { status: 400 })
    }

    const { error: updateError } = await supabaseAdmin
      .from('reservations')
      .update({ status: 'cancelled' })
      .eq('id', parsed.reservationId)

    if (updateError) {
      console.error('管理キャンセル更新エラー:', updateError)
      return NextResponse.json({ error: '更新に失敗しました。' }, { status: 500 })
    }

    return NextResponse.json({ ok: true })
  } catch (e: any) {
    if (e?.issues) return NextResponse.json({ error: '入力が不正です', details: e.issues }, { status: 400 })
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}


