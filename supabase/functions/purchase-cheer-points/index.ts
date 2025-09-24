import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { getSupabaseAdmin, authenticateUser } from '../_shared/client.ts'
import { corsHeaders, corsPreflightResponse } from '../_shared/cors.ts'

serve(async (req) => {
  if (req.method === 'OPTIONS') return corsPreflightResponse()
  if (req.method !== 'POST') return new Response('Method Not Allowed', { status: 405, headers: corsHeaders })
  try {
    const user = await authenticateUser(req)
    const supabase = getSupabaseAdmin()

    const body = await req.json().catch(() => ({})) as { battle_id?: string; creator_id?: string; points?: number }
    const { battle_id: battleId, creator_id: creatorId, points } = body
    if (!battleId || !creatorId || !points) return new Response(JSON.stringify({ error: 'battle_id, creator_id and points required' }), { status: 400, headers: { ...corsHeaders, 'content-type': 'application/json' } })

    // Allow-listed point tiers for transparency
    const allowedPoints = new Set([100, 1000, 10000, 100000])
    if (!allowedPoints.has(points)) return new Response(JSON.stringify({ error: 'invalid points' }), { status: 400, headers: { ...corsHeaders, 'content-type': 'application/json' } })

    // Ensure battle exists and is live
    const { data: battle } = await supabase
      .from('battles')
      .select('id, status')
      .eq('id', battleId)
      .single()
    if (!battle) return new Response(JSON.stringify({ error: 'battle not found' }), { status: 404, headers: { ...corsHeaders, 'content-type': 'application/json' } })
    if (battle.status !== 'live') return new Response(JSON.stringify({ error: 'battle is not live' }), { status: 400, headers: { ...corsHeaders, 'content-type': 'application/json' } })

    // Rate limit: purchases per 60min window (soft limit)
    try {
      const { data: canProceed } = await supabase.rpc('check_rate_limit', {
        p_user_id: user.id,
        p_action: 'cheer_points_purchase',
        p_limit: 200,
        p_window_minutes: 60
      })
      if (canProceed === false) return new Response(JSON.stringify({ error: 'Rate limit exceeded' }), { status: 429, headers: { ...corsHeaders, 'content-type': 'application/json' } })
    } catch (_) {}

    // Idempotency-Key enforcement to prevent duplicate charges
    const idemHeader = req.headers.get('Idempotency-Key') || (body as any)?.idempotency_key
    if (!idemHeader) {
      return new Response(JSON.stringify({ error: 'Idempotency-Key required' }), { status: 400, headers: { ...corsHeaders, 'content-type': 'application/json' } })
    }
    try {
      const { error: idemErr } = await supabase
        .from('idempotency_keys')
        .insert({ user_id: user.id, key: idemHeader, scope: 'purchase_cheer_points' })
      if (idemErr) {
        // Duplicate key indicates a retry/duplicate request
        return new Response(JSON.stringify({ error: 'Duplicate request' }), { status: 409, headers: { ...corsHeaders, 'content-type': 'application/json' } })
      }
    } catch (_) {}

    // TODO: Integrate Stripe payment verification here (server-side)
    // For now, record purchase and add points by inserting a cheer_tickets row with amount = points
    const { data, error } = await supabase
      .from('cheer_tickets')
      .insert({ battle_id: battleId, supporter_id: user.id, creator_id: creatorId, amount: points, exclusive_options: { mode: 'paid_points' } })
      .select('id, amount, purchased_at')
      .single()
    if (error) return new Response(JSON.stringify({ error: error.message }), { status: 400, headers: { ...corsHeaders, 'content-type': 'application/json' } })

    return new Response(JSON.stringify({ success: true, points: data.amount, purchased_at: data.purchased_at }), { headers: { ...corsHeaders, 'content-type': 'application/json' } })
  } catch (e: any) {
    if (e?.message?.includes('Authorization')) return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: { ...corsHeaders, 'content-type': 'application/json' } })
    return new Response(JSON.stringify({ error: e?.message ?? 'unknown error' }), { status: 500, headers: { ...corsHeaders, 'content-type': 'application/json' } })
  }
})
