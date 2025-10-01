# Stripe 本番環境切り替えガイド

## 概要

テスト環境から本番環境への Stripe 決済システム移行手順と検証項目。

## 1. 本番環境設定

### 1.1 Stripe API キーの取得

1. **Stripe Dashboard にアクセス**:
   - https://dashboard.stripe.com
   - 本番モードに切り替え（左上のトグル）

2. **API キーを取得**:
   - Developers > API keys
   - `Secret key` (本番用の秘密鍵) をコピー
   - `Publishable key` (本番用の公開鍵) をコピー

3. **Webhook シークレットの取得**:
   - Developers > Webhooks > Add endpoint
   - Endpoint URL: `https://nykfvvxvqpcxjjlsnnbx.supabase.co/functions/v1/stripe-webhook`
   - Events to send:
     - `payment_intent.succeeded`
     - `payment_intent.payment_failed`
     - `payment_intent.canceled`
     - `charge.refunded`
   - `Signing secret` (Webhook 署名検証用シークレット) をコピー

### 1.2 環境変数の設定

**Supabase Edge Functions**:
```bash
# Dashboard: Settings > Edge Functions > Secrets
STRIPE_SECRET_KEY=sk_live_[YOUR_LIVE_SECRET_KEY]
STRIPE_WEBHOOK_SECRET=whsec_[YOUR_WEBHOOK_SECRET]
```

**Vercel (Frontend)**:
```bash
# Dashboard: Settings > Environment Variables > Production
VITE_STRIPE_PUBLISHABLE_KEY=pk_live_[YOUR_LIVE_PUBLISHABLE_KEY]
```

### 1.3 CORS 設定

**Edge Functions の ALLOWED_ORIGINS**:
```bash
ALLOWED_ORIGINS=https://your-production-domain.com
```

## 2. Webhook 設定の検証

### 2.1 Webhook エンドポイントの確認

**必須イベント**:
- `payment_intent.succeeded` - 決済成功
- `payment_intent.payment_failed` - 決済失敗
- `payment_intent.canceled` - 決済キャンセル
- `charge.refunded` - 返金

**オプションイベント（不要なものは削除推奨）**:
- 最小限のイベントのみ購読することでパフォーマンス向上
- 不要なイベントは処理負荷とログノイズの原因

### 2.2 署名検証の確認

`stripe-webhook/index.ts` で実装済み:
```typescript
const sig = req.headers.get('stripe-signature')
const webhookSecret = Deno.env.get('STRIPE_WEBHOOK_SECRET')
const event = stripe.webhooks.constructEvent(body, sig, webhookSecret)
```

## 3. 決済フローの検証

### 3.1 テストシナリオ

**1. 通常決済（成功）**:
```bash
# 1. Intent 作成
curl -X POST https://nykfvvxvqpcxjjlsnnbx.supabase.co/functions/v1/create-payment-intent \
  -H "Authorization: Bearer USER_JWT" \
  -H "Content-Type: application/json" \
  -d '{
    "items": [{"work_id": "WORK_ID", "qty": 1}]
  }'

# 2. Frontend で Stripe Elements を使用して決済
# 3. payment_intent.succeeded webhook が呼ばれることを確認
# 4. purchases テーブルに status='confirmed' でレコードが作成されることを確認
```

**2. コンビニ決済**:
```bash
curl -X POST https://nykfvvxvqpcxjjlsnnbx.supabase.co/functions/v1/create-konbini-intent \
  -H "Authorization: Bearer USER_JWT" \
  -H "Content-Type: application/json" \
  -d '{
    "items": [{"work_id": "WORK_ID", "qty": 1}],
    "address_id": "ADDRESS_ID"
  }'
```

**3. 銀行振込**:
```bash
curl -X POST https://nykfvvxvqpcxjjlsnnbx.supabase.co/functions/v1/create-bank-transfer-intent \
  -H "Authorization: Bearer USER_JWT" \
  -H "Content-Type: application/json" \
  -d '{
    "items": [{"work_id": "WORK_ID", "qty": 1}],
    "address_id": "ADDRESS_ID"
  }'
```

**4. 決済失敗**:
- Stripe テストカード `4000 0000 0000 0002` (Decline)
- `payment_intent.payment_failed` webhook が呼ばれることを確認
- エラーメッセージが適切に表示されることを確認

**5. 決済キャンセル**:
- 決済フロー途中でユーザーがキャンセル
- `payment_intent.canceled` webhook が呼ばれることを確認
- Intent がキャンセル状態になることを確認

**6. 返金**:
```bash
curl -X POST https://nykfvvxvqpcxjjlsnnbx.supabase.co/functions/v1/execute-refund \
  -H "Authorization: Bearer ADMIN_JWT" \
  -H "Content-Type: application/json" \
  -d '{
    "refundRequestId": "REFUND_REQUEST_ID"
  }'
```
- `charge.refunded` webhook が呼ばれることを確認
- `refund_requests.status` が `completed` になることを確認
- `purchases.status` が `refunded` になることを確認

### 3.2 価格・税・通貨の検証

**確認項目**:
- ✅ 価格計算が正確（商品価格 + 配送料）
- ✅ 税率が正しい（日本: 10%）
- ✅ 通貨が JPY
- ✅ 最小金額が 50円以上
- ✅ 配送料計算が正確（工場別、地域別、分割配送対応）

**実装箇所**:
- `create-payment-intent/index.ts`
- `create-konbini-intent/index.ts`
- `create-bank-transfer-intent/index.ts`

## 4. 冪等性とメタデータの検証

### 4.1 冪等性キー

**実装確認**:
```sql
-- idempotency_keys テーブルの存在確認
SELECT * FROM idempotency_keys LIMIT 1;

-- 重複リクエスト時に同じ結果が返ることを確認
-- (同じ idempotency_key で 2回リクエスト)
```

