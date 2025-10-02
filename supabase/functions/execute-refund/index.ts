// Supabase Edge Function: execute-refund (v6)
// Purpose: Execute a refund for a refunds row, update statuses, and log admin note if provided.
// Auth: Requires a valid user token with admin role (checked via user_roles table), or use service role when invoked by webhook/admin backend.

import { getSupabaseAdmin, authenticateUser } from '../_shared/client.ts'
import { requireInternalSecret } from '../_shared/auth.ts'

type Json = Record<string, any> | null

async function isAdmin(userId: string): Promise<boolean> {
  const supabase = getSupabaseAdmin()
  // v6: user_roles テーブルでadminロールを確認
  const { data } = await supabase
    .from('user_roles')
    .select('role')
    .eq('user_id', userId)
    .eq('role', 'admin')
    .maybeSingle()
  return !!data
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

    // v6: Get refund + payment + order
    const { data: r, error: rErr } = await supabase
      .from('refunds')
      .select('*, payment:payments!inner(id, stripe_payment_intent_id, order_id)')
      .eq('id', refundRequestId)
      .single()
    if (rErr || !r) return new Response(JSON.stringify({ error: rErr?.message || 'refund not found' }), { status: 404 })

    // Additional safety: if Authorization header exists but user is not admin, block
    if (adminUserId === null) {
      const authHeader = req.headers.get('Authorization')
      if (authHeader) return new Response(JSON.stringify({ error: 'forbidden' }), { status: 403 })
    }

    const payment = r.payment || {}
    const paymentIntentId = payment.stripe_payment_intent_id as string | null
    const amountJpy = r.amount_jpy as number | undefined

    // Try Stripe refund first if possible (amount in cents for Stripe API)
    let stripeResult: { ok: boolean; reason?: string; data?: Json } = { ok: false }
    if (paymentIntentId && amountJpy) {
      const amountCents = amountJpy * 100  // Convert JPY to cents for Stripe
      stripeResult = await performStripeRefund(paymentIntentId, amountCents)
    }

    // v6: Update refunds table
    const updates: Record<string, any> = {
      state: stripeResult.ok ? 'processed' : 'processing',  // v5: 'refunded' → v6: 'processed'
      stripe_refund_id: stripeResult.ok ? (stripeResult.data as any)?.id : null,
      processed_at: stripeResult.ok ? new Date().toISOString() : null
    }
    const { error: upErr } = await supabase.from('refunds').update(updates).eq('id', refundRequestId)
    if (upErr) throw upErr

    // v6: Update payment state
    if (stripeResult.ok) {
      await supabase
        .from('payments')
        .update({ state: 'refunded' })
        .eq('id', r.payment_id)
    }

    return new Response(JSON.stringify({ ok: true, stripe: stripeResult }), { status: 200 })
  } catch (e) {
    return new Response(JSON.stringify({ error: (e as Error).message }), { status: 500 })
  }
}

// Deno Deploy entrypoint
Deno.serve(handler)
