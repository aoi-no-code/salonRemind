"use client"

import { useEffect, useState } from 'react'
import QrModal from '@/components/QrModal'
import { supabase } from '@/lib/supabaseClient'
import Link from 'next/link'
import RequireAuth from '@/components/RequireAuth'

export default function DashboardPage() {
  const [openQr, setOpenQr] = useState(false)
  const [customerName, setCustomerName] = useState('')
  const [storeId, setStoreId] = useState('')
  const [storeName, setStoreName] = useState<string | null>(null)
  const [startAt, setStartAt] = useState('')
  const [datePart, setDatePart] = useState('')
  const [timePart, setTimePart] = useState('')
  const [durationMin, setDurationMin] = useState<number | ''>('')
  const [note, setNote] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [qrUrl, setQrUrl] = useState<string | undefined>(undefined)
  const [linkUrl, setLinkUrl] = useState<string | undefined>(undefined)
  

  useEffect(() => {
    const fetchStore = async () => {
      try {
        const { data: sessionData } = await supabase.auth.getSession()
        const token = sessionData.session?.access_token
        console.log('[stores/me] token exists:', !!token)
        const res = await fetch('/api/stores/me', {
          headers: token ? { Authorization: `Bearer ${token}` } : undefined
        })
        const data = await res.json()
        console.log('[stores/me] response:', res.status, data)
        if (res.ok && data.storeId) {
          setStoreId(data.storeId)
          setStoreName(data.storeName || null)
        } else {
          console.warn('[stores/me] store not resolved, check user mapping or stores table')
        }
      } catch (e) {
        console.log('[stores/me] fetch error:', e)
      }
    }
    fetchStore()
  }, [])

  const timeOptions = Array.from({ length: 24 * 2 }, (_, i) => {
    const hh = String(Math.floor(i / 2)).padStart(2, '0')
    const mm = i % 2 === 0 ? '00' : '30'
    return `${hh}:${mm}`
  })

  const durationOptions = Array.from({ length: 12 }, (_, i) => (i + 1) * 30) // 30〜360分

  const updateStartAtFromParts = (dateVal: string, timeVal: string) => {
    setDatePart(dateVal)
    setTimePart(timeVal)
    if (dateVal && timeVal) {
      const v = `${dateVal}T${timeVal}:00`
      setStartAt(v)
      console.log('[startAt] built:', v)
    }
  }

  const isDisabled = loading || !customerName.trim() || !datePart || !timePart || durationMin === '' || !storeId

  useEffect(() => {
    const debug = {
      customerName,
      datePart,
      timePart,
      durationMin,
      storeId,
      storeName,
      startAt,
      loading,
      isDisabled,
    }
    console.log('[form state]', debug)
    if (isDisabled) {
      const reasons: string[] = []
      if (loading) reasons.push('loading')
      if (!customerName.trim()) reasons.push('customerName')
      if (!datePart) reasons.push('datePart')
      if (!timePart) reasons.push('timePart')
      if (durationMin === '') reasons.push('durationMin')
      if (!storeId) reasons.push('storeId')
      console.log('[disabled reasons]', reasons)
    }
  }, [customerName, datePart, timePart, durationMin, storeId, storeName, startAt, loading, isDisabled])

  const handleCreate = async () => {
    try {
      setLoading(true)
      setError(null)
      setQrUrl(undefined)
      setLinkUrl(undefined)

      // 必須チェック
      const missing: string[] = []
      if (!customerName.trim()) missing.push('お客様名')
      if (!datePart) missing.push('来店日')
      if (!timePart) missing.push('開始時間')
      if (durationMin === '') missing.push('所要時間')
      if (!storeId) missing.push('店舗')
      if (missing.length > 0) {
        setOpenQr(false)
        const msg = `${missing.join(' / ')} を入力してください。`
        console.log('[submit] blocked: missing fields ->', missing)
        setError(msg)
        return
      }

      // 過去日時チェック（ローカル）
      const startLocal = new Date(`${datePart}T${timePart}:00`)
      if (startLocal.getTime() < Date.now()) {
        setOpenQr(false)
        console.log('[submit] blocked: past datetime', startLocal.toISOString())
        setError('過去の日時は指定できません。')
        return
      }

      const payload = {
        customerName,
        storeId,
        startAt,
        durationMin: typeof durationMin === 'number' ? durationMin : Number(durationMin),
        note: note || undefined,
      }
      console.log('[submit] payload', payload)

      // 1) 予約作成
      const res = await fetch('/api/reservations/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      const data = await res.json()
      console.log('[submit] create response', res.status, data)
      if (!res.ok || !data?.reservation?.id) {
        throw new Error(data?.error || '予約作成に失敗しました')
      }

      const reservationId: string = data.reservation.id

      // 2) QR生成
      const gen = await fetch('/api/reservations/generate-qr', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reservationId }),
      })
      const genData = await gen.json()
      console.log('[submit] qr response', gen.status, genData)
      if (!gen.ok) {
        throw new Error(genData?.error || 'QR生成に失敗しました')
      }

      setQrUrl(genData.qrUrl)
      // APIが返すLIFFの完全URLを優先採用。無い場合のみ環境変数から生成
      if (genData.liffUrl) {
        setLinkUrl(genData.liffUrl)
      } else {
        const liffIdLink = process.env.NEXT_PUBLIC_LIFF_ID_LINK
        if (liffIdLink) {
          const statePath = `/liff/link?rid=${encodeURIComponent(reservationId)}&t=${encodeURIComponent(genData.linkToken)}`
          setLinkUrl(`https://liff.line.me/${liffIdLink}?liff.state=${encodeURIComponent(statePath)}`)
        }
      }
      setOpenQr(true)
    } catch (e: any) {
      console.log('[submit] error', e)
      setError(e.message || 'エラーが発生しました')
    } finally {
      setLoading(false)
    }
  }

  return (
    <RequireAuth>
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-6xl mx-auto px-4 py-8 space-y-8">
        <header className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">予約作成画面</h1>
            <p className="text-gray-600 text-sm">{storeName ? `ログイン中の店舗: ${storeName}` : '店舗が見つかりません。メールやAuthの紐付けをご確認ください。'}</p>
          </div>
          <div className="flex items-center gap-2">
            <Link href="/dashboard/reminders" className="bg-blue-600 hover:bg-blue-700 text-white text-sm px-4 py-2 rounded-md">通知管理</Link>
          </div>
        </header>

        <div className="grid lg:grid-cols-3 gap-6 items-start">
          {/* 予約作成フォーム */}
          <div className="lg:col-span-2 bg-white border border-gray-200 rounded-lg shadow-sm p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">予約管理</h2>
            <div className="grid md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">お客様名</label>
                <input value={customerName} onChange={(e) => setCustomerName(e.target.value)} className="w-full border border-gray-300 rounded-md px-3 py-2" placeholder="山田 太郎" />
              </div>
              {/* 店舗フィールドは削除（ログイン店舗固定） */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 md:col-span-2">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">来店日</label>
                  <input
                    type="date"
                    value={datePart}
                    onChange={(e) => updateStartAtFromParts(e.target.value, timePart)}
                    className="w-full border border-gray-300 rounded-md px-3 py-2"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">開始時間</label>
                  <select
                    value={timePart}
                    onChange={(e) => updateStartAtFromParts(datePart, e.target.value)}
                    className="w-full border border-gray-300 rounded-md px-3 py-2"
                  >
                    <option value="">選択してください</option>
                    {timeOptions.map((t) => (
                      <option key={t} value={t}>{t}</option>
                    ))}
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">所要時間（分）</label>
                <select
                  value={durationMin === '' ? '' : String(durationMin)}
                  onChange={(e) => setDurationMin(e.target.value === '' ? '' : Number(e.target.value))}
                  className="w-full border border-gray-300 rounded-md px-3 py-2"
                >
                  <option value="">選択してください</option>
                  {durationOptions.map((m) => (
                    <option key={m} value={m}>{m}</option>
                  ))}
                </select>
              </div>
              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-1">メモ</label>
                <textarea value={note} onChange={(e) => setNote(e.target.value)} className="w-full border border-gray-300 rounded-md px-3 py-2" rows={3} placeholder="任意" />
              </div>
              
            </div>
            <div className="mt-4">
              <div className="flex items-center gap-3">
                <button onClick={handleCreate} disabled={isDisabled} className="bg-blue-600 hover:bg-blue-700 disabled:opacity-60 text-white px-4 py-2 rounded-md">{loading ? '作成中...' : '予約を作成してQR発行'}</button>
                {error && <span className="text-sm text-red-600">{error}</span>}
              </div>
            </div>
          </div>

          {/* お知らせ/ヘルプ */}
          <aside className="bg-white border border-gray-200 rounded-lg shadow-sm p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-3">ヘルプ / お知らせ</h3>
            <ul className="space-y-3 text-sm text-gray-700 list-disc pl-5">
              <li>開始時刻は30分刻み（00分/30分）で入力してください</li>
              <li>重複する時間帯の予約は作成できません</li>
              <li>作成後は表示されたQRコードをお客様に読み取っていただき友達追加してください</li>
            </ul>
          </aside>
        </div>


      </div>
      <QrModal open={openQr} onClose={() => setOpenQr(false)} qrUrl={qrUrl} linkUrl={linkUrl} />
    </div>
    </RequireAuth>
  )
}


