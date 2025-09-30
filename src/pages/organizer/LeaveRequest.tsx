import React, { useState, useEffect } from 'react'
import { useUserRole } from '@/hooks/useUserRole'
import { fetchOrganizerDashboard, generateInviteCode, inviteCreator } from '@/services/organizerService'
import { supabase } from '@/services/supabaseClient'

const LeaveRequest: React.FC = () => {
  const { userProfile } = useUserRole()
  const [reason, setReason] = useState('')
  const [submitted, setSubmitted] = useState(false)
  const [creators, setCreators] = useState<Array<{ id: string; name: string }>>([])
  const [creatorId, setCreatorId] = useState('')
  const [loading, setLoading] = useState(true)
  // 招待管理
  const [inviteEmail, setInviteEmail] = useState('')
  const [inviteLoading, setInviteLoading] = useState(false)
  const [generatedCode, setGeneratedCode] = useState('')
  const [showCodeModal, setShowCodeModal] = useState(false)

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
        <h1 className="text-2xl font-bold mb-4 text-gray-900">所属管理</h1>
        <div className="bg-green-50 border border-green-200 text-green-800 rounded-lg p-4">
          申請を受け付けました。担当者が確認の上、メールでご連絡いたします。<br />
          基本的に、所属解除は月末付けでの適用となります（状況により前後する場合があります）。
        </div>
      </div>
    )
  }

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <h1 className="text-2xl font-bold mb-4 text-gray-900">所属管理</h1>
      {/* 招待管理 */}
      <section className="bg-white rounded-lg shadow p-6 mb-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">招待管理</h2>
        <div className="flex flex-col sm:flex-row gap-3 mb-4">
          <button
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
            onClick={async () => {
              try {
                if (!userProfile?.id || !userProfile?.display_name) return
                const code = await generateInviteCode(userProfile.id, userProfile.display_name)
                setGeneratedCode(code)
                setShowCodeModal(true)
              } catch (e: any) {
                alert(e?.message || '招待コードの生成に失敗しました')
              }
            }}
          >招待コード生成</button>
        </div>
        <div className="border-t pt-4 mt-2">
          <label className="block text-sm font-medium text-gray-700 mb-2">直接招待（メールアドレス）</label>
          <div className="flex gap-2 items-center">
            <input
              type="email"
              placeholder="creator@example.com"
              className="flex-1 px-3 py-2 border rounded-lg"
              value={inviteEmail}
              onChange={e=>setInviteEmail(e.target.value)}
              disabled={inviteLoading}
            />
            <button
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
              disabled={inviteLoading || !inviteEmail.trim()}
              onClick={async () => {
                if (!userProfile?.id || !inviteEmail.trim()) return
                setInviteLoading(true)
                try {
                  await inviteCreator(userProfile.id, inviteEmail.trim())
                  setInviteEmail('')
                  alert('クリエイターへの招待メールを送信しました！')
                } catch (e:any) {
                  alert(e?.message || '招待に失敗しました')
                } finally { setInviteLoading(false) }
              }}
            >{inviteLoading ? '送信中...' : '招待を送信'}</button>
          </div>
          <p className="text-xs text-gray-500 mt-2">※ 正しいメールアドレスを入力してください。</p>
        </div>
      </section>

      {/* 所属解除申請 */}
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

      {/* 招待コード モーダル */}
      {showCodeModal && generatedCode && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-md mx-4">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-gray-900">招待コードが生成されました</h3>
              <button className="text-gray-400 hover:text-gray-600" onClick={() => { setShowCodeModal(false); setGeneratedCode('') }}>×</button>
            </div>
            <div className="bg-gray-50 border-2 border-dashed border-gray-300 rounded-lg p-6 text-center">
              <div className="text-3xl font-mono font-bold text-gray-900 mb-2 tracking-wider">{generatedCode}</div>
              <p className="text-sm text-gray-500">招待コード（7日間有効・最大10回）</p>
            </div>
            <div className="mt-4 flex justify-end gap-3">
              <button className="px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200" onClick={() => { navigator.clipboard.writeText(generatedCode); alert('コピーしました'); }}>コピー</button>
              <button className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700" onClick={() => { setShowCodeModal(false); setGeneratedCode('') }}>閉じる</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default LeaveRequest
