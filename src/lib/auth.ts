import { createClient, type User } from "@supabase/supabase-js"
import type { NextRequest } from "next/server"

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

export async function getAuthUserFromRequest(request: NextRequest): Promise<User | null> {
  const authHeader = request.headers.get('authorization') || request.headers.get('Authorization')
  if (!authHeader || !authHeader.toLowerCase().startsWith('bearer ')) return null
  const token = authHeader.slice(7)

  const supabase = createClient(supabaseUrl, supabaseAnonKey, {
    global: { headers: { Authorization: `Bearer ${token}` } },
    auth: { persistSession: false, autoRefreshToken: false }
  })
  try {
    const { data, error } = await supabase.auth.getUser()
    if (error || !data.user) return null
    return data.user
  } catch {
    return null
  }
}

export function isAdminUser(user: User | null): boolean {
  if (!user) return false
  const appRole = (user.app_metadata as any)?.role
  const userRole = (user.user_metadata as any)?.role
  const appIsAdmin = (user.app_metadata as any)?.is_admin
  const userIsAdmin = (user.user_metadata as any)?.is_admin
  return appRole === 'admin' || userRole === 'admin' || appIsAdmin === true || userIsAdmin === true
}
