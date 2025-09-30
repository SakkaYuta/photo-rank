import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { authenticateUser, getSupabaseAdmin } from '../_shared/client.ts'
import Stripe from 'https://esm.sh/stripe@13.10.0?target=deno'
import { corsHeaders, corsPreflightResponse } from '../_shared/cors.ts'

serve(async (req) => {
  if (req.method === 'OPTIONS') return corsPreflightResponse()
  if (req.method !== 'POST') return new Response('Method Not Allowed', { status: 405, headers: corsHeaders })
  try {
    const user = await authenticateUser(req)
    const supabase = getSupabaseAdmin()
    const { items, description, metadata, address_id } = await req.json().catch(() => ({})) as any
    if (!Array.isArray(items) || items.length === 0) {
      return new Response(JSON.stringify({ error: 'items required [{ work_id, qty }]' }), { status: 400, headers: { ...corsHeaders, 'content-type': 'application/json' } })
    }

    const key = Deno.env.get('STRIPE_SECRET_KEY')
    if (!key) return new Response(JSON.stringify({ error: 'Stripe key missing' }), { status: 500, headers: { ...corsHeaders, 'content-type': 'application/json' } })
    const stripe = new Stripe(key, { apiVersion: '2023-10-16' })

    // Create or reuse customer for bank transfer
    let customerId: string | undefined = undefined
    try {
      const { data: prof } = await supabase.from('users').select('id, email').eq('id', user.id).maybeSingle()
      const cust = await stripe.customers.create({ email: prof?.email || undefined, metadata: { user_id: user.id } })
      customerId = cust.id
    } catch (_) {}

    // Recompute amount server-side from works table
    const supa = getSupabaseAdmin()
    const normalized = items.map((it: any) => ({ work_id: String(it?.work_id || it?.id || ''), qty: Math.max(1, Math.floor(Number(it?.qty || 1))) }))
    const workIds = Array.from(new Set(normalized.map((x: any) => x.work_id))).filter(Boolean)
    const { data: works } = await supa.from('works').select('id, price, factory_id, is_active, is_published').in('id', workIds)
    if (!works || works.length === 0) return new Response(JSON.stringify({ error: 'works not found' }), { status: 400, headers: { ...corsHeaders, 'content-type': 'application/json' } })
    const priceMap = Object.fromEntries(works.map(w => [w.id, Math.max(0, Number(w.price||0))]))
    const subtotal = normalized.reduce((sum: number, it: any) => sum + (priceMap[it.work_id] || 0) * it.qty, 0)
    const factoryItemCounts: Record<string, number> = {}
    for (const it of normalized) {
      const w = (works as any[]).find(x => x.id === it.work_id)
      const fid = w?.factory_id || 'no-factory'
      factoryItemCounts[fid] = (factoryItemCounts[fid] || 0) + it.qty
    }
    const shippingPerFactory = 300
    const shippingTotal = Math.max(0, (Object.keys(factoryMap).length || 0) * shippingPerFactory)
    const total = Math.max(0, Math.floor(subtotal + shippingTotal))
    if (total <= 0) return new Response(JSON.stringify({ error: 'invalid total' }), { status: 400, headers: { ...corsHeaders, 'content-type': 'application/json' } })

    // destination prefecture for shipping selection
    let destPref: string | null = null
    try {
      if (address_id) {
        const { data: addr } = await supa.from('user_addresses').select('id, user_id, prefecture').eq('id', address_id).maybeSingle()
        if (addr?.user_id && addr.user_id !== user.id) return new Response(JSON.stringify({ error: 'forbidden address' }), { status: 403, headers: { ...corsHeaders, 'content-type': 'application/json' } })
        destPref = addr?.prefecture || null
      }
    } catch (_) {}

    const okinawa = (destPref || '').includes('沖縄')
    // recompute shipping with partner shipping_info
    const factoryIds = Object.keys(factoryItemCounts).filter(id => id !== 'no-factory')
    let shippingTotalAdj = 0
    if (factoryIds.length > 0) {
      const { data: partners } = await supa.from('manufacturing_partners').select('id, shipping_info').in('id', factoryIds)
      for (const fid of factoryIds) {
        const p = (partners || []).find((x: any) => x.id === fid)
        const s: any = (p as any)?.shipping_info || {}
        const regions: Array<{ prefectures?: string[]; fee_jpy?: number }> = Array.isArray(s?.regions) ? s.regions : []
        const perItemFee = Number(s?.per_item_fee_jpy || 0)
        const splitRequired = Boolean(s?.split_require)
        const splitUnit = Math.max(1, Number(s?.split_unit_count || 1))
        let baseFee = 0
        if (regions.length > 0 && destPref) {
          const found = regions.find(r => Array.isArray(r.prefectures) && r.prefectures.includes(destPref))
          if (found && Number.isFinite(found.fee_jpy)) baseFee = Number(found.fee_jpy)
        }
        if (!baseFee) {
          baseFee = okinawa ? Number(s?.fee_okinawa_jpy || 0) : Number(s?.fee_general_jpy || 0)
          if (!Number.isFinite(baseFee) || baseFee < 0) baseFee = 300
        }
        const itemCount = factoryItemCounts[fid] || 1
        const splitMultiplier = splitRequired ? Math.max(1, Math.ceil(itemCount / splitUnit)) : 1
        shippingTotalAdj += (baseFee * splitMultiplier) + (perItemFee > 0 ? perItemFee * itemCount : 0)
      }
    }
    const totalAdj = Math.max(0, Math.floor(subtotal + shippingTotalAdj))
    const intent = await stripe.paymentIntents.create({
      amount: totalAdj,
      currency: 'jpy',
      customer: customerId,
      description: description || 'Bank transfer payment',
      payment_method_types: ['customer_balance'],
      payment_method_options: {
        customer_balance: {
          funding_type: 'bank_transfer',
          bank_transfer: { type: 'jp_bank_transfer' },
        },
      },
      metadata: { user_id: user.id, ...(metadata || {}), items: JSON.stringify(normalized) },
    })

    // The instructions are available after confirm/next_action. Frontend should poll or use webhook updates.
    return new Response(JSON.stringify({ clientSecret: intent.client_secret, paymentIntentId: intent.id }), { headers: { ...corsHeaders, 'content-type': 'application/json' } })
  } catch (e: any) {
    console.error('create-bank-transfer-intent error:', e)
    const code = String(e?.message || '').includes('Authorization') ? 401 : 500
    return new Response(JSON.stringify({ error: 'failed to create bank transfer intent' }), { status: code, headers: { ...corsHeaders, 'content-type': 'application/json' } })
  }
})
