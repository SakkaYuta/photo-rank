import { useEffect, useState } from 'react'
import type { GoodsOrder } from '../types'
import { listMyGoodsOrders } from '../services/goods.service'
import { supabase } from '../services/supabaseClient'

export function useMyGoodsOrders() {
  const [orders, setOrders] = useState<GoodsOrder[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let active = true
    ;(async () => {
      setLoading(true)
      try {
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) {
          if (active) setOrders([])
        } else {
          const data = await listMyGoodsOrders(user.id)
          if (active) setOrders(data)
        }
      } catch (e: any) {
        setError(e.message)
      } finally {
        if (active) setLoading(false)
      }
    })()
    return () => { active = false }
  }, [])

  return { orders, loading, error }
}

