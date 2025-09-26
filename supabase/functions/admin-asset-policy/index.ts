import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { getSupabaseAdmin, authenticateUser } from '../_shared/client.ts'
import { requireInternalSecret } from '../_shared/auth.ts'

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
  const secretErr = requireInternalSecret(req)
  if (secretErr) return secretErr
  try {
    const user = await authenticateUser(req)
    const supabase = getSupabaseAdmin()
    await assertAdmin(supabase, user.id)

    const body = await req.json().catch(() => ({})) as any
    const action = body?.action as 'list' | 'upsert' | 'delete'
    if (!action) return new Response(JSON.stringify({ error: 'action required' }), { status: 400, headers: { 'content-type': 'application/json' } })

    if (action === 'list') {
      const { data, error } = await supabase
        .from('asset_policies')
        .select('id, pattern, rule, notes, updated_at')
        .order('pattern', { ascending: true })
      if (error) return new Response(JSON.stringify({ error: error.message }), { status: 400, headers: { 'content-type': 'application/json' } })
      return new Response(JSON.stringify({ items: data || [] }), { headers: { 'content-type': 'application/json' } })
    }

    if (action === 'upsert') {
      const { id, pattern, rule, notes } = body || {}
      if (!pattern || !rule) return new Response(JSON.stringify({ error: 'pattern and rule required' }), { status: 400, headers: { 'content-type': 'application/json' } })
      const { data, error } = await supabase
        .from('asset_policies')
        .upsert({ id, pattern, rule, notes, updated_by: user.id }, { onConflict: 'pattern' })
        .select('id, pattern, rule, notes, updated_at')
        .single()
      if (error) return new Response(JSON.stringify({ error: error.message }), { status: 400, headers: { 'content-type': 'application/json' } })
      return new Response(JSON.stringify({ item: data }), { headers: { 'content-type': 'application/json' } })
    }

    if (action === 'delete') {
      const { id } = body || {}
      if (!id) return new Response(JSON.stringify({ error: 'id required' }), { status: 400, headers: { 'content-type': 'application/json' } })
      const { error } = await supabase
        .from('asset_policies')
        .delete()
        .eq('id', id)
      if (error) return new Response(JSON.stringify({ error: error.message }), { status: 400, headers: { 'content-type': 'application/json' } })
      return new Response(JSON.stringify({ ok: true }), { headers: { 'content-type': 'application/json' } })
    }

    return new Response(JSON.stringify({ error: 'unknown action' }), { status: 400, headers: { 'content-type': 'application/json' } })
  } catch (e: any) {
    if (e?.message === 'forbidden') return new Response(JSON.stringify({ error: 'Forbidden' }), { status: 403, headers: { 'content-type': 'application/json' } })
    if (e?.message?.includes('Authorization')) return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: { 'content-type': 'application/json' } })
    return new Response(JSON.stringify({ error: e?.message ?? 'unknown error' }), { status: 500, headers: { 'content-type': 'application/json' } })
  }
})
