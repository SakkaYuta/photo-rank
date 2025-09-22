import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { getSupabaseAdmin, authenticateUser } from '../_shared/client.ts'

serve(async (req) => {
  if (req.method !== 'POST') return new Response('Method Not Allowed', { status: 405 })
  try {
    const user = await authenticateUser(req)
    const supabase = getSupabaseAdmin()
    const body = await req.json().catch(() => ({})) as { battle_id?: string; winner_id?: string }
    const { battle_id: battleId, winner_id: winnerId } = body
    if (!battleId || !winnerId) return new Response(JSON.stringify({ error: 'battle_id and winner_id required' }), { status: 400, headers: { 'content-type': 'application/json' } })

    const { data: battle, error } = await supabase
      .from('battles')
      .select('id, challenger_id, opponent_id, status')
      .eq('id', battleId)
      .single()
    if (error) return new Response(JSON.stringify({ error: error.message }), { status: 404, headers: { 'content-type': 'application/json' } })
    if (battle.status !== 'live') return new Response(JSON.stringify({ error: 'invalid status' }), { status: 400, headers: { 'content-type': 'application/json' } })
    if (![battle.challenger_id, battle.opponent_id].includes(user.id)) return new Response(JSON.stringify({ error: 'forbidden' }), { status: 403, headers: { 'content-type': 'application/json' } })
    if (![battle.challenger_id, battle.opponent_id].includes(winnerId)) return new Response(JSON.stringify({ error: 'winner must be a participant' }), { status: 400, headers: { 'content-type': 'application/json' } })

    const { error: updErr } = await supabase
      .from('battles')
      .update({ status: 'finished', end_time: new Date().toISOString(), winner_id: winnerId })
      .eq('id', battleId)
    if (updErr) return new Response(JSON.stringify({ error: updErr.message }), { status: 400, headers: { 'content-type': 'application/json' } })

    return new Response(JSON.stringify({ ok: true }), { headers: { 'content-type': 'application/json' } })
  } catch (e: any) {
    if (e?.message?.includes('Authorization')) return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: { 'content-type': 'application/json' } })
    return new Response(JSON.stringify({ error: e?.message ?? 'unknown error' }), { status: 500, headers: { 'content-type': 'application/json' } })
  }
})

