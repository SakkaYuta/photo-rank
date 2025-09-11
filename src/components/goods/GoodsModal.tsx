import { X } from 'lucide-react'
import { GOODS_TYPES } from '../../utils/constants'
import { formatJPY } from '../../utils/helpers'
import type { Work } from '../../types'
import { useState } from 'react'
import { createGoodsOrder } from '../../services/goods.service'
import { supabase } from '../../services/supabaseClient'

export function GoodsModal({ work, onClose }: { work: Work, onClose: () => void }) {
  const [goods, setGoods] = useState(GOODS_TYPES[0].id as string)
  const [qty, setQty] = useState(1)
  const [busy, setBusy] = useState(false)
  const selected = GOODS_TYPES.find(g => g.id === goods)!
  const total = selected.basePrice * qty

  const onOrder = async () => {
    setBusy(true)
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error('ログインが必要です')
      await createGoodsOrder({
        user_id: user.id,
        work_id: work.id,
        goods_type: goods,
        quantity: qty,
        total_price: total,
        status: 'processing',
        shipping_address: null,
        estimated_delivery: null,
      } as any)
      onClose()
      alert('グッズ注文が完了しました')
    } catch (e: any) {
      alert(e.message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="fixed inset-0 z-20 grid place-items-center bg-black/40 p-4">
      <div className="w-full max-w-md rounded-lg bg-white p-6 shadow-xl dark:bg-gray-900">
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-lg font-semibold">グッズ化オプション</h3>
          <button className="btn btn-outline" onClick={onClose}><X className="h-4 w-4" /></button>
        </div>
        <div className="space-y-3">
          <div className="flex items-center gap-3">
            <img src={work.thumbnail_url || work.image_url} className="h-16 w-16 rounded object-cover" />
            <div>
              <p className="font-medium">{work.title}</p>
            </div>
          </div>
          <label className="block">
            <span className="mb-1 block text-sm font-medium">グッズ種別</span>
            <select value={goods} onChange={(e) => setGoods(e.target.value)} className="w-full rounded-md border border-gray-300 bg-white p-2 dark:border-gray-700 dark:bg-gray-900">
              {GOODS_TYPES.map(g => <option key={g.id} value={g.id}>{g.label} (+{formatJPY(g.basePrice)})</option>)}
            </select>
          </label>
          <label className="block">
            <span className="mb-1 block text-sm font-medium">数量</span>
            <input type="number" min={1} value={qty} onChange={(e) => setQty(Math.max(1, parseInt(e.target.value || '1')))} className="w-full rounded-md border border-gray-300 bg-white p-2 dark:border-gray-700 dark:bg-gray-900" />
          </label>
          <div className="flex items-center justify-between">
            <span className="text-sm text-gray-600">合計</span>
            <span className="text-lg font-semibold">{formatJPY(total)}</span>
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <button className="btn btn-outline" onClick={onClose}>閉じる</button>
            <button className="btn btn-primary" onClick={onOrder} disabled={busy}>注文する</button>
          </div>
        </div>
      </div>
    </div>
  )
}

