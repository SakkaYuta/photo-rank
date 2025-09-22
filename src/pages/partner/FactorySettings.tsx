import React, { useEffect, useState } from 'react'
import { usePartnerAuth } from '@/hooks/usePartnerAuth'
import { getPartnerProducts } from '@/services/partner.service'
import { useNav } from '@/contexts/NavContext'

const FactorySettings: React.FC = () => {
  const { partner, loading } = usePartnerAuth()
  const { navigate } = useNav()
  const [webhookUrl, setWebhookUrl] = useState('')
  const [notificationEmail, setNotificationEmail] = useState('')
  const [products, setProducts] = useState<any[]>([])
  const [saving, setSaving] = useState(false)
  const sample = (import.meta as any).env?.VITE_ENABLE_SAMPLE === 'true'

  useEffect(() => {
    (async () => {
      if (partner?.id) {
        const ps = await getPartnerProducts(partner.id)
        setProducts(ps || [])
      } else if (sample) {
        setProducts([{ id: 'prod-1', product_type: 'tshirt', base_cost: 1500 }, { id: 'prod-2', product_type: 'mug', base_cost: 800 }] as any)
      }
      // demo values
      setWebhookUrl('https://example.com/webhook')
      setNotificationEmail(partner?.contact_email || 'partner@example.com')
    })()
  }, [partner?.id])

  const onSave = async () => {
    setSaving(true)
    try {
      if (sample) {
        alert('（サンプル）設定を保存しました')
        return
      }
      // TODO: 実装（設定テーブルに保存、またはEdge Functionへ）
      alert('設定の保存は準備中です（本番DB適用後に有効化）')
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return <div className="p-6">読み込み中...</div>
  }

  return (
    <div className="p-6 max-w-3xl mx-auto">
      <h1 className="text-2xl font-bold mb-4 text-gray-900">工場設定</h1>

      {/* Tab Navigation */}
      <div className="mb-6 border-b">
        <nav className="-mb-px flex space-x-8">
          <button
            onClick={() => navigate('factory-dashboard')}
            className="py-2 px-1 border-b-2 border-transparent font-medium text-sm text-gray-500 hover:text-gray-700 hover:border-gray-300"
          >
            ダッシュボード
          </button>
          <button
            className="py-2 px-1 border-b-2 border-blue-500 font-medium text-sm text-blue-600"
          >
            設定
          </button>
        </nav>
      </div>

      <div className="bg-white rounded-lg shadow p-6 space-y-4">
        <div>
          <label className="block text-sm text-gray-900 mb-1">工場名</label>
          <input className="input input-bordered w-full" value={partner?.name || 'デモ製造パートナー'} readOnly />
        </div>
        <div>
          <label className="block text-sm text-gray-900 mb-1">通知メール</label>
          <input className="input input-bordered w-full" value={notificationEmail} onChange={e=>setNotificationEmail(e.target.value)} />
        </div>
        <div>
          <label className="block text-sm text-gray-900 mb-1">Webhook URL</label>
          <input className="input input-bordered w-full" value={webhookUrl} onChange={e=>setWebhookUrl(e.target.value)} />
          <p className="text-xs text-gray-900 mt-1">注文作成/更新時に通知します（Stripe決済/製造連携用）</p>
        </div>
        <div>
          <label className="block text-sm text-gray-900 mb-2">有効な商品種別</label>
          <div className="flex flex-wrap gap-2">
            {products.map(p => (
              <span key={p.id} className="badge badge-outline">{p.product_type}</span>
            ))}
            {products.length === 0 && <span className="text-sm text-gray-900">商品が見つかりません</span>}
          </div>
        </div>
        <div className="flex justify-end">
          <button className="btn btn-primary" onClick={onSave} disabled={saving}>{saving ? '保存中...' : '保存'}</button>
        </div>
      </div>
    </div>
  )
}

export default FactorySettings

