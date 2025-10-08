import './globals.css'
import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: '美容室予約システム',
  description: 'LINEから予約確認・変更ができる美容室向けシステム',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="ja">
      <body>{children}</body>
    </html>
  )
}


