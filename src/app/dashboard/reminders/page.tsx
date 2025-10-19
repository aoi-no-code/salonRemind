'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabaseClient'
import Link from 'next/link'
import { formatJstMdHm } from '@/lib/time'

type CustomerRow = {
  customerId: string
  customerName: string | null
  // phoneNumber は表示しない
  nextReservationAt: string | null
  status?: string | null
  sent7d: boolean
  sent1d: boolean
}

export default function StoreRemindersPage() {
  const [storeName, setStoreName] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [customers, setCustomers] = useState<CustomerRow[]>([])
  const [loadingCustomers, setLoadingCustomers] = useState(false)
  const [customersError, setCustomersError] = useState<string | null>(null)
  const [stats, setStats] = useState<{ thisMonth: number; nextMonth: number } | null>(null)

  useEffect(() => {
    const run = async () => {
      try {
        const { data: sessionData } = await supabase.auth.getSession()
        const token = sessionData.session?.access_token

        // 店舗情報（表示用）
        try {
          const res = await fetch('/api/stores/me', {
            headers: token ? { Authorization: `Bearer ${token}` } : undefined
          })
          const j = await res.json()
          if (res.ok) {
            setStoreName(j.storeName || null)
          }
        } catch {}

        // 顧客別一覧
        try {
          setLoadingCustomers(true)
          setCustomersError(null)
          const res = await fetch('/api/reminders/customers', {
            headers: token ? { Authorization: `Bearer ${token}` } : undefined
          })
          const j = await res.json()
          if (!res.ok) {
            setCustomersError(j.error || '顧客一覧の取得に失敗しました')
          } else {
            setCustomers(j.customers || [])
          }
        } catch (e: any) {
          setCustomersError(e.message || '顧客一覧の取得時にエラーが発生しました')
        } finally {
          setLoadingCustomers(false)
        }

        // 月次統計
        try {
          const res = await fetch('/api/reminders/stats', {
            headers: token ? { Authorization: `Bearer ${token}` } : undefined
          })
          const j = await res.json()
          if (res.ok) setStats({ thisMonth: j.thisMonth || 0, nextMonth: j.nextMonth || 0 })
        } catch {}
      } catch (e: any) {
        setError(e.message || 'エラーが発生しました')
      } finally {
        setLoading(false)
      }
    }
    run()
  }, [])

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-gray-600">読み込み中...</div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-6xl mx-auto px-4 py-8 space-y-8">
        <header className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">通知管理</h1>
            <p className="text-gray-600 text-sm">{storeName ? `ログイン中の店舗: ${storeName}` : 'ログイン中の店舗を特定できませんでした'}</p>
          </div>
        </header>

        {error && (
          <div className="bg-red-50 text-red-700 border border-red-200 rounded-md p-3 text-sm">{error}</div>
        )}

        {/* 概要カード */}
        <section className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="bg-white border border-gray-200 rounded-lg shadow-sm p-5">
            <div className="text-sm text-gray-600">今月の予約件数</div>
            <div className="mt-2 text-3xl font-bold text-gray-900">{stats ? stats.thisMonth : '-'}</div>
          </div>
          <div className="bg-white border border-gray-200 rounded-lg shadow-sm p-5">
            <div className="text-sm text-gray-600">来月の予約件数</div>
            <div className="mt-2 text-3xl font-bold text-gray-900">{stats ? stats.nextMonth : '-'}</div>
          </div>
        </section>

        {/* 通知一覧 */}
        <section className="bg-white border border-gray-200 rounded-lg shadow-sm p-6">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-lg font-semibold text-gray-900">顧客別</h2>
            {loadingCustomers && <div className="text-sm text-gray-600">読み込み中...</div>}
          </div>
          <div className="text-xs text-gray-700 mb-4 space-y-1">
            <div>各行のステータスは「今後の最も近い予約」の状態です。</div>
            <ul className="list-disc ml-5 space-y-0.5">
              <li><span className="font-medium">来店予定</span>（scheduled）: 予約してある状態です。</li>
              <li><span className="font-medium">来店確認済み</span>（visit_planned）: 一週間前のお知らせで来店の旨を確認済みです。</li>
              <li><span className="font-medium">変更希望</span>（change_requested）: 変更を希望しています。お客様から電話がない場合は予約日1〜3日前になったら確認のお電話差し上げてください。</li>
              <li><span className="font-medium">キャンセル</span>（cancelled）: お客様は予約日1日前までであればこちらでキャンセルにできます。</li>
            </ul>
          </div>
          {customersError && <div className="bg-red-50 text-red-700 border border-red-200 rounded-md p-3 text-sm mb-3">{customersError}</div>}
          {/* PC: テーブル表示 */}
          <div className="overflow-x-auto hidden sm:block">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="text-left text-gray-600">
                  <th className="py-2 pr-4">お客様名</th>
                  <th className="py-2 pr-4">予約日時</th>
                  <th className="py-2 pr-4">ステータス</th>
                  <th className="py-2 pr-4">一週間前</th>
                  <th className="py-2 pr-4">前日</th>
                </tr>
              </thead>
              <tbody>
                {customers.map((c) => (
                  <tr key={c.customerId} className="border-t border-gray-100">
                    <td className="py-2 pr-4">
                      <Link href={`/dashboard/customers/${c.customerId}`} className="text-blue-600 hover:underline">
                        {c.customerName || '(名前未設定)'}
                      </Link>
                    </td>
                    <td className="py-2 pr-4">{c.nextReservationAt ? formatJstMdHm(c.nextReservationAt) : '-'}</td>
                    <td className="py-2 pr-4">
                      <span className={`text-xs px-2 py-0.5 rounded border ${
                        c.status === 'cancelled' ? 'bg-red-50 text-red-700 border-red-200' :
                        c.status === 'change_requested' ? 'bg-yellow-50 text-yellow-800 border-yellow-200' :
                        c.status === 'visit_planned' ? 'bg-green-50 text-green-700 border-green-200' :
                        'bg-gray-50 text-gray-700 border-gray-200'
                      }`}>
                        {c.status === 'cancelled' ? 'キャンセル' :
                         c.status === 'change_requested' ? '変更希望' :
                         c.status === 'visit_planned' ? '来店確認済み' :
                         '来店予定'}
                      </span>
                    </td>
                    <td className="py-2 pr-4">
                      <span className={`px-2 py-0.5 rounded text-xs border ${c.sent7d ? 'bg-green-50 text-green-700 border-green-200' : 'bg-gray-50 text-gray-600 border-gray-200'}`}>{c.sent7d ? '済' : '-'}</span>
                    </td>
                    <td className="py-2 pr-4">
                      <span className={`px-2 py-0.5 rounded text-xs border ${c.sent1d ? 'bg-green-50 text-green-700 border-green-200' : 'bg-gray-50 text-gray-600 border-gray-200'}`}>{c.sent1d ? '済' : '-'}</span>
                    </td>
                  </tr>
                ))}
                {customers.length === 0 && (
                  <tr>
                    <td className="py-4 text-gray-500" colSpan={4}>対象のお客様がいません</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {/* Mobile: カード表示 */}
          <div className="sm:hidden space-y-3">
            {customers.map((c) => (
              <div key={c.customerId} className="border border-gray-200 rounded-lg p-4">
                <div className="flex items-center justify-between">
                  <Link href={`/dashboard/customers/${c.customerId}`} className="text-blue-600 font-medium hover:underline">
                    {c.customerName || '(名前未設定)'}
                  </Link>
                  <span className={`text-xs px-2 py-0.5 rounded border ${
                    c.status === 'cancelled' ? 'bg-red-50 text-red-700 border-red-200' :
                    c.status === 'change_requested' ? 'bg-yellow-50 text-yellow-800 border-yellow-200' :
                    c.status === 'visit_planned' ? 'bg-green-50 text-green-700 border-green-200' :
                    'bg-gray-50 text-gray-700 border-gray-200'
                  }`}>
                    {c.status === 'cancelled' ? 'キャンセル' :
                     c.status === 'change_requested' ? '変更希望' :
                     c.status === 'visit_planned' ? '来店確認済み' :
                     '来店予定'}
                  </span>
                </div>
                <div className="mt-2 text-sm text-gray-800">{c.nextReservationAt ? formatJstMdHm(c.nextReservationAt) : '-'}</div>
                <div className="mt-3 flex items-center gap-2 text-xs">
                  <span className="text-gray-600">一週間前:</span>
                  <span className={`px-2 py-0.5 rounded border ${c.sent7d ? 'bg-green-50 text-green-700 border-green-200' : 'bg-gray-50 text-gray-600 border-gray-200'}`}>{c.sent7d ? '済' : '-'}</span>
                  <span className="ml-3 text-gray-600">前日:</span>
                  <span className={`px-2 py-0.5 rounded border ${c.sent1d ? 'bg-green-50 text-green-700 border-green-200' : 'bg-gray-50 text-gray-600 border-gray-200'}`}>{c.sent1d ? '済' : '-'}</span>
                </div>
              </div>
            ))}
            {customers.length === 0 && (
              <div className="text-gray-500 text-sm">対象のお客様がいません</div>
            )}
          </div>
        </section>
      </div>
    </div>
  )
}


