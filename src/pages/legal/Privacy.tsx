import React from 'react'

export function Privacy() {
  return (
    <div className="max-w-3xl mx-auto p-6 space-y-4">
      <h1 className="text-2xl font-bold">プライバシーポリシー</h1>
      <p className="text-sm text-gray-600 dark:text-gray-400">個人情報の取扱いについて定めます。</p>
      <ul className="list-disc list-inside space-y-2 text-gray-800 dark:text-gray-200">
        <li>収集する情報・利用目的</li>
        <li>第三者提供・委託</li>
        <li>安全管理措置</li>
        <li>開示・訂正・削除の手続き</li>
        <li>お問い合わせ窓口</li>
      </ul>
    </div>
  )
}

export default Privacy

