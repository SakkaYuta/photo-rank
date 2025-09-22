import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { authenticateUser, getSupabaseAdmin } from '../_shared/client.ts'

serve(async (req) => {
  if (req.method !== 'POST') return new Response('Method Not Allowed', { status: 405 })
  try {
    const user = await authenticateUser(req)
    const body = await req.json().catch(() => ({})) as { battle_id?: string; creator_id?: string }
    const battleId = body?.battle_id
    const creatorId = body?.creator_id
    if (!battleId || !creatorId) return new Response(JSON.stringify({ error: 'battle_id and creator_id required' }), { status: 400, headers: { 'content-type': 'application/json' } })

    const supabase = getSupabaseAdmin()
    // minimal existence check
    const { data: battle } = await supabase
      .from('battles')
      .select('id, status')
      .eq('id', battleId)
      .single()
    if (!battle || battle.status !== 'live') return new Response(JSON.stringify({ error: 'battle not live' }), { status: 400, headers: { 'content-type': 'application/json' } })

    const stripeKey = Deno.env.get('STRIPE_SECRET_KEY')
    if (!stripeKey) return new Response(JSON.stringify({ error: 'Stripe key missing' }), { status: 500, headers: { 'content-type': 'application/json' } })
    // @ts-ignore
    const StripeLib = (await import('npm:stripe@12.16.0')).default as any
    const stripe = StripeLib(stripeKey, { apiVersion: '2023-10-16' })

    const intent = await stripe.paymentIntents.create({
      amount: 100,
      currency: 'jpy',
      metadata: {
        user_id: user.id,
        type: 'cheer_ticket',
        battle_id: battleId,
        creator_id: creatorId,
      },
      description: `Cheer ticket for battle ${battleId}`,
      automatic_payment_methods: { enabled: true },
    })

    return new Response(JSON.stringify({ clientSecret: intent.client_secret, client_secret: intent.client_secret }), { headers: { 'content-type': 'application/json' } })
  } catch (e: any) {
    if (e?.message?.includes('Authorization')) return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: { 'content-type': 'application/json' } })
    return new Response(JSON.stringify({ error: e?.message ?? 'unknown error' }), { status: 500, headers: { 'content-type': 'application/json' } })
  }
})
