import { useEffect, useState } from 'react'
import { supabase } from '../services/supabaseClient'
import { getCurrentUserProfile } from '../services/auth.service'
import type { User } from '../types'

export function useAuth() {
  const [profile, setProfile] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let active = true
    ;(async () => {
      try {
        const p = await getCurrentUserProfile()
        if (active) setProfile(p)
      } finally {
        if (active) setLoading(false)
      }
    })()

    const { data: sub } = supabase.auth.onAuthStateChange(async () => {
      const p = await getCurrentUserProfile()
      setProfile(p)
    })
    return () => {
      active = false
      sub.subscription.unsubscribe()
    }
  }, [])

  return { profile, loading }
}

