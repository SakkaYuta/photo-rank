import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { getSupabaseAdmin } from '../_shared/client.ts'

serve(async (req) => {
  try {
    const supabase = getSupabaseAdmin()
    const nowIso = new Date().toISOString()

    // Find scheduled battles whose requested_start_at <= now and not started
    const { data: rows, error } = await supabase
      .from('battles')
      .select('id')
      .eq('status', 'scheduled')
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
