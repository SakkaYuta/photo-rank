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
- トレンド一覧表示（`TrendingView`）
- クリエイター検索（`CreatorSearch`）
- コレクション表示（購入履歴結合）（`Collection`）
- 作品作成＋簡易エディタ（`CreateWork`/`PhotoEditor`）
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
