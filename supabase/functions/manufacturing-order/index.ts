import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { getSupabaseAdmin, authenticateUser } from '../_shared/client.ts'

type MatchInput = {
  product_type: string
  quantity?: number
  max_price?: number
  deadline_days?: number
  workId?: string
}

function scoreFactory(baseCost: number, leadDays: number, weights = { cost: 0.7, lead: 0.3 }) {
  // Lower is better: simple linear score（将来は正規化/学習へ置換）
  return baseCost * weights.cost + leadDays * 100 * weights.lead
}

serve(async (req) => {
  if (req.method !== 'POST') return new Response('Method Not Allowed', { status: 405 })

  try {
    // 認証
    const user = await authenticateUser(req)
    const { orderId, productData } = await req.json()

    if (!orderId || !productData?.product_type || !productData?.workId) {
      return new Response(JSON.stringify({ error: 'Missing required fields: orderId, productData.product_type, productData.workId' }), { 
        status: 400,
        headers: { 'content-type': 'application/json' }
      })
    }

    const supabase = getSupabaseAdmin()

    // 所有権チェック（作品）
    if (productData.workId) {
      const { data: work, error: workError } = await supabase
        .from('works')
        .select('creator_id')
        .eq('id', productData.workId)
        .single()
      if (workError || !work) {
        return new Response(JSON.stringify({ error: 'Work not found' }), { status: 404, headers: { 'content-type': 'application/json' } })
      }
      if (work.creator_id !== user.id) {
        return new Response(JSON.stringify({ error: 'Unauthorized to order manufacturing for this work' }), { status: 403, headers: { 'content-type': 'application/json' } })
      }
    }

    // 内部マッチング
    const matchInput: MatchInput = {
      product_type: productData.product_type,
      quantity: productData.quantity ?? 1,
      max_price: productData.max_price,
      deadline_days: productData.deadline_days,
      workId: productData.workId
    }

    const { data: candidates, error: candError } = await supabase
      .from('factory_products')
      .select('id, partner_id, base_cost, lead_time_days, manufacturing_partners!inner(status)')
      .eq('product_type', matchInput.product_type)
      .eq('is_active', true)
      .eq('manufacturing_partners.status', 'approved')

    if (candError) {
      return new Response(JSON.stringify({ error: candError.message }), { status: 500, headers: { 'content-type': 'application/json' } })
    }

    const filtered = (candidates || []).filter((c: any) => {
      const withinDeadline = matchInput.deadline_days ? (c.lead_time_days <= matchInput.deadline_days) : true
      const withinBudget = matchInput.max_price ? (c.base_cost <= matchInput.max_price) : true
      return withinDeadline && withinBudget
    })

    const scored = filtered.map((c: any) => ({ ...c, score: scoreFactory(c.base_cost, c.lead_time_days) }))
      .sort((a: any, b: any) => a.score - b.score)

    const selected = scored[0]
    if (!selected) {
      return new Response(JSON.stringify({ error: 'No factory available for given constraints' }), { status: 404, headers: { 'content-type': 'application/json' } })
    }

    // 製造オーダー作成
    const { error: insErr } = await supabase
      .from('manufacturing_orders')
      .insert({
        order_id: orderId,
        partner_id: selected.partner_id,
        request_payload: { ...productData, user_id: user.id },
        response_payload: { matched_product_id: selected.id, score: selected.score },
        status: 'accepted',
        assigned_at: new Date().toISOString(),
        creator_user_id: user.id,
        work_id: productData.workId ?? null
      })

    if (insErr) {
      return new Response(JSON.stringify({ error: insErr.message }), { status: 500, headers: { 'content-type': 'application/json' } })
    }

    return new Response(JSON.stringify({
      success: true,
      assigned_partner_id: selected.partner_id,
      matched_product_id: selected.id,
      score: selected.score
    }), { headers: { 'Content-Type': 'application/json' } })
  } catch (err: any) {
    console.error('manufacturing-order error:', err)
    if (err.message?.includes('Missing or invalid Authorization') || err.message?.includes('Invalid or expired token')) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: { 'content-type': 'application/json' } })
    }
    return new Response(JSON.stringify({ error: err?.message ?? 'unknown error' }), { status: 500, headers: { 'content-type': 'application/json' } })
  }
})
