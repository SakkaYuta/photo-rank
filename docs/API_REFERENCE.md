# API 一覧（Edge Functions）

> すべてのAPIは `Authorization: Bearer <JWT>` が必要（Webhook除く）。CORSは `ALLOWED_ORIGINS` に基づき許可。

## バトル

### POST /battle-request
- body: `{ opponent_id: string, duration: 5|30|60, title?, visibility?, requested_start_at?, description?, winner_bonus_amount? }`
- 返却: `{ battle_id, status, duration, ... }`
- 備考: 相手ユーザーの存在/適格性を検証。相手へ通知作成。

### POST /list-my-battle-invitations
- body: `{}`
- 返却: `{ items: Battle[], participants: Record<id, {display_name, avatar_url}> }`
- 備考: `created_at` を含む。挑戦者プロフィール同梱。

### POST /battle-accept
- body: `{ battle_id: string, reason?: string }`
- 返却: `{ ok: true }`
- 備考: `opponent_accepted=true`。挑戦者へ通知（accepted + scheduled）。RateLimit(10/min)。理由上限1000字。

### POST /battle-decline
- body: `{ battle_id: string, reason?: string }`
- 返却: `{ ok: true }`
- 備考: `status='cancelled'` に更新（削除ではない）。挑戦者へ通知。RateLimit(10/min)。理由上限1000字。

### POST /battle-status
- body: `{ battle_id: string }`
- 返却: `{ battle, participants?, scores, totals, recent? }`
- 備考: `visibility='private'` の場合、参加者以外は403。

## 自動関数（CRON/内部）

### POST /battle-autostart
- header: `x-cron-key: $CRON_SECRET`
- 動作: 予約到来かつ `opponent_accepted=true` の `scheduled` を `live` に遷移。両者へ開始通知。RateLimit(5/min)。

### POST /battle-autofinish
- header: `x-cron-key: $CRON_SECRET`
- 動作: 持ち時間終了で自動集計→`finished`。同点は最大2回延長、最終同点は挑戦者勝利。RateLimit(5/min)。

## 応援（チア）

### POST /cheer-ticket-purchase（無料専用）
- body: `{ battle_id: string, creator_id: string, options?: { mode: 'free' } }`
- 返却: `{ ticket_id, amount, purchased_at }`
- 備考: `mode!=='free'` は 410。`creator_id` 参加者検証必須。上限は RPC `use_free_cheer` で管理。

### POST /create-cheer-ticket-intent
- body: `{ battle_id: string, creator_id: string }`
- 返却: `{ clientSecret }`
- 備考: CORS/RateLimit(5/min)。フロントでElementsにより確定。

### POST /create-cheer-points-intent
- body: `{ battle_id: string, creator_id: string, points: 100|1000|10000|100000 }`
- 返却: `{ clientSecret }`
- 備考: CORS/RateLimit(5/min)。決済成功時は `stripe-webhook` で `cheer_tickets` 加算。

### POST /purchase-cheer-points（廃止）
- 返却: `410 Gone`

## 決済/Webhook

### POST /stripe-webhook
- header: `stripe-signature`
- 動作: 署名検証→イベントupsert（冪等）。
- 取り扱い:
  - `payment_intent.succeeded`
    - `metadata.type==='live_offer'` → `finalize_live_offer_transaction` RPC
    - `metadata.type==='cheer_points'` → `cheer_tickets` にポイント付与
  - `payment_intent.payment_failed/canceled/processing` → `purchases.payment_status` を更新（該当時）

## 共通事項

- Origin制限: `ALLOWED_ORIGINS`（カンマ区切り）。一致しないOriginは403。
- RateLimit: `check_rate_limit` RPCでユーザーごとに制限（例: 5/分）。
- エラー: 原則鈍化（`error: 'rate_limited' / 'failed to create intent'` など）。詳細はサーバーログ。

