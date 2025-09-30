import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { getSupabaseAdmin, authenticateUser } from '../_shared/client.ts'

serve(async (req) => {
  if (req.method !== 'POST') return new Response('Method Not Allowed', { status: 405 })
  try {
    const user = await authenticateUser(req)
    const supabase = getSupabaseAdmin()
    const body = await req.json().catch(() => ({})) as { battle_id?: string; reason?: string }
    const battleId = body?.battle_id
    const reason = (body?.reason || '').trim()
    if (!battleId) return new Response(JSON.stringify({ error: 'battle_id required' }), { status: 400, headers: { 'content-type': 'application/json' } })

    const { data: battle, error } = await supabase
      .from('battles')
      .select('id, opponent_id, status, challenger_id, title, duration_minutes, requested_start_at')
      .eq('id', battleId)
      .single()
    if (error || !battle) return new Response(JSON.stringify({ error: 'battle not found' }), { status: 404, headers: { 'content-type': 'application/json' } })
    if (battle.status !== 'scheduled') return new Response(JSON.stringify({ error: 'invalid status' }), { status: 400, headers: { 'content-type': 'application/json' } })
    if (battle.opponent_id !== user.id) return new Response(JSON.stringify({ error: 'forbidden' }), { status: 403, headers: { 'content-type': 'application/json' } })

    // Delete the scheduled battle (non-approval removes the request)
    const { error: delErr } = await supabase
      .from('battles')
      .delete()
      .eq('id', battleId)
    if (delErr) return new Response(JSON.stringify({ error: delErr.message }), { status: 400, headers: { 'content-type': 'application/json' } })

    // In-app notification to challenger (declined)
    try {
      await supabase
        .from('user_notifications')
        .insert({
          user_id: battle.challenger_id,
          type: 'battle_declined',
          title: 'バトル招待が辞退されました',
          message: `タイトル: ${battle.title || '(未設定)'} / 時間: ${battle.duration_minutes}分 / 開始予定: ${battle.requested_start_at ? new Date(battle.requested_start_at).toISOString() : '(未定)'}${reason ? ` / 理由: ${reason}` : ''}`,
          data: { battle_id: battle.id, reason: reason || null }
        })
    } catch (_) { }

    return new Response(JSON.stringify({ ok: true }), { headers: { 'content-type': 'application/json' } })
  } catch (e: any) {
    if (e?.message?.includes('Authorization')) return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: { 'content-type': 'application/json' } })
    return new Response(JSON.stringify({ error: e?.message || 'internal error' }), { status: 500, headers: { 'content-type': 'application/json' } })
  }
})
