// Skeleton for Supabase Edge Function: stripe-webhook
// Verify signature, parse event, and persist purchases/status.
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import Stripe from 'https://esm.sh/stripe@13.10.0?target=deno'
import { getSupabaseAdmin } from '../_shared/client.ts'
import { logWebhookError } from '../_shared/monitoring.ts'

serve(async (req) => {
  if (req.method !== 'POST') return new Response('Method Not Allowed', { status: 405 })
  try {
    const sig = req.headers.get('stripe-signature')
    const payload = await req.text()
    const secret = Deno.env.get('STRIPE_WEBHOOK_SECRET')
    const key = Deno.env.get('STRIPE_SECRET_KEY')
    if (!secret || !key) return new Response('Webhook secret missing', { status: 500 })
    const stripe = new Stripe(key, { apiVersion: '2023-10-16', httpClient: Stripe.createFetchHttpClient() })

    let event
    try {
      event = stripe.webhooks.constructEvent(payload, sig!, secret)
    } catch (err) {
      return new Response(`Webhook Error: ${String(err)}`, { status: 400 })
    }

    const supabase = getSupabaseAdmin()
    // log event
    await supabase.from('webhook_events').insert({ event_id: event.id, event_type: event.type, payload: event.data })

    switch (event.type) {
      case 'payment_intent.succeeded': {
        const pi = event.data.object as Stripe.PaymentIntent
        const workId = (pi.metadata as any)?.work_id
        const userId = (pi.metadata as any)?.user_id
        if (workId && userId) {
          const { error: pErr } = await supabase.from('purchases').insert({
            user_id: userId,
            work_id: workId,
            price: pi.amount_received ?? pi.amount,
            status: 'paid',
            currency: pi.currency,
            stripe_payment_intent_id: pi.id,
            purchased_at: new Date().toISOString(),
          } as any)
          if (pErr && !String(pErr.message || '').includes('duplicate')) {
            console.error('purchase insert error', pErr)
          }
          const { error: cErr } = await supabase.rpc('confirm_work_sale', { p_work_id: workId, p_amount: pi.amount })
          if (cErr) console.error('confirm_work_sale error', cErr)
        }
        break
      }
      case 'payment_intent.payment_failed': {
        const pi = event.data.object as Stripe.PaymentIntent
        const workId = (pi.metadata as any)?.work_id
        if (workId) await supabase.rpc('release_work_lock', { p_work_id: workId })
        break
      }
      case 'charge.refunded': {
        const ch = event.data.object as Stripe.Charge
        const { error } = await supabase
          .from('purchases')
          .update({ status: 'refunded' })
          .eq('stripe_payment_intent_id', String(ch.payment_intent))
        if (error) console.error('refund update error', error)
        break
      }
      default:
        // ignore
        break
    }
    return new Response('ok', { status: 200 })
  } catch (e) {
    try { await logWebhookError(e as Error) } catch {}
    return new Response(String(e), { status: 400 })
  }
});
