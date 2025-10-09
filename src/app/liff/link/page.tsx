'use client'

import { useEffect, useState } from 'react'
import Script from 'next/script'

export default function LiffLinkPage() {
  const [message, setMessage] = useState<string>('初期化中...')

  useEffect(() => {
    const run = async () => {
      try {
        if (!(typeof window !== 'undefined' && window.liff)) {
          setMessage('LIFFが利用できません。')
          return
        }

        await window.liff.init({ liffId: process.env.NEXT_PUBLIC_LIFF_ID! })
        if (!window.liff.isLoggedIn()) {
          ;(window.liff as any).login({ scope: ['openid', 'profile'], prompt: 'consent', redirectUri,})
          return
        }

        const profile = await window.liff.getProfile()
        const url = new URL(window.location.href)
        const rid = url.searchParams.get('rid')
        const token = url.searchParams.get('t')
        if (!rid || !token) {
          setMessage('不正なリンクです。')
          return
        }

        // 友だち状態の確認
        if (window.liff.getFriendship) {
          try {
            const f = await window.liff.getFriendship()
            if (!f.friendFlag) {
              setMessage('友だち追加が必要です。LINEで公式アカウントを追加してください。')
              return
            }
          } catch {
            // getFriendshipが失敗しても続行
          }
        }

        // リンク確定API
        const res = await fetch('/api/reservations/link/confirm', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ reservationId: rid, token, lineUserId: profile.userId })
        })
        const data = await res.json()
        if (res.ok && data.ok) {
          setMessage('連携が完了しました。ありがとうございます。')
        } else {
          setMessage(data.message || '連携に失敗しました。')
        }
      } catch (e) {
        console.error(e)
        setMessage('エラーが発生しました。')
      }
    }
    run()
  }, [])

  return (
    <>
      <Script src="https://static.line-scdn.net/liff/edge/2/sdk.js" strategy="beforeInteractive" />
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="bg-white border border-gray-200 rounded-lg shadow-sm p-6 max-w-md w-full text-center">
          <h1 className="text-xl font-bold text-gray-900 mb-3">予約とLINEの連携</h1>
          <p className="text-gray-700">{message}</p>
        </div>
      </div>
    </>
  )
}

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


