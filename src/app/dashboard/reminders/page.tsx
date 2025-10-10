'use client'

import { useEffect, useMemo, useState } from 'react'
import { supabase } from '@/lib/supabaseClient'

type ReminderKind = '7d_before' | '1d_before'

type Overview = {
  schedule: Array<{
    kind: ReminderKind
    reservationId: string
    reservationStartAt: string
    sendAt: string
    customerName: string | null
  }>
  history: Array<{
    id: string
    reservationId: string
    kind: ReminderKind
    channel: string
    status: string
    error: string | null
    attemptedAt: string
    reservationStartAt: string
    customerName: string | null
  }>
}

export default function StoreRemindersPage() {
  const [storeName, setStoreName] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [overview, setOverview] = useState<Overview | null>(null)
  const [remindersError, setRemindersError] = useState<string | null>(null)
  const [remindersLoading, setRemindersLoading] = useState(false)

  const [statusFilter, setStatusFilter] = useState<'all' | 'sent' | 'failed'>('all')
  const [kindFilter, setKindFilter] = useState<'all' | ReminderKind>('all')

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
        } catch {
          // 表示用なので失敗しても致命的ではない
        }

        // 概要取得
        try {
          setRemindersLoading(true)
          setRemindersError(null)
          const res = await fetch('/api/reminders/overview', {
            headers: token ? { Authorization: `Bearer ${token}` } : undefined
          })
          const j = await res.json()
          if (!res.ok) {
            setRemindersError(j.error || '通知情報の取得に失敗しました')
          } else {
            setOverview({ schedule: j.schedule || [], history: j.history || [] })
          }
        } catch (e: any) {
          setRemindersError(e.message || '通知情報の取得時にエラーが発生しました')
        } finally {
          setRemindersLoading(false)
        }
      } catch (e: any) {
        setError(e.message || 'エラーが発生しました')
      } finally {
        setLoading(false)
      }
    }
    run()
  }, [])

  const filteredHistory = useMemo(() => {
    const items = overview?.history ?? []
    return items.filter(i => {
      const byStatus = statusFilter === 'all' || i.status === statusFilter
      const byKind = kindFilter === 'all' || i.kind === kindFilter
      return byStatus && byKind
    })
  }, [overview, statusFilter, kindFilter])

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
            <h1 className="text-2xl font-bold text-gray-900">通知の予定と履歴</h1>
            <p className="text-gray-600 text-sm">{storeName ? `ログイン中の店舗: ${storeName}` : 'ログイン中の店舗を特定できませんでした'}</p>
          </div>
        </header>

        {error && (
          <div className="bg-red-50 text-red-700 border border-red-200 rounded-md p-3 text-sm">{error}</div>
        )}

        <section className="bg-white border border-gray-200 rounded-lg shadow-sm p-6">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-lg font-semibold text-gray-900">送信予定</h2>
            {remindersLoading && <div className="text-sm text-gray-600">読み込み中...</div>}
          </div>
          {remindersError && <div className="bg-red-50 text-red-700 border border-red-200 rounded-md p-3 text-sm mb-3">{remindersError}</div>}
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="text-left text-gray-600">
                  <th className="py-2 pr-4">送信日時</th>
                  <th className="py-2 pr-4">種別</th>
                  <th className="py-2 pr-4">予約日時</th>
                  <th className="py-2 pr-4">顧客</th>
                  <th className="py-2 pr-4">予約ID</th>
                </tr>
              </thead>
              <tbody>
                {(overview?.schedule ?? []).map((s) => (
                  <tr key={`${s.kind}-${s.reservationId}`} className="border-t border-gray-100">
                    <td className="py-2 pr-4 text-gray-900">{new Date(s.sendAt).toLocaleString('ja-JP')}</td>
                    <td className="py-2 pr-4">{s.kind === '7d_before' ? '1週間前' : '前日'}</td>
                    <td className="py-2 pr-4">{new Date(s.reservationStartAt).toLocaleString('ja-JP')}</td>
                    <td className="py-2 pr-4">{s.customerName || '-'}</td>
                    <td className="py-2 pr-4 font-mono text-xs">{s.reservationId}</td>
                  </tr>
                ))}
                {(!overview || (overview.schedule?.length ?? 0) === 0) && (
                  <tr>
                    <td className="py-4 text-gray-500" colSpan={5}>現在の送信予定はありません</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>

        <section className="bg-white border border-gray-200 rounded-lg shadow-sm p-6">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-lg font-semibold text-gray-900">送信履歴</h2>
            <div className="flex items-center gap-2 text-sm">
              <select className="border border-gray-300 rounded-md px-2 py-1" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value as any)}>
                <option value="all">すべて</option>
                <option value="sent">成功のみ</option>
                <option value="failed">失敗のみ</option>
              </select>
              <select className="border border-gray-300 rounded-md px-2 py-1" value={kindFilter} onChange={(e) => setKindFilter(e.target.value as any)}>
                <option value="all">全種別</option>
                <option value="7d_before">1週間前</option>
                <option value="1d_before">前日</option>
              </select>
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="text-left text-gray-600">
                  <th className="py-2 pr-4">試行日時</th>
                  <th className="py-2 pr-4">種別</th>
                  <th className="py-2 pr-4">ステータス</th>
                  <th className="py-2 pr-4">顧客</th>
                  <th className="py-2 pr-4">予約日時</th>
                  <th className="py-2 pr-4">エラー</th>
                  <th className="py-2 pr-4">予約ID</th>
                </tr>
              </thead>
              <tbody>
                {filteredHistory.map(h => (
                  <tr key={h.id} className="border-t border-gray-100">
                    <td className="py-2 pr-4 text-gray-900">{new Date(h.attemptedAt).toLocaleString('ja-JP')}</td>
                    <td className="py-2 pr-4">{h.kind === '7d_before' ? '1週間前' : '前日'}</td>
                    <td className="py-2 pr-4">
                      <span className={`px-2 py-0.5 rounded text-xs ${h.status === 'sent' ? 'bg-green-50 text-green-700 border border-green-200' : 'bg-red-50 text-red-700 border border-red-200'}`}>{h.status}</span>
                    </td>
                    <td className="py-2 pr-4">{h.customerName || '-'}</td>
                    <td className="py-2 pr-4">{new Date(h.reservationStartAt).toLocaleString('ja-JP')}</td>
                    <td className="py-2 pr-4 max-w-[360px] truncate" title={h.error || ''}>{h.error || '-'}</td>
                    <td className="py-2 pr-4 font-mono text-xs">{h.reservationId}</td>
                  </tr>
                ))}
                {(filteredHistory.length === 0) && (
                  <tr>
                    <td className="py-4 text-gray-500" colSpan={7}>該当する履歴がありません</td>
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


