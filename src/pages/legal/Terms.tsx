import React from 'react'

export function Terms() {
  return (
    <div className="max-w-3xl mx-auto p-6 space-y-4">
      <h1 className="text-2xl font-bold">利用規約</h1>
      <p className="text-sm text-gray-600 dark:text-gray-400">本サービスをご利用いただく前に、本規約をお読みください。</p>
      <ul className="list-disc list-inside space-y-2 text-gray-800 dark:text-gray-200">
        <li>本サービスの目的および提供内容</li>
        <li>アカウント・セキュリティ</li>
        <li>禁止事項（不正、権利侵害、迷惑行為等）</li>
        <li>決済・返金・キャンセルに関する条件</li>
        <li>免責事項・責任制限</li>
        <li>準拠法・管轄</li>
      </ul>
    </div>
  )
}

export default Terms

