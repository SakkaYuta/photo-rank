import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { getSupabaseAdmin, authenticateUser } from '../_shared/client.ts'
import { corsHeaders, corsPreflightResponse } from '../_shared/cors.ts'

serve(async (req) => {
  if (req.method === 'OPTIONS') return corsPreflightResponse()
  if (req.method !== 'POST') return new Response('Method Not Allowed', { status: 405, headers: corsHeaders })
  try {
    const user = await authenticateUser(req)
    const supabase = getSupabaseAdmin()

    const body = await req.json().catch(() => ({})) as { battle_id?: string; creator_id?: string; options?: Record<string, unknown> }
    const { battle_id: battleId, creator_id: creatorId, options } = body
    if (!battleId || !creatorId) return new Response(JSON.stringify({ error: 'battle_id and creator_id required' }), { status: 400, headers: { ...corsHeaders, 'content-type': 'application/json' } })

    // basic existence check
    const { data: battle } = await supabase
      .from('battles')
      .select('id, status, challenger_id, opponent_id')
      .eq('id', battleId)
      .single()
    if (!battle) return new Response(JSON.stringify({ error: 'battle not found' }), { status: 404, headers: { ...corsHeaders, 'content-type': 'application/json' } })
    if (battle.status !== 'live') return new Response(JSON.stringify({ error: 'battle is not live' }), { status: 400, headers: { ...corsHeaders, 'content-type': 'application/json' } })
    if (![battle.challenger_id, battle.opponent_id].includes(creatorId)) return new Response(JSON.stringify({ error: 'invalid creator_id' }), { status: 400, headers: { ...corsHeaders, 'content-type': 'application/json' } })

    // Free mode only; paid should go via create-cheer-points-intent
    const isFree = options && (options as any).mode === 'free'
    if (!isFree) {
      return new Response(JSON.stringify({ error: 'paid cheer not allowed here. use create-cheer-points-intent' }), { status: 410, headers: { ...corsHeaders, 'content-type': 'application/json' } })
    }

    // Rate limit per user (free cheer)
    try {
      const { data: res } = await supabase.rpc('use_free_cheer', {
        p_user_id: user.id,
        p_battle_id: battleId,
        p_limit: 30,
        p_window_minutes: 60
      })
      const allowed = Array.isArray(res) ? (res[0]?.allowed ?? res?.allowed) : (res as any)?.allowed
      if (!allowed) {
        return new Response(JSON.stringify({ error: 'Free cheer limit exceeded' }), { status: 429, headers: { ...corsHeaders, 'content-type': 'application/json' } })
      }
    } catch (_) {}

    const { data, error } = await supabase
      .from('cheer_tickets')
      .insert({ battle_id: battleId, supporter_id: user.id, creator_id: creatorId, amount: 100, exclusive_options: options ?? null })
      .select('id, amount, purchased_at')
      .single()
    if (error) return new Response(JSON.stringify({ error: error.message }), { status: 400, headers: { ...corsHeaders, 'content-type': 'application/json' } })

    return new Response(JSON.stringify({ ticket_id: data.id, amount: data.amount, purchased_at: data.purchased_at }), { headers: { ...corsHeaders, 'content-type': 'application/json' } })
  } catch (e: any) {
    if (e?.message?.includes('Authorization')) return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: { ...corsHeaders, 'content-type': 'application/json' } })
    return new Response(JSON.stringify({ error: e?.message ?? 'unknown error' }), { status: 500, headers: { ...corsHeaders, 'content-type': 'application/json' } })
  }
})
