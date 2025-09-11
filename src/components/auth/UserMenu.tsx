import { useState } from 'react'
import { useAuth } from '../../hooks/useAuth'
import { AuthModal } from './AuthModal'
import { signOut } from '../../services/auth.service'

export function UserMenu() {
  const { profile, loading } = useAuth()
  const [open, setOpen] = useState(false)

  if (loading) return <div className="h-8 w-24 animate-pulse rounded bg-gray-200 dark:bg-gray-800" />
  if (!profile) return (
    <>
      <button className="btn btn-primary" onClick={() => setOpen(true)}>ログイン</button>
      {open && <AuthModal onClose={() => setOpen(false)} />}
    </>
  )
  return (
    <div className="flex items-center gap-3">
      <img src={profile.avatar_url || `https://api.dicebear.com/7.x/identicon/svg?seed=${profile.id}`} alt="avatar" className="h-8 w-8 rounded-full" />
      <span className="text-sm">{profile.display_name}</span>
      <button className="btn btn-outline" onClick={() => signOut()}>ログアウト</button>
    </div>
  )
}

