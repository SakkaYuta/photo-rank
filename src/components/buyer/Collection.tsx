import { useEffect, useState } from 'react'
import type { Work } from '../../types'
import { myPurchases } from '../../services/work.service'
import { supabase } from '../../services/supabaseClient'

type PurchaseItem = { id: string, purchased_at: string, work: Work }

export function Collection() {
  const [items, setItems] = useState<PurchaseItem[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let active = true
    ;(async () => {
      setLoading(true)
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { setItems([]); setLoading(false); return }
      const data = await myPurchases(user.id)
      if (active) setItems(data as any)
      setLoading(false)
    })()
    return () => { active = false }
  }, [])

  if (loading) return <div className="p-4">読み込み中...</div>

  return (
    <div className="grid grid-cols-1 gap-4 p-4 md:grid-cols-2 lg:grid-cols-3">
      {items.map(p => (
        <div key={p.id} className="card">
          <img src={p.work.thumbnail_url || p.work.image_url} className="mb-2 h-60 w-full rounded-md object-cover" />
          <div className="flex items-center justify-between">
            <div>
              <h3 className="font-semibold">{p.work.title}</h3>
              <p className="text-xs text-gray-500">購入日: {new Date(p.purchased_at).toLocaleDateString()}</p>
            </div>
          </div>
        </div>
      ))}
      {items.length === 0 && (
        <div className="p-4 text-gray-500">購入した作品はまだありません。</div>
      )}
    </div>
  )
}

