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

    const { amount, currency, description, metadata } = await req.json().catch(() => ({})) as any
    if (!amount || !Number.isFinite(amount)) return new Response(JSON.stringify({ error: 'amount required (JPY)' }), { status: 400, headers: { ...corsHeaders, 'content-type': 'application/json' } })

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

    const intent = await stripe.paymentIntents.create({
      amount: Math.max(0, Math.floor(amount)),
      currency: (currency || 'jpy'),
      payment_method_types: ['konbini'],
      description: description || 'Konbini payment',
      customer: customerId,
      metadata: { user_id: user.id, ...(metadata || {}) },
    })

    // Return voucher details when available (requires confirm-on-customer?)
    // For standard flow, frontend will use client_secret to confirm and show voucher.
    return new Response(JSON.stringify({
      clientSecret: intent.client_secret,
      paymentIntentId: intent.id,
    }), { headers: { ...corsHeaders, 'content-type': 'application/json' } })
  } catch (e: any) {
    const code = String(e?.message || '').includes('Authorization') ? 401 : 500
    return new Response(JSON.stringify({ error: e?.message || 'unknown error' }), { status: code, headers: { ...corsHeaders, 'content-type': 'application/json' } })
  }
})

