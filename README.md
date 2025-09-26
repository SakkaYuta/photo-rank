# PhotoRank

写真作品のデジタル販売とグッズ化を組み合わせた、ランキングイベント機能付きのマーケットプレイス。

## セットアップ

1. 依存関係をインストール

```bash
cd photo-rank
npm install
```

2. Supabase 環境変数を設定

`.env` を作成し、以下を設定（`.env.example` 参照）:

```
VITE_SUPABASE_URL=...
VITE_SUPABASE_ANON_KEY=...
# 任意（Stripe 決済UIを有効化する場合）
VITE_STRIPE_PUBLISHABLE_KEY=pk_test_xxx
# Edge Functions の許可オリジン（カンマ区切り）
ALLOWED_ORIGINS=https://example.com,https://staging.example.com
```

3. 開発サーバー起動

```bash
npm run dev
```

## 環境設定（初期値）
- ビジネス設定: `src/config/business.ts`
- 技術設定: `src/config/technical.ts`

## データベース（マイグレーション）

### v5.0 マーケットプレイス移行
製造パートナー型マーケットプレイスへの完全移行

**マイグレーションファイル:**
- `db/migrations/v5_0_marketplace.sql` - パートナー・工場・製造オーダーテーブル
- `db/migrations/v5_0_rls.sql` - RLS ポリシーと認可制御
- `db/migrations/v5_0_backfill.sql` - 二段階手数料のバックフィル
- `db/migrations/v5_0_payouts.sql` - 支払いビューと月次生成関数

**適用コマンド:**
```bash
# Supabase プロジェクトに接続
supabase link --project-ref YOUR_PROJECT_REF

# マイグレーション適用（順番重要）
supabase db push --file db/migrations/v5_0_marketplace.sql
supabase db push --file db/migrations/v5_0_rls.sql  
supabase db push --file db/migrations/v5_0_backfill.sql
supabase db push --file db/migrations/v5_0_payouts.sql
# 2025-09-18 追加: 工場ダッシュボード強化（ビュー/参照項目拡張）
supabase db push --file supabase/migrations/20250918_partner_orders_enhancements.sql
```

**反映確認:**
```sql
-- 適用済みマイグレーション確認
SELECT version FROM schema_migrations 
WHERE version IN ('v5.0_marketplace','v5.0_rls','v5.0_backfill','v5.0_payouts');

-- 手数料バックフィル確認
SELECT COUNT(*) FROM purchases WHERE platform_total_revenue IS NULL;

-- パートナーテーブル確認
SELECT COUNT(*) FROM manufacturing_partners;
SELECT COUNT(*) FROM factory_products;
```

**月次支払い生成の設定:**
```sql
-- pg_cron 拡張が利用可能な場合、月次ジョブが自動設定されます
-- 手動実行の場合:
SELECT public.generate_monthly_payouts_v50();
```

### v3.1（旧版・参考）
- v3.1 追加: `db/migrations/v3_1_differential.sql`

## 要件定義
- v5.0（最終・マーケットプレイス型）: `docs/requirements_v5.0.md`
- v3.1（旧・API依存型）: `docs/requirements_v3.1.md`

## 実装ガイド・運用文書
- v3.1 実装ガイド: `docs/implementation_guide_v3.1.md`
- **v5.0 運用手順書**: `docs/operations_manual_v5.0.md`
- **マイグレーション検証**: `db/verification_queries.sql`

## Edge Functions（骨組み）
- `supabase/functions/create-payment-intent/`
- `supabase/functions/stripe-webhook/`
- `supabase/functions/acquire-work-lock/`
- `supabase/functions/add-watermark/`
- `supabase/functions/manufacturing-order/`
- `supabase/functions/process-payouts/`

開発プロジェクトのEdge Functionsとして導入し、Stripe秘密鍵やWebhook署名検証を実装してください。

## DR/運用
- DR計画: `docs/DRP/disaster-recovery-plan.yaml`

## 技術スタック
- React 18 + TypeScript
- Tailwind CSS
- Lucide React
- Vite
- Supabase (Auth/DB/Storage)

