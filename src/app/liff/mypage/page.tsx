'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { formatJst } from '@/lib/time'

type NextReservation = {
  id: string
  startAt: string
  durationMin: number
  storeName: string
  note?: string
}

export default function LiffMyPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [displayName, setDisplayName] = useState<string>('')
  const [pictureUrl, setPictureUrl] = useState<string | undefined>(undefined)
  const [lineUserId, setLineUserId] = useState<string | null>(null)
  const [nextReservation, setNextReservation] = useState<NextReservation | null>(null)

  useEffect(() => {
    initialize()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  async function initialize() {
    try {
      if (!(typeof window !== 'undefined' && (window as any).liff)) {
        setError('LIFFが利用できません。')
        setLoading(false)
        return
      }

      const inClient = (window as any).liff.isInClient ? (window as any).liff.isInClient() : true
      const liffConfig: { liffId: string; withLoginOnExternalBrowser?: boolean } = {
        liffId: process.env.NEXT_PUBLIC_LIFF_ID!,
      }
      if (!inClient) liffConfig.withLoginOnExternalBrowser = true
      await (window as any).liff.init(liffConfig)

      const url = new URL(window.location.href)
      const view = url.searchParams.get('view')
      if (view === 'reservations') {
        router.replace('/liff/reservations')
        return
      }

      const isLoggedIn = (window as any).liff.isLoggedIn()
      if (!inClient && !isLoggedIn) {
        (window as any).liff.login({
          scope: ['openid', 'profile'],
          prompt: 'consent',
          redirectUri: url.toString(),
        })
        return
      }

      const profile = await (window as any).liff.getProfile()
      setDisplayName(profile.displayName)
      setPictureUrl(profile.pictureUrl)
      setLineUserId(profile.userId)

      // 次回予約の取得
      try {
        const res = await fetch(`/api/reservations/list-mine?lineUserId=${profile.userId}`)
        const data = await res.json()
        if (data?.success && Array.isArray(data.reservations)) {
          // 先頭から status=scheduled/visit_planned を優先
          const upcoming = (data.reservations as any[]).find((r) => r.status === 'scheduled' || r.status === 'visit_planned')
          if (upcoming) {
            setNextReservation({
              id: upcoming.id,
              startAt: upcoming.startAt,
              durationMin: upcoming.durationMin,
              storeName: upcoming.storeName,
              note: upcoming.note,
            })
          }
        }
      } catch (e) {
        console.warn('次回予約取得に失敗しました:', e)
      }

      setLoading(false)
    } catch (e) {
      console.error('LIFF init error:', e)
      setError('アプリの初期化に失敗しました。')
      setLoading(false)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4" />
          <p className="text-gray-600">読み込み中...</p>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="bg-white border border-gray-200 rounded-lg shadow-sm p-6 max-w-md w-full text-center">
          <div className="text-red-500 text-5xl mb-3">⚠️</div>
          <div className="font-semibold text-gray-900 mb-2">エラーが発生しました</div>
          <div className="text-gray-600 mb-4">{error}</div>
          <button
            onClick={() => window.location.reload()}
            className="bg-blue-600 text-white px-5 py-2 rounded-lg hover:bg-blue-700"
          >
            再読み込み
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center">
      <div className="bg-white border border-gray-200 rounded-2xl shadow-sm p-6 max-w-md w-[88%] text-center">
        <div className="flex flex-col items-center mb-5">
          {pictureUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={pictureUrl} alt="avatar" className="w-16 h-16 rounded-full mb-3" />
          ) : (
            <div className="w-16 h-16 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center font-bold mb-3">
              {displayName ? displayName.charAt(0) : '👤'}
            </div>
          )}
          <h1 className="text-xl font-bold text-gray-900">マイページ</h1>
          {displayName && (
            <p className="text-sm text-gray-600 mt-1">{displayName} さん、こんにちは</p>
          )}
        </div>

        {/* 次回予約サマリー */}
        <div className="text-left bg-gray-50 border border-gray-200 rounded-lg p-4 mb-5">
          <div className="text-sm text-gray-500 mb-1">次回予約</div>
          {nextReservation ? (
            <div>
              <div className="font-semibold text-gray-900 mb-1">{nextReservation.storeName}</div>
              <div className="text-gray-700 text-sm">{formatJst(nextReservation.startAt)} 〜 {nextReservation.durationMin}分</div>
              {nextReservation.note && (
                <div className="text-gray-600 text-xs mt-2">備考: {nextReservation.note}</div>
              )}
            </div>
          ) : (
            <div className="text-gray-600 text-sm">次回予約はありません</div>
          )}
        </div>

        <div className="space-y-3">
          <button
            onClick={() => router.push('/liff/reservations')}
            className="w-full bg-green-600 text-white py-3 rounded-lg text-base font-semibold hover:bg-green-700"
          >
            予約を確認する
          </button>

          <button
            onClick={() => router.push('/liff/link')}
            className="w-full bg-white text-blue-700 border border-blue-200 py-3 rounded-lg text-base font-semibold hover:bg-blue-50"
          >
            友だち連携・再設定
          </button>

          <button
            onClick={() => {
              try { (window as any).liff?.closeWindow?.() } catch {}
            }}
            className="w-full bg-gray-100 text-gray-700 py-2.5 rounded-lg text-sm hover:bg-gray-200"
          >
            閉じる
          </button>
        </div>
      </div>
    </div>
  )
}


