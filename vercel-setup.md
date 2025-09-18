# Vercel環境変数設定ガイド

## Vercelダッシュボードでの設定手順

1. [Vercel Dashboard](https://vercel.com/dashboard)にアクセス
2. プロジェクトを選択
3. "Settings" タブをクリック
4. 左メニューから "Environment Variables" を選択

## 必要な環境変数

以下の環境変数を設定してください：

### 必須の環境変数

```
VITE_SUPABASE_URL=https://YOUR-PROJECT.supabase.co
VITE_SUPABASE_ANON_KEY=your_supabase_anon_key_here
```

### オプション（推奨）の環境変数

```
VITE_STRIPE_PUBLISHABLE_KEY=pk_test_または_pk_live_で始まるキー
VITE_SENTRY_DSN=Sentryのエラー監視用（オプション）
VITE_ENVIRONMENT=production
```

## Supabaseの認証情報取得方法

1. [Supabase Dashboard](https://app.supabase.com)にログイン
2. プロジェクトを選択
3. 左メニューの "Settings" → "API" をクリック
4. 以下の情報をコピー：
   - **Project URL** → `VITE_SUPABASE_URL`
   - **anon public** キー → `VITE_SUPABASE_ANON_KEY`

## Vercelでの環境変数追加方法

1. "Add New" ボタンをクリック
2. 以下の形式で入力：
   - **Name**: `VITE_SUPABASE_URL`
   - **Value**: `https://your-project-id.supabase.co`
   - **Environment**: Production, Preview, Development すべてにチェック
3. "Save" をクリック

4. 同様に `VITE_SUPABASE_ANON_KEY` も追加

## 重要な注意事項

- **Secretsは使用しない**: Vercelの "Create Secret" 機能は使わず、直接値を入力してください
- **VITE_プレフィックス**: Viteアプリケーションではすべての環境変数に`VITE_`プレフィックスが必要です
- **再デプロイが必要**: 環境変数を追加・変更した後は、再デプロイが必要です

## 再デプロイ方法

1. Vercelダッシュボードのプロジェクトページへ
2. "Deployments" タブをクリック
3. 最新のデプロイメントの "..." メニューをクリック
4. "Redeploy" を選択

## トラブルシューティング

エラー: `Environment Variable "VITE_SUPABASE_URL" references Secret "supabase_url", which does not exist.`

この場合、Secretとして設定されている可能性があります。以下の手順で修正：

1. Environment Variablesページで該当の変数を削除
2. 新規に追加する際、値を直接入力（Secretを使用しない）
3. 再デプロイを実行