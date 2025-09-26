import { useEffect, useState } from 'react'
import type { Work } from '../../types'
import { myWorks } from '../../services/work.service'
import { supabase } from '../../services/supabaseClient'
import { ProductCard } from '@/components/product/ProductCard'
import { useRequireAuth } from '@/hooks/useRequireAuth'

export function MyWorks() {
  const [items, setItems] = useState<Work[]>([])
  const [loading, setLoading] = useState(true)
  const [highlightId, setHighlightId] = useState<string | null>(null)
  const { LoginGate } = useRequireAuth()

  useEffect(() => {
    let active = true
    ;(async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { setItems([]); setLoading(false); return }
      const data = await myWorks(user.id)
      if (active) setItems(data)
      setLoading(false)
      // ハイライト対象があればスクロール
      try {
        const id = localStorage.getItem('highlight_work_id')
        if (id) {
          setHighlightId(id)
          setTimeout(() => {
            const el = document.getElementById(`work-${id}`)
            if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' })
            // ハイライトは数秒で解除
            setTimeout(() => setHighlightId((prev) => (prev === id ? null : prev)), 2200)
            localStorage.removeItem('highlight_work_id')
          }, 50)
        }
      } catch {}
    })()
    return () => { active = false }
  }, [])

  if (loading) return <div className="p-4">読み込み中...</div>

  return (
    <div className="grid grid-cols-1 gap-4 p-4 md:grid-cols-2 lg:grid-cols-3">
      <LoginGate />
      {items.map((w) => (
        <div
          key={w.id}
          id={`work-${w.id}`}
          className={
            highlightId === w.id
              ? 'ring-2 ring-primary-500 rounded-lg transition-shadow'
              : ''
          }
        >
          <ProductCard
            id={w.id}
            imageUrl={w.thumbnail_url || w.image_url}
            title={w.title}
            price={w.price}
            badgeText={new Date(w.created_at).toLocaleDateString('ja-JP')}
          />
        </div>
      ))}
      {items.length === 0 && <div className="p-4 text-gray-500">作品はまだありません。</div>}
    </div>
  )
}
