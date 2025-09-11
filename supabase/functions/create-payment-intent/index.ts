// Skeleton for Supabase Edge Function: create-payment-intent
// Note: This is a placeholder. Wire Stripe secret and input validation before production use.
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { getSupabaseAdmin } from '../_shared/client.ts'
// deno-lint-ignore no-explicit-any
type Stripe = any

serve(async (req) => {
  if (req.method !== 'POST') return new Response('Method Not Allowed', { status: 405 })
  try {
    const body = await req.json()
    const { workId, userId } = body
    if (!workId || !userId) return new Response('Bad Request', { status: 400 })
    const supabase = getSupabaseAdmin()
    const { data: work, error } = await supabase
      .from('works')
      .select('id, price, title, creator_id')
      .eq('id', workId)
      .single()
    if (error || !work) return new Response('Work not found', { status: 404 })

    const stripeKey = Deno.env.get('STRIPE_SECRET_KEY')
    if (!stripeKey) return new Response('Stripe key missing', { status: 500 })
    // @ts-ignore: Deno npm compat
    const StripeLib = (await import('npm:stripe@12.16.0')).default as (key: string, opts?: unknown) => Stripe
    const stripe = StripeLib(stripeKey, { apiVersion: '2023-10-16' })

    const intent = await stripe.paymentIntents.create({
      amount: work.price,
      currency: 'jpy',
      metadata: { user_id: userId, work_id: work.id, type: 'work_purchase' },
      description: `Photo purchase: ${work.title}`,
      automatic_payment_methods: { enabled: true },
    })

    return new Response(JSON.stringify({ clientSecret: intent.client_secret, client_secret: intent.client_secret }), { headers: { 'content-type': 'application/json' } })
  } catch (e) {
    return new Response(JSON.stringify({ error: String(e) }), { status: 400 })
  }
});
