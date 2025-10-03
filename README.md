# PhotoRank

写真作品のデジタル販売とグッズ化を組み合わせた、ランキングイベント機能付きのマーケットプレイス。

## セットアップ

1. 依存関係をインストール

```bash
cd photo-rank
npm install
```

2. Supabase/Edge Functions 環境変数を設定

`.env` を作成し、以下を設定（`.env.example` 参照）:

```
VITE_SUPABASE_URL=...
VITE_SUPABASE_ANON_KEY=...
# 任意（Stripe 決済UIを有効化する場合）
VITE_STRIPE_PUBLISHABLE_KEY=pk_test_xxx
# Edge Functions の許可オリジン（カンマ区切り）※本番必須
ALLOWED_ORIGINS=https://example.com,https://staging.example.com
# Stripe Secret/Webhook ※Edge Functions に設定
STRIPE_SECRET_KEY=sk_live_xxx
STRIPE_WEBHOOK_SECRET=whsec_xxx
# スケジューラ保護用のCRONキー ※Edge Functions に設定
CRON_SECRET=your-strong-secret
```

3. 開発サーバー起動

```bash
npm run dev
```

## 環境設定（初期値）
- ビジネス設定: `src/config/business.ts`
- 技術設定: `src/config/technical.ts`

### デモモードの完全非公開化（外部アクセス遮断）
- `VITE_ENABLE_SAMPLE` と `VITE_ENABLE_BATTLE_SAMPLE` は有効化フラグです。
- さらに `VITE_DEMO_ALLOWED_HOSTS`（カンマ区切りのホスト名）に一致する場合のみ、デモ機能が有効になります。
- 既定では `localhost,127.0.0.1,::1` のみ許可。外部ドメインではデモは常に無効です。

設定例:
```
VITE_ENABLE_SAMPLE=true
VITE_ENABLE_BATTLE_SAMPLE=false
VITE_DEMO_ALLOWED_HOSTS=localhost,127.0.0.1
```

実装は `src/utils/demo.ts` に集約されており、各ページ/サービスは `isDemoEnabled()` / `isBattleDemoEnabled()` を参照します。`localStorage` の `demoUser` などでデモを有効化する手段は無効化され、許可ホスト外からはデモ表示になりません。

## データベース（マイグレーション）

### 権威ディレクトリ（v6 系）
- Authoritative: `photo-rank/supabase/migrations`（v6 統合スキーマ）
- 適用例:
```bash
cd photo-rank
supabase link --project-ref YOUR_PROJECT_REF
supabase db push  # v6 のマイグレーションのみを適用
```

### アーカイブ（適用対象外）
- 旧 v5 系: `photo-rank/db/migrations_old/`（従来の `db/migrations` から退避済み）
- 旧ルート: `supabase/migrations_old/`（ルート直下の補助SQLは退避済み）
- これらは履歴/参考用であり、適用しないでください。

### 反映確認（例）
```sql
-- v6 テーブル群の存在確認（一例）
SELECT to_regclass('public.rate_limit_logs') AS has_rate_limit_logs,
       to_regclass('public.upload_attempts')  AS has_upload_attempts,
       to_regclass('public.users_vw')        AS has_users_vw;

-- RLS 確認（v6 レート制限テーブル）
SELECT relname, relrowsecurity
FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
WHERE n.nspname='public' AND relname IN ('rate_limit_logs','upload_attempts');
```

## 要件定義
- v5.0（最終・マーケットプレイス型）: `docs/requirements_v5.0.md`
- v3.1（旧・API依存型）: `docs/requirements_v3.1.md`

## 実装ガイド・運用文書
- v3.1 実装ガイド: `docs/implementation_guide_v3.1.md`
- **v5.0 運用手順書**: `docs/operations_manual_v5.0.md`
- **設計（バトル/チア/通知）**: `docs/ARCHITECTURE.md`
- **API一覧（Edge Functions）**: `docs/API_REFERENCE.md`
- **監査・運用ガイド**: `docs/operations/AUDIT_GUIDE.md`
- **マイグレーション検証**: `db/verification_queries.sql`

