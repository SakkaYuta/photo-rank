## 監査・運用ガイド（バトル/チア/決済）

本ドキュメントは、重要イベントの可視化・調査・運用アラートの方針を示します。

### 監査対象イベント

- バトル関連
  - 招待（battle-request）、承諾/辞退（battle-accept/decline）、自動開始/終了（autostart/autofinish）
- 応援/決済関連
  - 無料チア（cheer-ticket-purchase / free）、チアポイントIntent作成（create-cheer-points-intent）
  - Stripe Webhook（payment_intent.succeeded / failed / canceled / processing）
- 通知
  - `user_notifications` への作成（accepted / declined / scheduled / started）

### 可視化（代表クエリ）

最終24時間のバトル状態推移:
```sql
SELECT id, status, requested_start_at, start_time, end_time, opponent_accepted, cancelled_at, cancel_reason
FROM battles
WHERE COALESCE(start_time, requested_start_at, cancelled_at) >= NOW() - INTERVAL '24 hours'
ORDER BY COALESCE(start_time, requested_start_at, cancelled_at) DESC;
```

チアポイント（有料）反映の最新100件:
```sql
SELECT battle_id, supporter_id, creator_id, amount, exclusive_options, purchased_at
FROM cheer_tickets
WHERE exclusive_options ->> 'mode' = 'paid_points'
ORDER BY purchased_at DESC
LIMIT 100;
```

Stripe Webhook の未処理/失敗イベント:
```sql
SELECT stripe_event_id, type, processed, error, created_at
FROM stripe_webhook_events
WHERE processed = FALSE OR error IS NOT NULL
ORDER BY created_at DESC
LIMIT 100;
```

### アラート設計（例）

- Webhook未処理イベントが一定数を超過（例: 10件/10分） → 通知
- 自動関数のRateLimit多発（429） → 通知（ログ集計 or 関数レスポンス集計）
- battle-autostart/autofinish の403（CRONキー不一致） → セキュリティアラート

### 運用タスク

- シークレット管理
  - `CRON_SECRET`/`STRIPE_SECRET_KEY`/`STRIPE_WEBHOOK_SECRET`/`ALLOWED_ORIGINS` をSupabaseのEdge Functions環境へ設定。定期ローテーション推奨。
- レート閾値の調整
  - `create-*-intent`: 5/分、`battle-accept/decline`: 10/分 など、トラフィックに応じて見直し
- インデックス最適化（必要時）
  - `battles(opponent_id,status,requested_start_at)`、`cheer_tickets(battle_id)`、`user_notifications(user_id,read,created_at)`

### 調査時のポイント

- 有料チアの反映不備:
  - 対象 `payment_intent` の metadata（`type='cheer_points'` 等）・amount一致・イベント重複（`stripe_webhook_events` の processed フラグ）を確認し、必要に応じて再処理。
- 予約開始の未実行:
  - `battle-autostart` のRateLimitやCRONキー、`opponent_accepted` の有無を確認。
- 招待の表示差異:
  - `list-my-battle-invitations` とバックエンド `battles` の `created_at`/`requested_start_at` 表示ポリシーを確認（`requested_start_at` 優先・未定は作成日時）。

