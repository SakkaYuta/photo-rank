# セキュリティガイド

## 🔒 自動セキュリティチェック

このプロジェクトでは、コミット前に自動的にセキュリティチェックが実行されます。

### Pre-commitフックによる検知項目

#### 🔐 シークレット検知
以下のパターンが検知され、コミットがブロックされます：

- **Supabase Keys**: `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`
- **Stripe Keys**: `pk_live_*`, `sk_live_*`, `pk_test_*`, `sk_test_*`
- **Database URLs**: `DATABASE_URL`, `POSTGRES_PASSWORD`
- **JWT Secrets**: `JWT_SECRET`, `JWT_PRIVATE_KEY`
- **AWS Credentials**: `AKIA*`, `aws_access_key_id`, `aws_secret_access_key`
- **その他API Keys**: 一般的なAPIキーパターン

#### 🛡️ セキュリティ問題検知
以下の問題が警告されます：

- `eval()` の使用
- `innerHTML` での変数展開（XSSリスク）
- 直接的なAdmin API呼び出し
- ハードコードされたlocalhost URL

#### 📝 TypeScriptコンパイルチェック
TypeScriptエラーがある場合、コミットがブロックされます。

### セキュリティチェックのバイパス

緊急時や意図的な場合は以下でバイパス可能：
```bash
git commit --no-verify -m "commit message"
```

### 設定ファイル

- `.gitsecrets-patterns`: シークレット検知パターン
- `.git/hooks/pre-commit`: セキュリティチェックスクリプト

## 🔧 セキュリティベストプラクティス

### 環境変数の管理
```bash
# ❌ 危険 - ハードコード
const apiKey = "sk_live_abcd1234..."

# ✅ 安全 - 環境変数
const apiKey = process.env.STRIPE_SECRET_KEY
```

### Edge Functionsの使用
```typescript
// ❌ 危険 - クライアントサイドでAdmin API
await supabase.auth.admin.deleteUser(userId)

// ✅ 安全 - Edge Function経由
await supabase.functions.invoke('delete-account', {
  headers: { Authorization: \`Bearer \${session.access_token}\` }
})
```

### RLSポリシーの適用
```sql
-- ユーザーデータの保護
CREATE POLICY "users_own_data" ON public.favorites
  FOR ALL USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());
```

## 🔍 RLS（Row Level Security）ポリシー整合性

### 実装済みテーブルとポリシー

#### ✅ favorites（お気に入り）
- **ユーザー自身のお気に入り**: `user_id = auth.uid()`
- **作品作成者による管理**: 作品削除時の関連データ削除を許可
- **インデックス**: `user_id`, `work_id`で最適化

#### ✅ cart_items（カートアイテム）
- **ユーザー自身のカートアイテム**: `user_id = auth.uid()`
- **作品作成者による管理**: 作品削除時の関連データ削除を許可
- **インデックス**: `user_id`, `work_id`で最適化

#### ✅ purchases（購入履歴）
- **購入者による閲覧**: `user_id = auth.uid()`
- **作品作成者による販売データ確認**: 売上統計のため許可
- **サービスロール**: 管理操作用のバイパス

#### ✅ works（作品）
- **作成者による管理**: `user_id = auth.uid()`
- **公開作品の閲覧**: `is_published = true`
- **パフォーマンス最適化**: 公開作品用の部分インデックス

#### ✅ audit_logs（監査ログ）
- **サービスロールのみ**: システム監査用
- **管理者ビュー**: セキュリティサマリーとアラート

#### ✅ rate_limit_logs（レート制限ログ）
- **サービスロールのみ**: API制限管理用

### アプリケーション整合性確認済み

- ✅ **作品削除時の関連データ処理**: RLSポリシーとアプリケーションロジックが一致
- ✅ **販売統計の取得**: 作品作成者が自分の作品の売上を確認可能
- ✅ **お気に入り・カート機能**: ユーザー操作とポリシーが適切に連携

## 🚨 インシデント対応

### シークレット漏洩が発覚した場合
1. **即座にキーを無効化**
2. **新しいキーを生成・設定**
3. **Git履歴からの除去**（必要に応じて）
4. **影響範囲の調査**

### セキュリティアラート確認
```sql
-- 1時間以内の失敗が多いアクション
SELECT * FROM public.security_alerts;

-- 24時間以内の監査サマリー
SELECT * FROM public.audit_summary;
```

### 問い合わせ
セキュリティに関する問題や質問は、プロジェクト管理者まで連絡してください。