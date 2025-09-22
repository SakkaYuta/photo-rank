import { useEffect, useState } from 'react'
import { supabase } from '../services/supabaseClient'
import { getCurrentPartnerProfile } from '../services/partner.service'
import { getDemoUser } from '../services/auth.service'
import type { ManufacturingPartner } from '../types'

export function usePartnerAuth() {
  const [partner, setPartner] = useState<ManufacturingPartner | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let active = true
    ;(async () => {
      try {
        // デモユーザー（工場）の場合は擬似パートナーを返す
        const demo = getDemoUser()
        if (demo && (demo.user_type === 'factory' || demo.is_factory)) {
          if (active) {
            setPartner({
              id: 'demo-partner-1',
              name: 'デモ製造パートナー',
              contact_email: 'partner@example.com',
              status: 'approved',
              avg_rating: 4.6,
              ratings_count: 18,
              created_at: new Date().toISOString(),
            } as any)
            setLoading(false)
          }
          return
        }
        const p = await getCurrentPartnerProfile()
        if (active) setPartner(p)
      } finally {
        if (active) setLoading(false)
      }
    })()

    const { data: sub } = supabase.auth.onAuthStateChange(async () => {
      // 認証変更時もデモユーザーを優先
      const demo = getDemoUser()
      if (demo && (demo.user_type === 'factory' || demo.is_factory)) {
        setPartner({
          id: 'demo-partner-1',
          name: 'デモ製造パートナー',
          contact_email: 'partner@example.com',
          status: 'approved',
          avg_rating: 4.6,
          ratings_count: 18,
          created_at: new Date().toISOString(),
        } as any)
        return
      }
      const p = await getCurrentPartnerProfile()
      setPartner(p)
    })
    
    return () => {
      active = false
      sub.subscription.unsubscribe()
    }
  }, [])

  return { partner, loading }
}
