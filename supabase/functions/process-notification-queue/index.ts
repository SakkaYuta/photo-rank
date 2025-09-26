import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.0';
import * as crypto from 'https://deno.land/std@0.168.0/crypto/mod.ts';
import { corsHeaders, corsPreflightResponse } from '../_shared/cors.ts'
import { requireInternalSecret } from '../_shared/auth.ts'

interface PartnerNotification {
  id: string;
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
  manufacturing_partners: {
    webhook_url: string;
    webhook_secret: string;
  };
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

// 通知の送信処理
async function processNotification(
  supabase: any,
  notification: PartnerNotification
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
      'X-Notification-Id': notification.id,
      'X-Notification-Type': notification.notification_type,
      'X-Timestamp': timestamp,
    };

    // HMAC署名を追加（秘密鍵が設定されている場合）
    if (notification.manufacturing_partners?.webhook_secret) {
      const signature = await generateHmacSignature(
        payloadString,
        notification.manufacturing_partners.webhook_secret
      );
      headers['X-Signature'] = signature;
    }

    // Webhook送信
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 30000); // 30秒タイムアウト

    const response = await fetch(notification.manufacturing_partners.webhook_url, {
      method: 'POST',
      headers,
      body: payloadString,
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    const responseText = await response.text();
    const responseCode = response.status;

    // 送信結果を記録
    const updateData: any = {
      status: responseCode >= 200 && responseCode < 300 ? 'sent' : 'failed',
      attempts: notification.attempts + 1,
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
        attempts: notification.attempts + 1,
        error_message: error.message || 'Unknown error',
        next_retry_at: new Date(Date.now() + calculateRetryDelay(notification.attempts + 1)).toISOString(),
      })
      .eq('id', notification.id);
  }
}

serve(async (req) => {
  // CORS対応
  if (req.method === 'OPTIONS') return corsPreflightResponse()
  // 内部シークレットチェック（設定時のみ有効）
  const secretError = requireInternalSecret(req)
  if (secretError) return secretError

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

    if (!supabaseUrl || !supabaseKey) {
      throw new Error('Missing environment variables');
    }

    const supabase = createClient(supabaseUrl, supabaseKey);

    // リトライ対象の通知を取得
    const currentTime = new Date().toISOString();

    const { data: notifications, error } = await supabase
      .from('partner_notifications')
      .select(`
        *,
        manufacturing_partners(webhook_url, webhook_secret, status)
      `)
      .in('status', ['pending', 'retry'])
      .or(`next_retry_at.is.null,next_retry_at.lte.${currentTime}`)
      .eq('manufacturing_partners.status', 'approved') // 承認済みパートナーのみ
      .not('manufacturing_partners.webhook_url', 'is', null) // Webhook URLが設定済みのみ
      .order('created_at', { ascending: true })
      .limit(20); // 一度に最大20件処理

    if (error) {
      throw error;
    }

    let processedCount = 0;
    let successCount = 0;
    let failedCount = 0;

    if (notifications && notifications.length > 0) {
      console.log(`Processing ${notifications.length} notifications`);

      // 通知を並列処理
      const promises = notifications.map(async (notification) => {
        try {
          await processNotification(supabase, notification);
          successCount++;
        } catch (error) {
          console.error(`Failed to process notification ${notification.id}:`, error);
          failedCount++;
        }
        processedCount++;
      });

      await Promise.all(promises);
    }

    // 統計情報を取得（直近24時間）
    const { data: stats } = await supabase
      .from('partner_notifications')
      .select('status')
      .gte('created_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString());

    const notificationStats = {
      total_24h: stats?.length || 0,
      sent_24h: stats?.filter(s => s.status === 'sent').length || 0,
      failed_24h: stats?.filter(s => s.status === 'failed').length || 0,
      pending_24h: stats?.filter(s => s.status === 'pending').length || 0,
      retry_24h: stats?.filter(s => s.status === 'retry').length || 0,
    };

    return new Response(
      JSON.stringify({
        success: true,
        processed: processedCount,
        successful: successCount,
        failed: failedCount,
        queue_stats: notificationStats,
        processed_at: new Date().toISOString(),
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );

  } catch (error) {
    console.error('Error in process-notification-queue:', error);

    return new Response(
      JSON.stringify({
        success: false,
        error: error.message || 'Internal server error',
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});
