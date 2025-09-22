import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { getSupabaseAdmin, authenticateUser } from '../_shared/client.ts'

async function assertAdmin(supabase: any, userId: string) {
  try {
    const { data } = await supabase
      .from('users')
      .select('role')
      .eq('id', userId)
      .in('role', ['admin','moderator'])
      .single()
    if (!data) throw new Error('forbidden')
  } catch (_) {
    throw new Error('forbidden')
  }
}

serve(async (req) => {
  if (req.method !== 'POST') return new Response('Method Not Allowed', { status: 405 })
  try {
    const user = await authenticateUser(req)
    const supabase = getSupabaseAdmin()
    await assertAdmin(supabase, user.id)

    const body = await req.json().catch(() => ({})) as any
    const action = body?.action as 'list_pending' | 'approve' | 'reject'
    if (!action) return new Response(JSON.stringify({ error: 'action required' }), { status: 400, headers: { 'content-type': 'application/json' } })

    if (action === 'list_pending') {
      const { data, error } = await supabase
        .from('online_assets')
        .select('id, owner_user_id, source_url, provider, status, created_at')
        .eq('status', 'pending')
        .order('created_at', { ascending: false })
      if (error) return new Response(JSON.stringify({ error: error.message }), { status: 400, headers: { 'content-type': 'application/json' } })
      return new Response(JSON.stringify({ items: data || [] }), { headers: { 'content-type': 'application/json' } })
    }

    if (action === 'approve' || action === 'reject') {
      const { asset_id, reason } = body || {}
      if (!asset_id) return new Response(JSON.stringify({ error: 'asset_id required' }), { status: 400, headers: { 'content-type': 'application/json' } })
      const newStatus = action === 'approve' ? 'approved' : 'rejected'

      const { error: updErr } = await supabase
        .from('online_assets')
        .update({ status: newStatus })
        .eq('id', asset_id)
      if (updErr) return new Response(JSON.stringify({ error: updErr.message }), { status: 400, headers: { 'content-type': 'application/json' } })

      // record approval trail (best-effort)
      try {
        await supabase
          .from('asset_approvals')
          .insert({ asset_id, reviewer_id: user.id, decision: newStatus === 'approved' ? 'approved' : 'rejected', reason: reason ?? null })
      } catch (_) {}

      return new Response(JSON.stringify({ ok: true, status: newStatus }), { headers: { 'content-type': 'application/json' } })
    }

    return new Response(JSON.stringify({ error: 'unknown action' }), { status: 400, headers: { 'content-type': 'application/json' } })
  } catch (e: any) {
    if (e?.message === 'forbidden') return new Response(JSON.stringify({ error: 'Forbidden' }), { status: 403, headers: { 'content-type': 'application/json' } })
    if (e?.message?.includes('Authorization')) return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: { 'content-type': 'application/json' } })
    return new Response(JSON.stringify({ error: e?.message ?? 'unknown error' }), { status: 500, headers: { 'content-type': 'application/json' } })
  }
})