## E2E テスト（Playwright）
- `e2e/` 配下に Playwright の包括的構成を用意（自動 dev サーバー起動・マルチブラウザ/モバイル対応）。
- 実行例: `cd e2e && npm i && npx playwright install --with-deps && npm test`（デフォルト `BASE_URL=http://localhost:3002`）。
- 代表テスト: `smoke.spec.ts`（トップ表示確認）、`guards.spec.ts`（未認証のダッシュボード遷移はトップへ）。

## ディレクトリ
ご依頼の構成に沿って `src/components`, `src/services`, `src/hooks`, `src/types`, `src/utils` を配置しています。

## 主要機能

### v5.0 マーケットプレイス機能 ✅ 実装完了
- **製造パートナーUI**: ダッシュボード、商品管理、注文管理（`PartnerDashboard`/`PartnerProducts`/`PartnerOrders`）
- **内部マッチングシステム**: 工場選択と自動アサイン（`manufacturing-order` Edge Function）
- **二段階手数料**: 原価10% + 販売30%の手数料体系
- **月次支払い自動生成**: クリエイター/オーガナイザー別支払い計算
- **RLS セキュリティ**: パートナー/クリエイター/管理者の適切な権限分離

### 基本機能（v3.1ベース）
- 公開ナビゲーションからトレンド/クリエイター検索タブは削除（内部ルートは存続）
- トレンド一覧表示（`TrendingView`）
- クリエイター検索（`CreatorSearch`）
- コレクション表示（購入履歴結合）（`Collection`）
- 作品作成フォーム刷新（`CreateWork`）
- マイ作品（`MyWorks`）
- グッズ注文モーダル／履歴（`GoodsModal`/`OrderHistory`）
- 認証（Google OAuth、`AuthModal`/`UserMenu`）

### Edge Functions（認証済み）
- `manufacturing-order`: 内部マッチングと製造オーダー生成
- `process-payouts`: 月次支払い処理（管理者限定）
- `add-watermark`: Sharp v0.32.6 による高品質透かし処理
- その他: `create-payment-intent`, `stripe-webhook`, `acquire-work-lock`

## 補足
- 実行には Supabase のテーブル/ポリシーが必要です（提供スキーマ準拠）。
- ストレージへのアップロードは省略し、URL直接入力で最小動作にしています。
- ルーティングは簡易ナビゲーション（状態）で代替しています（`react-router` 未使用）。

## 最近の更新（2025-09-18）

- ナビゲーション調整
  - 公開タブ「トレンド」「クリエイター検索」削除
  - クリエイタータブ「工場比較」「製造発注」削除

- 作品作成フォーム（CreateWork）
  - 仕様に沿った項目へ刷新（タイトル/カテゴリ/説明[Markdown]/コンテンツURL/タグ/画像[並替]/ファイル使用量/バリエーション/価格/公開設定）
  - 保存カラム: `title`, `description`, `image_url`(先頭), `price`, `is_published`
  - UIのみ: `category`, `tags`, 2枚目以降の画像, ファイル, バリエーション

- クリエイターダッシュボード修正
  - スキーマ整合: `description`, `is_published`, `purchases.purchased_at` に統一
  - エラー（列不存在/400）解消

- 工場ダッシュボード強化（FactoryDashboard）
  - 工場ID（`partner.id`）に紐づくデータを表示
  - 製品IDフィルタ（`factory_products.id`/`product_id`/`product_type`）
  - ステータスをMarkdownで一括更新（例: `ORD-001: in_production`）
  - 設備状況セクションを削除、デモモードでダミー数値を自動表示

- Stripe設定の安全化
  - `VITE_STRIPE_PUBLISHABLE_KEY` 未設定時は決済UIを自動無効化し注意文表示

- アイコン
  - `public/favicon.ico` を追加

- データベース拡張
  - `supabase/migrations/20250918_partner_orders_enhancements.sql` 追加
    - `manufacturing_orders`: `factory_product_id`, `purchase_id` 追加 + インデックス
    - `manufacturing_order_status_history` 追加
    - 統合ビュー `partner_orders_view` 追加（注文/商品/作品/クリエイター/顧客を1クエリで参照）
  - RLS 環境では、ビューの参照ポリシー（`partner_id = セッションのパートナー`）を別途追加してください
