import React, { useEffect, useState } from 'react'
import { listMyLiveOffers, publishLiveOffer, archiveLiveOffer } from '@/services/liveOffers.service'
import LiveOfferModal from './LiveOfferModal'

export const LiveOffersList: React.FC = () => {
  const [items, setItems] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [busyId, setBusyId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [editing, setEditing] = useState<any | null>(null)

  const refresh = async () => {
    try {
      setLoading(true)
      const list = await listMyLiveOffers()
      setItems(list)
      setError(null)
    } catch (e: any) {
      setError(e?.message || '読み込みに失敗しました')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { refresh() }, [])

  const onPublish = async (id: string) => {
    try {
      setBusyId(id)
      await publishLiveOffer(id)
      await refresh()
    } catch (e) {
      console.error(e)
    } finally {
      setBusyId(null)
    }
  }
  const onArchive = async (id: string) => {
    try {
      setBusyId(id)
      await archiveLiveOffer(id)
      await refresh()
    } catch (e) {
      console.error(e)
    } finally {
      setBusyId(null)
    }
  }

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200">
      <div className="p-4 sm:p-6 border-b">
        <h2 className="text-lg sm:text-xl font-semibold text-gray-900">ライブ限定オファー</h2>
        <p className="text-xs text-gray-500 mt-1">既存の出品にライブ限定特典を付与したオファー一覧</p>
      </div>
      <div className="p-4 sm:p-6">
        {loading ? (
          <div className="text-gray-500 text-sm">読み込み中...</div>
        ) : error ? (
          <div className="text-red-600 text-sm">{error}</div>
        ) : items.length === 0 ? (
          <div className="text-gray-500 text-sm">オファーはありません。作品一覧から「ライブ限定」を選んで作成できます。</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="text-left text-gray-600">
                  <th className="py-2 pr-3">作品</th>
                  <th className="py-2 pr-3">状態</th>
                  <th className="py-2 pr-3">期間</th>
                  <th className="py-2 pr-3">在庫</th>
                  <th className="py-2 pr-3">特典</th>
                  <th className="py-2 pr-3">操作</th>
                </tr>
              </thead>
              <tbody>
                {items.map((it) => {
                  const available = Math.max(0, (it.stock_total||0) - (it.stock_reserved||0) - (it.stock_sold||0))
                  return (
                    <tr key={it.id} className="border-t">
                      <td className="py-2 pr-3">{it.work_id?.slice(0,8)}…</td>
                      <td className="py-2 pr-3">
                        <span className={`px-2 py-0.5 rounded-full text-xs ${
                          it.status==='published' ? 'bg-green-100 text-green-800' : it.status==='draft' ? 'bg-yellow-100 text-yellow-800' : 'bg-gray-100 text-gray-600'
                        }`}>{it.status}</span>
                      </td>
                      <td className="py-2 pr-3 whitespace-nowrap">{new Date(it.start_at).toLocaleString()} 〜 {new Date(it.end_at).toLocaleString()}</td>
                      <td className="py-2 pr-3">{available}/{it.stock_total}</td>
                      <td className="py-2 pr-3">{it.perks_type}</td>
                      <td className="py-2 pr-3">
                        <div className="flex gap-2">
                          {it.status==='draft' && (
                            <button className="btn btn-xs btn-primary" disabled={busyId===it.id} onClick={()=>onPublish(it.id)}>{busyId===it.id?'処理中...':'公開'}</button>
                          )}
                          <button className="btn btn-xs" onClick={()=>setEditing(it)}>編集</button>
                          {it.status!=='archived' && (
                            <button className="btn btn-xs" disabled={busyId===it.id} onClick={()=>onArchive(it.id)}>{busyId===it.id?'処理中...':'アーカイブ'}</button>
                          )}
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
      {editing && (
        <LiveOfferModal isOpen={!!editing} onClose={()=>{ setEditing(null); refresh() }} offer={editing} />
      )}
    </div>
  )
}

export default LiveOffersList
