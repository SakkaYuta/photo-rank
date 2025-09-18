# Vercel自動デプロイ手順

## 🚀 Vercel CLI デプロイメント

### 1. 準備：ビルド確認
```bash
# 本番ビルドテスト
npm run build

# 型チェック
npm run typecheck

# リント
npm run lint
```

### 2. Vercel CLI インストール・ログイン
```bash
# Vercel CLI インストール
npm i -g vercel

# Vercelにログイン
vercel login
```

### 3. プロジェクト設定
```bash
# プロジェクト初期化
vercel

# プロジェクト設定の確認
# ? Set up and deploy? Yes
# ? Which scope? (あなたのアカウント選択)
# ? Link to existing project? No
# ? What's your project's name? photo-rank
# ? In which directory is your code located? ./
```

### 4. 環境変数設定
```bash
# Production環境変数を設定
vercel env add VITE_SUPABASE_URL production
# 値: https://your-project.supabase.co

vercel env add VITE_SUPABASE_ANON_KEY production
# 値: your-anon-key

vercel env add VITE_STRIPE_PUBLISHABLE_KEY production
# 値: pk_live_your-publishable-key

vercel env add VITE_GA_MEASUREMENT_ID production
# 値: G-XXXXXXXXXX

vercel env add VITE_POSTHOG_KEY production
# 値: phc_your-posthog-key

vercel env add VITE_APP_URL production
# 値: https://your-app.vercel.app

vercel env add VITE_ENVIRONMENT production
# 値: production
```

### 5. デプロイ実行
```bash
# 本番デプロイ
vercel --prod

# デプロイ完了後のURL確認
# ✅ Production: https://photo-rank.vercel.app [copied to clipboard]
```

## 🔧 Vercel Dashboard 設定

### プロジェクト設定確認
1. https://vercel.com/dashboard にアクセス
2. photo-rank プロジェクトを選択
3. Settings > Environment Variables で設定確認

### ドメイン設定（オプション）
```bash
# カスタムドメイン追加
vercel domains add your-domain.com
```

### GitHub連携（推奨）
1. Settings > Git で GitHub リポジトリと連携
2. 自動デプロイ設定：main ブランチへのpushで自動デプロイ

## 📊 デプロイ後確認事項

### 1. アプリケーション動作確認
- [ ] ホームページ表示
- [ ] ユーザー認証（Google OAuth）
- [ ] 作品一覧表示
- [ ] カート・お気に入り機能
- [ ] 注文追跡ページ
- [ ] プロフィール設定ページ

### 2. Supabase連携確認
- [ ] データベース接続
- [ ] 認証システム
- [ ] Edge Functions 呼び出し
- [ ] ストレージアクセス

### 3. 決済システム確認
- [ ] Stripe決済フォーム表示
- [ ] 決済インテント作成
- [ ] Webhook受信

### 4. パフォーマンス確認
```bash
# Lighthouse監査実行
npx lighthouse https://your-app.vercel.app --view

# Core Web Vitals確認
# - LCP < 2.5秒
# - FID < 100ms
# - CLS < 0.1
```

## 🔄 継続的デプロイメント

### GitHub Actions設定（オプション）
```yaml
# .github/workflows/deploy.yml
name: Deploy to Vercel
on:
  push:
    branches: [main]
jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v2
      - name: Install Vercel CLI
        run: npm install --global vercel@latest
      - name: Pull Vercel Environment Information
        run: vercel pull --yes --environment=production --token=${{ secrets.VERCEL_TOKEN }}
      - name: Build Project Artifacts
        run: vercel build --prod --token=${{ secrets.VERCEL_TOKEN }}
      - name: Deploy Project Artifacts to Vercel
        run: vercel deploy --prebuilt --prod --token=${{ secrets.VERCEL_TOKEN }}
```

### 自動デプロイ確認
```bash
# 変更をプッシュしてデプロイテスト
git add .
git commit -m "test: vercel auto-deploy"
git push origin main

# Vercel Dashboardでデプロイステータス確認
```

## 🚨 トラブルシューティング

### ビルドエラー対応
```bash
# ローカルで本番ビルドテスト
npm run build

# TypeScriptエラー確認
npm run typecheck

# 依存関係確認
npm audit fix
```

### 環境変数エラー対応
```bash
# 環境変数一覧確認
vercel env ls

# 環境変数削除・再設定
vercel env rm VARIABLE_NAME production
vercel env add VARIABLE_NAME production
```

### パフォーマンス問題対応
- バンドルサイズ確認：`npm run build` 後のdist/フォルダサイズ
- 画像最適化：WebP形式、適切なサイズ
- コード分割：React.lazy()の活用

## ✅ デプロイ完了チェックリスト

### 基本機能
- [ ] **ホームページ**: 作品一覧表示
- [ ] **認証**: Google OAuth ログイン
- [ ] **カート**: 商品追加・削除
- [ ] **お気に入り**: 作品保存機能
- [ ] **決済**: Stripe統合決済
- [ ] **注文追跡**: タイムライン表示・追跡番号
- [ ] **プロフィール**: 設定・住所管理

### セキュリティ
- [ ] **HTTPS**: SSL証明書自動設定
- [ ] **CSP**: Content Security Policy
- [ ] **認証**: JWT ベースセッション
- [ ] **API**: CORS設定適切

### パフォーマンス
- [ ] **Speed Index** < 3秒
- [ ] **Bundle Size** < 500KB初回
- [ ] **Core Web Vitals** 緑判定
- [ ] **PWA** 対応（Service Worker）

## 📋 本番運用準備

### モニタリング設定
1. **Vercel Analytics**: 自動有効化
2. **Sentry**: エラートラッキング
3. **PostHog**: ユーザー分析
4. **Google Analytics**: コンバージョン追跡

### バックアップ・復旧
1. **Git**: ソースコード管理
2. **Vercel**: デプロイ履歴保持
3. **Supabase**: データベース自動バックアップ

---

✅ **デプロイ完了！**

Photo-Rank MVPが本番環境で稼働中：
- 🎯 注文追跡システム
- 👤 プロフィール管理
- 💳 決済システム
- 🔒 セキュリティ対応
- ⚡ パフォーマンス最適化

次のステップ: ユーザー受け入れテストとフィードバック収集