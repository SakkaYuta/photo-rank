import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { getSupabaseAdmin, authenticateUser } from '../_shared/client.ts'

serve(async (req) => {
  if (req.method !== 'POST') return new Response('Method Not Allowed', { status: 405 })
  try {
    const user = await authenticateUser(req)
    const supabase = getSupabaseAdmin()

    const { data: rows, error } = await supabase
      .from('battles')
      .select('id, challenger_id, opponent_id, duration_minutes, requested_start_at, title, status, opponent_accepted')
      .eq('opponent_id', user.id)
      .eq('status', 'scheduled')
      .limit(100)
    if (error) return new Response(JSON.stringify({ error: error.message }), { status: 400, headers: { 'content-type': 'application/json' } })

    // Fetch challenger profiles
    const challengerIds = Array.from(new Set((rows || []).map(r => r.challenger_id)))
    let participants: Record<string, { id: string; display_name?: string; avatar_url?: string }> = {}
    if (challengerIds.length > 0) {
      const { data: profs } = await supabase
        .from('user_public_profiles')
        .select('id, display_name, avatar_url')
        .in('id', challengerIds)
      for (const p of profs || []) participants[p.id] = { id: p.id, display_name: p.display_name, avatar_url: p.avatar_url }
    }

    // Private short cache for invitations
    return new Response(
      JSON.stringify({ items: rows || [], participants }),
      { headers: { 'content-type': 'application/json', 'Cache-Control': 'private, max-age=15' } }
    )
  } catch (e: any) {
    if (e?.message?.includes('Authorization')) return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: { 'content-type': 'application/json' } })
    return new Response(JSON.stringify({ error: e?.message || 'internal error' }), { status: 500, headers: { 'content-type': 'application/json' } })
  }
})
