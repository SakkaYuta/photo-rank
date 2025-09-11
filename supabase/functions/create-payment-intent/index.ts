// Skeleton for Supabase Edge Function: create-payment-intent
// Note: This is a placeholder. Wire Stripe secret and input validation before production use.
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { getSupabaseAdmin, authenticateUser } from '../_shared/client.ts'
// deno-lint-ignore no-explicit-any
type Stripe = any

serve(async (req) => {
  if (req.method !== 'POST') return new Response('Method Not Allowed', { status: 405 })
  
  try {
    // Authenticate user from request headers
    const user = await authenticateUser(req)
    
    const body = await req.json()
    const { workId } = body
    if (!workId) return new Response('Bad Request: workId is required', { status: 400 })
    
    const supabase = getSupabaseAdmin()
    const { data: work, error } = await supabase
      .from('works')
      .select('id, price, title, creator_id')
      .eq('id', workId)
      .single()
    if (error || !work) return new Response('Work not found', { status: 404 })

    // Prevent self-purchase
    if (work.creator_id === user.id) {
      return new Response('Cannot purchase your own work', { status: 400 })
    }

    const stripeKey = Deno.env.get('STRIPE_SECRET_KEY')
    if (!stripeKey) return new Response('Stripe key missing', { status: 500 })
    // @ts-ignore: Deno npm compat
    const StripeLib = (await import('npm:stripe@12.16.0')).default as (key: string, opts?: unknown) => Stripe
    const stripe = StripeLib(stripeKey, { apiVersion: '2023-10-16' })

    const intent = await stripe.paymentIntents.create({
      amount: work.price,
      currency: 'jpy',
      metadata: { user_id: user.id, work_id: work.id, type: 'work_purchase' },
      description: `Photo purchase: ${work.title}`,
      automatic_payment_methods: { enabled: true },
    })

    return new Response(JSON.stringify({ clientSecret: intent.client_secret, client_secret: intent.client_secret }), { headers: { 'content-type': 'application/json' } })
  } catch (e) {
    console.error('create-payment-intent error:', e)
    if (e.message.includes('Missing or invalid Authorization') || e.message.includes('Invalid or expired token')) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: { 'content-type': 'application/json' } })
    }
    return new Response(JSON.stringify({ error: String(e) }), { status: 400, headers: { 'content-type': 'application/json' } })
  }
});
