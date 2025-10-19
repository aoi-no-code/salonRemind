import './globals.css'
import type { Metadata } from 'next'
import Script from 'next/script'

export const metadata: Metadata = {
  title: 'サロンリマインド',
  description: 'LINEで予約の数日前にリマインドするシステム',
  icons: {
    icon: [
      { url: '/favicon.svg', type: 'image/svg+xml' },
    ],
    shortcut: ['/favicon.svg'],
  },
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="ja">
      <head>
        <Script src="https://static.line-scdn.net/liff/edge/2/sdk.js" strategy="beforeInteractive" />
      </head>
      <body>
        <div className="min-h-screen flex flex-col bg-gray-50">
          <main className="flex-1">
            {children}
          </main>
          <footer className="border-t border-gray-200 bg-white text-gray-600 text-sm">
            <div className="max-w-6xl mx-auto px-4 py-4 flex items-center justify-between">
              <div>サロンリマインド</div>
              <div>{new Date().getFullYear()} &copy; All rights reserved.</div>
            </div>
          </footer>
        </div>
      </body>
    </html>
  )
}


