import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { getSupabaseAdmin, authenticateUser } from '../_shared/client.ts'

serve(async (req) => {
  if (req.method !== 'POST') return new Response('Method Not Allowed', { status: 405 })
  try {
    await authenticateUser(req) // any authenticated user can view status
    const supabase = getSupabaseAdmin()
    const body = await req.json().catch(() => ({})) as { battle_id?: string }
    const battleId = body?.battle_id
    if (!battleId) return new Response(JSON.stringify({ error: 'battle_id required' }), { status: 400, headers: { 'content-type': 'application/json' } })

    const { data: battle, error: bErr } = await supabase
      .from('battles')
      .select('id, challenger_id, opponent_id, duration_minutes, start_time, end_time, status, winner_id')
      .eq('id', battleId)
      .single()
    if (bErr || !battle) return new Response(JSON.stringify({ error: 'battle not found' }), { status: 404, headers: { 'content-type': 'application/json' } })

    // Aggregate cheer points (100 per ticket)
    const { data: tickets } = await supabase
      .from('cheer_tickets')
      .select('creator_id, amount')
      .eq('battle_id', battleId)
    let points: Record<string, number> = {}
    for (const t of tickets || []) {
      points[t.creator_id] = (points[t.creator_id] || 0) + (t.amount || 0)
    }

    // Participant public profiles (best-effort)
    let participants: Record<string, { id: string; display_name?: string; avatar_url?: string }> = {}
    try {
      const { data: profs } = await supabase
        .from('user_public_profiles')
        .select('id, display_name, avatar_url')
        .in('id', [battle.challenger_id, battle.opponent_id])
      for (const p of profs || []) {
        participants[p.id] = { id: p.id, display_name: p.display_name, avatar_url: p.avatar_url }
      }
    } catch (_) {}

    // Recent ticket events (sanitized, supporter not included)
    const { data: recent } = await supabase
      .from('cheer_tickets')
      .select('creator_id, amount, purchased_at')
      .eq('battle_id', battleId)
      .order('purchased_at', { ascending: false })
      .limit(10)

    return new Response(JSON.stringify({
      battle,
      participants,
      scores: {
        [battle.challenger_id]: points[battle.challenger_id] || 0,
        [battle.opponent_id]: points[battle.opponent_id] || 0,
      },
      totals: {
        tickets: (tickets || []).length,
        amount: (tickets || []).reduce((s, t) => s + (t.amount || 0), 0)
      },
      recent: recent || []
    }), { headers: { 'content-type': 'application/json' } })
  } catch (e: any) {
    if (e?.message?.includes('Authorization')) return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: { 'content-type': 'application/json' } })
    return new Response(JSON.stringify({ error: e?.message ?? 'unknown error' }), { status: 500, headers: { 'content-type': 'application/json' } })
  }
})
