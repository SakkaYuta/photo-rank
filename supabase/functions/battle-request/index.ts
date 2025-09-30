import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { getSupabaseAdmin, authenticateUser } from '../_shared/client.ts'

serve(async (req) => {
  if (req.method !== 'POST') return new Response('Method Not Allowed', { status: 405 })
  try {
    const user = await authenticateUser(req)
    const supabase = getSupabaseAdmin()

    const body = await req.json().catch(() => ({})) as {
      opponent_id?: string
      duration?: 5|30|60
      title?: string
      visibility?: 'public'|'private'
      requested_start_at?: string
      winner_bonus_amount?: number
      description?: string
    }
    const opponentId = body.opponent_id
    const duration = body.duration ?? 5
    const title = (body.title || '').trim()
    const visibility = (body.visibility || 'public') as 'public'|'private'
    const reqStartAt = body.requested_start_at ? new Date(body.requested_start_at) : null
    const winnerBonus = Number.isInteger(body.winner_bonus_amount) ? body.winner_bonus_amount : null
    const description = (body.description || '').trim()

    if (!opponentId || ![5,30,60].includes(duration)) {
      return new Response(JSON.stringify({ error: 'opponent_id and valid duration required' }), { status: 400, headers: { 'content-type': 'application/json' } })
    }
    if (title && title.length > 120) {
      return new Response(JSON.stringify({ error: 'title too long (max 120)' }), { status: 400, headers: { 'content-type': 'application/json' } })
    }
    if (!['public','private'].includes(visibility)) {
      return new Response(JSON.stringify({ error: 'invalid visibility' }), { status: 400, headers: { 'content-type': 'application/json' } })
    }
    if (reqStartAt && isNaN(reqStartAt.getTime())) {
      return new Response(JSON.stringify({ error: 'invalid requested_start_at' }), { status: 400, headers: { 'content-type': 'application/json' } })
    }

    // Eligibility check
    const { data: elig } = await supabase
      .from('battle_eligibility')
      .select('is_eligible')
      .eq('user_id', user.id)
      .single()
    if (!elig?.is_eligible) {
      return new Response(JSON.stringify({ error: 'not eligible' }), { status: 403, headers: { 'content-type': 'application/json' } })
    }

    // Rate limit (10/day)
    try {
      const { data: canProceed } = await supabase.rpc('check_rate_limit', {
        p_user_id: user.id,
        p_action: 'battle_request',
        p_limit: 10,
        p_window_minutes: 24*60
      })
      if (canProceed === false) {
        return new Response(JSON.stringify({ error: 'Rate limit exceeded' }), { status: 429, headers: { 'content-type': 'application/json' } })
      }
    } catch (_) {}

    const { data, error } = await supabase
      .from('battles')
      .insert({
        challenger_id: user.id,
        opponent_id: opponentId,
        duration_minutes: duration,
        status: 'scheduled',
        title: title || null,
        visibility,
        requested_start_at: reqStartAt ? reqStartAt.toISOString() : null,
        winner_bonus_amount: winnerBonus,
        description: description || null
      })
      .select('id, status, duration_minutes, title, visibility, requested_start_at, winner_bonus_amount')
      .single()
    if (error) {
      return new Response(JSON.stringify({ error: error.message }), { status: 400, headers: { 'content-type': 'application/json' } })
    }
    return new Response(JSON.stringify({
      battle_id: data.id,
      status: data.status,
      duration: data.duration_minutes,
      title: data.title,
      visibility: data.visibility,
      requested_start_at: data.requested_start_at,
      winner_bonus_amount: data.winner_bonus_amount
    }), { headers: { 'content-type': 'application/json' } })
  } catch (e: any) {
    if (e?.message?.includes('Authorization')) return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: { 'content-type': 'application/json' } })
    return new Response(JSON.stringify({ error: e?.message ?? 'unknown error' }), { status: 500, headers: { 'content-type': 'application/json' } })
  }
})
