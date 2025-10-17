'use client'

import { useEffect } from 'react'

export default function LiffLinkCatchAllPage() {
  useEffect(() => {
    try {
      const href = window.location.href
      const path = window.location.pathname // 例: /liff/link/liff/link%3Frid=...%26t=...
      const after = path.split('/liff/link/')[1] || ''
      const decoded = decodeURIComponent(after) // 例: liff/link?rid=...&t=...

      // 想定誤形式: liff/link?rid=...&t=...
      if (decoded.startsWith('liff/link')) {
        const qIndex = decoded.indexOf('?')
        const query = qIndex >= 0 ? decoded.slice(qIndex) : ''
        window.location.replace(`/liff/link${query}`)
        return
      }

      // それ以外は正規の連携ページへフォールバック
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


