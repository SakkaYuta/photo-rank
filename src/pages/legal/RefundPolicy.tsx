import React from 'react'

export function RefundPolicy() {
  return (
    <div className="max-w-3xl mx-auto p-6 space-y-4">
      <h1 className="text-2xl font-bold">返金ポリシー</h1>
      <p className="text-sm text-black dark:text-black">返金・キャンセルの条件を定めます。</p>
      <ul className="list-disc list-inside space-y-2 text-black dark:text-black">
        <li>不良・欠陥時の対応</li>
        <li>発送前キャンセルの可否・手数料</li>
        <li>返金方法・所要日数</li>
      </ul>
    </div>
  )
}

export default RefundPolicy
