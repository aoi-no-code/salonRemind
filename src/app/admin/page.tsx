'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabaseClient'

export default function AdminPage() {
  const [loading, setLoading] = useState(true)
  const [authorized, setAuthorized] = useState(false)
  const [storeName, setStoreName] = useState('')
  const [phone, setPhone] = useState('')
  const [address, setAddress] = useState('')
  const [email, setEmail] = useState('')
  const [message, setMessage] = useState<string | null>(null)

  useEffect(() => {
    const check = async () => {
      const { data: sessionData } = await supabase.auth.getSession()
      const accessToken = sessionData.session?.access_token
      if (!accessToken) {
        window.location.href = '/admin/login'
        return
      }
      try {
        const res = await fetch('/api/admin/check', {
          method: 'GET',
          headers: { Authorization: `Bearer ${accessToken}` }
        })
        if (res.status === 401) {
          window.location.href = '/admin/login'
          return
        }
        setAuthorized(true)
      } catch {
        window.location.href = '/admin/login'
        return
      } finally {
        setLoading(false)
      }
    }
    check()
  }, [])

  const formatPhone = (value: string) => {
    const digits = value.replace(/[^0-9]/g, '').slice(0, 10)
    if (digits.startsWith('03') || digits.startsWith('06')) {
      if (digits.length <= 2) return digits
      if (digits.length <= 6) return `${digits.slice(0,2)}-${digits.slice(2)}`
      if (digits.length <= 10) return `${digits.slice(0,2)}-${digits.slice(2,6)}-${digits.slice(6)}`
      return `${digits.slice(0,2)}-${digits.slice(2,6)}-${digits.slice(6,10)}`
    }
    if (digits.length <= 3) return digits
    if (digits.length <= 6) return `${digits.slice(0,3)}-${digits.slice(3)}`
    return `${digits.slice(0,3)}-${digits.slice(3,6)}-${digits.slice(6,10)}`
  }

  const handleCreateStore = async () => {
    setMessage(null)
    const { data: sessionData } = await supabase.auth.getSession()
    const accessToken = sessionData.session?.access_token
    if (!accessToken) {
      window.location.href = '/admin/login'
      return
    }
    if (!storeName.trim()) { setMessage('店舗名は必須です'); return }
    if (!phone.trim()) { setMessage('電話番号は必須です'); return }
    if (!address.trim()) { setMessage('住所は必須です'); return }
    if (!email.trim()) { setMessage('メールアドレスは必須です'); return }
    try {
      const res = await fetch('/api/admin/stores/create', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${accessToken}`
        },
        body: JSON.stringify({ name: storeName.trim(), phone_number: phone.trim(), address: address.trim(), email: email.trim() })
      })
      const data = await res.json()
      if (!res.ok) {
        setMessage(data.error || '作成に失敗しました')
        return
      }
      setMessage(`店舗を作成しました。初期パスワードを ${email} に送信しました。`)
      setStoreName('')
      setPhone('')
      setAddress('')
      setEmail('')
    } catch (e: any) {
      setMessage(e.message || '作成時にエラーが発生しました')
    }
  }

  const handleLogout = async () => {
    await supabase.auth.signOut()
    window.location.href = '/admin/login'
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-gray-600">読み込み中...</div>
      </div>
    )
  }

  if (!authorized) return null

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-3xl mx-auto px-4 py-8 space-y-6">
        <header className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">管理ダッシュボード</h1>
            <p className="text-gray-600 text-sm">adminユーザーのみがアクセスできます</p>
          </div>
          <button onClick={handleLogout} className="text-sm text-gray-600 hover:text-gray-900">ログアウト</button>
        </header>

        <section className="bg-white border border-gray-200 rounded-lg shadow-sm p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-2">店舗作成</h2>
          <p className="text-sm text-gray-600 mb-4">保存すると初期パスワードが自動生成され、店舗メール宛に通知されます。</p>
          <div className="grid gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">店舗名<span className="text-red-600 ml-1">*</span></label>
              <input value={storeName} onChange={(e) => setStoreName(e.target.value)} className="w-full border border-gray-300 rounded-md px-3 py-2" placeholder="サンプル美容室" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">電話番号<span className="text-red-600 ml-1">*</span></label>
              <input value={phone} onChange={(e) => setPhone(formatPhone(e.target.value))} className="w-full border border-gray-300 rounded-md px-3 py-2" placeholder="03-1234-5678" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">住所<span className="text-red-600 ml-1">*</span></label>
              <input value={address} onChange={(e) => setAddress(e.target.value)} className="w-full border border-gray-300 rounded-md px-3 py-2" placeholder="東京都..." />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">店舗メールアドレス<span className="text-red-600 ml-1">*</span></label>
              <input value={email} onChange={(e) => setEmail(e.target.value)} type="email" className="w-full border border-gray-300 rounded-md px-3 py-2" placeholder="store@example.com" />
            </div>
            {message && <div className="text-sm text-blue-700">{message}</div>}
            <div>
              <button onClick={handleCreateStore} className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-md">店舗を作成</button>
            </div>
          </div>
        </section>
      </div>
    </div>
  )
}
