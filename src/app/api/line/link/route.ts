import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'

// DBは触らず、受け取りと検証だけ行うスタブ
const BodySchema = z.object({
  lineUserId: z.string().min(10),
  reservationId: z.string().uuid().optional()
})

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const data = BodySchema.parse(body)

    // 将来ここでDBにリンク情報を保存する
    console.log('Link request received:', data)

    return NextResponse.json({ success: true })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: 'Invalid body', details: error.errors }, { status: 400 })
    }
    console.error('Link API error', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}


