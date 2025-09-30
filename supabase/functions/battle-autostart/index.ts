import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { getSupabaseAdmin } from '../_shared/client.ts'

serve(async (req) => {
  try {
    // Protect endpoint with simple secret header for scheduler
    if (req.method && req.method !== 'POST') return new Response('Method Not Allowed', { status: 405 })
    const cronKey = req.headers.get('x-cron-key') || ''
    const expected = Deno.env.get('CRON_SECRET') || ''
    if (expected && cronKey !== expected) {
      return new Response('Forbidden', { status: 403 })
    }
    const supabase = getSupabaseAdmin()
    // Rate limit autostart to avoid rapid repeated runs
    try {
      const { data: canProceed } = await supabase.rpc('check_rate_limit', {
        p_user_id: 'system', p_action: 'battle_autostart', p_limit: 5, p_window_minutes: 1
      })
      if (canProceed === false) return new Response(JSON.stringify({ error: 'rate_limited' }), { status: 429, headers: { 'content-type': 'application/json' } })
    } catch (_) {}
    const nowIso = new Date().toISOString()

    // Find scheduled battles whose requested_start_at <= now and not started
    const { data: rows, error } = await supabase
      .from('battles')
      .select('id')
      .eq('status', 'scheduled')
      .eq('opponent_accepted', true)
      .lte('requested_start_at', nowIso)
      .limit(200)
    if (error) return new Response(JSON.stringify({ error: error.message }), { status: 400, headers: { 'content-type': 'application/json' } })

    let started = 0
    for (const r of rows || []) {
      const { data: bRow } = await supabase
        .from('battles')
        .select('id, challenger_id, opponent_id')
        .eq('id', r.id)
        .single()
      const { error: updErr } = await supabase
        .from('battles')
        .update({ status: 'live', start_time: new Date().toISOString() })
        .eq('id', r.id)
        .eq('status', 'scheduled')
      if (!updErr) {
        started++
        // Notify both participants that the event has started
        try {
          await supabase.from('user_notifications').insert([
            { user_id: bRow?.challenger_id, type: 'battle_started', title: 'イベントが開始されました', message: 'イベントが開始しました。ページから参戦/観戦できます。', data: { battle_id: r.id, view: 'live-battle' } },
            { user_id: bRow?.opponent_id, type: 'battle_started', title: 'イベントが開始されました', message: 'イベントが開始しました。ページから参戦/観戦できます。', data: { battle_id: r.id, view: 'live-battle' } },
          ].filter((x: any) => x.user_id))
        } catch (_) {}
      }
    }
    return new Response(JSON.stringify({ ok: true, started }), { headers: { 'content-type': 'application/json' } })
  } catch (e: any) {
    return new Response(JSON.stringify({ error: e?.message || 'internal error' }), { status: 500, headers: { 'content-type': 'application/json' } })
  }
})
