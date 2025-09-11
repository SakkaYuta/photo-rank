import { useEffect, useState } from 'react'
import type { Work } from '../../types'
import { myWorks } from '../../services/work.service'
import { supabase } from '../../services/supabaseClient'

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
        <div key={w.id} className="card">
          <img src={w.thumbnail_url || w.image_url} className="mb-2 h-60 w-full rounded-md object-cover" />
          <h3 className="font-semibold">{w.title}</h3>
          <p className="text-xs text-gray-500">{new Date(w.created_at).toLocaleString()}</p>
        </div>
      ))}
      {items.length === 0 && <div className="p-4 text-gray-500">作品はまだありません。</div>}
    </div>
  )
}

