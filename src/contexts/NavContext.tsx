import React, { createContext, useContext } from 'react'

type NavContextType = {
  navigate: (view: string) => void
}

const NavContext = createContext<NavContextType | null>(null)

export function NavProvider({ navigate, children }: { navigate: (view: string) => void; children: React.ReactNode }) {
  return <NavContext.Provider value={{ navigate }}>{children}</NavContext.Provider>
}

export function useNav() {
  const ctx = useContext(NavContext)
  if (!ctx) return { navigate: (_v: string) => {} }
  return ctx
}
