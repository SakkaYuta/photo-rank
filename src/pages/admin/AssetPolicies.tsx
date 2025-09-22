import React, { useEffect, useState } from 'react'
import { listAssetPolicies, upsertAssetPolicy, deleteAssetPolicy, AssetPolicy } from '@/services/admin-asset.service'

export const AssetPolicies: React.FC = () => {
  const [items, setItems] = useState<AssetPolicy[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [pattern, setPattern] = useState('')
  const [rule, setRule] = useState<'allow'|'deny'|'manual'>('manual')
  const [notes, setNotes] = useState('')

  const load = async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await listAssetPolicies()
      setItems(res)
    } catch (e: any) {
      setError(e?.message || '取得に失敗しました（DB適用後に有効化）')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [])

  const onUpsert = async () => {
    if (!pattern) return
    setLoading(true)
    setError(null)
    try {
      await upsertAssetPolicy({ pattern, rule, notes })
      setPattern(''); setNotes(''); setRule('manual')
      await load()
    } catch (e: any) {
      setError(e?.message || '保存に失敗しました')
    } finally {
      setLoading(false)
    }
  }

  const onDelete = async (id: string) => {
    if (!confirm('このポリシーを削除しますか？')) return
    setLoading(true)
    setError(null)
    try {
      await deleteAssetPolicy(id)
      await load()
    } catch (e: any) {
      setError(e?.message || '削除に失敗しました')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="p-6">
      <h2 className="text-xl font-semibold mb-4">アセットポリシー</h2>
      {error && <div className="alert alert-error mb-4">{error}</div>}
      <div className="mb-4 flex flex-wrap gap-2 items-end">
        <div>
          <label className="block text-sm">パターン（ドメイン/プロバイダ）</label>
          <input className="input input-bordered" value={pattern} onChange={e => setPattern(e.target.value)} placeholder="example.com" />
        </div>
        <div>
          <label className="block text-sm">ルール</label>
          <select className="select select-bordered" value={rule} onChange={e => setRule(e.target.value as any)}>
            <option value="allow">allow</option>
            <option value="manual">manual</option>
            <option value="deny">deny</option>
          </select>
        </div>
        <div>
          <label className="block text-sm">メモ</label>
          <input className="input input-bordered w-80" value={notes} onChange={e => setNotes(e.target.value)} />
        </div>
        <button className="btn btn-primary" onClick={onUpsert} disabled={loading}>追加/更新</button>
      </div>
      <div className="overflow-x-auto">
        <table className="table">
          <thead>
            <tr><th>パターン</th><th>ルール</th><th>メモ</th><th>更新</th><th></th></tr>
          </thead>
          <tbody>
            {items.map(it => (
              <tr key={it.id}>
                <td>{it.pattern}</td>
                <td><span className="badge">{it.rule}</span></td>
                <td className="max-w-sm truncate" title={it.notes}>{it.notes}</td>
                <td>{it.updated_at ? new Date(it.updated_at).toLocaleString() : '-'}</td>
                <td>
                  <button className="btn btn-sm btn-outline" onClick={() => onDelete(it.id)} disabled={loading}>削除</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

export default AssetPolicies

