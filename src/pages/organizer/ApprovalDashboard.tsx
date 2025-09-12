import { useEffect, useState } from 'react'
import { supabase } from '../../services/supabaseClient'
import { useAuth } from '../../hooks/useAuth'

type ApprovalRow = {
  id: string
  work_id: string
  organizer_id: string
  status: 'pending'|'approved'|'rejected'
  requested_at: string
  works: {
    id: string
    title: string
    image_url?: string
    creator_id: string
    users?: { display_name?: string }
  }
}

export const ApprovalDashboard = () => {
  const { profile } = useAuth()
  const [rows, setRows] = useState<ApprovalRow[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!profile?.id) return
    fetchPending()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profile?.id])

  const fetchPending = async () => {
    setLoading(true)
    const { data, error } = await supabase
      .from('publishing_approvals')
      .select(`*, works ( id, title, image_url, creator_id, users ( display_name ) )`)
      .eq('status', 'pending')
      .eq('organizer_id', profile!.id)

    if (!error) setRows((data as any) || [])
    setLoading(false)
  }

  const handleApproval = async (workId: string, approved: boolean, reason?: string) => {
    if (!profile?.id) return
    const { error } = await supabase.rpc('approve_publishing', {
      p_work_id: workId,
      p_organizer_id: profile.id,
      p_approved: approved,
      p_reviewer_id: profile.id,
      p_reason: reason ?? null
    })
    if (!error) await fetchPending()
  }

  if (loading) return <div className="p-6">読み込み中...</div>

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-6">出品承認管理</h1>
      <div className="grid gap-4">
        {rows.map((approval) => (
          <div key={approval.id} className="border rounded-lg p-4">
            <div className="flex gap-4">
              {approval.works?.image_url && (
                <img src={approval.works.image_url} alt={approval.works.title} className="w-32 h-32 object-cover rounded" />
              )}
              <div className="flex-1">
                <h3 className="font-semibold">{approval.works?.title}</h3>
                <p className="text-sm text-gray-600">作成者: {approval.works?.users?.display_name ?? '—'}</p>
                <p className="text-sm text-gray-500">申請日: {new Date(approval.requested_at).toLocaleDateString()}</p>
              </div>
              <div className="flex flex-col gap-2">
                <button onClick={() => handleApproval(approval.work_id, true)} className="px-4 py-2 bg-green-600 text-white rounded">承認</button>
                <button onClick={() => {
                  const reason = window.prompt('却下理由を入力してください') || undefined
                  handleApproval(approval.work_id, false, reason)
                }} className="px-4 py-2 bg-red-600 text-white rounded">却下</button>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

export default ApprovalDashboard

