import React from 'react'

export function Footer() {
  const go = (view: string) => {
    import('@/utils/navigation').then(m => m.navigate(view))
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const isDev = import.meta.env.DEV || (import.meta as any).env?.VITE_ENABLE_SAMPLE === 'true'

  return (
    <footer className="mt-12 border-t border-gray-200 dark:border-gray-800 py-8 text-sm text-gray-600 dark:text-gray-400">
      <div className="mx-auto max-w-6xl px-4">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {/* 運営会社 */}
          <div className="space-y-2">
            <div className="font-bold text-black">運営会社</div>
            <div className="space-y-1">
              <button className="block hover:underline text-gray-900" onClick={() => go('commerce')}>特定商取引法に基づく表示</button>
              <button className="block hover:underline text-gray-900" onClick={() => go('terms')}>ご利用規約</button>
              <button className="block hover:underline text-gray-900" onClick={() => go('privacy')}>プライバシーポリシー</button>
              <a href="https://seai.co.jp/" target="_blank" rel="noopener noreferrer" className="block hover:underline text-gray-900">コーポレートサイト</a>
              <button className="block hover:underline text-gray-900" onClick={() => go('careers')}>採用情報</button>
            </div>
          </div>

          {/* ご利用ガイド */}
          <div className="space-y-2">
            <div className="font-bold text-black">ご利用ガイド</div>
            <div className="space-y-1">
              <button className="block hover:underline text-gray-900" onClick={() => go('faq')}>よくある質問</button>
              <button className="block hover:underline text-gray-900" onClick={() => go('payment-methods')}>お支払方法</button>
              <button className="block hover:underline text-gray-900" onClick={() => go('receipt')}>領収書発行</button>
              <button className="block hover:underline text-gray-900" onClick={() => go('refunds')}>返品・交換</button>
            </div>
          </div>

          {/* サイト情報 */}
          <div className="space-y-2">
            <div>© {new Date().getFullYear()} Photo-Rank</div>
            <div className="text-xs">すべての価格は税込み表示です（送料は別途表示）。</div>
            {isDev && (
              <div className="text-xs text-blue-600 dark:text-blue-400">
                🚧 開発モード
              </div>
            )}
          </div>
        </div>
      </div>
    </footer>
  )
}

export default Footer
