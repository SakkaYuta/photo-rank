import React, { useState } from 'react'

const LeaveRequest: React.FC = () => {
  const [reason, setReason] = useState('')
  const [submitted, setSubmitted] = useState(false)

  const submit = async () => {
    if (!reason.trim()) { alert('理由を入力してください'); return }
    // 実装メモ: ここでSupabaseに所属解除申請を記録するエンドポイントを呼び出す
    setSubmitted(true)
  }

  if (submitted) {
    return (
      <div className="p-6 max-w-2xl mx-auto">
        <h1 className="text-2xl font-bold mb-4 text-gray-900">所属解除申請</h1>
        <div className="bg-green-50 border border-green-200 text-green-800 rounded-lg p-4">
          申請を受け付けました。担当者が確認の上、メールでご連絡いたします。
        </div>
      </div>
    )
  }

  return (
    <div className="p-6 max-w-2xl mx-auto">
      <h1 className="text-2xl font-bold mb-4 text-gray-900">所属解除申請</h1>
      <div className="bg-white rounded-lg shadow p-6 space-y-4">
        <p className="text-gray-700">所属解除の理由をご記入ください。運用へのご要望などもあれば併せてお知らせください。</p>
        <textarea className="textarea textarea-bordered w-full min-h-[140px]" value={reason} onChange={e=>setReason(e.target.value)} placeholder="理由を記載..." />
        <div className="flex justify-end">
          <button className="btn btn-primary" onClick={submit}>申請する</button>
        </div>
      </div>
    </div>
  )
}

export default LeaveRequest

