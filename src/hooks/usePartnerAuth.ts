import { useEffect, useState } from 'react'
import { supabase } from '../services/supabaseClient'
import { getCurrentPartnerProfile } from '../services/partner.service'
import type { ManufacturingPartner } from '../types'

export function usePartnerAuth() {
  const [partner, setPartner] = useState<ManufacturingPartner | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let active = true
    ;(async () => {
      try {
        const p = await getCurrentPartnerProfile()
        if (active) setPartner(p)
      } finally {
        if (active) setLoading(false)
      }
    })()

    const { data: sub } = supabase.auth.onAuthStateChange(async () => {
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