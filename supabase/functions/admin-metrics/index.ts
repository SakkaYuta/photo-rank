import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { getSupabaseAdmin, authenticateUser } from "../_shared/client.ts";
import { corsHeaders, corsPreflightResponse } from "../_shared/cors.ts";

type Metrics = {
  todayRevenue: number
  successRate: number
  expiredLocks: number
  recentErrors: Array<{ id: string; message: string; level: 'warning'|'error'; time: string }>
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return corsPreflightResponse()
  if (req.method !== 'POST') return new Response('Method Not Allowed', { status: 405, headers: corsHeaders })

  try {
    // Require authenticated user
    const user = await authenticateUser(req)
    const supabase = getSupabaseAdmin()

    // Optional: only allow admins/moderators
    try {
      const { data: u } = await supabase
        .from('users')
        .select('role')
        .eq('id', user.id)
        .single()
      const role = (u?.role || '').toLowerCase()
      if (role !== 'admin' && role !== 'moderator') {
        return new Response(JSON.stringify({ error: 'forbidden' }), { status: 403, headers: { ...corsHeaders, 'content-type': 'application/json' } })
      }
    } catch (_e) {
      // If users.role is unavailable, fall back to permissive access for authenticated users
    }

    // Time windows
    const now = new Date()
    const startOfToday = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), 0, 0, 0))
    const startOfTodayISO = startOfToday.toISOString()
    const since24hISO = new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString()

    // 1) Today's revenue
    let todayRevenue = 0
    try {
      const { data: rows } = await supabase
        .from('purchases')
        .select('price, purchased_at, status')
        .eq('status', 'paid')
        .gte('purchased_at', startOfTodayISO)
      todayRevenue = (rows || []).reduce((sum: number, r: any) => sum + (Number(r.price) || 0), 0)
    } catch (_) {}

    // 2) Success rate (last 24h): successes / (successes + failures)
    let successes = 0
    let failures = 0
    try {
      const succ = await supabase
        .from('purchases')
        .select('id', { count: 'exact', head: true })
        .eq('status', 'paid')
        .gte('purchased_at', since24hISO)
      successes = succ.count || 0
    } catch (_) {}
    try {
      const fail = await supabase
        .from('payment_failures')
        .select('id', { count: 'exact', head: true })
        .gte('created_at', since24hISO)
      failures = fail.count || 0
    } catch (_) {}
    const attempts = successes + failures
    const successRate = attempts > 0 ? Math.round((successes / attempts) * 1000) / 10 : 100

    // 3) Expired locks
    let expiredLocks = 0
    try {
      const ex = await supabase
        .from('work_availability')
        .select('id', { count: 'exact', head: true })
        .not('locked_until', 'is', null)
        .lt('locked_until', now.toISOString())
      expiredLocks = ex.count || 0
    } catch (_) {}

    // 4) Recent errors (last 5)
    const recentErrors: Metrics['recentErrors'] = []
    try {
      const { data: errs } = await supabase
        .from('payment_failures')
        .select('id, error_message, error_code, created_at')
        .order('created_at', { ascending: false })
        .limit(5)
      for (const e of errs || []) {
        const msg = (e as any).error_message || (e as any).error_code || 'payment failed'
        recentErrors.push({ id: String((e as any).id), message: msg, level: 'warning', time: (e as any).created_at })
      }
    } catch (_) {}

    const metrics: Metrics = { todayRevenue, successRate, expiredLocks, recentErrors }
    return new Response(JSON.stringify({ metrics }), { headers: { ...corsHeaders, 'content-type': 'application/json' } })
  } catch (e: any) {
    if (e?.message?.includes('Authorization') || e?.message?.includes('Invalid or expired token')) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: { ...corsHeaders, 'content-type': 'application/json' } })
    }
    return new Response(JSON.stringify({ error: e?.message || 'internal error' }), { status: 500, headers: { ...corsHeaders, 'content-type': 'application/json' } })
  }
})

