# 実装ガイド v3.1 - アプリケーション層の変更（差分導入）

本ガイドは v3.1 要件のアプリケーション実装に向けた実行手順とスキャフォールドを提供します。既存実装と競合しないように「差分テーブル/関数（_v31）」で導入します。

## Phase 1: データベース基盤（即実行）

1. マイグレーション実行（Supabase CLI）

```bash
# バックアップ作成（任意）
supabase db dump -f backup_before_v31.sql

# マイグレーション適用（本リポジトリの差分SQL）
supabase db push < db/migrations/v3_1_differential.sql

# 確認
supabase db query "SELECT * FROM schema_migrations WHERE version = 'v3.1_differential_update'"
```

2. 既存データの整合性確認（参考クエリ）

```sql
-- オーガナイザーデータの移行確認（v3.1新設）
SELECT COUNT(*) FROM public.organizers;

-- 売上データの移行確認（v3.1新設）
SELECT COUNT(*) FROM public.sales;

-- 承認状態の確認（v3.1新設）
SELECT status, COUNT(*) 
FROM public.publishing_approvals 
GROUP BY status;
```

注意: 既存スキーマ（public.payouts など）は破壊せず、v3.1 では `payouts_v31` と集計関数 `generate_monthly_payouts_v31()` を追加しています。完全移行時に置換/統合してください。

## Phase 2: Edge Functions 実装（2日間）

1) 透かし処理 Function（雛形）

- パス: `supabase/functions/add-watermark/index.ts`
- 受け取り: `multipart/form-data`（file: image）
- 出力: Storage への保存パス

2) 製造API連携 Function（雛形）

- パス: `supabase/functions/manufacturing-order/index.ts`
- 連携先: SUZURI / pixivFACTORY（APIキーは Env で設定）
- ログ: `public.manufacturing_orders`（v3.1 で新設）

3) 振込バッチ Function（雛形）

- パス: `supabase/functions/process-payouts/index.ts`
- 対象: `public.payouts_v31` の当日 `scheduled_date` かつ `pending`

## Phase 3: フロントエンド実装（5日間）

1) オーガナイザー承認ダッシュボード（雛形）

- パス: `src/pages/organizer/ApprovalDashboard.tsx`
- 依存: RPC `approve_publishing`（v3.1 で新設）

2) 売上管理画面（雛形）

- パス: `src/pages/organizer/RevenueManagement.tsx`
- 参照: `public.sales`, `public.payouts_v31`

3) 透かしプレビュー（雛形）

- パス: `src/components/ProductPreview.tsx`

## Phase 4: 支払い処理の自動化（2日間）

1) 月次支払いジョブ（pg_cron）

```sql
-- Supabase で pg_cron を有効化後
SELECT cron.schedule(
  'monthly-payout-generation-v31',
  '0 0 1 * *', -- 毎月1日の0時に実行
  $$
  SELECT public.generate_monthly_payouts_v31();
  $$
);
```

2) 振込処理バッチ（Edge Function 呼び出し）

- `process-payouts` を日次/当日複数回で実行し、`scheduled_date = CURRENT_DATE` のレコードのみ処理

## メモ/補足
- 既存の `public.payouts`/`creator_organizer_contracts` に依存する箇所は残しつつ、v3.1 の `organizers`/`publishing_approvals`/`sales`/`payouts_v31` を段階導入。
- 完全移行時に名称置換（`payouts_v31` → `payouts` など）を計画。
- 画像透かしは本番では Sharp/ImageMagick 等の利用を推奨（雛形は簡易・非最適）。

