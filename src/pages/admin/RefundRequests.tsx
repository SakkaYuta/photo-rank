import React, { useEffect, useState } from 'react'
import { AdminRefundService, type AdminRefundRequestRow, type RefundRequestStatus } from '@/services/admin-refund.service'

// v6: 'refunded' → 'processed', 'rejected' 除外
const STATUS_LABEL: Record<RefundRequestStatus, string> = {
  requested: '申請中',
  processing: '処理中',
  processed: '返金済み',
  failed: '失敗',
}

export const RefundRequests: React.FC = () => {
  const [items, setItems] = useState<AdminRefundRequestRow[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [filter, setFilter] = useState<RefundRequestStatus | ''>('')
  const [adminNote, setAdminNote] = useState<Record<string, string>>({})

  const load = async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await AdminRefundService.listRefundRequests(filter || undefined)
      setItems(res)
    } catch (e: any) {
      setError(e?.message || '取得に失敗しました（DB適用後に有効化）')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [filter])

  const updateStatus = async (id: string, status: RefundRequestStatus) => {
    setLoading(true)
    setError(null)
    try {
      await AdminRefundService.updateStatus(id, status, adminNote[id])
      await load()
    } catch (e: any) {
      setError(e?.message || '更新に失敗しました')
    } finally {
      setLoading(false)
    }
  }

  const executeRefund = async (id: string) => {
    if (!confirm('この申請を返金処理しますか？')) return
    setLoading(true)
    setError(null)
    try {
      await AdminRefundService.executeRefund(id)
      await load()
    } catch (e: any) {
      setError(e?.message || '返金実行に失敗しました')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="p-6">
      <div className="flex flex-wrap items-end gap-3 mb-4">
        <h2 className="text-xl font-semibold">返金申請</h2>
        <select className="select select-bordered select-sm" value={filter} onChange={e => setFilter(e.target.value as any)}>
          <option value="">すべて</option>
          <option value="requested">申請中</option>
          <option value="processing">処理中</option>
          <option value="processed">返金済み</option>
          <option value="failed">失敗</option>
        </select>
        <button className="btn btn-sm" onClick={load} disabled={loading}>再読込</button>
      </div>
      {error && <div className="alert alert-error mb-4">{error}</div>}
      {items.length === 0 && <div className="text-gray-500">申請はありません。</div>}
      <div className="space-y-3">
        {items.map(it => (
          <div key={it.id} className="rounded border p-4 bg-white">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <span className="badge badge-outline">{STATUS_LABEL[it.state]}</span>
                <div className="text-sm text-gray-600">{new Date(it.created_at).toLocaleString()}</div>
              </div>
              <div className="text-sm text-gray-500">ID: {it.id}</div>
            </div>
            <div className="mt-2 grid grid-cols-1 md:grid-cols-4 gap-2 text-sm">
              <div>
                <div className="text-gray-500">ユーザー</div>
                <div>{it.user?.display_name || it.user?.email || 'N/A'}</div>
              </div>
              <div>
                <div className="text-gray-500">決済ID</div>
                <div>{it.payment?.id || it.payment_id}</div>
              </div>
              <div>
                <div className="text-gray-500">金額</div>
                <div>¥{(it.amount_jpy || 0).toLocaleString()}</div>
              </div>
              <div>
                <div className="text-gray-500">理由</div>
                <div className="truncate" title={it.reason || ''}>{it.reason || '-'}</div>
              </div>
            </div>
            {it.stripe_refund_id && (
              <div className="mt-3 rounded border p-2 bg-green-50">
                <div className="text-xs text-gray-600 mb-1">Stripe返金ID</div>
                <div className="text-xs font-mono text-gray-800">{it.stripe_refund_id}</div>
              </div>
            )}
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <input
                className="input input-bordered input-sm w-72"
                placeholder="管理メモ (任意)"
                value={adminNote[it.id] || ''}
                onChange={e => setAdminNote(v => ({ ...v, [it.id]: e.target.value }))}
              />
              {it.state === 'requested' && (
                <>
                  <button className="btn btn-sm" onClick={() => updateStatus(it.id, 'processing')} disabled={loading}>処理中にする</button>
                  <button className="btn btn-sm btn-primary" onClick={() => executeRefund(it.id)} disabled={loading}>返金を実行</button>
                </>
              )}
              {it.state === 'processing' && (
                <>
                  <button className="btn btn-sm btn-primary" onClick={() => executeRefund(it.id)} disabled={loading}>返金を実行</button>
                  <button className="btn btn-sm btn-outline" onClick={() => updateStatus(it.id, 'requested')} disabled={loading}>申請中に戻す</button>
                </>
              )}
              {it.state === 'failed' && (
                <>
                  <button className="btn btn-sm btn-primary" onClick={() => executeRefund(it.id)} disabled={loading}>再実行</button>
                  <button className="btn btn-sm btn-outline" onClick={() => updateStatus(it.id, 'processing')} disabled={loading}>処理中に戻す</button>
                </>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

export default RefundRequests
