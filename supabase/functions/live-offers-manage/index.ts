import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { getSupabaseAdmin, authenticateUser } from '../_shared/client.ts'
import { corsHeaders, corsPreflightResponse } from '../_shared/cors.ts'

type PerksType = 'none' | 'signed' | 'limited_design'

type CreatePayload = {
  action: 'create'
  work_id: string
  live_event_id?: string
  start_at: string
  end_at: string
  stock_total: number
  per_user_limit?: number
  price_override?: number
  currency?: string
  perks_type?: PerksType
  perks?: Record<string, unknown>
  image_preview_path?: string
  variant_original_path?: string
  variant_preview_path?: string
}

type UpdatePayload = {
  action: 'update'
  id: string
  start_at?: string
  end_at?: string
  stock_total?: number
  per_user_limit?: number
  price_override?: number
  currency?: string
  perks_type?: PerksType
  perks?: Record<string, unknown>
  image_preview_path?: string
  variant_original_path?: string
  variant_preview_path?: string
}

type PublishPayload = { action: 'publish'; id: string }
type ArchivePayload = { action: 'archive'; id: string }
type GetPayload = { action: 'get'; id: string }
type ListMinePayload = { action: 'list_mine' }

serve(async (req) => {
  if (req.method === 'OPTIONS') return corsPreflightResponse()
  if (req.method !== 'POST') return new Response('Method Not Allowed', { status: 405, headers: corsHeaders })

  try {
    const user = await authenticateUser(req)
    const supabase = getSupabaseAdmin()
    const body = await req.json().catch(() => ({})) as any
    const action = body?.action as CreatePayload['action'] | UpdatePayload['action'] | PublishPayload['action'] | ArchivePayload['action'] | GetPayload['action'] | ListMinePayload['action']
    if (!action) return new Response(JSON.stringify({ error: 'action required' }), { status: 400, headers: { ...corsHeaders, 'content-type': 'application/json' } })

    // Helpers
    const assertOwnsWork = async (workId: string) => {
      const { data: w, error } = await supabase.from('works').select('id, creator_id').eq('id', workId).single()
      if (error || !w) throw new Error('work not found')
      if (w.creator_id !== user.id) throw new Error('forbidden')
      return w
    }
    const assertOwnsOffer = async (offerId: string) => {
      const { data: o, error } = await supabase.from('live_offers').select('id, creator_id, status').eq('id', offerId).single()
      if (error || !o) throw new Error('offer not found')
      if (o.creator_id !== user.id) throw new Error('forbidden')
      return o
    }

    if (action === 'create') {
      const p = body as CreatePayload
      if (!p.work_id || !p.start_at || !p.end_at || !Number.isInteger(p.stock_total) || p.stock_total <= 0) {
        return new Response(JSON.stringify({ error: 'invalid payload' }), { status: 400, headers: { ...corsHeaders, 'content-type': 'application/json' } })
      }
      await assertOwnsWork(p.work_id)
      const start = new Date(p.start_at)
      const end = new Date(p.end_at)
      if (!(end.getTime() > start.getTime())) {
        return new Response(JSON.stringify({ error: 'end_at must be after start_at' }), { status: 400, headers: { ...corsHeaders, 'content-type': 'application/json' } })
      }
      const row: any = {
        work_id: p.work_id,
        creator_id: user.id,
        live_event_id: p.live_event_id || null,
        start_at: start.toISOString(),
        end_at: end.toISOString(),
        status: 'draft',
        stock_total: p.stock_total,
        per_user_limit: p.per_user_limit ?? 1,
        price_override: p.price_override ?? null,
        currency: p.currency || 'jpy',
        perks_type: p.perks_type || 'none',
        perks: p.perks || {},
        image_preview_path: p.image_preview_path || null,
        variant_original_path: p.variant_original_path || null,
        variant_preview_path: p.variant_preview_path || null,
      }
      const { data, error } = await supabase.from('live_offers').insert(row).select().single()
      if (error) return new Response(JSON.stringify({ error: error.message }), { status: 400, headers: { ...corsHeaders, 'content-type': 'application/json' } })
      return new Response(JSON.stringify({ item: data }), { headers: { ...corsHeaders, 'content-type': 'application/json' } })
    }

    if (action === 'update') {
      const p = body as UpdatePayload
      if (!p.id) return new Response(JSON.stringify({ error: 'id required' }), { status: 400, headers: { ...corsHeaders, 'content-type': 'application/json' } })
      await assertOwnsOffer(p.id)
      const patch: any = {}
      if (p.start_at) patch.start_at = new Date(p.start_at).toISOString()
      if (p.end_at) patch.end_at = new Date(p.end_at).toISOString()
      if (Number.isInteger(p.stock_total)) patch.stock_total = p.stock_total
      if (Number.isInteger(p.per_user_limit)) patch.per_user_limit = p.per_user_limit
      if (Number.isInteger(p.price_override)) patch.price_override = p.price_override
      if (p.currency) patch.currency = p.currency
      if (p.perks_type) patch.perks_type = p.perks_type
      if (p.perks) patch.perks = p.perks
      if (p.image_preview_path !== undefined) patch.image_preview_path = p.image_preview_path
      if (p.variant_original_path !== undefined) patch.variant_original_path = p.variant_original_path
      if (p.variant_preview_path !== undefined) patch.variant_preview_path = p.variant_preview_path

      if (patch.start_at && patch.end_at) {
        if (!(new Date(patch.end_at).getTime() > new Date(patch.start_at).getTime()))
          return new Response(JSON.stringify({ error: 'end_at must be after start_at' }), { status: 400, headers: { ...corsHeaders, 'content-type': 'application/json' } })
      }
      const { data, error } = await supabase.from('live_offers').update(patch).eq('id', p.id).select().single()
      if (error) return new Response(JSON.stringify({ error: error.message }), { status: 400, headers: { ...corsHeaders, 'content-type': 'application/json' } })
      return new Response(JSON.stringify({ item: data }), { headers: { ...corsHeaders, 'content-type': 'application/json' } })
    }

    if (action === 'publish') {
      const { id } = body as PublishPayload
      if (!id) return new Response(JSON.stringify({ error: 'id required' }), { status: 400, headers: { ...corsHeaders, 'content-type': 'application/json' } })
      const o = await assertOwnsOffer(id)
      // basic validation before publish
      const { data: curr, error } = await supabase
        .from('live_offers')
        .select('start_at, end_at, stock_total')
        .eq('id', id)
        .single()
      if (error) return new Response(JSON.stringify({ error: error.message }), { status: 400, headers: { ...corsHeaders, 'content-type': 'application/json' } })
      if (!curr?.start_at || !curr?.end_at || !(new Date(curr.end_at).getTime() > new Date(curr.start_at).getTime())) {
        return new Response(JSON.stringify({ error: 'invalid time window' }), { status: 400, headers: { ...corsHeaders, 'content-type': 'application/json' } })
      }
      if (!Number.isInteger(curr.stock_total) || curr.stock_total < 1) {
        return new Response(JSON.stringify({ error: 'invalid stock_total' }), { status: 400, headers: { ...corsHeaders, 'content-type': 'application/json' } })
      }
      const { data, error: upErr } = await supabase.from('live_offers').update({ status: 'published' }).eq('id', id).select().single()
      if (upErr) return new Response(JSON.stringify({ error: upErr.message }), { status: 400, headers: { ...corsHeaders, 'content-type': 'application/json' } })
      return new Response(JSON.stringify({ item: data }), { headers: { ...corsHeaders, 'content-type': 'application/json' } })
    }

    if (action === 'archive') {
      const { id } = body as ArchivePayload
      if (!id) return new Response(JSON.stringify({ error: 'id required' }), { status: 400, headers: { ...corsHeaders, 'content-type': 'application/json' } })
      await assertOwnsOffer(id)
      const { data, error } = await supabase.from('live_offers').update({ status: 'archived' }).eq('id', id).select().single()
      if (error) return new Response(JSON.stringify({ error: error.message }), { status: 400, headers: { ...corsHeaders, 'content-type': 'application/json' } })
      return new Response(JSON.stringify({ item: data }), { headers: { ...corsHeaders, 'content-type': 'application/json' } })
    }

    if (action === 'get') {
      const { id } = body as GetPayload
      if (!id) return new Response(JSON.stringify({ error: 'id required' }), { status: 400, headers: { ...corsHeaders, 'content-type': 'application/json' } })
      const { data, error } = await supabase.from('live_offers').select('*').eq('id', id).single()
      if (error) return new Response(JSON.stringify({ error: error.message }), { status: 400, headers: { ...corsHeaders, 'content-type': 'application/json' } })
      if (data?.creator_id !== user.id) return new Response(JSON.stringify({ error: 'forbidden' }), { status: 403, headers: { ...corsHeaders, 'content-type': 'application/json' } })
      return new Response(JSON.stringify({ item: data }), { headers: { ...corsHeaders, 'content-type': 'application/json' } })
    }

    if (action === 'list_mine') {
      const { data, error } = await supabase
        .from('live_offers')
        .select('*')
        .eq('creator_id', user.id)
        .order('created_at', { ascending: false })
      if (error) return new Response(JSON.stringify({ error: error.message }), { status: 400, headers: { ...corsHeaders, 'content-type': 'application/json' } })
      return new Response(JSON.stringify({ items: data || [] }), { headers: { ...corsHeaders, 'content-type': 'application/json' } })
    }

    return new Response(JSON.stringify({ error: 'unknown action' }), { status: 400, headers: { ...corsHeaders, 'content-type': 'application/json' } })
  } catch (e: any) {
    if (e?.message === 'forbidden') return new Response(JSON.stringify({ error: 'Forbidden' }), { status: 403, headers: { ...corsHeaders, 'content-type': 'application/json' } })
    if (e?.message?.includes('Authorization')) return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: { ...corsHeaders, 'content-type': 'application/json' } })
    return new Response(JSON.stringify({ error: e?.message || 'internal error' }), { status: 500, headers: { ...corsHeaders, 'content-type': 'application/json' } })
  }
})

