import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { supabaseAdmin } from '@/lib/supabaseAdmin'
import { getAuthUserFromRequest, isAdminUser } from '@/lib/auth'
import { createClient } from '@supabase/supabase-js'
import { sendEmail } from '@/lib/email'

const BodySchema = z.object({
	name: z.string().min(1),
	phone_number: z.string().min(1).regex(/^[0-9-]+$/, '電話番号は数字とハイフンのみ利用できます')
		.refine((v) => !/^0(70|80|90)/.test(v.replace(/-/g, '')), '携帯番号は登録できません'),
	address: z.string().min(1),
	email: z.string().email()
})

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

function generatePassword(): string {
	// 16文字のランダム（英大小・数字・記号を混ぜる）
	const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789!@#$%^&*()'
	const array = new Uint32Array(32)
	if (typeof crypto !== 'undefined' && (crypto as any).getRandomValues) {
		;(crypto as any).getRandomValues(array)
	} else {
		for (let i = 0; i < array.length; i++) array[i] = Math.floor(Math.random() * 4294967296)
	}
	let out = ''
	for (let i = 0; i < 16; i++) out += chars[array[i] % chars.length]
	return out
}

export async function POST(request: NextRequest) {
	try {
		const user = await getAuthUserFromRequest(request)
		if (!isAdminUser(user)) {
			return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
		}

		const body = await request.json()
		const input = BodySchema.parse(body)

		const adminClient = createClient(supabaseUrl, serviceRoleKey, {
			auth: { persistSession: false, autoRefreshToken: false }
		})

		// 既存メール重複チェック（Auth）
		// v2 SDKでは listUsers に email フィルタがないため、
		// 重複は createUser のエラーで判定する

		// パスワード生成
		const password = generatePassword()

		// Authユーザー作成（storeロール）
		const createRes = await adminClient.auth.admin.createUser({
			email: input.email,
			email_confirm: true,
			password,
			app_metadata: { role: 'store' },
			user_metadata: { role: 'store' }
		})
		if (createRes.error || !createRes.data?.user) {
			console.error('auth create error:', createRes.error)
			return NextResponse.json({ error: 'Authユーザーの作成に失敗しました。' }, { status: 500 })
		}
		const storeAuthUserId = createRes.data.user.id

		// メール送信
		const subject = '【店舗アカウント発行】ログイン情報のご案内'
		const appUrl = (process.env.NEXT_PUBLIC_APP_URL || '').replace(/\/$/, '')
		const text = `この度は店舗アカウントの登録ありがとうございます。\n\nログイン情報:\n- ログイン用メール: ${input.email}\n- 初期パスワード: ${password}\n\n管理画面: ${appUrl}/admin\n\n初回ログイン後、必ずパスワードの変更をお願いします。`
		const mailRes = await sendEmail(input.email, subject, text)
		if (!mailRes.ok) {
			console.error('email send failed:', mailRes.error)
			// 失敗しても作成自体は継続（別途再送可能とする）
		}

		// stores に保存
		const { data: store, error } = await supabaseAdmin
			.from('stores')
			.insert({
				name: input.name,
				phone_number: input.phone_number,
				address: input.address,
				email: input.email,
				user_id: storeAuthUserId
			})
			.select('id, name, phone_number, address, email, created_at')
			.single()

		if (error) {
			console.error('store create error:', error)
			return NextResponse.json({ error: 'Failed to create store' }, { status: 500 })
		}

		return NextResponse.json({ success: true, store })
	} catch (error) {
		if (error instanceof z.ZodError) {
			return NextResponse.json({ error: 'Invalid input', details: error.errors }, { status: 400 })
		}
		console.error('admin store create error:', error)
		return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
	}
}
