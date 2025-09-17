import { useEffect, useState } from 'react'
import { supabase } from '../../services/supabaseClient'
import type { User } from '../../types'

export function CreatorSearch() {
  const [q, setQ] = useState('')
  const [items, setItems] = useState<User[]>([])

  useEffect(() => {
    const handler = setTimeout(async () => {
      if (!q) { setItems([]); return }
      const { data, error } = await supabase
        .from('users')
        .select('*')
        .ilike('display_name', `%${q}%`)
        .eq('is_creator', true)
        .limit(20)
      if (!error) setItems((data || []) as User[])
    }, 300)
    return () => clearTimeout(handler)
  }, [q])

  return (
    <div className="p-4">
      <input
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder="クリエイター名で検索"
        className="mb-4 w-full rounded-md border border-gray-300 bg-white p-2 outline-none focus:ring-2 focus:ring-primary-500 dark:border-gray-700 dark:bg-gray-900"
      />
      <ul className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-3">
        {items.map(u => (
          <li key={u.id} className="card flex items-center gap-3">
            <img src={u.avatar_url || `https://api.dicebear.com/7.x/identicon/svg?seed=${u.id}`} className="h-12 w-12 rounded-full" />
            <div>
              <p className="font-medium">{u.display_name}</p>
              {u.bio && <p className="text-sm text-gray-600">{u.bio}</p>}
            </div>
          </li>
        ))}
      </ul>
    </div>
  )
}
