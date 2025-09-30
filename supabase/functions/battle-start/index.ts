import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { getSupabaseAdmin, authenticateUser } from '../_shared/client.ts'

serve(async (req) => {
  if (req.method !== 'POST') return new Response('Method Not Allowed', { status: 405 })
  try {
    const user = await authenticateUser(req)
    const supabase = getSupabaseAdmin()
    const body = await req.json().catch(() => ({})) as { battle_id?: string }
    const battleId = body.battle_id
    if (!battleId) return new Response(JSON.stringify({ error: 'battle_id required' }), { status: 400, headers: { 'content-type': 'application/json' } })

    // Ensure participant and scheduled
    const { data: battle, error } = await supabase
      .from('battles')
      .select('id, challenger_id, opponent_id, status, opponent_accepted')
      .eq('id', battleId)
      .single()
    if (error) return new Response(JSON.stringify({ error: error.message }), { status: 404, headers: { 'content-type': 'application/json' } })
    if (battle.status !== 'scheduled') return new Response(JSON.stringify({ error: 'invalid status' }), { status: 400, headers: { 'content-type': 'application/json' } })
    if (![battle.challenger_id, battle.opponent_id].includes(user.id)) return new Response(JSON.stringify({ error: 'forbidden' }), { status: 403, headers: { 'content-type': 'application/json' } })
    // Require opponent acceptance before starting
    if (!battle.opponent_accepted) {
      return new Response(JSON.stringify({ error: 'opponent has not accepted yet' }), { status: 400, headers: { 'content-type': 'application/json' } })
    }

    const { error: updErr } = await supabase
      .from('battles')
      .update({ status: 'live', start_time: new Date().toISOString() })
      .eq('id', battleId)
    if (updErr) return new Response(JSON.stringify({ error: updErr.message }), { status: 400, headers: { 'content-type': 'application/json' } })
    return new Response(JSON.stringify({ ok: true }), { headers: { 'content-type': 'application/json' } })
  } catch (e: any) {
    if (e?.message?.includes('Authorization')) return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: { 'content-type': 'application/json' } })
    return new Response(JSON.stringify({ error: e?.message ?? 'unknown error' }), { status: 500, headers: { 'content-type': 'application/json' } })
  }
})
