'use client'

import { useEffect, useRef, useState } from 'react'
import Script from 'next/script'

export default function LiffLinkPage() {
  const [message, setMessage] = useState('初期化中...')
  const [isNotFriend, setIsNotFriend] = useState(false)
  const [debugMode, setDebugMode] = useState(false)
  const [debugInfo, setDebugInfo] = useState<{ inClient: boolean | null; isLoggedIn: boolean | null; ua: string } | null>(null)

  const ranRef = useRef(false)

  // SDKロード後に呼ぶ
  async function run() {
    if (ranRef.current) return
    ranRef.current = true
    try {
      if (!(typeof window !== 'undefined' && window.liff)) {
        setMessage('LIFFが利用できません。')
        return
      }

      // デバッグフラグ
      try {
        const u = new URL(window.location.href)
        const dbg = u.searchParams.get('debug')
        setDebugMode(dbg === '1' || dbg === 'true')
      } catch {}

      // isInClient が未定義な端末では true とみなして外ブラウザログインを避ける
      const inClient = window.liff.isInClient ? window.liff.isInClient() : true

      // 外ブラウザ時のみ withLoginOnExternalBrowser を有効化
      const liffConfig: { liffId: string; withLoginOnExternalBrowser?: boolean } = {
        liffId: process.env.NEXT_PUBLIC_LIFF_ID!,
      }
      if (!inClient) {
        liffConfig.withLoginOnExternalBrowser = true
      }
      await window.liff.init(liffConfig)

      const isLoggedIn = window.liff.isLoggedIn()

      // デバッグ情報保持
      if (typeof navigator !== 'undefined') {
        setDebugInfo({ inClient, isLoggedIn, ua: navigator.userAgent })
      } else {
        setDebugInfo({ inClient, isLoggedIn, ua: 'n/a' })
      }

      // ブラウザ(アプリ外)で未ログインのときだけログイン。
      // LINE側のコールバックURLが /liff/mypage の場合に合わせて、
      // rid/t を保持したまま /liff/mypage に戻す
      if (!inClient && !isLoggedIn) {
        const current = new URL(window.location.href)
        const ridForLogin = current.searchParams.get('rid')
        const tokenForLogin = current.searchParams.get('t')
        const base = `${current.origin}/liff/mypage`
        const qs = ridForLogin && tokenForLogin
          ? `?rid=${encodeURIComponent(ridForLogin)}&t=${encodeURIComponent(tokenForLogin)}`
          : ''
        const redirectUri = `${base}${qs}`
        window.liff.login({
          scope: ['openid', 'profile'],
          prompt: 'consent',
          redirectUri,
        })
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

      // 友だち状態の確認（LINEアプリ内でのみ有効。外部ブラウザでは呼ばない）
      if (inClient && window.liff.getFriendship) {
        try {
          const f = await window.liff.getFriendship()
          if (!f.friendFlag) {
            setIsNotFriend(true)
            setMessage('友だち追加が必要です。追加後に「更新」ボタンを押してください。')
            return
          }
        } catch (e) {
          // 取得失敗時は判定をスキップして続行
        }
      }

      // リンク確定API
      const res = await fetch('/api/reservations/link/confirm', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reservationId: rid, token, lineUserId: profile.userId }),
      })
      const data = await res.json()
      if (res.ok && data.ok) {
        setMessage('連携が完了しました。ありがとうございます。')
        // ここで歓迎Push(API)を叩いて「予約確認」ボタンを送るのもアリ
        // await fetch('/api/line/push/welcome', { method: 'POST', headers: {'Content-Type':'application/json'}, body: JSON.stringify({ lineUserId: profile.userId }) })
      } else {
        setMessage(data.message || '連携に失敗しました。')
      }
    } catch (e) {
      console.error(e)
      setMessage('エラーが発生しました。')
    }
  }

  useEffect(() => {
    if (typeof window !== 'undefined' && (window as any).liff) run()
  }, [])

  return (
    <>
      <Script
        src="https://static.line-scdn.net/liff/edge/2/sdk.js"
        strategy="afterInteractive"
        onLoad={() => run()}
      />
      {/* 設定確認メモ:
        - .env の NEXT_PUBLIC_LIFF_ID が正しいこと
        - LINE Developers: LIFFエンドポイント → https://salon-remind.vercel.app/liff/link
        - LINEログインのコールバックURL → https://salon-remind.vercel.app/liff/link
        が一致していることを確認
      */}
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="bg-white border border-gray-200 rounded-lg shadow-sm p-6 max-w-md w-full text-center">
          <h1 className="text-xl font-bold text-gray-900 mb-3">予約とLINEの連携</h1>
          <p className="text-gray-700 mb-4">{message}</p>
          {debugMode && debugInfo && (
            <div className="text-left text-xs bg-gray-50 border border-gray-200 rounded p-3 mb-4 break-words">
              <div className="font-semibold mb-1">Debug</div>
              <div>inClient: {String(debugInfo.inClient)}</div>
              <div>isLoggedIn: {String(debugInfo.isLoggedIn)}</div>
              <div>ua: {debugInfo.ua}</div>
            </div>
          )}
          {isNotFriend && (
            <div className="space-y-3">
              <a
                href={process.env.NEXT_PUBLIC_LINE_ADD_FRIEND_URL || '#'} // 例: line://ti/p/@xxxx
                className="inline-block bg-green-600 text-white px-4 py-2 rounded hover:bg-green-700"
              >
                友だち追加
              </a>
              <div>
                <button
                  onClick={() => window.location.reload()}
                  className="inline-block bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700"
                >
                  更新
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </>
  )
}

declare global {
  interface Window {
    liff: {
      init: (config: { liffId: string; withLoginOnExternalBrowser?: boolean }) => Promise<void>
      isLoggedIn: () => boolean
      login: (options?: {
        scope?: string[]
        prompt?: string
        redirectUri?: string
      }) => void
      getProfile: () => Promise<{ userId: string; displayName: string; pictureUrl?: string }>
      getFriendship?: () => Promise<{ friendFlag: boolean }>
      isInClient?: () => boolean
    }
  }
}
