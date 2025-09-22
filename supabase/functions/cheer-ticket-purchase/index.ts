import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { getSupabaseAdmin, authenticateUser } from '../_shared/client.ts'

serve(async (req) => {
  if (req.method !== 'POST') return new Response('Method Not Allowed', { status: 405 })
  try {
    const user = await authenticateUser(req)
    const supabase = getSupabaseAdmin()

    const body = await req.json().catch(() => ({})) as { battle_id?: string; creator_id?: string; options?: Record<string, unknown> }
    const { battle_id: battleId, creator_id: creatorId, options } = body
    if (!battleId || !creatorId) return new Response(JSON.stringify({ error: 'battle_id and creator_id required' }), { status: 400, headers: { 'content-type': 'application/json' } })

    // basic existence check
    const { data: battle } = await supabase
      .from('battles')
      .select('id, status')
      .eq('id', battleId)
      .single()
    if (!battle) return new Response(JSON.stringify({ error: 'battle not found' }), { status: 404, headers: { 'content-type': 'application/json' } })
    if (battle.status !== 'live') return new Response(JSON.stringify({ error: 'battle is not live' }), { status: 400, headers: { 'content-type': 'application/json' } })

    // Rate limit per user
    try {
      const { data: canProceed } = await supabase.rpc('check_rate_limit', {
        p_user_id: user.id,
        p_action: 'cheer_ticket',
        p_limit: 100,
        p_window_minutes: 60
      })
      if (canProceed === false) return new Response(JSON.stringify({ error: 'Rate limit exceeded' }), { status: 429, headers: { 'content-type': 'application/json' } })
    } catch (_) {}

    const { data, error } = await supabase
      .from('cheer_tickets')
      .insert({ battle_id: battleId, supporter_id: user.id, creator_id: creatorId, amount: 100, exclusive_options: options ?? null })
      .select('id, amount, purchased_at')
      .single()
    if (error) return new Response(JSON.stringify({ error: error.message }), { status: 400, headers: { 'content-type': 'application/json' } })

    return new Response(JSON.stringify({ ticket_id: data.id, amount: data.amount, purchased_at: data.purchased_at }), { headers: { 'content-type': 'application/json' } })
  } catch (e: any) {
    if (e?.message?.includes('Authorization')) return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: { 'content-type': 'application/json' } })
    return new Response(JSON.stringify({ error: e?.message ?? 'unknown error' }), { status: 500, headers: { 'content-type': 'application/json' } })
  }
})

