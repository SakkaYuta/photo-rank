# Stripe Webhook v6対応ガイド

## 概要

v6スキーマ変更に伴うStripe Webhookの修正ガイドです。

## 主な変更点

### 1. テーブル構造の変更

| v5 | v6 | 備考 |
|---|---|---|
| `purchases` | `orders` + `order_items` + `payments` | 正規化により分離 |
| `users.display_name` | `user_profiles.display_name` | プロフィール情報を分離 |
| `cheer_tickets.amount` | `cheer_tickets.amount_jpy` + `points` | 金額とポイントを明示的に分離 |
| `stripe_webhook_events` | 列構造変更 | v6の新しい列構造に対応 |

### 2. stripe_webhook_events テーブル (v6)

```sql
CREATE TABLE stripe_webhook_events (
  id uuid PRIMARY KEY,
  event_type text NOT NULL,      -- v5では 'type'
  payload jsonb NOT NULL,
  received_at timestamptz DEFAULT now(),  -- v5では 'created_at'
  -- 注意: v5にあった 'processed', 'error', 'stripe_event_id', 'idempotency_key' がない
);
```

**重要な変更**:
- `type` → `event_type`
- `created_at` → `received_at`
- `processed`, `error`, `stripe_event_id`, `idempotency_key` カラムが削除
- 冪等性管理が必要な場合は、別途 `idempotency_keys` テーブルを使用

### 3. 必要な修正箇所

#### A. stripe_webhook_events への挿入

**v5コード**:
```typescript
await supabase.from('stripe_webhook_events').insert({
  id: crypto.randomUUID(),
  stripe_event_id: event.id,
  type: event.type,
  payload: event.data.object,
  processed: false,
  idempotency_key: `stripe_${event.id}`,
  created_at: new Date().toISOString(),
});
```

**v6対応コード**:
```typescript
// Step 1: 冪等性チェック（idempotency_keysテーブルを使用）
const idempotencyKey = `stripe_webhook_${event.id}`;
const { data: existingKey } = await supabase
  .from('idempotency_keys')
  .select('id')
  .eq('key', idempotencyKey)
  .single();

if (existingKey) {
  console.log(`Event ${event.id} already processed (idempotency check)`);
  return new Response(
    JSON.stringify({ received: true, message: 'Event already processed' }),
    { status: 200, headers: corsHeaders }
  );
}

// Step 2: イベント記録
await supabase.from('stripe_webhook_events').insert({
  id: crypto.randomUUID(),
  event_type: event.type,        // 'type' → 'event_type'
  payload: event.data.object,
  received_at: new Date().toISOString(),  // 'created_at' → 'received_at'
});

// Step 3: 冪等性キー登録
await supabase.from('idempotency_keys').insert({
  key: idempotencyKey,
  scope: 'stripe_webhook',
  expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(), // 7日後
});
```

#### B. 購入完了処理 (payment_intent.succeeded)

**v5コード**:
```typescript
// RPC呼び出し
const { data, error } = await supabase.rpc('complete_purchase_transaction', {
  p_payment_intent_id: paymentIntent.id,
  p_amount_jpy: paymentIntent.amount
});
```

**v6対応コード**:
```typescript
// v6では互換関数が用意されているため、そのまま使用可能
const { data, error } = await supabase.rpc('complete_purchase_transaction', {
  p_payment_intent_id: paymentIntent.id,
  p_amount_jpy: paymentIntent.amount
});

// または、直接SQLで処理
const { data: payment } = await supabase
  .from('payments')
  .update({
    state: 'captured',
    captured_at: new Date().toISOString()
  })
  .eq('stripe_payment_intent_id', paymentIntent.id)
  .select('id, order_id')
  .single();

if (payment) {
  // 注文ステータス更新
  await supabase
    .from('orders')
    .update({
      payment_state: 'captured',
      status: 'confirmed',
      updated_at: new Date().toISOString()
    })
    .eq('id', payment.order_id);

  // デジタル商品の場合、ダウンロード権限発行
  const { data: digitalItems } = await supabase
    .from('order_items')
    .select('id, product_variant_id, product_variants(kind)')
    .eq('order_id', payment.order_id);

  for (const item of digitalItems || []) {
    if (item.product_variants?.kind === 'digital') {
      await supabase.from('download_entitlements').insert({
        order_item_id: item.id,
        product_variant_id: item.product_variant_id,
        max_downloads: 3,
        expires_at: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString()
      });
    }
  }
}
```

