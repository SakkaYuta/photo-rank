// Supabase Edge Function: execute-refund
// Purpose: Execute a refund for a refund_requests row, update statuses, and log admin note if provided.
// Auth: Requires a valid user token with admin role (checked via profiles table), or use service role when invoked by webhook/admin backend.

import { getSupabaseAdmin, authenticateUser } from '../_shared/client.ts'
import { requireInternalSecret } from '../_shared/auth.ts'

type Json = Record<string, any> | null

async function isAdmin(userId: string): Promise<boolean> {
  const supabase = getSupabaseAdmin()
  const { data } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', userId)
    .single()
  return !!data && (data as any).role === 'admin'
}

async function performStripeRefund(paymentIntentId: string, amount?: number) {
  const key = Deno.env.get('STRIPE_SECRET_KEY')
  if (!key) return { ok: false, reason: 'no-stripe-key' }
  try {
    const res = await fetch('https://api.stripe.com/v1/refunds', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${key}`,
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      body: new URLSearchParams({
        payment_intent: paymentIntentId,
        ...(amount ? { amount: String(amount) } : {}),
      })
    })
    const json = await res.json()
    if (!res.ok) throw new Error(json?.error?.message || 'Stripe refund failed')
    return { ok: true, data: json }
  } catch (e) {
    return { ok: false, reason: (e as Error).message }
  }
}

export async function handler(req: Request): Promise<Response> {
  try {
    // Internal secret from env (required for non-admin access)
    const internalSecret = Deno.env.get('INTERNAL_CRON_SECRET') || ''

    // Admin auth (if Authorization header exists)
    let adminUserId: string | null = null
    try {
      const user = await authenticateUser(req)
      if (user?.id && (await isAdmin(user.id))) adminUserId = user.id
    } catch {}

    if (adminUserId === null) {
      if (!internalSecret) {
        // Safe default: deny if secret not configured
        return new Response(JSON.stringify({ error: 'forbidden' }), { status: 403 })
      }
      const secretError = requireInternalSecret(req)
      if (secretError) return secretError
    }

    const supabase = getSupabaseAdmin()
    const { refundRequestId } = await req.json()
    if (!refundRequestId) return new Response(JSON.stringify({ error: 'refundRequestId required' }), { status: 400 })

    // Get refund request + purchase
    const { data: r, error: rErr } = await supabase
      .from('refund_requests')
      .select('*, purchase:purchases(*)')
      .eq('id', refundRequestId)
      .single()
    if (rErr || !r) return new Response(JSON.stringify({ error: rErr?.message || 'refund request not found' }), { status: 404 })

    // Additional safety: if Authorization header exists but user is not admin, block
    if (adminUserId === null) {
      const authHeader = req.headers.get('Authorization')
      if (authHeader) return new Response(JSON.stringify({ error: 'forbidden' }), { status: 403 })
    }

    const purchase = r.purchase || {}
    const paymentIntentId = purchase.stripe_payment_intent_id as string | null
    const amount = r.amount as number | undefined

    // Try Stripe refund first if possible
    let stripeResult: { ok: boolean; reason?: string; data?: Json } = { ok: false }
    if (paymentIntentId) {
      stripeResult = await performStripeRefund(paymentIntentId, amount)
    }

    // Update DB statuses regardless (if Stripe not configured, treat as offline refund)
    const updates: Record<string, any> = { status: stripeResult.ok ? 'refunded' : 'processing' }
    const { error: upErr } = await supabase.from('refund_requests').update(updates).eq('id', refundRequestId)
    if (upErr) throw upErr

    // Also reflect into purchases
    const pUpdates: Record<string, any> = {
      refund_status: stripeResult.ok ? 'refunded' : 'processing',
      refund_amount: amount || null,
      refund_processed_at: stripeResult.ok ? new Date().toISOString() : null,
    }
    await supabase.from('purchases').update(pUpdates).eq('id', r.purchase_id)

    return new Response(JSON.stringify({ ok: true, stripe: stripeResult }), { status: 200 })
  } catch (e) {
    return new Response(JSON.stringify({ error: (e as Error).message }), { status: 500 })
  }
}

// Deno Deploy entrypoint
Deno.serve(handler)
