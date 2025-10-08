'use client'

import { useState, useEffect } from 'react'
import { formatJst } from '@/lib/time'

interface Reservation {
  id: string
  startAt: string
  durationMin: number
  status: 'scheduled' | 'cancelled' | 'completed' | 'change_requested'
  note?: string
  storeName: string
}

const statusLabels = {
  scheduled: '予約確定',
  cancelled: 'キャンセル',
  completed: '完了',
  change_requested: '変更希望'
}

const statusColors = {
  scheduled: 'bg-blue-100 text-blue-800',
  cancelled: 'bg-red-100 text-red-800',
  completed: 'bg-green-100 text-green-800',
  change_requested: 'bg-yellow-100 text-yellow-800'
}

export default function LiffPage() {
  const [reservations, setReservations] = useState<Reservation[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [userId, setUserId] = useState<string | null>(null)

  useEffect(() => {
    initializeLiff()
  }, [])

  const initializeLiff = async () => {
    try {
      // LIFF初期化
      if (typeof window !== 'undefined' && window.liff) {
        await window.liff.init({ liffId: process.env.NEXT_PUBLIC_LIFF_ID! })
        
        if (window.liff.isLoggedIn()) {
          const profile = await window.liff.getProfile()
          setUserId(profile.userId)

          // 友だち追加後の連携（link=1 クエリがあればAPIへPOST）
          const url = new URL(window.location.href)
          if (url.searchParams.get('link') === '1') {
            try {
              await fetch('/api/line/link', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ lineUserId: profile.userId })
              })
            } catch (e) {
              console.error('link API error', e)
            }
          }

          await loadReservations(profile.userId)
        } else {
          window.liff.login()
        }
      } else {
        // 開発環境でのフォールバック
        setError('LIFFが利用できません。')
        setLoading(false)
      }
    } catch (error) {
      console.error('LIFF初期化エラー:', error)
      setError('アプリの初期化に失敗しました。')
      setLoading(false)
    }
  }

  const loadReservations = async (lineUserId: string) => {
    try {
      const response = await fetch(`/api/reservations/list-mine?lineUserId=${lineUserId}`)
      const data = await response.json()
      
      if (data.success) {
        setReservations(data.reservations)
      } else {
        setError(data.error || '予約一覧の取得に失敗しました。')
      }
    } catch (error) {
      console.error('予約一覧取得エラー:', error)
      setError('予約一覧の取得に失敗しました。')
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">読み込み中...</p>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center p-6">
          <div className="text-red-500 text-6xl mb-4">⚠️</div>
          <h1 className="text-xl font-bold text-gray-900 mb-2">エラーが発生しました</h1>
          <p className="text-gray-600 mb-4">{error}</p>
          <button 
            onClick={() => window.location.reload()}
            className="bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700"
          >
            再読み込み
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-md mx-auto bg-white shadow-sm">
        {/* ヘッダー */}
        <div className="bg-blue-600 text-white p-4">
          <h1 className="text-xl font-bold">予約一覧</h1>
          <p className="text-blue-100 text-sm">あなたの予約情報</p>
        </div>

        {/* 予約一覧 */}
        <div className="p-4">
          {reservations.length === 0 ? (
            <div className="text-center py-8">
              <div className="text-gray-400 text-4xl mb-4">📅</div>
              <p className="text-gray-600">予約がありません</p>
            </div>
          ) : (
            <div className="space-y-4">
              {reservations.map((reservation) => (
                <div key={reservation.id} className="border border-gray-200 rounded-lg p-4 bg-white shadow-sm">
                  <div className="flex justify-between items-start mb-3">
                    <div className="flex-1">
                      <h3 className="font-semibold text-gray-900">{reservation.storeName}</h3>
                      <p className="text-sm text-gray-600">
                        {formatJst(reservation.startAt)} 〜 {reservation.durationMin}分
                      </p>
                    </div>
                    <span className={`px-2 py-1 rounded-full text-xs font-medium ${statusColors[reservation.status]}`}>
                      {statusLabels[reservation.status]}
                    </span>
                  </div>
                  
                  {reservation.note && (
                    <div className="mb-3">
                      <p className="text-sm text-gray-600 bg-gray-50 p-2 rounded">
                        <span className="font-medium">備考:</span> {reservation.note}
                      </p>
                    </div>
                  )}
                  
                  <div className="text-xs text-gray-500 bg-blue-50 p-2 rounded">
                    💡 変更・キャンセルはリマインドのボタン、またはお電話でお願いします。
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* フッター */}
        <div className="bg-gray-100 p-4 text-center">
          <p className="text-xs text-gray-600">
            予約の変更・キャンセルは<br />
            リマインドメッセージのボタンから<br />
            または店舗までお電話ください
          </p>
        </div>
      </div>
    </div>
  )
}

// LIFF型定義
declare global {
  interface Window {
    liff: {
      init: (config: { liffId: string }) => Promise<void>
      isLoggedIn: () => boolean
      login: (options?: { scope?: string[]; prompt?: string }) => void
      getProfile: () => Promise<{ userId: string; displayName: string; pictureUrl?: string }>
      getFriendship?: () => Promise<{ friendFlag: boolean }>
    }
  }
}
