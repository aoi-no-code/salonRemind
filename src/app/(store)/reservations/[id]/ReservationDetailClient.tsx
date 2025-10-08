"use client"

import { useState } from 'react'
import QrModal from '@/components/QrModal'

export default function ReservationDetailClient({ reservationId }: { reservationId: string }) {
  const [open, setOpen] = useState(false)
  const [qrUrl, setQrUrl] = useState<string | undefined>(undefined)
  const [linkUrl, setLinkUrl] = useState<string | undefined>(undefined)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleGenerate = async () => {
    try {
      setLoading(true)
      setError(null)
      const res = await fetch('/api/reservations/generate-qr', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reservationId })
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'QR発行に失敗しました')

      setQrUrl(data.qrUrl)
      const appUrl = process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, '') || ''
      setLinkUrl(`${appUrl}/liff/link?rid=${encodeURIComponent(reservationId)}&t=${encodeURIComponent(data.linkToken)}`)
      setOpen(true)
    } catch (e: any) {
      setError(e.message || 'エラーが発生しました')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-3xl mx-auto px-4 py-8 space-y-6">
        <h1 className="text-2xl font-bold text-gray-900">予約詳細</h1>
        <div className="bg-white border border-gray-200 rounded-lg p-6 space-y-4">
          <div className="text-sm text-gray-600">予約ID: {reservationId}</div>
          {error && <div className="text-sm text-red-600">{error}</div>}
          <button
            onClick={handleGenerate}
            disabled={loading}
            className="bg-blue-600 hover:bg-blue-700 disabled:opacity-60 text-white px-4 py-2 rounded-md"
          >
            {loading ? '発行中...' : '連携用QRを発行'}
          </button>
        </div>
      </div>
      <QrModal open={open} onClose={() => setOpen(false)} qrUrl={qrUrl} linkUrl={linkUrl} />
    </div>
  )
}