## Edge Functions（骨組み）
- `supabase/functions/create-payment-intent/`
- `supabase/functions/execute-refund/`
- `supabase/functions/stripe-webhook/`
- `supabase/functions/acquire-work-lock/`
- `supabase/functions/add-watermark/`
- `supabase/functions/manufacturing-order/`
- `supabase/functions/process-payouts/`

開発プロジェクトのEdge Functionsとして導入し、Stripe秘密鍵やWebhook署名検証を実装してください。

### バトル機能（招待/承諾/辞退/開始/終了）
- 招待一覧: `list-my-battle-invitations`（挑戦者プロフィールの同梱）
- 承諾/辞退: `battle-accept` / `battle-decline`
  - 承諾: `opponent_accepted=true` を更新、挑戦者にアプリ内通知。予約開始時刻がある場合は「予約」通知も送信。
  - 辞退: `status='cancelled'` に更新（監査性重視）、挑戦者に辞退通知。
- ステータス参照: `battle-status`（private の場合は参加者のみ許可）
- 自動開始/終了: `battle-autostart` / `battle-autofinish`
  - `POST` 限定、ヘッダ `x-cron-key: $CRON_SECRET` 必須、RateLimit (5/min)。
  - 開始は承諾済み（`opponent_accepted=true`）のみ対象。

### 応援（チア）/ポイント購入フロー
- 無料チア: `cheer-ticket-purchase`（free専用）
  - `options.mode === 'free'` のみ許可。上限はRPC `use_free_cheer` で管理。
- チアポイント（有料）: `create-cheer-points-intent` → Stripe Checkout → `stripe-webhook` で `cheer_tickets` 付与
  - 旧 `purchase-cheer-points` は廃止（410 Gone）。
  - `create-cheer-ticket-intent`（チアチケットIntent）にも CORS/RateLimit を適用。

### アプリ内通知
- `user_notifications` テーブルに通知を作成。RLSにより本人のみ参照可。
- ヘッダーのベルから未読件数/一覧をリアルタイム表示（Supabase Realtime購読）。

### execute-refund
- 役割: `refund_requests` 行に対する返金実行。StripeのPaymentIntentがある場合はStripe Refund APIを呼び出し、結果に応じて`refund_requests`/`purchases`を更新。
- 認証: Authorizationヘッダで管理者ユーザーを検証（サービスロールでの実行も許容）。
- 必要環境変数: `STRIPE_SECRET_KEY`（任意: 未設定時はオフライン返金としてDBのみ更新）

エンドポイント例:
```
POST /functions/v1/execute-refund
{ "refundRequestId": "<uuid>" }
```

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

## 最近の更新（2025-10-01）

- バトル招待
  - 招待一覧に「詳細を見る」モーダルを追加（理由入力、承諾/辞退）。
  - 承諾/辞退はアプリ内通知と連動。予約時刻の開始通知も自動化。
  - private バトルは参加者のみステータス参照可。

- チア/決済
  - チアポイントは Intent→Webhook検証に一本化（`create-cheer-points-intent`）。
  - 旧 `purchase-cheer-points` は廃止（410）。
  - `create-cheer-ticket-intent`/`create-konbini-intent`/`create-bank-transfer-intent` に CORS/RateLimit を適用。

- 自動関数保護
  - `battle-autostart`/`battle-autofinish` は `POST + x-cron-key` 必須、RateLimit (5/min)。

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

-- データベース拡張（v6 権威）
  - v6 に統合済み。`photo-rank/supabase/migrations/` 配下の関連SQLをご確認ください。
  - RLS 環境では、ビュー参照ポリシー（`partner_id = セッションのパートナー`）の適用を忘れずに。
