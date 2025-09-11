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

## データベース（DDL/RLS/関数雛形）
- DDL: `db/ddl/v0_5_schema.sql`
- RLSポリシー: `db/ddl/v0_5_rls.sql`
- 関数: `db/ddl/v0_5_functions.sql`

Supabase SQLエディタや`supabase/db`に取り込んで実行してください（権限や拡張はプロジェクト設定に依存します）。

## Edge Functions（骨組み）
- `supabase/functions/create-payment-intent/`
- `supabase/functions/stripe-webhook/`
- `supabase/functions/acquire-work-lock/`

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

## 主要機能（最小実装）
- トレンド一覧表示（`TrendingView`）
- イベント一覧（`EventList`）
- クリエイター検索（`CreatorSearch`）
- コレクション表示（購入履歴結合）（`Collection`）
- 作品作成＋簡易エディタ（`CreateWork`/`PhotoEditor`）
- マイ作品（`MyWorks`）
- グッズ注文モーダル／履歴（`GoodsModal`/`OrderHistory`）
- 認証（Google OAuth、`AuthModal`/`UserMenu`）

## 補足
- 実行には Supabase のテーブル/ポリシーが必要です（提供スキーマ準拠）。
- ストレージへのアップロードは省略し、URL直接入力で最小動作にしています。
- ルーティングは簡易ナビゲーション（状態）で代替しています（`react-router` 未使用）。
