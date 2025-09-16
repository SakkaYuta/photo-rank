# PhotoRank v5.0 セキュリティ実装ガイド

## 🚨 即時実行が必要なSQLパッチ

### 実行順序（Supabase SQLエディタ）

1. **setup_owner_user_id.sql** - 製造パートナー所有者設定
2. **security_patches_critical.sql** - 高優先度セキュリティ修正
3. **security_patches_recommended.sql** - 中優先度セキュリティ修正

### 高優先度修正（CRITICAL）

#### 1. Stripe Webhook整合性問題
**問題**: stripe-webhook が purchases テーブルに書き込むカラム（currency, stripe_payment_intent_id）が存在しない

**影響**: 
- 決済処理の失敗
- データ整合性の欠損
- 重複決済の可能性

**修正**: security_patches_critical.sql で自動対応

#### 2. Webhook イベント重複処理
**問題**: webhook_events テーブルの重複防止とRLS未設定

**影響**:
- イベントの重複処理
- 機密情報漏洩のリスク
- ログ肥大化

**修正**: security_patches_critical.sql で自動対応

## 📋 Edge Functions修正

### stripe-webhook.ts の修正例

```typescript
// 修正前の問題: purchases テーブルのカラム不整合
const { error } = await supabase
  .from('purchases')
  .insert({
    work_id: workId,
    buyer_user_id: customerId,
    total_amount_cents: amountReceived,
    currency: currency, // ← このカラムが存在しなかった
    stripe_payment_intent_id: paymentIntentId, // ← このカラムが存在しなかった
    created_at: new Date().toISOString()
  });

// 修正後: security_patches_critical.sql 適用後に動作
```

### manufacturing-order.ts の権限確認強化

```typescript
// 承認済み工場の厳格チェック
const { data: partner } = await supabase
  .from('manufacturing_partners')
  .select('id, status, owner_user_id')
  .eq('id', partnerId)
  .eq('status', 'approved') // 承認済みのみ
  .eq('owner_user_id', userId) // 所有者のみ
  .single();

if (!partner) {
  return new Response('Unauthorized partner', { status: 403 });
}
```

## 🔐 ストレージセキュリティ設定

### バケット分離戦略

#### 推奨構成
```
photos-original (Private)
├── user_uuid/
│   ├── work_id/
│   │   └── original.jpg    # 非公開、署名URL必要
│
photos-watermarked (Public)
├── watermarked/
│   ├── work_id/
│   │   └── watermarked.jpg # 公開アクセス可能
```

#### Supabaseコンソールでの設定

1. **photos-original バケット**
```sql
-- 所有者のみアクセス可能
CREATE POLICY "Original photos owner only" ON storage.objects 
FOR SELECT USING (
  bucket_id = 'photos-original' AND 
  auth.uid()::text = (storage.foldername(name))[1]
);
```

2. **photos-watermarked バケット**
```sql
-- 透かし画像は公開読み取り
CREATE POLICY "Watermarked photos public" ON storage.objects 
FOR SELECT USING (
  bucket_id = 'photos-watermarked' AND 
  starts_with(name, 'watermarked/')
);
```

## 🌐 CORS・セキュリティヘッダー設定

### Vercel (vercel.json)

```json
{
  "headers": [
    {
      "source": "/(.*)",
      "headers": [
        {
          "key": "Content-Security-Policy",
          "value": "default-src 'self'; script-src 'self' 'unsafe-inline' https://js.stripe.com; style-src 'self' 'unsafe-inline'; img-src 'self' data: https:; connect-src 'self' https://api.stripe.com https://*.supabase.co; frame-src https://js.stripe.com;"
        },
        {
          "key": "X-Frame-Options",
          "value": "DENY"
        },
        {
          "key": "X-Content-Type-Options",
          "value": "nosniff"
        },
        {
          "key": "Referrer-Policy",
          "value": "strict-origin-when-cross-origin"
        },
        {
          "key": "Permissions-Policy",
          "value": "camera=(), microphone=(), geolocation=()"
        }
      ]
    }
  ]
}
```

