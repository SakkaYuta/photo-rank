import React, { useState, useEffect } from 'react'
import { useUserRole } from '@/hooks/useUserRole'
import { fetchOrganizerDashboard } from '@/services/organizerService'
import { supabase } from '@/services/supabaseClient'

const LeaveRequest: React.FC = () => {
  const { userProfile } = useUserRole()
  const [reason, setReason] = useState('')
  const [submitted, setSubmitted] = useState(false)
  const [creators, setCreators] = useState<Array<{ id: string; name: string }>>([])
  const [creatorId, setCreatorId] = useState('')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    (async () => {
      try {
        if (!userProfile?.id) return
        const data = await fetchOrganizerDashboard(userProfile.id)
        setCreators((data.creators || []).map(c => ({ id: c.id, name: c.name })))
      } finally { setLoading(false) }
    })()
  }, [userProfile?.id])

  const submit = async () => {
    if (!creatorId) { alert('対象クリエイターを選択してください'); return }
    if (!reason.trim()) { alert('理由を入力してください'); return }
    try {
      const organizerId = userProfile?.id as string
      // 月末を算出
      const now = new Date()
      const endOfMonth = new Date(now.getFullYear(), now.getMonth()+1, 0)
      const effective_date = endOfMonth.toISOString().slice(0,10)
      await supabase.from('organizer_leave_requests').insert({
        organizer_id: organizerId,
        creator_id: creatorId,
        reason,
        effective_date,
        status: 'pending'
      })
      setSubmitted(true)
    } catch (e:any) {
      alert(e?.message || '申請の送信に失敗しました')
    }
  }

  if (submitted) {
    return (
      <div className="p-6 max-w-2xl mx-auto">
        <h1 className="text-2xl font-bold mb-4 text-gray-900">所属解除申請</h1>
        <div className="bg-green-50 border border-green-200 text-green-800 rounded-lg p-4">
          申請を受け付けました。担当者が確認の上、メールでご連絡いたします。<br />
          基本的に、所属解除は月末付けでの適用となります（状況により前後する場合があります）。
        </div>
      </div>
    )
  }

  return (
    <div className="p-6 max-w-2xl mx-auto">
      <h1 className="text-2xl font-bold mb-4 text-gray-900">所属解除申請</h1>
      <div className="bg-white rounded-lg shadow p-6 space-y-4">
        <div>
          <label className="block text-sm text-gray-900 mb-1">対象クリエイター</label>
          {loading ? (
            <div className="text-sm text-gray-600">読み込み中...</div>
          ) : (
            <select className="input input-bordered w-full" value={creatorId} onChange={e=>setCreatorId(e.target.value)}>
              <option value="">選択してください</option>
              {creators.map(c => (
                <option key={c.id} value={c.id}>{c.name}（ID: {c.id}）</option>
              ))}
            </select>
          )}
        </div>
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
