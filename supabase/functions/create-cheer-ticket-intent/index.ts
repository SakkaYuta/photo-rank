import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { authenticateUser, getSupabaseAdmin } from '../_shared/client.ts'
import { corsHeaders, corsPreflightResponse } from '../_shared/cors.ts'

serve(async (req) => {
  if (req.method === 'OPTIONS') return corsPreflightResponse()
  if (req.method !== 'POST') return new Response('Method Not Allowed', { status: 405, headers: corsHeaders })
  try {
    // Origin allowlist
    try {
      const allowed = (Deno.env.get('ALLOWED_ORIGINS') || '').split(',').map(s => s.trim()).filter(Boolean)
      const origin = req.headers.get('Origin') || ''
      if (allowed.length > 0 && origin && !allowed.includes(origin)) {
        return new Response('Forbidden origin', { status: 403, headers: corsHeaders })
      }
    } catch (_) {}
    const user = await authenticateUser(req)
    const body = await req.json().catch(() => ({})) as { battle_id?: string; creator_id?: string }
    const battleId = body?.battle_id
    const creatorId = body?.creator_id
    if (!battleId || !creatorId) return new Response(JSON.stringify({ error: 'battle_id and creator_id required' }), { status: 400, headers: { ...corsHeaders, 'content-type': 'application/json' } })

    const supabase = getSupabaseAdmin()
    // Rate limit: 5/min
    try {
      const { data: canProceed } = await supabase.rpc('check_rate_limit', { p_user_id: user.id, p_action: 'create_cheer_ticket_intent', p_limit: 5, p_window_minutes: 1 })
      if (canProceed === false) return new Response(JSON.stringify({ error: 'rate_limited' }), { status: 429, headers: { ...corsHeaders, 'content-type': 'application/json' } })
    } catch (_) {}
    // minimal existence check
    const { data: battle } = await supabase
      .from('battles')
      .select('id, status')
      .eq('id', battleId)
      .single()
    if (!battle || battle.status !== 'live') return new Response(JSON.stringify({ error: 'battle not live' }), { status: 400, headers: { ...corsHeaders, 'content-type': 'application/json' } })

    const stripeKey = Deno.env.get('STRIPE_SECRET_KEY')
    if (!stripeKey) return new Response(JSON.stringify({ error: 'Stripe key missing' }), { status: 500, headers: { ...corsHeaders, 'content-type': 'application/json' } })
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

    return new Response(JSON.stringify({ clientSecret: intent.client_secret, client_secret: intent.client_secret }), { headers: { ...corsHeaders, 'content-type': 'application/json' } })
  } catch (e: any) {
    if (e?.message?.includes('Authorization')) return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: { ...corsHeaders, 'content-type': 'application/json' } })
    return new Response(JSON.stringify({ error: e?.message ?? 'unknown error' }), { status: 500, headers: { ...corsHeaders, 'content-type': 'application/json' } })
  }
})
