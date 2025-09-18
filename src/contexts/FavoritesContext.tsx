import React, { createContext, useContext, useEffect, useMemo, useState } from 'react'

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

  const add = (id: string) => setIds(prev => new Set(prev).add(id))
  const remove = (id: string) => setIds(prev => { const n = new Set(prev); n.delete(id); return n })
  const toggle = (id: string) => setIds(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n })
  const has = (id: string) => ids.has(id)

  const value = useMemo(() => ({ ids, add, remove, toggle, has }), [ids])
  return <FavoritesContext.Provider value={value}>{children}</FavoritesContext.Provider>
}

export function useFavorites() {
  return useContext(FavoritesContext)
}

