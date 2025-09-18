import React from 'react'

export function Footer() {
  const go = (view: string) => {
    window.dispatchEvent(new CustomEvent('navigate', { detail: { view } }))
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }
  return (
    <footer className="mt-12 border-t border-gray-200 dark:border-gray-800 py-8 text-sm text-gray-600 dark:text-gray-400">
      <div className="mx-auto max-w-6xl px-4 flex flex-wrap gap-4 justify-between">
        <div className="space-y-2">
          <div className="font-semibold text-gray-900 dark:text-gray-200">ポリシー</div>
          <button className="hover:underline" onClick={() => go('terms')}>利用規約</button><br />
          <button className="hover:underline" onClick={() => go('privacy')}>プライバシーポリシー</button><br />
          <button className="hover:underline" onClick={() => go('refunds')}>返金ポリシー</button><br />
          <button className="hover:underline" onClick={() => go('commerce')}>特定商取引法に基づく表示</button>
        </div>
        <div className="space-y-2">
          <div>© {new Date().getFullYear()} Photo-Rank</div>
          <div className="text-xs">すべての価格は税込み表示です（送料は別途表示）。</div>
        </div>
      </div>
    </footer>
  )
}

export default Footer