### 4.2 Webhook イベント処理の冪等性

**stripe-webhook/index.ts で実装済み**:
```typescript
// Event ID の upsert で重複処理を防止
const { error: insertErr } = await supabase
  .from('stripe_webhook_events')
  .upsert({ event_id: event.id, event_type: event.type, processed_at: new Date().toISOString() }, { onConflict: 'event_id' })
```

**検証**:
1. 同じ webhook イベントを複数回送信
2. 処理が1回のみ実行されることを確認
3. `stripe_webhook_events` テーブルにイベント ID が記録されることを確認

### 4.3 メタデータの検証

**Payment Intent メタデータ**:
```typescript
metadata: {
  user_id: user.id,
  items: JSON.stringify(normalized),
  // その他の必要な情報
}
```

**確認項目**:
- ✅ `user_id` が正しく設定されている
- ✅ `items` が JSON 形式で保存されている
- ✅ Webhook 処理時にメタデータから必要な情報を取得できる

## 5. セキュリティチェック

### 5.1 認証・認可

**確認項目**:
- ✅ 全ての決済 API が認証必須
- ✅ ユーザーは自分の購入のみ参照可能
- ✅ 返金は管理者のみ実行可能
- ✅ Webhook は署名検証必須

### 5.2 Rate Limiting

**実装確認**:
```typescript
// create-konbini-intent/index.ts
await supabase.rpc('check_rate_limit', {
  p_user_id: user.id,
  p_action: 'create_konbini_intent',
  p_limit: 5,
  p_window_minutes: 1,
})
```

**検証**:
1. 短時間に複数回リクエスト
2. レート制限が適用されることを確認（429 エラー）

### 5.3 Origin チェック

**実装確認**:
```typescript
const allowed = (Deno.env.get('ALLOWED_ORIGINS') || '').split(',')
const origin = req.headers.get('Origin') || ''
if (allowed.length > 0 && origin && !allowed.includes(origin)) {
  return new Response('Forbidden origin', { status: 403 })
}
```

**検証**:
1. 許可されていない Origin からリクエスト
2. 403 エラーが返ることを確認

## 6. モニタリングとログ

### 6.1 Stripe Dashboard

**確認項目**:
- Payments: 決済状況の監視
- Disputes: チャージバックの監視
- Radar: 不正検知の監視

### 6.2 Supabase Logs

**Edge Functions ログ**:
```bash
# Dashboard: Edge Functions > migrate-avatars > Logs
```

**確認項目**:
- エラーログがないか
- レスポンスタイムが適切か（< 2秒）
- Webhook 処理が成功しているか

### 6.3 データベース監視

**購入データの整合性**:
```sql
-- 決済成功後に purchases レコードが作成されているか
SELECT COUNT(*) FROM purchases WHERE status = 'confirmed' AND created_at > NOW() - INTERVAL '1 day';

-- Webhook イベント処理が正常か
SELECT COUNT(*) FROM stripe_webhook_events WHERE processed_at > NOW() - INTERVAL '1 day';

-- 返金処理が正常か
SELECT COUNT(*) FROM refund_requests WHERE status = 'completed' AND updated_at > NOW() - INTERVAL '1 day';
```

## 7. トラブルシューティング

### 7.1 Webhook が届かない

**確認事項**:
1. Stripe Dashboard で Webhook URL が正しいか
2. Webhook が有効（Enabled）になっているか
3. イベントタイプが正しく設定されているか
4. Edge Function のログでエラーがないか

**解決策**:
- Stripe Dashboard > Webhooks > Events で配信履歴を確認
- 失敗したイベントを手動で再送信

### 7.2 署名検証エラー

**原因**:
- `STRIPE_WEBHOOK_SECRET` が正しくない
- Webhook エンドポイントが複数ある（古いエンドポイントが残っている）

**解決策**:
1. Stripe Dashboard で新しい Webhook を作成
2. 古い Webhook を削除
3. 新しい `STRIPE_WEBHOOK_SECRET` を設定

### 7.3 決済が pending のまま

**確認事項**:
1. Webhook が正常に処理されているか
2. `stripe_webhook_events` テーブルにイベントが記録されているか
3. Edge Function のログでエラーがないか

**解決策**:
- Webhook を手動で再送信
- 必要に応じて手動で `purchases.status` を更新

## 8. チェックリスト

### 本番切り替え前

- [ ] Stripe API キー（本番）を取得
- [ ] Webhook シークレット（本番）を取得
- [ ] Supabase に環境変数を設定
- [ ] Vercel に環境変数を設定
- [ ] ALLOWED_ORIGINS を本番ドメインに設定
- [ ] Webhook エンドポイントを本番環境に登録
- [ ] 不要なイベントを削除（最小限に）

### 本番切り替え後

- [ ] 通常決済（成功）を実行
- [ ] コンビニ決済を実行
- [ ] 銀行振込を実行
- [ ] 決済失敗をテスト
- [ ] 決済キャンセルをテスト
- [ ] 返金をテスト
- [ ] 価格・税・通貨を検証
- [ ] 配送料計算を検証
- [ ] 冪等性を検証
- [ ] メタデータを検証
- [ ] 認証・認可を検証
- [ ] Rate Limiting を検証
- [ ] Origin チェックを検証
- [ ] Stripe Dashboard でログを確認
- [ ] Supabase Logs でエラーを確認
- [ ] データベースの整合性を確認

## 9. 参考リソース

- [Stripe API ドキュメント](https://stripe.com/docs/api)
- [Stripe Webhook ガイド](https://stripe.com/docs/webhooks)
- [Stripe テストカード](https://stripe.com/docs/testing)
- [Supabase Edge Functions](https://supabase.com/docs/guides/functions)
