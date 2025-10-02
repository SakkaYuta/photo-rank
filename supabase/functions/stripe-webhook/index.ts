// 既存スキーマ完全整合版 - RPC呼び出し統一
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.0';
import Stripe from 'https://esm.sh/stripe@13.10.0?target=deno';
import { sendEmail } from '../_shared/email.ts'
import { renderPurchaseSuccessEmail, renderPaymentFailedEmail, renderRefundEmail } from '../_shared/emailTemplates.ts'
import { corsHeaders, corsPreflightResponse } from '../_shared/cors.ts'

serve(async (req) => {
  if (req.method === 'OPTIONS') return corsPreflightResponse()

  const signature = req.headers.get('stripe-signature');
  let rawBody: string = '';
  
  try {
    rawBody = await req.text();
  } catch (err) {
    return new Response(
      JSON.stringify({ error: 'Failed to read request body' }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  if (!signature) {
    // 署名なしのリクエストをログ（v6: event_type/received_at）
    try {
      const supabase = createClient(
        Deno.env.get('SUPABASE_URL')!,
        Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
      );
      await supabase.from('stripe_webhook_events').insert({
        id: `no_signature_${Date.now()}`,
        event_type: 'invalid_request',
        payload: { raw_body: rawBody.substring(0, 5000) },
        received_at: new Date().toISOString(),
      });
    } catch (logErr) {
      console.error('Failed to log missing signature:', logErr);
    }

    return new Response(
      JSON.stringify({ error: 'Missing stripe-signature header' }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  let event: Stripe.Event | null = null;
  let supabase: any = null;

  try {
    // 環境変数の取得
    const stripeSecretKey = Deno.env.get('STRIPE_SECRET_KEY');
    const stripeWebhookSecret = Deno.env.get('STRIPE_WEBHOOK_SECRET');
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

    if (!stripeSecretKey || !stripeWebhookSecret || !supabaseUrl || !supabaseKey) {
      throw new Error('Missing required environment variables');
    }

    // クライアントの初期化
    const stripe = new Stripe(stripeSecretKey, {
      apiVersion: '2023-10-16',
      httpClient: Stripe.createFetchHttpClient(),
    });
    
    supabase = createClient(supabaseUrl, supabaseKey);

    // Stripe署名の検証
    event = stripe.webhooks.constructEvent(
      rawBody,
      signature,
      stripeWebhookSecret
    );

    console.log(`Received Stripe event: ${event.type} - ${event.id}`);

    // v6: イベントを記録（id=Stripeのevent.id）。冪等性はid衝突で担保。
    await supabase
      .from('stripe_webhook_events')
      .insert({
        id: event.id,
        event_type: event.type,
        payload: event.data.object,
        received_at: new Date().toISOString(),
      })
      .then(({ error }) => {
        if (error && !String(error.message || '').includes('duplicate key')) {
          console.warn('stripe_webhook_events insert warning:', error)
        }
      });

    // イベントタイプごとの処理
    let processingResult: any = {};
    
    switch (event.type) {
      case 'payment_intent.succeeded': {
        const pi = event.data.object as Stripe.PaymentIntent
        if (pi?.metadata?.type === 'live_offer') {
          try {
            const { error: txErr } = await supabase.rpc('finalize_live_offer_transaction', {
              p_payment_intent_id: pi.id,
            })
            if (txErr) console.error('finalize_live_offer_transaction error:', txErr)
          } catch (e) {
            console.error('finalize_live_offer_transaction failed:', e)
          }
        }
        processingResult = await handlePaymentIntentSucceeded(supabase, pi)
        if (pi?.metadata?.type === 'cheer_points' && pi.metadata.user_id && pi.metadata.battle_id && pi.metadata.creator_id) {
          try {
            const battleId = String(pi.metadata.battle_id)
            const creatorId = String(pi.metadata.creator_id)
            const supporterId = String(pi.metadata.user_id)
            const amountJpy = Math.floor(((pi.amount_received ?? pi.amount ?? 0) as number) / 100)
            const { data: computedPoints } = await supabase.rpc('jpy_to_points', { amount_jpy: amountJpy })
            const points = Number(computedPoints ?? amountJpy)
            if (amountJpy >= 0 && points >= 0) {
              await supabase
                .from('cheer_tickets')
                .insert({
                  battle_id: battleId,
                  supporter_id: supporterId,
                  creator_id: creatorId,
                  amount_jpy: amountJpy,
                  points,
                  exclusive_options: { mode: 'paid_points', payment_intent_id: pi.id },
                })
            }
          } catch (e) {
            console.error('Failed to insert cheer_tickets:', e)
          }
        }
        break
      }

      case 'payment_intent.payment_failed': {
        const pi = event.data.object as Stripe.PaymentIntent
        processingResult = await handlePaymentIntentFailed(supabase, pi)
        break
      }

      case 'payment_intent.canceled': {
        const pi = event.data.object as Stripe.PaymentIntent
        processingResult = await handlePaymentIntentCanceled(supabase, pi)
        break
      }

      case 'charge.refunded': {
        const ch = event.data.object as Stripe.Charge
        processingResult = await handleChargeRefunded(supabase, ch)
        break
      }

      case 'payment_intent.processing': {
        // v6: DB更新せずログのみ
        processingResult = { processing: true }
        break
      }
      // removed duplicate payment_intent.canceled case to avoid confusion
      default:
        console.log(`Unhandled event type: ${event.type}`);
        processingResult = { unhandled: true };
    }

    return new Response(
      JSON.stringify({ 
        received: true, 
        type: event.type,
        result: processingResult 
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (err: any) {
    console.error('Webhook processing error:', err);
    
    // エラーログ（v6: event_type/received_at）
    try {
      if (!supabase) {
        supabase = createClient(
          Deno.env.get('SUPABASE_URL')!,
          Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
        );
      }

      await supabase.from('stripe_webhook_events').insert({
        id: event?.id ? `error_${event.id}` : `error_${Date.now()}`,
        event_type: event?.type ?? 'validation_error',
        payload: { raw_body: rawBody.substring(0, 5000), error: err?.message ?? 'Unknown error' },
        received_at: new Date().toISOString(),
      });
    } catch (logErr) {
      console.error('Failed to log webhook error:', logErr);
    }

    return new Response(
      JSON.stringify({ error: err?.message || 'Invalid payload' }),
      { 
        status: 400, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
});

// ===== 決済成功処理 =====
async function handlePaymentIntentSucceeded(
  supabase: any,
  paymentIntent: Stripe.PaymentIntent
): Promise<any> {
  // すでにCAPTURED済みなら冪等スキップ（payments）
  try {
    const { data: existing } = await supabase
      .from('payments')
      .select('id')
      .eq('stripe_payment_intent_id', paymentIntent.id)
      .eq('state', 'captured')
      .maybeSingle()
    if (existing?.id) return { success: true, idempotent: true }
  } catch (_) {}

  // v6 互換RPCで確定（orders/payment/digital権利付与）
  const { error } = await supabase.rpc('complete_purchase_transaction', {
    p_payment_intent_id: paymentIntent.id,
    p_amount_jpy: Math.floor(((paymentIntent.amount_received ?? paymentIntent.amount ?? 0) as number) / 100)
  })
  if (error) throw new Error(`Transaction failed: ${error.message}`)

  // 購入完了メール（最低限: ユーザーEmailのみ）
  try {
    const userId = (paymentIntent.metadata?.user_id as string | undefined) || undefined
    if (userId) {
      const { data: u } = await supabase
        .from('users')
        .select('email')
        .eq('id', userId)
        .single()
      const email = u?.email
      if (email) {
        const amountYen = Math.floor(((paymentIntent.amount_received ?? paymentIntent.amount ?? 0) as number) / 100)
        const html = renderPurchaseSuccessEmail({ amount: amountYen, items: [] })
        await sendEmail({ to: email, subject: 'ご購入ありがとうございます（注文確認）', html })
      }
    }
  } catch (mailErr) {
    console.error('failed to send purchase email:', mailErr)
  }

  return { success: true, payment_intent_id: paymentIntent.id, complete: true }
}

// ===== 決済失敗処理（RPC使用） =====
async function handlePaymentIntentFailed(
  supabase: any,
  paymentIntent: Stripe.PaymentIntent
): Promise<any> {
  // payments を failed に
  try {
    await supabase
      .from('payments')
      .update({ state: 'failed', error_code: (paymentIntent.last_payment_error as any)?.code ?? null, error_message: (paymentIntent.last_payment_error as any)?.message ?? null })
      .eq('stripe_payment_intent_id', paymentIntent.id)
  } catch (_) {}

  // 失敗ログ
  try {
    await supabase
      .from('payment_failures')
      .insert({
        payment_id: null,
        payment_intent_id: paymentIntent.id,
        reason: (paymentIntent.last_payment_error as any)?.code ?? 'payment_failed',
        payload: { code: (paymentIntent.last_payment_error as any)?.code, message: (paymentIntent.last_payment_error as any)?.message },
        created_at: new Date().toISOString(),
      })
  } catch (_) {}

  // 失敗メール（ベストエフォート）
  try {
    const userId = (paymentIntent.metadata?.user_id as string | undefined) || undefined
    if (userId) {
      const { data: profile } = await supabase
        .from('users')
        .select('email')
        .eq('id', userId)
        .single()
      if (profile?.email) await sendEmail({ to: profile.email, subject: 'お支払いに失敗しました', html: renderPaymentFailedEmail() })
    }
  } catch (_) {}

  return { success: true, failed: true };
}

// ===== 決済キャンセル処理（RPC使用） =====
async function handlePaymentIntentCanceled(
  supabase: any,
  paymentIntent: Stripe.PaymentIntent
): Promise<any> {
  try {
    await supabase
      .from('payments')
      .update({ state: 'cancelled' })
      .eq('stripe_payment_intent_id', paymentIntent.id)
  } catch (_) {}
  return { success: true, canceled: true };
}

// ===== 返金処理（修正版） =====
async function handleChargeRefunded(
  supabase: any,
  charge: Stripe.Charge
): Promise<any> {
  const paymentIntentId = charge.payment_intent as string

  // payments を refunded に、refunds レコードを追加（ベストエフォート）
  try {
    const { data: pay } = await supabase
      .from('payments')
      .update({ state: 'refunded' })
      .eq('stripe_payment_intent_id', paymentIntentId)
      .select('id, order_id')
      .maybeSingle()

    if (pay?.id) {
      await supabase.from('refunds').insert({
        payment_id: pay.id,
        amount_jpy: Math.floor((charge.amount_refunded || 0) / 100),
        state: 'processed',
        reason: (charge.reason as string | null) ?? null,
        stripe_refund_id: charge.id,
        processed_at: new Date().toISOString(),
      })

      // 返金メール（ベストエフォート）: 注文のユーザーに送付
      try {
        const { data: o } = await supabase
          .from('orders')
          .select('user_id')
          .eq('id', pay.order_id)
          .single()
        if (o?.user_id) {
          const { data: u } = await supabase
            .from('users')
            .select('email')
            .eq('id', o.user_id)
            .single()
          if (u?.email) {
            await sendEmail({ to: u.email, subject: '返金手続きを行いました', html: renderRefundEmail((charge.amount_refunded || 0)/100) })
          }
        }
      } catch (mailErr) {
        console.error('failed to send refund email:', mailErr)
      }
    }
  } catch (e) {
    console.error('refund handling failed:', e)
  }

  return { success: true, refunded: true };
}
