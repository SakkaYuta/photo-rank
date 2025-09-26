import React, { useEffect, useRef, useState } from 'react'
import { allowedViews as ROUTES, ROUTES_META, type RoleKey } from '@/routes'
import { Menu, Home, Store, LayoutDashboard, Users, Building2, Calendar, Trophy, Shield, PlusSquare, Images, Gamepad2, Heart, Package } from 'lucide-react'

type NavItem = { key: string; label: string }

export function HamburgerMenu({ current, userType = 'general', isAdmin = false, hasProfile = false, buttonLabel = '✨ PhotoRank' }: {
  current: string
  userType?: string
  isAdmin?: boolean
  hasProfile?: boolean
  buttonLabel?: string
}) {
  const viewOverride = typeof window !== 'undefined' ? localStorage.getItem('view_override') : null
  const effectiveType = viewOverride === 'general' ? 'general' : userType
  let role: RoleKey = (effectiveType as RoleKey) || 'general'
  if (isAdmin) role = 'admin'

  const iconMap: Record<string, React.ComponentType<{ className?: string }>> = {
    Home, Store, LayoutDashboard, Users, Building2, Calendar, Trophy, Shield, PlusSquare, Images, Gamepad2, Heart, Package
  }

  const items: NavItem[] = (ROUTES as readonly string[])
    .filter((key) => {
      const meta = ROUTES_META[key as keyof typeof ROUTES_META]
      if (!meta?.showInNav) return false
      if (meta.requireAuth && !hasProfile) return false
      if (meta.roles && !meta.roles.includes(role)) return false
      return true
    })
    .map((key) => ({ key, label: ROUTES_META[key as keyof typeof ROUTES_META]?.title || key }))
    .sort((a, b) => {
      const ao = ROUTES_META[a.key as keyof typeof ROUTES_META]?.navOrder ?? 999
      const bo = ROUTES_META[b.key as keyof typeof ROUTES_META]?.navOrder ?? 999
      return ao - bo
    })

  const [open, setOpen] = useState(false)
  const menuRef = useRef<HTMLDivElement | null>(null)
  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (!menuRef.current) return
      if (!menuRef.current.contains(e.target as Node)) setOpen(false)
    }
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false) }
    document.addEventListener('click', onClick)
    document.addEventListener('keydown', onKey)
    return () => { document.removeEventListener('click', onClick); document.removeEventListener('keydown', onKey) }
  }, [])

  return (
    <div className="relative" ref={menuRef}>
      <button
        className="px-3 py-2 border rounded-lg hover:bg-gray-50 text-sm text-gray-900"
        title="ホームへ"
        onClick={() => import('@/utils/navigation').then(m => m.navigate('merch'))}
      >
        ✨ PhotoRank
      </button>

      {open && (
        <div className="absolute left-0 mt-2 w-64 rounded-lg border bg-white shadow-lg z-20">
          <ul className="py-2 max-h-[70vh] overflow-y-auto">
            {items.map((it) => (
              <li key={it.key}>
                <button
                  className={`w-full text-left px-3 py-2 text-sm flex items-center gap-2 transition-colors ${current === it.key ? 'bg-primary-50 text-primary-700' : 'text-gray-700 hover:bg-gray-50'}`}
                  onClick={() => { import('@/utils/navigation').then(m => m.navigate(it.key)); setOpen(false) }}
                >
                  {(() => {
                    const iconKey = ROUTES_META[it.key as keyof typeof ROUTES_META]?.icon
                    const IconComp = iconKey ? iconMap[iconKey] : undefined
                    return IconComp ? <IconComp className="w-4 h-4" /> : null
                  })()}
                  <span className="truncate">{it.label}</span>
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}