### Supabase Edge Functions CORS

```typescript
// Edge Functions共通ヘッダー
const corsHeaders = {
  'Access-Control-Allow-Origin': process.env.FRONTEND_URL || 'http://localhost:5174',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Max-Age': '86400'
};

export default serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }
  
  // メイン処理...
  
  return new Response(JSON.stringify(result), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' }
  });
});
```

## 🔍 セキュリティ監視・運用

### 1. 日次セキュリティチェック

```sql
-- 毎日実行推奨
SELECT * FROM public.check_system_integrity();
```

### 2. 異常検知クエリ

```sql
-- 大量購入の検知（1時間に10件以上）
SELECT 
  buyer_user_id,
  COUNT(*) as purchase_count,
  SUM(total_amount_cents) as total_amount
FROM public.purchases
WHERE created_at > now() - interval '1 hour'
GROUP BY buyer_user_id
HAVING COUNT(*) > 10
ORDER BY total_amount DESC;

-- 失敗したWebhookイベント
SELECT 
  event_type,
  COUNT(*) as failure_count
FROM public.webhook_events
WHERE created_at > now() - interval '1 day'
  AND payload->>'status' = 'failed'
GROUP BY event_type;
```

### 3. 自動アラート設定

```sql
-- pg_cron での定期実行（利用可能な場合）
SELECT cron.schedule('security-check', '0 */6 * * *', 
'SELECT public.check_system_integrity()');

-- Webhookログクリーンアップ（30日経過）
SELECT cron.schedule('webhook-cleanup', '0 2 * * *', 
'DELETE FROM public.webhook_events WHERE created_at < now() - interval ''30 days''');
```

## 📊 パフォーマンス・インデックス最適化

### 重要なインデックス

```sql
-- 購入履歴の高速検索
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_purchases_buyer_created 
ON public.purchases(buyer_user_id, created_at DESC);

-- Webhook重複チェック高速化
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_webhook_events_type_created 
ON public.webhook_events(event_type, created_at DESC);

-- 製造注文の検索最適化
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_manufacturing_orders_partner_status 
ON public.manufacturing_orders(partner_id, status, created_at DESC);
```

## 🚀 本番デプロイ前チェックリスト

### データベース
- [ ] setup_owner_user_id.sql 実行完了
- [ ] security_patches_critical.sql 実行完了
- [ ] security_patches_recommended.sql 実行完了
- [ ] `SELECT * FROM public.check_system_integrity();` で全て OK

### ストレージ
- [ ] photos-original バケット非公開設定
- [ ] photos-watermarked バケット公開設定
- [ ] RLSポリシー適用確認

### Edge Functions
- [ ] レートリミット機能動作確認
- [ ] Webhook重複防止確認
- [ ] 認証・権限チェック確認

### フロントエンド
- [ ] CSPヘッダー設定
- [ ] CORS設定確認
- [ ] XSS対策確認

### 監視・運用
- [ ] セキュリティダッシュボード設定
- [ ] アラート設定
- [ ] バックアップ・復旧手順確認

## 📞 緊急時対応

### セキュリティインシデント発生時

1. **即座の対応**
```sql
-- 特定ユーザーの一時停止
UPDATE public.users SET is_active = false WHERE id = 'USER_ID';

-- 疑わしい取引の一時停止
UPDATE public.purchases SET status = 'under_review' 
WHERE id = 'TRANSACTION_ID';
```

2. **ログ確認**
```sql
-- 該当時間帯の全活動を確認
SELECT * FROM public.audit_logs 
WHERE created_at BETWEEN 'START_TIME' AND 'END_TIME'
ORDER BY created_at DESC;
```

3. **通知・報告**
- Slackアラート設定
- 管理者への自動通知
- 必要に応じて利用者への告知

---

**最終更新**: 2025-09-16  
**適用対象**: PhotoRank v5.0製造マーケットプレイス  
**次回レビュー**: セキュリティパッチ適用後1週間以内