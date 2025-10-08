'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabaseClient'

type Role = 'admin' | 'store' | 'unknown'

export default function LoginPanel() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [loggedIn, setLoggedIn] = useState(false)
  const [role, setRole] = useState<Role>('unknown')
  const [userEmail, setUserEmail] = useState<string | null>(null)

  useEffect(() => {
    const init = async () => {
      const { data } = await supabase.auth.getSession()
      const session = data.session
      if (session?.user) {
        setLoggedIn(true)
        setUserEmail(session.user.email ?? null)
        const appRole = (session.user.app_metadata as any)?.role
        const userRole = (session.user.user_metadata as any)?.role
        if (appRole === 'admin' || userRole === 'admin') setRole('admin')
        else if (appRole === 'store' || userRole === 'store') setRole('store')
        else setRole('unknown')
      }
    }
    init()
  }, [])

  const handleLogin = async () => {
    try {
      setLoading(true)
      setError(null)
      const { error } = await supabase.auth.signInWithPassword({ email, password })
      if (error) throw error

      const { data } = await supabase.auth.getUser()
      const u = data.user
      const appRole = (u?.app_metadata as any)?.role
      const userRole = (u?.user_metadata as any)?.role
      const nextRole: Role = appRole === 'admin' || userRole === 'admin'
        ? 'admin'
        : appRole === 'store' || userRole === 'store'
        ? 'store'
        : 'unknown'

      if (nextRole === 'admin') {
        window.location.href = '/admin'
      } else {
        window.location.href = '/dashboard'
      }
    } catch (e: any) {
      setError(e?.message || 'ログインに失敗しました')
    } finally {
      setLoading(false)
    }
  }

  const handleLogout = async () => {
    await supabase.auth.signOut()
    setLoggedIn(false)
    setRole('unknown')
    setUserEmail(null)
    setEmail('')
    setPassword('')
  }

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
      <h2 className="text-2xl font-bold text-gray-900 mb-4">ログイン</h2>

      {!loggedIn ? (
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">メールアドレス</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full border border-gray-300 rounded-md px-3 py-2"
              placeholder="store@example.com"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">パスワード</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full border border-gray-300 rounded-md px-3 py-2"
              placeholder="••••••••"
            />
          </div>
          {error && <div className="text-sm text-red-600">{error}</div>}
          <button
            onClick={handleLogin}
            disabled={loading}
            className="w-full inline-flex items-center justify-center bg-blue-600 hover:bg-blue-700 disabled:opacity-60 text-white font-medium px-4 py-2.5 rounded-md"
          >
            {loading ? 'ログイン中...' : 'ログイン'}
          </button>

          <div className="text-xs text-gray-500">
            小規模運用ではSupabaseで手動作成したアカウントでログインしてください。
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          <div className="text-sm text-gray-700">
            ログイン中: <span className="font-medium">{userEmail ?? '不明'}</span>（役割: {role}）
          </div>
          {role === 'admin' ? (
            <a href="/admin" className="w-full inline-flex items-center justify-center bg-green-600 hover:bg-green-700 text-white font-medium px-4 py-2.5 rounded-md">
              管理画面へ
            </a>
          ) : (
            <a href="/dashboard" className="w-full inline-flex items-center justify-center bg-green-600 hover:bg-green-700 text-white font-medium px-4 py-2.5 rounded-md">
              店舗ダッシュボードへ
            </a>
          )}
          <button
            onClick={handleLogout}
            className="w-full inline-flex items-center justify-center bg-gray-100 hover:bg-gray-200 text-gray-900 font-medium px-4 py-2.5 rounded-md"
          >
            ログアウト
          </button>
        </div>
      )}
    </div>
  )
}