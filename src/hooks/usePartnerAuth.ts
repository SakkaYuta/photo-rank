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
        // Supabase 上の実パートナーを優先取得
        const real = await getCurrentPartnerProfile()
        if (active) {
          if (real) {
            setPartner(real)
          } else {
            // 実データがない場合のみデモユーザーにフォールバック
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
            } else {
              setPartner(null)
            }
          }
        }
      } finally {
        if (active) setLoading(false)
      }
    })()

    const { data: sub } = supabase.auth.onAuthStateChange(async () => {
      const p = await getCurrentPartnerProfile()
      if (p) setPartner(p)
      else {
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
        } else {
          setPartner(null)
        }
      }
    })
    
    return () => {
      active = false
      sub.subscription.unsubscribe()
    }
  }, [])

  // パートナー情報のリアルタイム反映（工場設定の変更を即時UIへ）
  useEffect(() => {
    const sample = (import.meta as any).env?.VITE_ENABLE_SAMPLE === 'true'
    if (!partner?.id || sample) return

    const channel = supabase
      .channel(`partner-auth-${partner.id}`)
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'manufacturing_partners',
        filter: `id=eq.${partner.id}`,
      }, async () => {
        const p = await getCurrentPartnerProfile()
        setPartner(p)
      })
      .subscribe()

    return () => {
      try { supabase.removeChannel(channel) } catch {}
    }
  }, [partner?.id])

  return { partner, loading }
}
