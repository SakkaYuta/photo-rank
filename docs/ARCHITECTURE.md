# システム設計（バトル/チア/通知 概要）

本ドキュメントは、バトル招待・承諾/辞退、ステータス参照、応援（無料/有料）および通知の全体設計をまとめます。

## コンポーネント

- フロントエンド（React + Supabase JS）
  - 主要ページ: `BattleInvitations.tsx`, `LiveBattle.tsx`, ヘッダー通知（`Header.tsx`）
  - 決済UI: `StripeCheckout.tsx`（Elements）

- Edge Functions（Supabase）
  - バトル: `battle-request`, `list-my-battle-invitations`, `battle-accept`, `battle-decline`, `battle-status`, `battle-autostart`, `battle-autofinish`
  - 応援: `cheer-ticket-purchase`（無料専用）、`create-cheer-ticket-intent`（チアチケットIntent）、`create-cheer-points-intent`（ポイントIntent）
  - 決済連携: `stripe-webhook`

- データベース（主要テーブル）
  - `battles`: バトル本体（`status/opponent_accepted/requested_start_at/cancelled_at/cancel_reason` など）
  - `cheer_tickets`: 応援チケット・ポイントの集計元（`amount` でポイント加算）
  - `user_notifications`: アプリ内通知

## フロー（高レベル）

### 1) 招待〜承諾/辞退
1. `battle-request` で招待作成（相手は `opponent_id`）。
2. `list-my-battle-invitations` で相手側に招待一覧を表示。
3. `battle-accept` / `battle-decline` で承諾/辞退を登録（理由任意）。
4. 両ケースで挑戦者へアプリ内通知。承諾時は予約時刻があれば「予約」通知も送信。

### 2) 自動開始/終了
- `battle-autostart`: 予約時刻に到達かつ `opponent_accepted=true` の場合に自動で `live` に遷移（通知送信）。
- `battle-autofinish`: 時間経過後に自動で勝敗判定（延長/最終引き分け規則）。
  - いずれも `POST + x-cron-key: $CRON_SECRET` 必須、RateLimit (5/min)。

### 3) 応援（無料/有料）
- 無料: `cheer-ticket-purchase`（`options.mode==='free'` のみ許可）。RPC `use_free_cheer` で上限管理。
- 有料（ポイント）: `create-cheer-points-intent` → フロントでStripe確定 → `stripe-webhook(payment_intent.succeeded)` で `cheer_tickets` へ加算。
  - 旧 `purchase-cheer-points` は廃止（410 Gone）。

## セキュリティと運用

- CORS/Origin制限: `ALLOWED_ORIGINS` を環境変数に設定。支払い系・Intent作成系・ダウンロードプロキシで適用。
- RateLimit: 代表値で 5/分（Intent作成/支払いAPI）、10/分（承諾/辞退）。
- CRON保護: 自動関数は `POST + x-cron-key=CRON_SECRET` で保護。
- Webhook署名検証: `stripe-webhook` は `STRIPE_WEBHOOK_SECRET` で検証。イベントは `stripe_webhook_events` にupsert（冪等）。

## キャッシュ/リアルタイム

- 招待一覧: `battles`（opponent_id=自分）を購読し、UIを即時更新（デバウンス）。
- ヘッダー通知: `user_notifications` を購読し、未読バッジ/一覧を即時更新。

