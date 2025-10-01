# Stripe本番環境 実装チェックリスト

本番環境への移行前に必要な設定と検証項目の実務チェックリスト。

## 📋 事前準備チェックリスト

### 1. Stripe Dashboard設定

**本番モードへ切り替え**:
- [ ] Stripe Dashboard (https://dashboard.stripe.com) にログイン
- [ ] 左上のトグルを「本番モード」に切り替え

**APIキーの取得**:
- [ ] Developers > API keys にアクセス
- [ ] `Secret key` (sk_live_xxx) をコピー → Supabase環境変数へ
- [ ] `Publishable key` (pk_live_xxx) をコピー → Vercel環境変数へ

**Webhook設定**:
- [ ] Developers > Webhooks > Add endpoint をクリック
- [ ] Endpoint URL: `https://nykfvvxvqpcxjjlsnnbx.supabase.co/functions/v1/stripe-webhook`
- [ ] イベント選択（**必須4イベントのみ**）:
  - `payment_intent.succeeded` ✅
  - `payment_intent.payment_failed` ✅
  - `payment_intent.canceled` ✅
  - `charge.refunded` ✅
- [ ] `Signing secret` (whsec_xxx) をコピー → Supabase環境変数へ

### 2. Supabase環境変数設定

**Edge Functions Secrets設定**:
```bash
# Supabase Dashboard: Settings > Edge Functions > Secrets
```

設定が必要な環境変数:
- [ ] `STRIPE_SECRET_KEY=sk_live_[YOUR_LIVE_SECRET_KEY]`
- [ ] `STRIPE_WEBHOOK_SECRET=whsec_[YOUR_WEBHOOK_SECRET]`
- [ ] `ALLOWED_ORIGINS=https://your-production-domain.com`
- [ ] `INTERNAL_CRON_SECRET=[RANDOM_SECRET_FOR_CRON_JOBS]`

### 3. Vercel環境変数設定

**Production環境変数**:
```bash
# Vercel Dashboard: Settings > Environment Variables > Production
```

- [ ] `VITE_STRIPE_PUBLISHABLE_KEY=pk_live_[YOUR_LIVE_PUBLISHABLE_KEY]`
- [ ] `VITE_SUPABASE_URL=https://nykfvvxvqpcxjjlsnnbx.supabase.co`
- [ ] `VITE_SUPABASE_ANON_KEY=[YOUR_ANON_KEY]`

---

## 🔍 実装状況の検証

### 決済フロー実装状況

**実装済み Edge Functions**:
- ✅ `create-payment-intent` - 通常決済（カード）
- ✅ `create-konbini-intent` - コンビニ決済
- ✅ `create-bank-transfer-intent` - 銀行振込
- ✅ `create-cheer-points-intent` - 応援ポイント購入
- ✅ `create-cheer-ticket-intent` - 応援チケット購入
- ✅ `stripe-webhook` - Webhook処理（冪等性対応済み）
- ✅ `execute-refund` - 返金処理

**セキュリティ機能**:
- ✅ Origin Allowlist (`ALLOWED_ORIGINS`)
- ✅ Rate Limiting (20/hour for payment intents)
- ✅ 認証必須 (`authenticateUser`)
- ✅ 自己購入防止 (`work.creator_id === user.id`)
- ✅ Webhook署名検証 (`stripe.webhooks.constructEvent`)

**冪等性保証**:
- ✅ Webhook events: `stripe_webhook_events` テーブルで `stripe_event_id` の upsert
- ✅ Purchase creation: `stripe_payment_intent_id` で重複チェック

---

## 🧪 テストシナリオ

### 1. 通常決済（カード）

**テスト手順**:
```bash
# 1. Payment Intent作成
curl -X POST https://nykfvvxvqpcxjjlsnnbx.supabase.co/functions/v1/create-payment-intent \
  -H "Authorization: Bearer USER_JWT" \
  -H "Content-Type: application/json" \
  -d '{"workId": "WORK_ID", "addressId": "ADDRESS_ID"}'

# 2. フロントエンドでStripe Elementsを使用して決済完了
# 3. Webhook確認
```

**検証項目**:
- [ ] `payment_intent.succeeded` webhook が呼ばれる
- [ ] `purchases` テーブルに `status='confirmed'` でレコード作成
- [ ] 購入確認メールが送信される
- [ ] `stripe_webhook_events` に処理履歴が記録される

### 2. コンビニ決済

**テスト手順**:
```bash
curl -X POST https://nykfvvxvqpcxjjlsnnbx.supabase.co/functions/v1/create-konbini-intent \
  -H "Authorization: Bearer USER_JWT" \
  -H "Content-Type: application/json" \
  -d '{"workId": "WORK_ID", "addressId": "ADDRESS_ID"}'
```

**検証項目**:
- [ ] `confirmation_number` が返却される
- [ ] `hosted_voucher_url` でバウチャー表示可能
- [ ] コンビニで支払い後に `payment_intent.succeeded` webhook

### 3. 銀行振込

**テスト手順**:
```bash
curl -X POST https://nykfvvxvqpcxjjlsnnbx.supabase.co/functions/v1/create-bank-transfer-intent \
  -H "Authorization: Bearer USER_JWT" \
  -H "Content-Type: application/json" \
  -d '{"workId": "WORK_ID", "addressId": "ADDRESS_ID"}'
```

**検証項目**:
- [ ] 振込先情報（口座番号、参照番号）が返却される
- [ ] 入金後に `payment_intent.succeeded` webhook

### 4. 決済失敗

**テスト手順**:
- Stripe テストカード `4000 0000 0000 0002` (Decline) を使用

**検証項目**:
- [ ] `payment_intent.payment_failed` webhook が呼ばれる
- [ ] エラーメッセージが適切に表示される
- [ ] 在庫ロックが解放される（`release_work_lock` RPC実行）
- [ ] `payment_failures` テーブルに記録される

### 5. 決済キャンセル

**テスト手順**:
- 決済フロー途中でユーザーがキャンセル

**検証項目**:
- [ ] `payment_intent.canceled` webhook が呼ばれる
- [ ] Intent がキャンセル状態になる
- [ ] 在庫ロックが解放される

### 6. 返金

**テスト手順**:
```bash
curl -X POST https://nykfvvxvqpcxjjlsnnbx.supabase.co/functions/v1/execute-refund \
  -H "Authorization: Bearer ADMIN_JWT" \
  -H "Content-Type: application/json" \
  -d '{"refundRequestId": "REFUND_REQUEST_ID"}'
```

**検証項目**:
- [ ] `charge.refunded` webhook が呼ばれる
- [ ] `purchases.status` が `refunded` になる
- [ ] 在庫が復元される（`restore_work_availability` RPC実行）
- [ ] 返金メールが送信される

---

## 🔒 セキュリティ検証

### 認証・認可

**チェック項目**:
- [ ] 全ての決済 API が認証必須（`authenticateUser`）
- [ ] ユーザーは自分の購入のみ参照可能
- [ ] 返金は管理者のみ実行可能（admin role check）
- [ ] Webhook は署名検証必須

**テスト方法**:
```bash
# 認証なしでリクエスト → 401 Unauthorized
curl -X POST https://nykfvvxvqpcxjjlsnnbx.supabase.co/functions/v1/create-payment-intent \
  -H "Content-Type: application/json" \
  -d '{"workId": "WORK_ID"}'
```

### Rate Limiting

**実装状況**:
- `create-payment-intent`: 20/hour
- `create-konbini-intent`: 5/minute
- `create-bank-transfer-intent`: 5/minute
- `create-cheer-points-intent`: 10/minute

**テスト方法**:
```bash
# 短時間に複数回リクエスト → 429 Too Many Requests
for i in {1..10}; do
  curl -X POST https://nykfvvxvqpcxjjlsnnbx.supabase.co/functions/v1/create-konbini-intent \
    -H "Authorization: Bearer USER_JWT" \
    -H "Content-Type: application/json" \
    -d '{"workId": "WORK_ID", "addressId": "ADDRESS_ID"}'
done
```

**検証項目**:
- [ ] レート制限が適用される
- [ ] 429 エラーが返却される
- [ ] エラーメッセージに残り時間が含まれる

### Origin チェック

**実装コード** (`create-payment-intent/index.ts:17-25`):
```typescript
const allowed = (Deno.env.get('ALLOWED_ORIGINS') || '').split(',').map(s => s.trim()).filter(Boolean)
const origin = req.headers.get('Origin') || ''
if (allowed.length === 0) {
  return new Response('Forbidden origin (allowlist not configured)', { status: 403, headers: corsHeaders })
}
if (!origin || !allowed.includes(origin)) {
  return new Response('Forbidden origin', { status: 403, headers: corsHeaders })
}
```

**テスト方法**:
```bash
# 許可されていない Origin からリクエスト → 403 Forbidden
curl -X POST https://nykfvvxvqpcxjjlsnnbx.supabase.co/functions/v1/create-payment-intent \
  -H "Origin: https://malicious-site.com" \
  -H "Authorization: Bearer USER_JWT" \
  -H "Content-Type: application/json" \
  -d '{"workId": "WORK_ID"}'
```

**検証項目**:
- [ ] 許可されていない Origin は 403 エラー
- [ ] `ALLOWED_ORIGINS` が未設定の場合も 403 エラー（安全側）

---

## 📊 モニタリングとログ

### Stripe Dashboard

**確認項目**:
- [ ] Payments: 決済状況の監視
- [ ] Disputes: チャージバックの監視
- [ ] Radar: 不正検知の監視
- [ ] Webhooks > Events: 配信履歴の確認

### Supabase Logs

**Edge Functions ログ**:
```sql
-- stripe-webhook のログを確認
SELECT * FROM edge_function_logs
WHERE function_name = 'stripe-webhook'
ORDER BY created_at DESC
LIMIT 100;
```

**確認項目**:
- [ ] エラーログがないか
- [ ] レスポンスタイムが適切か（< 2秒）
- [ ] Webhook 処理が成功しているか

### データベース監視

**購入データの整合性**:
```sql
-- 決済成功後に purchases レコードが作成されているか
SELECT COUNT(*) FROM purchases
WHERE status = 'confirmed'
  AND created_at > NOW() - INTERVAL '1 day';

-- Webhook イベント処理が正常か
SELECT COUNT(*) FROM stripe_webhook_events
WHERE processed = true
  AND processed_at > NOW() - INTERVAL '1 day';

-- 返金処理が正常か
SELECT COUNT(*) FROM purchases
WHERE status = 'refunded'
  AND refunded_at > NOW() - INTERVAL '1 day';
```

---

## 🚨 トラブルシューティング

### Webhook が届かない

**確認事項**:
1. Stripe Dashboard で Webhook URL が正しいか
2. Webhook が有効（Enabled）になっているか
3. イベントタイプが正しく設定されているか（4イベントのみ）
4. Edge Function のログでエラーがないか

**解決策**:
- Stripe Dashboard > Webhooks > Events で配信履歴を確認
- 失敗したイベントを手動で再送信
- 古い Webhook エンドポイントがあれば削除

### 署名検証エラー

**原因**:
- `STRIPE_WEBHOOK_SECRET` が正しくない
- Webhook エンドポイントが複数ある（古いエンドポイントが残っている）

**解決策**:
1. Stripe Dashboard で新しい Webhook を作成
2. 古い Webhook を削除
3. 新しい `STRIPE_WEBHOOK_SECRET` を Supabase に設定
4. Edge Function を再デプロイ

### 決済が pending のまま

**確認事項**:
1. Webhook が正常に処理されているか
2. `stripe_webhook_events` テーブルにイベントが記録されているか
3. Edge Function のログでエラーがないか

**解決策**:
```sql
-- Webhook イベントの処理状況を確認
SELECT * FROM stripe_webhook_events
WHERE stripe_event_id = 'evt_xxx'
ORDER BY created_at DESC;

-- 手動で購入を確定（最終手段）
UPDATE purchases
SET status = 'confirmed', confirmed_at = NOW()
WHERE stripe_payment_intent_id = 'pi_xxx';
```

---

## ✅ 本番切り替えチェックリスト

### 事前準備
- [ ] Stripe API キー（本番）を取得
- [ ] Webhook シークレット（本番）を取得
- [ ] Supabase に環境変数を設定
- [ ] Vercel に環境変数を設定
- [ ] `ALLOWED_ORIGINS` を本番ドメインに設定
- [ ] Webhook エンドポイントを本番環境に登録
- [ ] 不要なイベントを削除（4イベントのみ）

### テスト実施
- [ ] 通常決済（成功）を実行
- [ ] コンビニ決済を実行
- [ ] 銀行振込を実行
- [ ] 決済失敗をテスト
- [ ] 決済キャンセルをテスト
- [ ] 返金をテスト

### セキュリティ検証
- [ ] 認証・認可を検証
- [ ] Rate Limiting を検証
- [ ] Origin チェックを検証
- [ ] Webhook 署名検証を確認

### モニタリング設定
- [ ] Stripe Dashboard でログを確認
- [ ] Supabase Logs でエラーを確認
- [ ] データベースの整合性を確認
- [ ] アラート設定（Slack/Email）

---

## 📝 参考リソース

- [Stripe API ドキュメント](https://stripe.com/docs/api)
- [Stripe Webhook ガイド](https://stripe.com/docs/webhooks)
- [Stripe テストカード](https://stripe.com/docs/testing)
- [Supabase Edge Functions](https://supabase.com/docs/guides/functions)
- [STRIPE_PRODUCTION_GUIDE.md](./STRIPE_PRODUCTION_GUIDE.md)

---

## 🔄 定期メンテナンス

**月次チェック**:
- [ ] Stripe Dashboard で異常な取引がないか確認
- [ ] Webhook 配信成功率を確認（95%以上を維持）
- [ ] データベースの整合性チェック（purchases vs stripe_webhook_events）

**四半期チェック**:
- [ ] Stripe API バージョンの更新確認
- [ ] セキュリティパッチの適用
- [ ] パフォーマンスメトリクスの分析
