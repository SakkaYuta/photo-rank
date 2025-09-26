import React from 'react'

export function LoginRequiredPopup({ onProceed, onClose }: { onProceed: () => void; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-30 grid place-items-center bg-black/40 p-4">
      <div className="w-full max-w-md rounded-lg bg-white p-6 shadow-xl">
        <h2 className="mb-3 text-lg font-semibold text-gray-900">ログインが必要です</h2>
        <p className="mb-6 text-sm text-gray-700">これ以上進めるには会員ログインが必要です。</p>
        <div className="flex justify-end gap-3">
          <button className="px-4 py-2 rounded-lg border border-gray-300 text-gray-700 hover:bg-gray-50" onClick={onClose}>閉じる</button>
          <button className="px-4 py-2 rounded-lg bg-blue-600 text-white hover:bg-blue-700" onClick={onProceed}>ログインする</button>
        </div>
      </div>
    </div>
  )
}

