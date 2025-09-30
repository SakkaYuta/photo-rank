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
    // 署名なしのリクエストをログ
    try {
      const supabase = createClient(
        Deno.env.get('SUPABASE_URL')!,
        Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
      );
      await supabase.from('stripe_webhook_events').insert({
        id: crypto.randomUUID(),
        stripe_event_id: 'no_signature_' + Date.now(),
        type: 'invalid_request',
        payload: { raw_body: rawBody.substring(0, 5000) },
        processed: false,
        error: 'Missing stripe-signature header',
        created_at: new Date().toISOString(),
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

    // イベントをupsertで記録（冪等性確保）
    const webhookEvent = {
      stripe_event_id: event.id,
      type: event.type,
      payload: event.data.object,
      processed: false,
      idempotency_key: `stripe_${event.id}`,
      created_at: new Date().toISOString(),
    };

    const { data: upsertedEvent, error: upsertError } = await supabase
      .from('stripe_webhook_events')
      .upsert(webhookEvent, { 
        onConflict: 'stripe_event_id',
        ignoreDuplicates: false 
      })
      .select()
      .single();

    if (upsertError) {
      console.error('Failed to upsert event:', upsertError);
      throw new Error(`Event logging failed: ${upsertError.message}`);
    }

    // すでに処理済みの場合はスキップ
    if (upsertedEvent.processed) {
      console.log(`Event ${event.id} already processed, skipping`);
      return new Response(
        JSON.stringify({ received: true, skipped: true }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // イベントタイプごとの処理
    let processingResult: any = {};
    
    switch (event.type) {
      case 'payment_intent.succeeded':
        {
          const pi = event.data.object as Stripe.PaymentIntent
          if (pi?.metadata?.type === 'live_offer' && pi.metadata.live_offer_id && pi.metadata.user_id) {
            try {
              // finalize + purchases insert atomically
              const { error: txErr } = await supabase.rpc('finalize_live_offer_transaction', {
                p_live_offer_id: pi.metadata.live_offer_id,
                p_user_id: pi.metadata.user_id,
                p_payment_intent_id: pi.id,
                p_amount: pi.amount,
                p_currency: pi.currency
              })
              if (txErr) throw txErr
            } catch (e) {
              console.error('finalize_live_offer_transaction failed:', e)
            }
          }
          processingResult = await handlePaymentIntentSucceeded(
            supabase,
            pi
          );
          // Link purchase to live_offer if applicable
          // tagging handled by finalize RPC insert; no-op here
        }
        break;

      case 'payment_intent.payment_failed':
        processingResult = await handlePaymentIntentFailed(
          supabase,
          event.data.object as Stripe.PaymentIntent
        );
        break;

      case 'payment_intent.canceled':
        processingResult = await handlePaymentIntentCanceled(
          supabase,
          event.data.object as Stripe.PaymentIntent
        );
        break;

      case 'charge.refunded':
        processingResult = await handleChargeRefunded(
          supabase,
          event.data.object as Stripe.Charge
        );
        break;

      case 'payment_intent.processing': {
        const pi = event.data.object as Stripe.PaymentIntent
        // Optional: update purchases.payment_status to processing
        try {
          await supabase.from('purchases').update({ payment_status: 'processing' }).eq('stripe_payment_intent_id', pi.id)
        } catch {}
        processingResult = { processing: true }
        break
      }
      case 'payment_intent.canceled': {
        const pi = event.data.object as Stripe.PaymentIntent
        try {
          await supabase.from('purchases').update({ payment_status: 'canceled' }).eq('stripe_payment_intent_id', pi.id)
        } catch {}
        processingResult = { canceled: true }
        break
      }
      default:
        console.log(`Unhandled event type: ${event.type}`);
        processingResult = { unhandled: true };
    }

    // 処理完了を記録
    await supabase
      .from('stripe_webhook_events')
      .update({
        processed: true,
        processed_at: new Date().toISOString(),
      })
      .eq('stripe_event_id', event.id);

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
    
    // エラーログの記録を試行
    try {
      if (!supabase) {
        supabase = createClient(
          Deno.env.get('SUPABASE_URL')!,
          Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
        );
      }

      if (event?.id) {
        // イベントIDが判明している場合は更新
        await supabase
          .from('stripe_webhook_events')
          .update({
            processed: false,
            error: err?.message ?? 'Unknown error',
            updated_at: new Date().toISOString(),
          })
          .eq('stripe_event_id', event.id);
      } else {
        // 署名検証前のエラーは新規挿入
        await supabase.from('stripe_webhook_events').insert({
          id: crypto.randomUUID(),
          stripe_event_id: 'error_' + Date.now(),
          type: 'validation_error',
          payload: { 
            raw_body: rawBody.substring(0, 5000),
            signature_header: signature?.substring(0, 100)
          },
          processed: false,
          error: err?.message ?? 'Unknown error',
          created_at: new Date().toISOString(),
        });
      }
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
  const { user_id, work_id, order_id, type, battle_id, creator_id } = paymentIntent.metadata as any;
  // Cheer ticket flow
  if (type === 'cheer_ticket' && battle_id && creator_id && user_id) {
    await supabase
      .from('cheer_tickets')
      .insert({
        battle_id,
        supporter_id: user_id,
        creator_id,
        amount: paymentIntent.amount,
        has_signed_goods_right: true,
        has_exclusive_options: true,
        purchased_at: new Date().toISOString()
      })
    return { success: true, cheer: true }
  }
  
  if (!user_id || !work_id) {
    throw new Error('Missing required metadata in payment intent');
  }

  // すでに同じPIで購入確定済みなら冪等的にスキップ
  try {
    const { data: existing } = await supabase
      .from('purchases')
      .select('id')
      .eq('stripe_payment_intent_id', paymentIntent.id)
      .maybeSingle()
    if (existing?.id) {
      return { success: true, idempotent: true }
    }
  } catch (_) {}

  // トランザクション的な処理（RPC関数を使用）
  const { data, error } = await supabase.rpc('complete_purchase_transaction', {
    p_payment_intent_id: paymentIntent.id,
    p_user_id: user_id,
    p_work_id: work_id,
    p_order_id: order_id,
    p_amount: paymentIntent.amount,
    p_currency: paymentIntent.currency,
  });

  if (error) {
    throw new Error(`Transaction failed: ${error.message}`);
  }

  // ユーザーのメールアドレスを取得
  let buyerEmail: string | undefined = undefined
  try {
    const { data: profile } = await supabase
      .from('users')
      .select('email, display_name')
      .eq('id', user_id)
      .single()
    buyerEmail = profile?.email
  } catch (_) {}

  // メール用のアイテム一覧を試行取得
  const items: Array<{ title: string; price: number }> = []
  try {
    if (paymentIntent.metadata?.type === 'bulk_purchase') {
      const { data } = await supabase
        .from('purchases')
        .select('amount, works(title)')
        .eq('stripe_payment_intent_id', paymentIntent.id)
      data?.forEach((row: any) => {
        const title = row?.works?.title || 'アイテム'
        const price = (row?.amount || 0)
        items.push({ title, price })
      })
    } else if (work_id) {
      const { data: work } = await supabase
        .from('works')
        .select('title, price')
        .eq('id', work_id)
        .single()
      if (work) items.push({ title: work.title, price: work.price })
    }
  } catch (e) {
    console.error('failed to load items for email:', e)
  }

  // 製造発注がある場合は通知をキューに追加
  if (order_id) {
    const { data: order } = await supabase
      .from('manufacturing_orders')
      .select('partner_id')
      .eq('id', order_id)
      .single();

    if (order?.partner_id) {
      // 通知をキューに追加（別ワーカーが処理）
      await supabase
        .from('partner_notifications')
        .insert({
          partner_id: order.partner_id,
          notification_type: 'payment_received',
          payload: {
            order_id,
            order_number: data?.order_number,
            amount: paymentIntent.amount / 100,
            currency: paymentIntent.currency,
          },
          status: 'pending',
          priority: 'high',
          created_at: new Date().toISOString(),
        });
    }
  }

  // 支払い手順（可能なら保存）
  try {
    const instructions: Record<string, any> = {}
    // 支払い方式（保存用）
    const pmType = Array.isArray(paymentIntent.payment_method_types) && paymentIntent.payment_method_types.length > 0
      ? paymentIntent.payment_method_types[0]
      : undefined
    // Konbini voucher info
    // @ts-ignore: Stripe types on deno
    const konbiniNext = (paymentIntent as any)?.next_action?.konbini_display_details
    if (konbiniNext) {
      instructions.konbini = {
        confirmation_number: konbiniNext.confirmation_number,
        expires_at: konbiniNext.expires_at,
        hosted_voucher_url: konbiniNext.hosted_voucher_url,
        stores: konbiniNext.stores || undefined,
      }
    }
    // Bank transfer instructions
    // @ts-ignore
    const bankNext = (paymentIntent as any)?.next_action?.display_bank_transfer_instructions
    if (bankNext) {
      instructions.bank_transfer = {
        amount_remaining: bankNext.amount_remaining,
        currency: bankNext.currency,
        hosted_instructions_url: bankNext.hosted_instructions_url,
        financial_addresses: bankNext.financial_addresses || [],
        reference: bankNext.reference || undefined,
      }
    }
    const updates: Record<string, any> = {}
    if (pmType) updates.payment_method = pmType
    if (Object.keys(instructions).length > 0) {
      updates.payment_instructions = instructions
    }
    if (Object.keys(updates).length > 0) {
      await supabase
        .from('purchases')
        .update(updates)
        .eq('stripe_payment_intent_id', paymentIntent.id)
    }
  } catch (e) {
    console.warn('payment_instructions save skipped:', e)
  }

  // 購入完了メール（ベストエフォート）
  try {
    if (buyerEmail) {
      const amountYen = (paymentIntent.amount_received || paymentIntent.amount || 0) / 100
      const html = renderPurchaseSuccessEmail({ amount: amountYen, items })
      await sendEmail({ to: buyerEmail, subject: 'ご購入ありがとうございます（注文確認）', html })
    }
  } catch (mailErr) {
    console.error('failed to send purchase email:', mailErr)
  }

  return { 
    success: true, 
    purchase_id: data?.purchase_id,
    order_updated: !!order_id 
  };
}

// ===== 決済失敗処理（RPC使用） =====
async function handlePaymentIntentFailed(
  supabase: any,
  paymentIntent: Stripe.PaymentIntent
): Promise<any> {
  const { user_id, work_id } = paymentIntent.metadata;
  
  if (!user_id || !work_id) {
    return { success: false, error: 'Missing metadata' };
  }

  // 在庫ロックを解放（RPC関数を使用）
  const { data, error } = await supabase.rpc('release_work_lock', {
    p_work_id: work_id,
  });

  // 失敗ログを記録
  await supabase
    .from('payment_failures')
    .insert({
      user_id,
      work_id,
      payment_intent_id: paymentIntent.id,
      error_code: paymentIntent.last_payment_error?.code,
      error_message: paymentIntent.last_payment_error?.message,
      amount: paymentIntent.amount,
      created_at: new Date().toISOString(),
    });

  // 失敗メール（ベストエフォート）
  try {
    const { data: profile } = await supabase
      .from('users')
      .select('email')
      .eq('id', user_id)
      .single()
    if (profile?.email) {
      await sendEmail({ to: profile.email, subject: 'お支払いに失敗しました', html: renderPaymentFailedEmail() })
    }
  } catch (mailErr) {
    console.error('failed to send failure email:', mailErr)
  }

  return { 
    success: true, 
    lock_released: !error,
    error_code: paymentIntent.last_payment_error?.code 
  };
}

// ===== 決済キャンセル処理（RPC使用） =====
async function handlePaymentIntentCanceled(
  supabase: any,
  paymentIntent: Stripe.PaymentIntent
): Promise<any> {
  const { user_id, work_id } = paymentIntent.metadata;
  
  if (user_id && work_id) {
    // 在庫ロックを解放（RPC関数を使用）
    const { error } = await supabase.rpc('release_work_lock', {
      p_work_id: work_id,
    });
    
    return { success: true, lock_released: !error };
  }

  return { success: true };
}

// ===== 返金処理（修正版） =====
async function handleChargeRefunded(
  supabase: any,
  charge: Stripe.Charge
): Promise<any> {
  const paymentIntentId = charge.payment_intent as string;
  
  // 購入履歴を返金済みに更新
  const { data: purchase } = await supabase
    .from('purchases')
    .update({
      status: 'refunded',
      refunded_at: new Date().toISOString(),
      refund_amount: charge.amount_refunded,
    })
    .eq('stripe_payment_intent_id', paymentIntentId)
    .select()
    .single();

  if (purchase) {
    // 在庫を復元（RPC関数使用）
    await supabase.rpc('restore_work_availability', {
      p_work_id: purchase.work_id,
      p_quantity: 1,
    });

    // 関連する製造発注をキャンセル（整合性確保）
    await supabase
      .from('manufacturing_orders')
      .update({
        status: 'cancelled',
        cancelled_at: new Date().toISOString(),
      })
      .eq('work_id', purchase.work_id)
      .in('status', ['submitted', 'accepted', 'in_production']);

    // 返金メール（ベストエフォート）
    try {
      const { data: profile } = await supabase
        .from('users')
        .select('email')
        .eq('id', purchase.user_id)
        .single()
      if (profile?.email) {
        await sendEmail({ to: profile.email, subject: '返金手続きを行いました', html: renderRefundEmail(charge.amount_refunded/100) })
      }
    } catch (mailErr) {
      console.error('failed to send refund email:', mailErr)
    }
  }

  return { success: true, purchase_refunded: !!purchase };
}
