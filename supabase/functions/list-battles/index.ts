import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { getSupabaseAdmin, authenticateUser } from '../_shared/client.ts'

serve(async (req) => {
  if (req.method !== 'POST') return new Response('Method Not Allowed', { status: 405 })
  try {
    // allow any authenticated user
    const user = await authenticateUser(req)
    const supabase = getSupabaseAdmin()
    const body = await req.json().catch(() => ({})) as { status?: 'scheduled'|'live'|'finished', limit?: number, offset?: number, duration?: 5|30|60, only_mine?: boolean, include_participants?: boolean, include_aggregates?: boolean }
    const { status, limit = 20, offset = 0, duration, only_mine, include_participants = true, include_aggregates = true } = body

    let query = supabase
      .from('battles')
      .select('id, challenger_id, opponent_id, duration_minutes, start_time, end_time, status, winner_id')
      .order('start_time', { ascending: false })
      .range(offset, offset + Math.max(1, Math.min(50, limit)) - 1)

    if (status) query = query.eq('status', status)
    if (duration) query = query.eq('duration_minutes', duration)
    if (only_mine) {
      // challenger or opponent is me
      // Use OR filter
      // @ts-ignore
      query = query.or(`challenger_id.eq.${user.id},opponent_id.eq.${user.id}`)
    }

    const { data: rows, error } = await query
    if (error) return new Response(JSON.stringify({ error: error.message }), { status: 400, headers: { 'content-type': 'application/json' } })

    // Aggregate cheers per battle
    const ids = (rows || []).map(r => r.id)
    let aggregates: Record<string, { tickets: number; amount: number; by_user: Record<string, number> }> = {}
    if (include_aggregates && ids.length > 0) {
      const { data: tickets } = await supabase
        .from('cheer_tickets')
        .select('battle_id, creator_id, amount')
        .in('battle_id', ids)
      for (const t of tickets || []) {
        const a = (aggregates[t.battle_id] ||= { tickets: 0, amount: 0, by_user: {} })
        a.tickets += 1
        a.amount += (t.amount || 0)
        a.by_user[t.creator_id] = (a.by_user[t.creator_id] || 0) + (t.amount || 0)
      }
    }

    // Participants public profiles (for display)
    let participants: Record<string, { id: string; display_name?: string; avatar_url?: string }> = {}
    const userIds = Array.from(new Set((rows || []).flatMap(r => [r.challenger_id, r.opponent_id])))
    if (include_participants && userIds.length > 0) {
      const { data: profs } = await supabase
        .from('user_public_profiles')
        .select('id, display_name, avatar_url')
        .in('id', userIds)
      for (const p of profs || []) {
        participants[p.id] = { id: p.id, display_name: p.display_name, avatar_url: p.avatar_url }
      }
    }

    // Caching policy: user-specific (only_mine) is private short cache; public lists can be more aggressive
    const headers: Record<string,string> = { 'content-type': 'application/json' }
    if (only_mine) {
      headers['Cache-Control'] = 'private, max-age=30'
    } else if (status === 'finished') {
      headers['Cache-Control'] = 'public, max-age=60, s-maxage=120, stale-while-revalidate=300'
    } else {
      headers['Cache-Control'] = 'public, max-age=15'
    }
    return new Response(JSON.stringify({ items: rows || [], aggregates, participants }), { headers })
  } catch (e: any) {
    if (e?.message?.includes('Authorization')) return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: { 'content-type': 'application/json' } })
    return new Response(JSON.stringify({ error: e?.message ?? 'unknown error' }), { status: 500, headers: { 'content-type': 'application/json' } })
  }
})
