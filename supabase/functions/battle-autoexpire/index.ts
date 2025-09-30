import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { getSupabaseAdmin } from '../_shared/client.ts'

serve(async (_req) => {
  try {
    const supabase = getSupabaseAdmin()
    const now = Date.now()

    // Fetch scheduled battles with requested_start_at set
    const { data: rows, error } = await supabase
      .from('battles')
      .select('id, requested_start_at, opponent_accepted, status')
      .eq('status', 'scheduled')
      .not('requested_start_at', 'is', null)
      .limit(500)

    if (error) return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: { 'content-type': 'application/json' } })

    let expired = 0
    for (const r of rows || []) {
      const rsa = r.requested_start_at ? new Date(r.requested_start_at as any).getTime() : null
      if (!rsa) continue
      const threshold = rsa - 60 * 60 * 1000 // 1 hour before scheduled start
      if (now >= threshold && r.opponent_accepted !== true) {
        const { error: updErr } = await supabase
          .from('battles')
          .update({ status: 'cancelled', cancel_reason: 'not_approved_before_deadline', cancelled_at: new Date().toISOString() })
          .eq('id', r.id)
          .eq('status', 'scheduled')
        if (!updErr) expired++
      }
    }

    return new Response(JSON.stringify({ ok: true, expired }), { headers: { 'content-type': 'application/json' } })
  } catch (e: any) {
    return new Response(JSON.stringify({ error: e?.message || 'internal error' }), { status: 500, headers: { 'content-type': 'application/json' } })
  }
})

