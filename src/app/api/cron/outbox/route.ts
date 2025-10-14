import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabaseAdmin'
import { lineClient } from '@/lib/line'

export async function GET(_req: NextRequest) {
  try {
    // pending をバッチで取得
    const { data: pendings, error } = await supabaseAdmin
      .from('line_outbox')
      .select('id, line_user_id, message')
      .eq('status', 'pending')
      .order('created_at', { ascending: true })
      .limit(50)

    if (error) {
      console.error('line_outbox 取得エラー:', error)
      return NextResponse.json({ ok: false, error: 'fetch_failed' }, { status: 500 })
    }

    let sent = 0
    let failed = 0
    for (const p of pendings || []) {
      try {
        await lineClient.pushMessage((p as any).line_user_id, (p as any).message)
        await supabaseAdmin
          .from('line_outbox')
          .update({ status: 'sent', sent_at: new Date().toISOString(), last_error: null })
          .eq('id', (p as any).id)
        sent++
      } catch (e: any) {
        const errorText = typeof e?.message === 'string' ? e.message : JSON.stringify(e)
        await supabaseAdmin
          .from('line_outbox')
          .update({ last_error: errorText, attempted_at: new Date().toISOString() })
          .eq('id', (p as any).id)
        failed++
      }
    }

    return NextResponse.json({ ok: true, sent, failed })
  } catch (err) {
    console.error('outbox cron エラー:', err)
    return NextResponse.json({ ok: false }, { status: 500 })
  }
}


