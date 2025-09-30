import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { getSupabaseAdmin } from '../_shared/client.ts'
import { corsHeaders, corsPreflightResponse } from '../_shared/cors.ts'

serve(async (req) => {
  if (req.method === 'OPTIONS') return corsPreflightResponse()
  if (req.method !== 'GET' && req.method !== 'POST') return new Response('Method Not Allowed', { status: 405 })
  try {
    let eventId = ''
    if (req.method === 'GET') {
      const url = new URL(req.url)
      eventId = url.searchParams.get('event_id') || url.searchParams.get('live_event_id') || ''
    } else {
      const body = await req.json().catch(() => ({})) as any
      eventId = body?.event_id || body?.live_event_id || ''
    }
    const nowIso = new Date().toISOString()
    const supabase = getSupabaseAdmin()

    let query = supabase
      .from('live_offers')
      .select('id, work_id, live_event_id, start_at, end_at, status, price_override, currency, stock_total, stock_reserved, stock_sold, per_user_limit, perks_type, perks, image_preview_path, variant_preview_path, works(title, price)')
      .eq('status', 'published')
      .lte('start_at', nowIso)
      .gte('end_at', nowIso)

    if (eventId) query = query.eq('live_event_id', eventId)

    const { data, error } = await query
    if (error) {
      return new Response(JSON.stringify({ error: error.message }), { status: 400, headers: { ...corsHeaders, 'content-type': 'application/json' } })
    }

    // compute available client-side values
    const items = (data || []).map((row: any) => {
      const available = Math.max(0, (row.stock_total || 0) - (row.stock_reserved || 0) - (row.stock_sold || 0))
      const basePrice = row?.works?.price || 0
      const price = Number.isInteger(row.price_override) ? row.price_override : basePrice
      return { ...row, available, price }
    })

    return new Response(JSON.stringify({ items }), { headers: { ...corsHeaders, 'content-type': 'application/json' } })
  } catch (e: any) {
    return new Response(JSON.stringify({ error: e?.message || 'internal error' }), { status: 500, headers: { ...corsHeaders, 'content-type': 'application/json' } })
  }
})
