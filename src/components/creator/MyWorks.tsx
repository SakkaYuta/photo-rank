import { useEffect, useState } from 'react'
import type { Work } from '../../types'
import { myWorks } from '../../services/work.service'
import { supabase } from '../../services/supabaseClient'
import { ProductCard } from '@/components/product/ProductCard'

export function MyWorks() {
  const [items, setItems] = useState<Work[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let active = true
    ;(async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { setItems([]); setLoading(false); return }
      const data = await myWorks(user.id)
      if (active) setItems(data)
      setLoading(false)
    })()
    return () => { active = false }
  }, [])

  if (loading) return <div className="p-4">読み込み中...</div>

  return (
    <div className="grid grid-cols-1 gap-4 p-4 md:grid-cols-2 lg:grid-cols-3">
      {items.map((w) => (
        <ProductCard
          key={w.id}
          id={w.id}
          imageUrl={w.thumbnail_url || w.image_url}
          title={w.title}
          price={w.price}
          badgeText={new Date(w.created_at).toLocaleDateString('ja-JP')}
        />
      ))}
      {items.length === 0 && <div className="p-4 text-gray-500">作品はまだありません。</div>}
    </div>
  )
}
