import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabaseAdmin'
import { getAuthUserFromRequest } from '@/lib/auth'

export async function GET(request: NextRequest) {
  try {
    const user = await getAuthUserFromRequest(request)
    if (!user) {
      return NextResponse.json({ storeId: null }, { status: 401 })
    }

    // 1) user_id で一致
    const { data: byUser, error: byUserErr } = await supabaseAdmin
      .from('stores')
      .select('id, name')
      .eq('user_id', user.id)
      .single()
    if (!byUserErr && byUser) {
      return NextResponse.json({ storeId: byUser.id, storeName: byUser.name })
    }

    // 2) email で一致（手動登録運用のフォールバック）
    const email = user.email || null
    if (email) {
      const { data: byEmail, error: byEmailErr } = await supabaseAdmin
        .from('stores')
        .select('id, name')
        .eq('email', email)
        .single()
      if (!byEmailErr && byEmail) {
        return NextResponse.json({ storeId: byEmail.id, storeName: byEmail.name })
      }
    }

    // 3) 最後のフォールバック: 先頭店舗（開発/検証用途）
    const { data: firstStore } = await supabaseAdmin
      .from('stores')
      .select('id, name')
      .limit(1)
      .single()
    if (firstStore) {
      return NextResponse.json({ storeId: firstStore.id, storeName: firstStore.name })
    }

    return NextResponse.json({ storeId: null }, { status: 200 })
  } catch (e) {
    return NextResponse.json({ storeId: null }, { status: 200 })
  }
}


