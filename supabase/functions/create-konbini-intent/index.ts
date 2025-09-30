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

    const { items, description, metadata } = await req.json().catch(() => ({})) as any
    if (!Array.isArray(items) || items.length === 0) {
      return new Response(JSON.stringify({ error: 'items required [{ work_id, qty }]' }), { status: 400, headers: { ...corsHeaders, 'content-type': 'application/json' } })
    }

    const key = Deno.env.get('STRIPE_SECRET_KEY')
    if (!key) return new Response(JSON.stringify({ error: 'Stripe key missing' }), { status: 500, headers: { ...corsHeaders, 'content-type': 'application/json' } })
    const stripe = new Stripe(key, { apiVersion: '2023-10-16' })

    // Ensure a Stripe customer per user (optional)
    let customerId: string | undefined = undefined
    try {
      const { data: prof } = await supabase.from('users').select('id, email').eq('id', user.id).maybeSingle()
      if (prof?.email) {
        const cust = await stripe.customers.create({ email: prof.email, metadata: { user_id: user.id } })
        customerId = cust.id
      }
    } catch (_) {}

    // Recompute amount server-side from works table
    const supa = getSupabaseAdmin()
    const normalized = items.map((it: any) => ({ work_id: String(it?.work_id || it?.id || ''), qty: Math.max(1, Math.floor(Number(it?.qty || 1))) }))
    const workIds = Array.from(new Set(normalized.map((x: any) => x.work_id))).filter(Boolean)
    const { data: works } = await supa.from('works').select('id, price, factory_id, is_active, is_published').in('id', workIds)
    if (!works || works.length === 0) return new Response(JSON.stringify({ error: 'works not found' }), { status: 400, headers: { ...corsHeaders, 'content-type': 'application/json' } })
    // map price
    const priceMap = Object.fromEntries(works.map(w => [w.id, Math.max(0, Number(w.price||0))]))
    const subtotal = normalized.reduce((sum: number, it: any) => sum + (priceMap[it.work_id] || 0) * it.qty, 0)
    // simple shipping per factory group (best-effort)
    const factoryMap: Record<string, number> = {}
    for (const it of normalized) {
      const w = (works as any[]).find(x => x.id === it.work_id)
      const fid = w?.factory_id || 'no-factory'
      factoryMap[fid] = 1
    }
    const shippingPerFactory = 300
    const shippingTotal = Math.max(0, (Object.keys(factoryMap).length || 0) * shippingPerFactory)
    const total = Math.max(0, Math.floor(subtotal + shippingTotal))
    if (total <= 0) return new Response(JSON.stringify({ error: 'invalid total' }), { status: 400, headers: { ...corsHeaders, 'content-type': 'application/json' } })

    const intent = await stripe.paymentIntents.create({
      amount: total,
      currency: 'jpy',
      payment_method_types: ['konbini'],
      description: description || 'Konbini payment',
      customer: customerId,
      metadata: { user_id: user.id, ...(metadata || {}), items: JSON.stringify(normalized) },
    })

    // Return voucher details when available (requires confirm-on-customer?)
    // For standard flow, frontend will use client_secret to confirm and show voucher.
    return new Response(JSON.stringify({
      clientSecret: intent.client_secret,
      paymentIntentId: intent.id,
    }), { headers: { ...corsHeaders, 'content-type': 'application/json' } })
  } catch (e: any) {
    console.error('create-konbini-intent error:', e)
    const code = String(e?.message || '').includes('Authorization') ? 401 : 500
    return new Response(JSON.stringify({ error: 'failed to create konbini intent' }), { status: code, headers: { ...corsHeaders, 'content-type': 'application/json' } })
  }
})
