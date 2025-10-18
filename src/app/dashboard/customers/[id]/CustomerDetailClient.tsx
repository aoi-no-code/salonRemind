'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { supabase } from '@/lib/supabaseClient'
import { formatJstMdHm } from '@/lib/time'

type Reservation = {
  id: string
  startAt: string
  durationMin: number | null
  status: string
  note: string | null
  storeName: string | null
}

type CustomerDetail = {
  customerId: string
  customerName: string | null
  phoneNumber: string | null
  lineUserId: string | null
  reservations: Reservation[]
}

export default function CustomerDetailClient({ customerId }: { customerId: string }) {
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [detail, setDetail] = useState<CustomerDetail | null>(null)
  const [editingName, setEditingName] = useState<string>('')
  const [editingPhone, setEditingPhone] = useState<string>('')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    const run = async () => {
      try {
        setLoading(true)
        setError(null)
        const { data: sessionData } = await supabase.auth.getSession()
        const token = sessionData.session?.access_token
        const res = await fetch(`/api/customers/${customerId}` , {
          headers: token ? { Authorization: `Bearer ${token}` } : undefined
        })
        const j = await res.json()
        if (!res.ok) {
          setError(j.error || '顧客情報の取得に失敗しました')
        } else {
          setDetail(j as CustomerDetail)
          setEditingName((j as CustomerDetail).customerName || '')
          setEditingPhone((j as CustomerDetail).phoneNumber || '')
        }
      } catch (e: any) {
        setError(e.message || 'エラーが発生しました')
      } finally {
        setLoading(false)
      }
    }
    run()
  }, [customerId])

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-gray-600">読み込み中...</div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="bg-red-50 text-red-700 border border-red-200 rounded-md p-3 text-sm">{error}</div>
      </div>
    )
  }

  if (!detail) return null

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-5xl mx-auto px-4 py-8 space-y-8">
        <header className="space-y-3">
          <h1 className="text-2xl font-bold text-gray-900">顧客情報</h1>
          <div className="bg-white border border-gray-200 rounded-lg p-4 space-y-3">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <label className="text-sm text-gray-700">
                お客様名
                <input
                  className="mt-1 w-full border border-gray-300 rounded-md px-3 py-2"
                  value={editingName}
                  onChange={(e) => setEditingName(e.target.value)}
                  placeholder="山田 太郎"
                />
              </label>
              <label className="text-sm text-gray-700">
                電話番号
                <input
                  className="mt-1 w-full border border-gray-300 rounded-md px-3 py-2"
                  value={editingPhone}
                  onChange={(e) => setEditingPhone(e.target.value)}
                  placeholder="090-1234-5678"
                />
              </label>
            </div>
            <div>
              <button
                disabled={saving}
                onClick={async () => {
                  try {
                    setSaving(true)
                    const { data: sessionData } = await supabase.auth.getSession()
                    const token = sessionData.session?.access_token
                    const res = await fetch(`/api/customers/${customerId}`, {
                      method: 'PATCH',
                      headers: {
                        'Content-Type': 'application/json',
                        ...(token ? { Authorization: `Bearer ${token}` } : {})
                      },
                      body: JSON.stringify({ customerName: editingName, phoneNumber: editingPhone })
                    })
                    const j = await res.json().catch(() => ({}))
                    if (!res.ok) throw new Error(j.error || '保存に失敗しました')
                    setDetail((d) => d ? { ...d, customerName: editingName, phoneNumber: editingPhone } : d)
                  } catch (e: any) {
                    setError(e.message || '保存時にエラーが発生しました')
                  } finally {
                    setSaving(false)
                  }
                }}
                className="bg-blue-600 hover:bg-blue-700 disabled:opacity-60 text-white px-4 py-2 rounded-md"
              >{saving ? '保存中...' : '保存'}</button>
            </div>
          </div>
        </header>

        <section className="bg-white border border-gray-200 rounded-lg shadow-sm p-6">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-lg font-semibold text-gray-900">予約一覧</h2>
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="text-left text-gray-600">
                  <th className="py-2 pr-4">予約日時</th>
                  <th className="py-2 pr-4">店舗</th>
                  <th className="py-2 pr-4">ステータス</th>
                  <th className="py-2 pr-4">メモ</th>
                  <th className="py-2 pr-4">操作</th>
                </tr>
              </thead>
              <tbody>
                {detail.reservations.map((r) => (
                  <tr key={r.id} className="border-t border-gray-100">
                    <td className="py-2 pr-4">{formatJstMdHm(r.startAt)}</td>
                    <td className="py-2 pr-4">{r.storeName || '-'}</td>
                    <td className="py-2 pr-4">{r.status}</td>
                    <td className="py-2 pr-4 max-w-[360px] truncate" title={r.note || ''}>{r.note || '-'}</td>
                    <td className="py-2 pr-4">
                      <div className="flex gap-2">
                        <Link href={`/reservations/${r.id}`} className="text-blue-600 hover:underline">詳細</Link>
                        {/* 変更・キャンセル導線（実装方針: LIFFへ誘導） */}
                        <a
                          className="text-green-700 hover:underline"
                          href={process.env.NEXT_PUBLIC_LIFF_ID ? `https://liff.line.me/${process.env.NEXT_PUBLIC_LIFF_ID}?view=reservations&rid=${encodeURIComponent(r.id)}` : '#'}
                          target="_blank"
                        >変更</a>
                        <a
                          className="text-red-700 hover:underline"
                          href={process.env.NEXT_PUBLIC_LIFF_ID ? `https://liff.line.me/${process.env.NEXT_PUBLIC_LIFF_ID}?view=reservations&rid=${encodeURIComponent(r.id)}&link=cancel` : '#'}
                          target="_blank"
                        >キャンセル</a>
                      </div>
                    </td>
                  </tr>
                ))}
                {detail.reservations.length === 0 && (
                  <tr>
                    <td className="py-4 text-gray-500" colSpan={5}>予約がありません</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </div>
  )
}


