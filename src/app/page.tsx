import Image from 'next/image'
import LoginPanel from '@/components/LoginPanel'

export default function Home() {
  return (
    <div className="min-h-screen bg-gray-50">
      {/* メインビジュアル */}
      {/* <div className="relative w-full h-96 bg-gray-200">
        <Image
          src="/IMG_0018.JPG"
          alt="美容室メインビジュアル"
          fill
          className="object-cover"
          priority
        />
        <div className="absolute inset-0 bg-black bg-opacity-40 flex items-center justify-center">
          <div className="text-center text-white">
            <h1 className="text-4xl font-bold mb-4">美容室予約システム</h1>
            <p className="text-lg">LINEから簡単に予約確認ができます</p>
          </div>
        </div>
      </div> */}

      {/* コンテンツ：左右レイアウト */}
      <div className="max-w-5xl mx-auto px-4 py-12">
        <div className="grid md:grid-cols-2 gap-8 items-start">
          {/* 左：ログイン */}
          <LoginPanel />

          {/* 右：お知らせ・広告 */}
          <div className="space-y-6">
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
              <h2 className="text-2xl font-bold text-gray-900 mb-4">お知らせ</h2>
              <ul className="divide-y divide-gray-100">
                <li className="py-3">
                  <p className="text-sm text-gray-500 mb-1">2025-10-01</p>
                  <p className="text-gray-800">年末年始の営業日について</p>
                </li>
                <li className="py-3">
                  <p className="text-sm text-gray-500 mb-1">2025-09-15</p>
                  <p className="text-gray-800">指名予約の受付を開始しました</p>
                </li>
                <li className="py-3">
                  <p className="text-sm text-gray-500 mb-1">2025-09-01</p>
                  <p className="text-gray-800">台風接近時のご案内</p>
                </li>
              </ul>
            </div>

            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
              <h2 className="text-2xl font-bold text-gray-900 mb-4">広告・キャンペーン</h2>
              <div className="grid sm:grid-cols-2 gap-4">
                <div className="bg-blue-50 rounded-lg p-4">
                  <p className="text-sm font-semibold text-blue-900 mb-1">新規ご来店の方</p>
                  <p className="text-sm text-blue-800">カット10%OFF クーポン配布中</p>
                </div>
                <div className="bg-pink-50 rounded-lg p-4">
                  <p className="text-sm font-semibold text-pink-900 mb-1">平日限定</p>
                  <p className="text-sm text-pink-800">カラー+トリートメント セット割</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
