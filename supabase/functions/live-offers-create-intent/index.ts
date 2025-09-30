import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { getSupabaseAdmin, authenticateUser } from '../_shared/client.ts'
import { corsHeaders, corsPreflightResponse } from '../_shared/cors.ts'

// deno-lint-ignore no-explicit-any
type Stripe = any

serve(async (req) => {
  if (req.method === 'OPTIONS') return corsPreflightResponse()
  if (req.method !== 'POST') return new Response('Method Not Allowed', { status: 405 })
  try {
    const user = await authenticateUser(req)
    const supabase = getSupabaseAdmin()

    const body = await req.json().catch(() => ({})) as { live_offer_id?: string }
    const live_offer_id = body?.live_offer_id || ''
    if (!live_offer_id) return new Response(JSON.stringify({ error: 'live_offer_id required' }), { status: 400, headers: { ...corsHeaders, 'content-type': 'application/json' } })

    const nowIso = new Date().toISOString()
    const { data: offer, error: offErr } = await supabase
      .from('live_offers')
      .select('id, work_id, creator_id, start_at, end_at, status, price_override, currency, stock_total, stock_reserved, stock_sold, per_user_limit, works(price)')
      .eq('id', live_offer_id)
      .single()
    if (offErr || !offer) return new Response(JSON.stringify({ error: offErr?.message || 'offer not found' }), { status: 404, headers: { ...corsHeaders, 'content-type': 'application/json' } })
    if (offer.status !== 'published' || !(offer.start_at <= nowIso && offer.end_at >= nowIso)) {
      return new Response(JSON.stringify({ error: 'offer not active' }), { status: 400, headers: { ...corsHeaders, 'content-type': 'application/json' } })
    }
    const available = (offer.stock_total || 0) - (offer.stock_reserved || 0) - (offer.stock_sold || 0)
    if (available < 1) return new Response(JSON.stringify({ error: 'sold out' }), { status: 409, headers: { ...corsHeaders, 'content-type': 'application/json' } })

    const stripeKey = Deno.env.get('STRIPE_SECRET_KEY')
    if (!stripeKey) return new Response(JSON.stringify({ error: 'Stripe key missing' }), { status: 500, headers: { ...corsHeaders, 'content-type': 'application/json' } })
    // @ts-ignore: Deno npm compat
    const StripeLib = (await import('npm:stripe@12.16.0')).default as (key: string, opts?: unknown) => Stripe
    const stripe = StripeLib(stripeKey, { apiVersion: '2023-10-16' })

    const basePrice = offer?.works?.price || 0
    const amount = Number.isInteger(offer.price_override) ? offer.price_override : basePrice
    if (!Number.isInteger(amount) || amount <= 0) return new Response(JSON.stringify({ error: 'invalid amount' }), { status: 400, headers: { ...corsHeaders, 'content-type': 'application/json' } })

    const intent = await stripe.paymentIntents.create({
      amount,
      currency: offer.currency || 'jpy',
      metadata: { type: 'live_offer', live_offer_id: offer.id, work_id: offer.work_id, user_id: user.id },
      description: `Live offer purchase`,
      automatic_payment_methods: { enabled: true },
    })

    return new Response(JSON.stringify({ clientSecret: intent.client_secret, client_secret: intent.client_secret }), { headers: { ...corsHeaders, 'content-type': 'application/json' } })
  } catch (e: any) {
    if (e?.message?.includes('Unauthorized')) return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: { ...corsHeaders, 'content-type': 'application/json' } })
    return new Response(JSON.stringify({ error: e?.message || 'internal error' }), { status: 500, headers: { ...corsHeaders, 'content-type': 'application/json' } })
  }
})

