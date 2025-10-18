'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { supabase } from '@/lib/supabaseClient'

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
        <header className="space-y-1">
          <h1 className="text-2xl font-bold text-gray-900">{detail.customerName || '(名前未設定)'} 様</h1>
          <p className="text-gray-600 text-sm">電話番号: {detail.phoneNumber || '-'}</p>
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
                    <td className="py-2 pr-4">{new Date(r.startAt).toLocaleString('ja-JP')}</td>
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


