interface QrModalProps {
  open: boolean
  onClose: () => void
  qrUrl?: string
  linkUrl?: string
}

export default function QrModal({ open, onClose, qrUrl, linkUrl }: QrModalProps) {
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
        <button onClick={onClose} className="absolute top-2 right-2 text-gray-500 hover:text-gray-700">✕</button>
      </div>
    </div>
  )
}


