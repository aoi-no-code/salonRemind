import { NextRequest, NextResponse } from 'next/server'
import { getAuthUserFromRequest, isAdminUser } from '@/lib/auth'

export async function GET(request: NextRequest) {
	const user = await getAuthUserFromRequest(request)
	if (!isAdminUser(user)) {
		return NextResponse.json({ ok: false }, { status: 401 })
	}
	return NextResponse.json({ ok: true })
}
