import { supabase } from '@/services/supabaseClient'

export const RateLimit = {
  // key example: `user:${userId}:action:update-refund`
  async allow(key: string, limit: number, windowSeconds: number, cost = 1): Promise<boolean> {
    try {
      const { data, error } = await (supabase as any).rpc('enforce_rate_limit', { p_key: key, p_limit: limit, p_window_seconds: windowSeconds, p_cost: cost })
      if (error) {
        if (import.meta.env.DEV) console.warn('[ratelimit] RPC error', error)
        return true // fail-open to avoid breaking UX; logs will capture server errors
      }
      return !!data
    } catch (e) {
      if (import.meta.env.DEV) console.warn('[ratelimit] call failed', e)
      return true
    }
  }
}

