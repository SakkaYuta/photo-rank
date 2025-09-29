import React, { useEffect, useState } from 'react'
import { listPendingAssets, approveAsset, rejectAsset, OnlineAsset } from '@/services/admin-asset.service'

export const AssetApprovalQueue: React.FC = () => {
  const [items, setItems] = useState<OnlineAsset[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [reason, setReason] = useState<Record<string,string>>({})

  const load = async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await listPendingAssets()
      setItems(res)
    } catch (e: any) {
      setError(e?.message || '取得に失敗しました（DB適用後に有効化）')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [])

  const onApprove = async (id: string) => {
    setLoading(true)
    setError(null)
    try {
      await approveAsset(id)
      await load()
    } catch (e: any) {
      setError(e?.message || '承認に失敗しました')
    } finally {
      setLoading(false)
    }
  }

  const onReject = async (id: string) => {
    setLoading(true)
    setError(null)
    try {
      await rejectAsset(id, reason[id])
      await load()
    } catch (e: any) {
      setError(e?.message || '却下に失敗しました')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="p-6">
      <div className="flex items-center gap-3 mb-4">
        <h2 className="text-xl font-semibold">承認キュー</h2>
        <button className="btn btn-sm" onClick={load} disabled={loading}>再読込</button>
      </div>
      {error && <div className="alert alert-error mb-4">{error}</div>}
      {items.length === 0 && <div className="text-gray-500">承認待ちはありません。</div>}
      <div className="space-y-3">
        {items.map(it => (
          <div key={it.id} className="rounded border p-3">
            <div className="text-sm text-gray-600">ID: {it.id}</div>
            <div className="text-sm">URL: <a href={it.source_url} className="link" target="_blank" rel="noopener noreferrer">{it.source_url}</a></div>
            <div className="text-sm">提供元: {it.provider || '-'}</div>
            <div className="flex flex-wrap gap-2 mt-2 items-center">
              <button className="btn btn-success btn-sm" onClick={() => onApprove(it.id)} disabled={loading}>承認</button>
              <input className="input input-bordered input-sm w-64" placeholder="却下理由 (任意)" 
                value={reason[it.id] || ''} onChange={e => setReason(r => ({ ...r, [it.id]: e.target.value }))} />
              <button className="btn btn-error btn-sm" onClick={() => onReject(it.id)} disabled={loading}>却下</button>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

export default AssetApprovalQueue
