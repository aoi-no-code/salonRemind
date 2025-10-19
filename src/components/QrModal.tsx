'use client'

import { useState } from 'react'

interface QrModalProps {
  open: boolean
  onClose: () => void
  qrUrl?: string
  linkUrl?: string
}

export default function QrModal({ open, onClose, qrUrl, linkUrl }: QrModalProps) {
  const [copied, setCopied] = useState(false)

  const handleCopy = async () => {
    if (!linkUrl) return
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(linkUrl)
      } else {
        const ta = document.createElement('textarea')
        ta.value = linkUrl
        ta.style.position = 'fixed'
        ta.style.left = '-9999px'
        document.body.appendChild(ta)
        ta.select()
        document.execCommand('copy')
        document.body.removeChild(ta)
      }
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    } catch {}
  }

  const handleShare = async () => {
    if (!linkUrl) return
    try {
      if (navigator.share) {
        await navigator.share({ title: 'LINE連携リンク', url: linkUrl })
      } else {
        await handleCopy()
        alert('リンクをクリップボードにコピーしました。任意のアプリで貼り付けて送信してください。')
      }
    } catch {}
  }

  if (!open) return null
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black bg-opacity-40" onClick={onClose} />
      <div className="relative bg-white rounded-lg shadow-xl border border-gray-200 w-full max-w-md mx-auto p-6">
        <h2 className="text-xl font-bold text-gray-900 mb-2">LINEと連携する</h2>
        <p className="text-sm text-gray-600 mb-4">下のQRコードを読み取り、公式LINEを友だち追加してください。</p>
        <div className="flex justify-center mb-4">
          <img src={qrUrl || '/line-qr-placeholder.svg'} alt="LINE 友だち追加 QR" className="w-56 h-56" />
        </div>
        {linkUrl && (
          <div className="space-y-2 mb-2">
            <div className="text-sm font-medium text-gray-800">リンクで送る（QRが使えない場合）</div>
            <div className="flex gap-2">
              <input
                className="flex-1 border border-gray-300 rounded-md px-3 py-2 text-sm truncate"
                value={linkUrl}
                readOnly
                onFocus={(e) => e.currentTarget.select()}
              />
              <button onClick={handleCopy} className="px-3 py-2 text-sm rounded-md border border-gray-300 text-gray-700 hover:bg-gray-50">{copied ? 'コピー済' : 'コピー'}</button>
            </div>
            <div className="flex gap-2">
              <a href={linkUrl} target="_blank" rel="noreferrer" className="px-3 py-2 text-sm rounded-md border border-gray-300 text-gray-700 hover:bg-gray-50 text-center">開く</a>
              <button onClick={handleShare} className="px-3 py-2 text-sm rounded-md bg-blue-600 text-white hover:bg-blue-700">共有</button>
            </div>
          </div>
        )}
        <button onClick={onClose} className="absolute top-2 right-2 text-gray-500 hover:text-gray-700">✕</button>
      </div>
    </div>
  )
}


