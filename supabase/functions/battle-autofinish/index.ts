import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { getSupabaseAdmin } from '../_shared/client.ts'

type BattleRow = {
  id: string
  challenger_id: string
  opponent_id: string
  start_time: string | null
  duration_minutes: number | null
  status: 'scheduled' | 'live' | 'finished'
  overtime_count?: number | null
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('', { status: 204 })
  // Optional: simple auth via header token if you want to restrict manual calls
  try {
    if (req.method && req.method !== 'POST') return new Response('Method Not Allowed', { status: 405 })
    const cronKey = req.headers.get('x-cron-key') || ''
    const expected = Deno.env.get('CRON_SECRET') || ''
    if (expected && cronKey !== expected) {
      return new Response('Forbidden', { status: 403, headers: { 'content-type': 'application/json' } })
    }
    const supabase = getSupabaseAdmin()
    try {
      const { data: canProceed } = await supabase.rpc('check_rate_limit', {
        p_user_id: 'system', p_action: 'battle_autofinish', p_limit: 5, p_window_minutes: 1
      })
      if (canProceed === false) return new Response(JSON.stringify({ error: 'rate_limited' }), { status: 429, headers: { 'content-type': 'application/json' } })
    } catch (_) {}

    // Fetch live battles (limited batch)
    const { data: battles, error } = await supabase
      .from('battles')
      .select('id, challenger_id, opponent_id, start_time, duration_minutes, status, overtime_count')
      .eq('status', 'live')
      .limit(200)

    if (error) {
      return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: { 'content-type': 'application/json' } })
    }

    const nowMs = Date.now()
    let processed = 0
    const results: Array<{ id: string; winner_id: string | null; reason: string }> = []

    for (const b of (battles || []) as BattleRow[]) {
      const start = b.start_time ? new Date(b.start_time).getTime() : null
      const durMin = Number(b.duration_minutes || 0)
      if (!start || !durMin) continue
      const otCount = Number(b.overtime_count || 0)
      const end = start + (durMin + (otCount * 3)) * 60 * 1000
      if (nowMs < end) continue // not yet finished

      // Tally cheer points by creator
      const { data: tickets, error: tErr } = await supabase
        .from('cheer_tickets')
        .select('creator_id, amount')
        .eq('battle_id', b.id)

      if (tErr) continue
      let chPts = 0
      let opPts = 0
      for (const t of tickets || []) {
        if (t.creator_id === b.challenger_id) chPts += (t.amount || 0)
        else if (t.creator_id === b.opponent_id) opPts += (t.amount || 0)
      }

      if (chPts === opPts) {
        const currentOt = (b.overtime_count ?? 0)
        if (currentOt < 2) {
          // Add 3 minutes overtime (keeps status live), increment overtime_count
          const { error: otErr } = await supabase
            .from('battles')
            .update({ overtime_count: currentOt + 1 })
            .eq('id', b.id)
          if (!otErr) {
            processed++
            results.push({ id: b.id, winner_id: null, reason: `overtime +3min (OT#${currentOt + 1}, tie: ${chPts} vs ${opPts})` })
          }
          continue
        }
        // Max overtime reached (2): decide winner by challenger as final tie-breaker
        const { error: otErr } = await supabase
          .from('battles')
          .update({ status: 'finished', end_time: new Date().toISOString(), winner_id: b.challenger_id })
          .eq('id', b.id)
        if (!otErr) {
          processed++
          results.push({ id: b.id, winner_id: b.challenger_id, reason: `final tie after 2 OTs: ${chPts} vs ${opPts}` })
        }
      } else {
        // Decide winner by higher points
        const winner_id = chPts > opPts ? b.challenger_id : b.opponent_id
        const { error: updErr } = await supabase
          .from('battles')
          .update({ status: 'finished', end_time: new Date().toISOString(), winner_id })
          .eq('id', b.id)
        if (!updErr) {
          processed++
          results.push({ id: b.id, winner_id, reason: `auto-finish: ${chPts} vs ${opPts}` })
        }
      }
    }

    return new Response(JSON.stringify({ ok: true, processed, results }), { headers: { 'content-type': 'application/json' } })
  } catch (e: any) {
    return new Response(JSON.stringify({ error: e?.message || 'unknown error' }), { status: 500, headers: { 'content-type': 'application/json' } })
  }
})
