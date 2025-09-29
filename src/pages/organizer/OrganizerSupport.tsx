import React from 'react'

const OrganizerSupport: React.FC = () => {
  return (
    <div className="p-6 max-w-3xl mx-auto">
      <h1 className="text-2xl font-bold mb-4 text-gray-900">オーガナイザー窓口</h1>
      <p className="text-gray-700 mb-4">運用・機能に関するお問い合わせやご要望がある場合は、以下の窓口までご連絡ください。</p>
      <div className="bg-white rounded-lg shadow p-6 space-y-3">
        <div>
          <h2 className="font-semibold text-gray-900">メール</h2>
          <p className="text-gray-700"><a className="text-blue-600 underline" href="mailto:support@example.com">support@example.com</a></p>
        </div>
        <div>
          <h2 className="font-semibold text-gray-900">FAQ / ガイド</h2>
          <ul className="list-disc list-inside text-gray-700">
            <li><button className="text-blue-600 underline" onClick={() => import('@/utils/navigation').then(m => m.navigate('terms'))}>利用規約</button></li>
            <li><button className="text-blue-600 underline" onClick={() => import('@/utils/navigation').then(m => m.navigate('privacy'))}>プライバシーポリシー</button></li>
          </ul>
        </div>
      </div>
    </div>
  )
}

export default OrganizerSupport

