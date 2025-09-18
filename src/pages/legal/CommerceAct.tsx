import React from 'react'

export function CommerceAct() {
  return (
    <div className="max-w-3xl mx-auto p-6 space-y-4">
      <h1 className="text-2xl font-bold">特定商取引法に基づく表示</h1>
      <table className="w-full text-sm text-left">
        <tbody>
          <tr><th className="py-2 pr-4 text-gray-600">販売事業者</th><td>Photo-Rank 運営事業者名</td></tr>
          <tr><th className="py-2 pr-4 text-gray-600">運営責任者</th><td>責任者名</td></tr>
          <tr><th className="py-2 pr-4 text-gray-600">所在地</th><td>住所</td></tr>
          <tr><th className="py-2 pr-4 text-gray-600">お問い合わせ</th><td>contact@example.com</td></tr>
          <tr><th className="py-2 pr-4 text-gray-600">商品代金以外の必要料金</th><td>送料・決済手数料等</td></tr>
          <tr><th className="py-2 pr-4 text-gray-600">引き渡し時期</th><td>決済完了後、製造完了次第発送</td></tr>
          <tr><th className="py-2 pr-4 text-gray-600">お支払い方法</th><td>クレジットカード（Stripe）</td></tr>
          <tr><th className="py-2 pr-4 text-gray-600">返品・キャンセル</th><td>返金ポリシーをご参照ください</td></tr>
        </tbody>
      </table>
    </div>
  )
}

export default CommerceAct

