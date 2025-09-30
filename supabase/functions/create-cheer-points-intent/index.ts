import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { authenticateUser, getSupabaseAdmin } from '../_shared/client.ts'
import Stripe from 'https://esm.sh/stripe@13.10.0?target=deno'
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
    const supabase = getSupabaseAdmin()

    // Rate limit per user (5/min)
    try {
      const { data: canProceed } = await supabase.rpc('check_rate_limit', {
        p_user_id: user.id, p_action: 'create_cheer_points_intent', p_limit: 5, p_window_minutes: 1
      })
      if (canProceed === false) return new Response(JSON.stringify({ error: 'rate_limited' }), { status: 429, headers: { ...corsHeaders, 'content-type': 'application/json' } })
    } catch (_) {}

    const { battle_id: battleId, creator_id: creatorId, points } = await req.json().catch(() => ({})) as { battle_id?: string; creator_id?: string; points?: number }
    if (!battleId || !creatorId || !points) return new Response(JSON.stringify({ error: 'battle_id, creator_id, points required' }), { status: 400, headers: { ...corsHeaders, 'content-type': 'application/json' } })

    // Validate points tier
    const allowedPoints = new Set([100, 1000, 10000, 100000])
    if (!allowedPoints.has(points)) return new Response(JSON.stringify({ error: 'invalid points' }), { status: 400, headers: { ...corsHeaders, 'content-type': 'application/json' } })

    // Ensure battle live and creator is participant
    const { data: battle, error } = await supabase
      .from('battles')
      .select('id, status, challenger_id, opponent_id')
      .eq('id', battleId)
      .single()
    if (error || !battle) return new Response(JSON.stringify({ error: 'battle not found' }), { status: 404, headers: { ...corsHeaders, 'content-type': 'application/json' } })
    if (battle.status !== 'live') return new Response(JSON.stringify({ error: 'battle is not live' }), { status: 400, headers: { ...corsHeaders, 'content-type': 'application/json' } })
    if (![battle.challenger_id, battle.opponent_id].includes(creatorId)) return new Response(JSON.stringify({ error: 'invalid creator_id' }), { status: 400, headers: { ...corsHeaders, 'content-type': 'application/json' } })

    const key = Deno.env.get('STRIPE_SECRET_KEY')
    if (!key) return new Response(JSON.stringify({ error: 'Stripe key missing' }), { status: 500, headers: { ...corsHeaders, 'content-type': 'application/json' } })
    const stripe = new Stripe(key, { apiVersion: '2023-10-16' })

    // Create PaymentIntent (1pt = 1JPY)
    const intent = await stripe.paymentIntents.create({
      amount: points,
      currency: 'jpy',
      description: `Cheer points for battle ${battleId}`,
      metadata: {
        type: 'cheer_points',
        user_id: user.id,
        battle_id: battleId,
        creator_id: creatorId,
        points: String(points)
      },
      automatic_payment_methods: { enabled: true },
    })

    return new Response(JSON.stringify({ clientSecret: intent.client_secret }), { headers: { ...corsHeaders, 'content-type': 'application/json' } })
  } catch (e: any) {
    console.error('create-cheer-points-intent error:', e)
    const code = String(e?.message || '').includes('Authorization') ? 401 : 500
    return new Response(JSON.stringify({ error: 'failed to create intent' }), { status: code, headers: { ...corsHeaders, 'content-type': 'application/json' } })
  }
})