#### C. 応援チケット作成処理

**v5コード**:
```typescript
await supabase.from('cheer_tickets').insert({
  battle_id: battleId,
  supporter_id: supporterId,
  creator_id: creatorId,
  amount: amountJpy  // v5
});
```

**v6対応コード**:
```typescript
// jpy_to_points関数を使用してポイント計算
const { data: pointsData } = await supabase
  .rpc('jpy_to_points', { amount_jpy: amountJpy });

await supabase.from('cheer_tickets').insert({
  battle_id: battleId,
  supporter_id: supporterId,
  creator_id: creatorId,
  amount_jpy: amountJpy,      // v6: 明示的に _jpy サフィックス
  points: pointsData || amountJpy  // デフォルト1:1換算
});
```

#### D. ユーザー表示名取得

**v5コード**:
```typescript
const { data: user } = await supabase
  .from('users')
  .select('display_name')
  .eq('id', userId)
  .single();
```

**v6対応コード**:
```typescript
// 方法1: 互換ビュー使用
const { data: user } = await supabase
  .from('users_vw')
  .select('display_name')
  .eq('id', userId)
  .single();

// 方法2: JOINで直接取得
const { data: user } = await supabase
  .from('users')
  .select('id, user_profiles(display_name)')
  .eq('id', userId)
  .single();

const displayName = user?.user_profiles?.display_name;
```

## 修正手順

### ステップ1: イベント記録部分の修正

1. `stripe_webhook_events` への INSERT文を修正
   - `type` → `event_type`
   - `created_at` → `received_at`
   - 不要なカラム削除: `processed`, `error`, `stripe_event_id`, `idempotency_key`

2. 冪等性チェックを `idempotency_keys` テーブル経由に変更

### ステップ2: 購入フロー修正

1. `complete_purchase_transaction` 互換関数を使用（既に用意済み）
2. または直接 `payments`, `orders`, `download_entitlements` テーブルを操作

### ステップ3: 応援チケット修正

1. `amount` → `amount_jpy` + `points` に変更
2. `jpy_to_points` 関数を使用してポイント計算

### ステップ4: ユーザー情報取得修正

1. `users_vw` 互換ビューを使用
2. または `user_profiles` テーブルとJOIN

### ステップ5: テスト

1. ローカル環境でStripe Test Modeを使用
2. 以下のイベントをテスト:
   - `payment_intent.succeeded` - 購入完了
   - `payment_intent.payment_failed` - 支払い失敗
   - `charge.refunded` - 返金
   - カスタムイベント（応援チケット等）

## テストコマンド

```bash
# Stripe CLIでローカルテスト
stripe listen --forward-to localhost:54321/functions/v1/stripe-webhook

# テストイベント送信
stripe trigger payment_intent.succeeded
```

## 注意事項

1. **冪等性**: v6では `idempotency_keys` テーブルを使用して冪等性を保証
2. **RLS**: `stripe_webhook_events`, `idempotency_keys` は service_role のみアクセス可
3. **トランザクション**: 購入完了処理は複数テーブル更新を伴うため、エラーハンドリングを適切に実装
4. **互換関数**: 段階的移行のため、互換関数 `complete_purchase_transaction` を使用可能

## 移行完了チェックリスト

- [ ] `stripe_webhook_events` の列名変更対応
- [ ] 冪等性チェックを `idempotency_keys` テーブル経由に変更
- [ ] 購入完了処理の v6 対応（`payments`, `orders`, `download_entitlements`）
- [ ] 応援チケットの `amount_jpy` + `points` 対応
- [ ] ユーザー情報取得の `user_profiles` 対応
- [ ] ローカル環境でテスト実施
- [ ] エラーハンドリング確認
- [ ] ログ出力確認
