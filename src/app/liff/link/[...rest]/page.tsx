'use client'

import { useEffect } from 'react'

export default function LiffLinkCatchAllPage() {
  useEffect(() => {
    try {
      const u = new URL(window.location.href)
      // 1) 通常のクエリから取得
      let rid = u.searchParams.get('rid') || undefined
      let t = u.searchParams.get('t') || undefined

      // 2) liff.state から復元
      if (!(rid && t)) {
        const rawState = u.searchParams.get('liff.state')
        if (rawState) {
          const normalized = rawState.startsWith('/') ? rawState : `/${rawState}`
          try {
            const stateUrl = new URL(normalized, u.origin)
            rid = rid || stateUrl.searchParams.get('rid') || undefined
            t = t || stateUrl.searchParams.get('t') || undefined
          } catch {}
        }
      }

      // 3) パスにエンコードされた形から復元
      if (!(rid && t)) {
        const after = u.pathname.split('/liff/link/')[1] || ''
        if (after) {
          let decoded = decodeURIComponent(after)
          try { decoded = decodeURIComponent(decoded) } catch {}
          // 例: liff/link?rid=...&t=... / ?rid=...&t=... / rid=...&t=...
          if (decoded.startsWith('liff/link')) {
            decoded = decoded.slice('liff/link'.length)
          }
          if (decoded.startsWith('/')) decoded = decoded.slice(1)
          if (decoded.startsWith('?')) decoded = decoded.slice(1)
          try {
            const params = new URLSearchParams(decoded)
            rid = rid || params.get('rid') || undefined
            t = t || params.get('t') || undefined
          } catch {}
        }
      }

      if (rid && t) {
        window.location.replace(`/liff/link?rid=${encodeURIComponent(rid)}&t=${encodeURIComponent(t)}`)
        return
      }

      // それ以外は正規の連携ページへフォールバック（エラーはページ側で表示）
      window.location.replace('/liff/link')
    } catch {
      window.location.replace('/liff/link')
    }
  }, [])

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center">
      <div className="text-gray-600">リダイレクト中...</div>
    </div>
  )
}


