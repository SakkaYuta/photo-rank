# Photo-Rank Deployment Guide

## 概要
注文追跡システムとプロフィール管理機能を含む完全なMVP機能のデプロイメント手順です。

## 1. Supabase Production Deployment

### Database Schema Update
```bash
# プロダクション Supabase プロジェクトに接続
npx supabase link --project-ref your-project-id

# マイグレーションを本番に適用
npx supabase db push

# 適用されるマイグレーション:
# - 20240115_core_tables.sql (コアテーブル: users, works, purchases, favorites, cart_items)
# - 20240118_add_profile_tables.sql (プロフィール機能: user_notification_settings, user_privacy_settings, order_status_history, user_addresses)
# - 20240119_add_rls_policies.sql (セキュリティポリシー)
```

### Edge Functions Deployment
```bash
# 全てのエッジ関数をデプロイ
npx supabase functions deploy

# 主要な関数:
# - create-payment-intent (単体決済)
# - create-bulk-payment-intent (一括決済)
# - stripe-webhook (Stripe イベント処理)
# - manufacturing-order (製造注文)
# - notify-partner (パートナー通知)
```

### Storage Configuration
```bash
# ストレージバケットの設定 (RLS ポリシーで設定済み)
# - user-content bucket (ユーザーアバター用)
# - 自動フォルダ構造: avatars/{user_id}/
```

## 2. Environment Variables Update

### Production .env Variables
```bash
# Supabase
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key

# Stripe
VITE_STRIPE_PUBLISHABLE_KEY=pk_live_your-publishable-key
STRIPE_SECRET_KEY=sk_live_your-secret-key
STRIPE_WEBHOOK_SECRET=whsec_your-webhook-secret

# Google OAuth
GOOGLE_CLIENT_ID=your-google-client-id.googleusercontent.com
GOOGLE_CLIENT_SECRET=your-google-client-secret

# Analytics (Optional)
VITE_GA_MEASUREMENT_ID=G-XXXXXXXXXX
VITE_POSTHOG_KEY=phc_your-posthog-key

# Email (Optional - for notifications)
SMTP_HOST=smtp.sendgrid.net
SMTP_PORT=587
SMTP_USER=apikey
SMTP_PASS=your-sendgrid-api-key
FROM_EMAIL=noreply@your-domain.com

# App Configuration
VITE_APP_URL=https://your-app.vercel.app
VITE_ENVIRONMENT=production
```

### Supabase Function Secrets
```bash
# Edge Functions用の環境変数設定
npx supabase secrets set STRIPE_SECRET_KEY=sk_live_your-secret-key
npx supabase secrets set STRIPE_WEBHOOK_SECRET=whsec_your-webhook-secret
npx supabase secrets set GOOGLE_CLIENT_SECRET=your-google-client-secret
npx supabase secrets set SMTP_PASS=your-sendgrid-api-key
```

## 3. Vercel Deployment

### Build Configuration
```bash
# 本番ビルドの実行
npm run build

# 型チェック
npm run typecheck

# リント
npm run lint
```

### Vercel Environment Variables
```bash
# Vercel プロジェクトの環境変数設定
# Production Environment:
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key
VITE_STRIPE_PUBLISHABLE_KEY=pk_live_your-publishable-key
VITE_GA_MEASUREMENT_ID=G-XXXXXXXXXX
VITE_POSTHOG_KEY=phc_your-posthog-key
VITE_APP_URL=https://your-app.vercel.app
VITE_ENVIRONMENT=production
```

### Deploy to Vercel
```bash
# Vercel CLI でデプロイ
npx vercel --prod

# または GitHub integration で自動デプロイ
git push origin main
```

## 4. Post-Deployment Verification

### Database Tables Check
- ✅ `users` (プロフィール情報拡張)
- ✅ `works` (作品・商品情報)
- ✅ `purchases` (注文追跡情報追加)
- ✅ `user_notification_settings` (通知設定)
- ✅ `user_privacy_settings` (プライバシー設定)
- ✅ `user_addresses` (住所管理)
- ✅ `order_status_history` (注文ステータス履歴)
- ✅ `favorites` (お気に入り)
- ✅ `cart_items` (カート)

### Feature Verification
- ✅ 注文追跡システム (タイムライン表示・追跡番号)
- ✅ プロフィール管理 (基本情報・通知・プライバシー・住所)
- ✅ アバターアップロード機能
- ✅ 注文ステータス管理 (6段階ワークフロー)
- ✅ 配送業者自動検出 (ヤマト・佐川・郵便局)
- ✅ ストライプ決済統合
- ✅ RLS セキュリティポリシー

### Edge Functions Test
```bash
# 決済インテント作成テスト
curl -X POST https://your-project.supabase.co/functions/v1/create-payment-intent \
  -H "Authorization: Bearer YOUR_ANON_KEY" \
  -H "Content-Type: application/json" \
  -d '{"workId": "test-work-id", "amount": 2500}'

# 一括決済テスト
curl -X POST https://your-project.supabase.co/functions/v1/create-bulk-payment-intent \
  -H "Authorization: Bearer YOUR_ANON_KEY" \
  -H "Content-Type: application/json" \
  -d '{"items": [{"workId": "work1", "price": 2500}]}'
```

## 5. Security Configuration

### RLS Policies
- ✅ ユーザーは自分のデータのみアクセス可能
- ✅ 作品は公開設定に基づきアクセス制御
- ✅ 注文情報は購入者のみ閲覧可能
- ✅ プロフィール設定は本人のみ変更可能
- ✅ ストレージは適切なフォルダ構造でアクセス制御

### Authentication
- ✅ Google OAuth 統合
- ✅ メール/パスワード認証
- ✅ JWT ベースのセッション管理

## 6. Monitoring & Analytics

### Performance Monitoring
- PostHog 統合 (ユーザー行動分析)
- Google Analytics 4 (ページビュー・コンバージョン)
- Supabase Dashboard (データベースメトリクス)

### Error Tracking
- Supabase Logs (Edge Functions エラー)
- Vercel Analytics (フロントエンドエラー)
- Stripe Dashboard (決済エラー)

## 7. Backup & Recovery

### Database Backup
- Supabase 自動バックアップ (7日間保持)
- 手動エクスポート: `npx supabase db dump`

### Code Backup
- GitHub リポジトリ (自動バージョン管理)
- Vercel デプロイ履歴 (ロールバック可能)

## Summary

✅ **Complete MVP Features**:
- 注文追跡システム (Order tracking with timeline)
- プロフィール管理 (Profile management)
- 決済システム (Payment processing)
- セキュリティ (RLS policies)

✅ **Production Ready**:
- Database schema applied
- Edge Functions deployed
- Environment variables configured
- Security policies active

次のステップ: 本番環境での最終テストとユーザー受け入れテストを実施してください。