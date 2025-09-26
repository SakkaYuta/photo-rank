import React from 'react'

export function Footer() {
  const go = (view: string) => {
    import('@/utils/navigation').then(m => m.navigate(view))
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const isDev = import.meta.env.DEV || (import.meta as any).env?.VITE_ENABLE_SAMPLE === 'true'

  return (
    <footer className="mt-12 border-t border-gray-200 dark:border-gray-800 py-8 text-sm text-gray-600 dark:text-gray-400">
      <div className="mx-auto max-w-6xl px-4 flex flex-wrap gap-4 justify-between">
        <div className="space-y-2">
          <div className="font-semibold text-gray-900 dark:text-gray-200">ポリシー</div>
          <button className="hover:underline text-gray-900" onClick={() => go('terms')}>利用規約</button><br />
          <button className="hover:underline text-gray-900" onClick={() => go('privacy')}>プライバシーポリシー</button><br />
          <button className="hover:underline text-gray-900" onClick={() => go('refunds')}>返金ポリシー</button><br />
          <button className="hover:underline text-gray-900" onClick={() => go('commerce')}>特定商取引法に基づく表示</button>
        </div>

        {/* 開発者ツール（ローカルデータビューアー）は削除 */}

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
    </footer>
  )
}

export default Footer
