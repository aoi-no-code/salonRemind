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
  const [openChange, setOpenChange] = useState<string | null>(null) // reservationId
  const [openCancel, setOpenCancel] = useState<string | null>(null)
  const [datePart, setDatePart] = useState('')
  const [timePart, setTimePart] = useState('')

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
          {/* PC: テーブル表示 */}
          <div className="overflow-x-auto hidden sm:block">
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
                    <td className="py-2 pr-4">
                      <span className={`text-xs px-2 py-0.5 rounded border ${
                        r.status === 'cancelled' ? 'bg-red-50 text-red-700 border-red-200' :
                        r.status === 'change_requested' ? 'bg-yellow-50 text-yellow-800 border-yellow-200' :
                        r.status === 'visit_planned' ? 'bg-green-50 text-green-700 border-green-200' :
                        'bg-gray-50 text-gray-700 border-gray-200'
                      }`}>{r.status}</span>
                    </td>
                    <td className="py-2 pr-4 max-w-[360px] truncate" title={r.note || ''}>{r.note || '-'}</td>
                    <td className="py-2 pr-4">
                      <div className="flex gap-2">
                        <Link href={`/reservations/${r.id}`} className="text-blue-600 hover:underline">詳細</Link>
                        <button className="text-green-700 hover:underline" onClick={() => {
                          setOpenChange(r.id)
                          try {
                            const d = new Date(r.startAt)
                            const yyyy = d.getFullYear()
                            const mm = String(d.getMonth() + 1).padStart(2, '0')
                            const dd = String(d.getDate()).padStart(2, '0')
                            const hh = String(d.getHours()).padStart(2, '0')
                            const mi = String(d.getMinutes()).padStart(2, '0')
                            setDatePart(`${yyyy}-${mm}-${dd}`)
                            setTimePart(`${hh}:${mi}`)
                          } catch {
                            setDatePart('')
                            setTimePart('')
                          }
                        }}>変更</button>
                        <a
                          className="text-red-700 hover:underline"
                          onClick={(e) => { e.preventDefault(); setOpenCancel(r.id) }}
                          href="#"
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

          {/* Mobile: カード表示 */}
          <div className="sm:hidden space-y-3">
            {detail.reservations.map((r) => (
              <div key={r.id} className="border border-gray-200 rounded-lg p-4">
                <div className="flex items-center justify-between">
                  <div className="text-sm text-gray-600">予約日時</div>
                  <div className="text-sm text-gray-900">{formatJstMdHm(r.startAt)}</div>
                </div>
                <div className="mt-2 grid grid-cols-3 gap-y-1 text-sm">
                  <div className="text-gray-600">店舗</div>
                  <div className="col-span-2 text-gray-900">{r.storeName || '-'}</div>
                  <div className="text-gray-600">ステータス</div>
                  <div className="col-span-2">
                    <span className={`text-xs px-2 py-0.5 rounded border ${
                      r.status === 'cancelled' ? 'bg-red-50 text-red-700 border-red-200' :
                      r.status === 'change_requested' ? 'bg-yellow-50 text-yellow-800 border-yellow-200' :
                      r.status === 'visit_planned' ? 'bg-green-50 text-green-700 border-green-200' :
                      'bg-gray-50 text-gray-700 border-gray-200'
                    }`}>{r.status}</span>
                  </div>
                  <div className="text-gray-600">メモ</div>
                  <div className="col-span-2 text-gray-900 truncate" title={r.note || ''}>{r.note || '-'}</div>
                </div>
                <div className="mt-3 flex justify-end gap-2">
                  <Link href={`/reservations/${r.id}`} className="text-xs px-3 py-1.5 rounded border border-gray-300 text-gray-700 hover:bg-gray-50">詳細</Link>
                  <button className="text-xs px-3 py-1.5 rounded border border-green-300 text-green-700 hover:bg-green-50"
                    onClick={() => {
                      setOpenChange(r.id)
                      try {
                        const d = new Date(r.startAt)
                        const yyyy = d.getFullYear()
                        const mm = String(d.getMonth() + 1).padStart(2, '0')
                        const dd = String(d.getDate()).padStart(2, '0')
                        const hh = String(d.getHours()).padStart(2, '0')
                        const mi = String(d.getMinutes()).padStart(2, '0')
                        setDatePart(`${yyyy}-${mm}-${dd}`)
                        setTimePart(`${hh}:${mi}`)
                      } catch {
                        setDatePart('')
                        setTimePart('')
                      }
                    }}>変更</button>
                  <button className="text-xs px-3 py-1.5 rounded border border-red-300 text-red-700 hover:bg-red-50"
                    onClick={() => setOpenCancel(r.id)}>キャンセル</button>
                </div>
              </div>
            ))}
            {detail.reservations.length === 0 && (
              <div className="text-gray-500 text-sm">予約がありません</div>
            )}
          </div>
        </section>
      </div>

      {/* 変更モーダル */}
      {openChange && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black bg-opacity-40" onClick={() => setOpenChange(null)} />
          <div className="relative bg-white rounded-lg shadow-xl border border-gray-200 w-full max-w-md mx-auto p-6 space-y-4">
            <h3 className="text-lg font-semibold text-gray-900">予約日時を変更</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <label className="text-sm text-gray-700">
                日付
                <input type="date" className="mt-1 w-full border border-gray-300 rounded-md px-3 py-2"
                  value={datePart} onChange={e => setDatePart(e.target.value)} />
              </label>
              <label className="text-sm text-gray-700">
                時刻
                <input type="time" step={1800} className="mt-1 w-full border border-gray-300 rounded-md px-3 py-2"
                  value={timePart} onChange={e => setTimePart(e.target.value)} />
              </label>
            </div>
            <div className="flex justify-end gap-2">
              <button onClick={() => setOpenChange(null)} className="px-4 py-2 rounded-md border border-gray-300 text-gray-700">キャンセル</button>
              <button
                className="px-4 py-2 rounded-md bg-blue-600 hover:bg-blue-700 text-white disabled:opacity-60"
                disabled={!datePart || !timePart}
                onClick={async () => {
                  try {
                    const localIso = `${datePart}T${timePart}:00`
                    const { data: sessionData } = await supabase.auth.getSession()
                    const token = sessionData.session?.access_token
                    const res = await fetch('/api/reservations/update', {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
                      body: JSON.stringify({ reservationId: openChange, startAt: localIso })
                    })
                    const j = await res.json().catch(() => ({}))
                    if (!res.ok || !j.ok) throw new Error(j.error || '更新に失敗しました')
                    setDetail((d) => d ? {
                      ...d,
                      reservations: d.reservations.map(r => r.id === openChange ? { ...r, startAt: j.reservation.start_at } : r)
                    } : d)
                    setOpenChange(null)
                  } catch (e: any) {
                    setError(e.message || '更新時にエラーが発生しました')
                  }
                }}
              >保存</button>
            </div>
          </div>
        </div>
      )}

      {/* キャンセル確認モーダル */}
      {openCancel && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black bg-opacity-40" onClick={() => setOpenCancel(null)} />
          <div className="relative bg-white rounded-lg shadow-xl border border-gray-200 w-full max-w-md mx-auto p-6 space-y-4">
            <h3 className="text-lg font-semibold text-gray-900">この予約をキャンセルしますか？</h3>
            <div className="text-sm text-gray-600">キャンセル後は元に戻せません。</div>
            <div className="flex justify-end gap-2">
              <button onClick={() => setOpenCancel(null)} className="px-4 py-2 rounded-md border border-gray-300 text-gray-700">戻る</button>
              <button
                className="px-4 py-2 rounded-md bg-red-600 hover:bg-red-700 text-white"
                onClick={async () => {
                  try {
                    const { data: sessionData } = await supabase.auth.getSession()
                    const token = sessionData.session?.access_token
                    const res = await fetch('/api/reservations/cancel', {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
                      body: JSON.stringify({ reservationId: openCancel })
                    })
                    const j = await res.json().catch(() => ({}))
                    if (!res.ok || !j.ok) throw new Error(j.error || 'キャンセルに失敗しました')
                    setDetail((d) => d ? {
                      ...d,
                      reservations: d.reservations.map(r => r.id === openCancel ? { ...r, status: 'cancelled' } : r)
                    } : d)
                    setOpenCancel(null)
                  } catch (e: any) {
                    setError(e.message || 'キャンセル時にエラーが発生しました')
                  }
                }}
              >キャンセルする</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}


