import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { getSupabaseAdmin, authenticateUser } from '../_shared/client.ts'
import { corsHeaders, corsPreflightResponse } from '../_shared/cors.ts'

serve(async (req) => {
  if (req.method === 'OPTIONS') return corsPreflightResponse()
  if (req.method !== 'POST') return new Response('Method Not Allowed', { status: 405 })
  try {
    const user = await authenticateUser(req)
    const supabase = getSupabaseAdmin()
    const body = await req.json().catch(() => ({})) as any
    const action = (body?.action || 'acquire') as 'acquire'|'release'
    const live_offer_id = body?.live_offer_id as string
    if (!live_offer_id) return new Response(JSON.stringify({ error: 'live_offer_id required' }), { status: 400, headers: { ...corsHeaders, 'content-type': 'application/json' } })

    if (action === 'acquire') {
      const { data, error } = await supabase.rpc('reserve_live_offer', { p_live_offer_id: live_offer_id, p_user_id: user.id, p_ttl_seconds: 300 })
      if (error) return new Response(JSON.stringify({ error: error.message }), { status: 400, headers: { ...corsHeaders, 'content-type': 'application/json' } })
      if (data === false) return new Response(JSON.stringify({ locked: false }), { status: 409, headers: { ...corsHeaders, 'content-type': 'application/json' } })
      return new Response(JSON.stringify({ locked: true }), { headers: { ...corsHeaders, 'content-type': 'application/json' } })
    }

    if (action === 'release') {
      const { data, error } = await supabase.rpc('release_live_offer', { p_live_offer_id: live_offer_id, p_user_id: user.id })
      if (error) return new Response(JSON.stringify({ error: error.message }), { status: 400, headers: { ...corsHeaders, 'content-type': 'application/json' } })
      return new Response(JSON.stringify({ released: !!data }), { headers: { ...corsHeaders, 'content-type': 'application/json' } })
    }

    return new Response(JSON.stringify({ error: 'unknown action' }), { status: 400, headers: { ...corsHeaders, 'content-type': 'application/json' } })
  } catch (e: any) {
    if (e?.message?.includes('Unauthorized')) return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: { ...corsHeaders, 'content-type': 'application/json' } })
    return new Response(JSON.stringify({ error: e?.message || 'internal error' }), { status: 500, headers: { ...corsHeaders, 'content-type': 'application/json' } })
  }
})

