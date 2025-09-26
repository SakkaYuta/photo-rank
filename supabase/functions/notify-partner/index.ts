import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.0';
import * as crypto from 'https://deno.land/std@0.168.0/crypto/mod.ts';
import { corsHeaders, corsPreflightResponse } from '../_shared/cors.ts'
import { requireInternalSecret } from '../_shared/auth.ts'

interface NotifyPartnerRequest {
  partner_id: string;
  notification_type: 'order_created' | 'order_updated' | 'order_cancelled' | 'payment_received';
  payload: {
    order_id: string;
    order_number: string;
    status?: string;
    amount?: number;
    metadata?: Record<string, any>;
  };
  priority?: 'high' | 'normal' | 'low';
}

interface PartnerNotification {
  id?: string;
  partner_id: string;
  notification_type: string;
  payload: any;
  status: 'pending' | 'sent' | 'failed' | 'retry';
  attempts: number;
  next_retry_at?: string;
  sent_at?: string;
  response_code?: number;
  response_body?: string;
  error_message?: string;
}

// HMAC署名の生成
async function generateHmacSignature(
  payload: string,
  secret: string
): Promise<string> {
  const encoder = new TextEncoder();
  const keyData = encoder.encode(secret);
  const messageData = encoder.encode(payload);

  const key = await crypto.subtle.importKey(
    'raw',
    keyData,
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );

  const signature = await crypto.subtle.sign(
    'HMAC',
    key,
    messageData
  );

  return btoa(String.fromCharCode(...new Uint8Array(signature)));
}

// リトライ遅延の計算（指数バックオフ）
function calculateRetryDelay(attempt: number): number {
  const baseDelay = 1000; // 1秒
  const maxDelay = 300000; // 5分
  const delay = Math.min(baseDelay * Math.pow(2, attempt), maxDelay);
  return delay + Math.random() * 1000; // ジッターを追加
}

serve(async (req) => {
  // CORS対応
  if (req.method === 'OPTIONS') return corsPreflightResponse()
  const secretErr = requireInternalSecret(req)
  if (secretErr) return secretErr

  try {
    // 認証チェック
    const authHeader = req.headers.get('authorization');
    if (!authHeader) {
      throw new Error('Missing authorization header');
    }

    // Supabaseクライアント作成
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

    if (!supabaseUrl || !supabaseKey) {
      throw new Error('Missing environment variables');
    }

    const supabase = createClient(supabaseUrl, supabaseKey);

    // リクエストボディを取得
    const requestData: NotifyPartnerRequest = await req.json();
    const { partner_id, notification_type, payload, priority = 'normal' } = requestData;

    // 入力検証
    if (!partner_id || !notification_type || !payload) {
      throw new Error('Missing required fields');
    }

    // パートナー情報を取得
    const { data: partner, error: partnerError } = await supabase
      .from('manufacturing_partners')
      .select('id, name, webhook_url, webhook_secret, status')
      .eq('id', partner_id)
      .single();

    if (partnerError || !partner) {
      throw new Error(`Partner not found: ${partner_id}`);
    }

    if (partner.status !== 'approved') {
      throw new Error(`Partner not approved: ${partner_id}`);
    }

    if (!partner.webhook_url) {
      throw new Error(`Partner has no webhook URL configured: ${partner_id}`);
    }

    // 通知をキューに追加
    const notificationData: PartnerNotification = {
      partner_id,
      notification_type,
      payload,
      status: 'pending',
      attempts: 0,
    };

    const { data: notification, error: insertError } = await supabase
      .from('partner_notifications')
      .insert(notificationData)
      .select()
      .single();

    if (insertError) {
      throw new Error(`Failed to queue notification: ${insertError.message}`);
    }

    // 高優先度の場合は即座に送信
    if (priority === 'high') {
      await processNotification(
        supabase,
        notification,
        partner.webhook_url,
        partner.webhook_secret
      );
    } else {
      // 通常優先度の場合はキューに残して非同期処理
      console.log(`Notification queued for partner ${partner_id}: ${notification.id}`);
    }

    return new Response(
      JSON.stringify({
        success: true,
        notification_id: notification.id,
        status: notification.status,
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );

  } catch (error) {
    console.error('Error in notify-partner:', error);

    return new Response(
      JSON.stringify({
        success: false,
        error: error.message || 'Internal server error',
      }),
      {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});

// 通知の送信処理
async function processNotification(
  supabase: any,
  notification: PartnerNotification,
  webhookUrl: string,
  webhookSecret?: string
): Promise<void> {
  try {
    const timestamp = new Date().toISOString();
    const payloadString = JSON.stringify({
      id: notification.id,
      type: notification.notification_type,
      timestamp,
      data: notification.payload,
    });

    // HTTPヘッダーの準備
    const headers: HeadersInit = {
      'Content-Type': 'application/json',
      'X-Notification-Id': notification.id || '',
      'X-Notification-Type': notification.notification_type,
      'X-Timestamp': timestamp,
    };

    // HMAC署名を追加（秘密鍵が設定されている場合）
    if (webhookSecret) {
      const signature = await generateHmacSignature(payloadString, webhookSecret);
      headers['X-Signature'] = signature;
    }

    // Webhook送信
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 30000); // 30秒タイムアウト

    const response = await fetch(webhookUrl, {
      method: 'POST',
      headers,
      body: payloadString,
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    const responseText = await response.text();
    const responseCode = response.status;

    // 送信結果を記録
    const updateData: Partial<PartnerNotification> = {
      status: responseCode >= 200 && responseCode < 300 ? 'sent' : 'failed',
      attempts: (notification.attempts || 0) + 1,
      sent_at: timestamp,
      response_code: responseCode,
      response_body: responseText.substring(0, 1000), // 最初の1000文字のみ保存
    };

    // 失敗した場合はリトライをスケジュール
    if (updateData.status === 'failed' && updateData.attempts < 5) {
      const retryDelay = calculateRetryDelay(updateData.attempts);
      updateData.status = 'retry';
      updateData.next_retry_at = new Date(Date.now() + retryDelay).toISOString();
    }

    await supabase
      .from('partner_notifications')
      .update(updateData)
      .eq('id', notification.id);

    console.log(`Notification ${notification.id} processed: ${updateData.status}`);

  } catch (error) {
    console.error(`Failed to process notification ${notification.id}:`, error);

    // エラーを記録
    await supabase
      .from('partner_notifications')
      .update({
        status: 'failed',
        attempts: (notification.attempts || 0) + 1,
        error_message: error.message || 'Unknown error',
        next_retry_at: new Date(Date.now() + calculateRetryDelay((notification.attempts || 0) + 1)).toISOString(),
      })
      .eq('id', notification.id);
  }
}
