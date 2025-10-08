'use client'

import { useState } from 'react'
import { supabase } from '@/lib/supabaseClient'

export default function AdminLoginPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleLogin = async () => {
    try {
      setLoading(true)
      setError(null)
      const { error } = await supabase.auth.signInWithPassword({ email, password })
      if (error) throw error
      window.location.href = '/admin'
    } catch (e: any) {
      setError(e.message || 'ログインに失敗しました')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center">
      <div className="bg-white border border-gray-200 rounded-lg shadow-sm w-full max-w-md p-6">
        <h1 className="text-xl font-bold text-gray-900 mb-1">管理ログイン</h1>
        <p className="text-gray-600 text-sm mb-6">supabaseAuthのadminのみ入室できます</p>

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">メールアドレス</label>
            <input value={email} onChange={(e) => setEmail(e.target.value)} type="email" className="w-full border border-gray-300 rounded-md px-3 py-2" placeholder="you@example.com" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">パスワード</label>
            <input value={password} onChange={(e) => setPassword(e.target.value)} type="password" className="w-full border border-gray-300 rounded-md px-3 py-2" placeholder="••••••••" />
          </div>
          {error && <div className="text-sm text-red-600">{error}</div>}
          <button onClick={handleLogin} disabled={loading} className="w-full bg-blue-600 hover:bg-blue-700 disabled:opacity-60 text-white px-4 py-2 rounded-md">{loading ? 'ログイン中...' : 'ログイン'}</button>
        </div>
      </div>
    </div>
  )
}
