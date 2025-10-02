import { useEffect, useState } from 'react'
import { supabase } from '../../services/supabaseClient'
import type { User } from '../../types'
import { resolveImageUrl } from '@/utils/imageFallback'
import { defaultImages } from '@/utils/defaultImages'

export function CreatorSearch() {
  const [q, setQ] = useState('')
  const [items, setItems] = useState<User[]>([])

  useEffect(() => {
    const handler = setTimeout(async () => {
      if (!q) { setItems([]); return }
      // v6: user_rolesでcreatorロールを持つユーザーを検索
      const { data: creatorRoles } = await supabase
        .from('user_roles')
        .select('user_id')
        .eq('role', 'creator')

      const creatorIds = (creatorRoles || []).map((r: any) => r.user_id)
      if (creatorIds.length === 0) { setItems([]); return }

      const { data, error } = await supabase
        .from('users_vw')
        .select('*')
        .ilike('display_name', `%${q}%`)
        .in('id', creatorIds)
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
            <img src={resolveImageUrl(u.avatar_url, [defaultImages.avatar])} alt={`${u.display_name}のアバター`} className="h-12 w-12 rounded-full" />
            <div>
              <p className="font-medium jp-text">{u.display_name}</p>
              {u.bio && <p className="text-sm text-gray-600 jp-text line-clamp-2">{u.bio}</p>}
            </div>
          </li>
        ))}
      </ul>
    </div>
  )
}
