import React, { createContext, useContext, useEffect, useMemo, useState } from 'react'
import { supabase } from '@/services/supabaseClient'

type FavoritesContextType = {
  ids: Set<string>
  add: (id: string) => void
  remove: (id: string) => void
  toggle: (id: string) => void
  has: (id: string) => boolean
}

const FavoritesContext = createContext<FavoritesContextType>({
  ids: new Set(),
  add: () => {},
  remove: () => {},
  toggle: () => {},
  has: () => false,
})

const STORAGE_KEY = 'favorites.v1'

export function FavoritesProvider({ children }: { children: React.ReactNode }) {
  const [ids, setIds] = useState<Set<string>>(new Set())

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY)
      if (raw) setIds(new Set(JSON.parse(raw)))
    } catch {}
  }, [])

  useEffect(() => {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(Array.from(ids))) } catch {}
  }, [ids])

  const isSample = (import.meta as any).env?.VITE_ENABLE_SAMPLE === 'true'

  const add = (id: string) => {
    setIds(prev => new Set(prev).add(id))
    ;(async () => {
      try {
        if (isSample) return
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) return
        await supabase
          .from('favorites')
          .upsert({ user_id: user.id, work_id: id }, { onConflict: 'user_id,work_id', ignoreDuplicates: true })
      } catch { /* noop */ }
    })()
  }

  const remove = (id: string) => {
    setIds(prev => { const n = new Set(prev); n.delete(id); return n })
    ;(async () => {
      try {
        if (isSample) return
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) return
        await supabase.from('favorites').delete().eq('user_id', user.id).eq('work_id', id)
      } catch { /* noop */ }
    })()
  }

  const toggle = (id: string) => {
    const wasFav = ids.has(id)
    setIds(prev => { const n = new Set(prev); wasFav ? n.delete(id) : n.add(id); return n })
    ;(async () => {
      try {
        if (isSample) return
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) return
        if (wasFav) {
          await supabase.from('favorites').delete().eq('user_id', user.id).eq('work_id', id)
        } else {
          await supabase.from('favorites').insert({ user_id: user.id, work_id: id })
        }
      } catch { /* noop */ }
    })()
  }
  const has = (id: string) => ids.has(id)

  const value = useMemo(() => ({ ids, add, remove, toggle, has }), [ids])
  return <FavoritesContext.Provider value={value}>{children}</FavoritesContext.Provider>
}

export function useFavorites() {
  return useContext(FavoritesContext)
}
