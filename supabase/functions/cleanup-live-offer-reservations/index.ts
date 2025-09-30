import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { getSupabaseAdmin } from '../_shared/client.ts'
import { requireInternalSecret } from '../_shared/auth.ts'

serve(async (req) => {
  const secretErr = requireInternalSecret(req)
  if (secretErr) return secretErr
  try {
    const supabase = getSupabaseAdmin()
    const nowIso = new Date().toISOString()

    // 1) Find expired reservations grouped by live_offer_id
    const { data: expired, error } = await supabase
      .from('live_offer_reservations')
      .select('live_offer_id, count:id')
      .lte('expires_at', nowIso)
      .group('live_offer_id')

    if (error) return new Response(JSON.stringify({ error: error.message }), { status: 400, headers: { 'content-type': 'application/json' } })

    let updated = 0
    for (const row of expired || []) {
      try {
        // decrease reserved counts safely
        const { error: upErr } = await supabase.rpc('decrement_reserved_safely', {
          p_live_offer_id: row.live_offer_id,
          p_count: row.count
        })
        if (!upErr) updated++
      } catch (_) {}
    }

    // 2) Delete expired reservations
    const { error: delErr, count } = await supabase
      .from('live_offer_reservations')
      .delete({ count: 'exact' })
      .lte('expires_at', nowIso)

    if (delErr) return new Response(JSON.stringify({ error: delErr.message }), { status: 400, headers: { 'content-type': 'application/json' } })

    return new Response(JSON.stringify({ ok: true, offers_updated: updated, reservations_deleted: count || 0 }), { headers: { 'content-type': 'application/json' } })
  } catch (e: any) {
    return new Response(JSON.stringify({ error: e?.message || 'internal error' }), { status: 500, headers: { 'content-type': 'application/json' } })
  }
})

