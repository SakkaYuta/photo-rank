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

    // Create or reuse customer for bank transfer
    let customerId: string | undefined = undefined
    try {
      const { data: prof } = await supabase.from('users').select('id, email').eq('id', user.id).maybeSingle()
      const cust = await stripe.customers.create({ email: prof?.email || undefined, metadata: { user_id: user.id } })
      customerId = cust.id
    } catch (_) {}

    const intent = await stripe.paymentIntents.create({
      amount: Math.max(0, Math.floor(amount)),
      currency: (currency || 'jpy'),
      customer: customerId,
      description: description || 'Bank transfer payment',
      payment_method_types: ['customer_balance'],
      payment_method_options: {
        customer_balance: {
          funding_type: 'bank_transfer',
          bank_transfer: { type: 'jp_bank_transfer' },
        },
      },
      metadata: { user_id: user.id, ...(metadata || {}) },
    })

    // The instructions are available after confirm/next_action. Frontend should poll or use webhook updates.
    return new Response(JSON.stringify({ clientSecret: intent.client_secret, paymentIntentId: intent.id }), { headers: { ...corsHeaders, 'content-type': 'application/json' } })
  } catch (e: any) {
    const code = String(e?.message || '').includes('Authorization') ? 401 : 500
    return new Response(JSON.stringify({ error: e?.message || 'unknown error' }), { status: code, headers: { ...corsHeaders, 'content-type': 'application/json' } })
  }
})

