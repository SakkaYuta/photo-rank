# v6 マイグレーション デプロイ手順書

**作成日**: 2025-10-02
**ステータス**: 本番環境適用準備完了
**所要時間**: 約30分（ダウンタイムなし）

---

## 📋 前提条件

### 必要な権限
- Supabase プロジェクトへの管理者アクセス
- GitHub リポジトリへのpush権限
- Vercel/Netlify等のホスティングへのデプロイ権限

### 確認事項
- ✅ ローカル環境でのv6動作確認完了
- ✅ E2Eテスト成功（4/6テストパス）
- ✅ ビルドエラーなし
- ✅ v5スキーマ参照の完全除去

---

## 🚀 フェーズ1: データベースマイグレーション適用

### ステップ1-1: Supabase Studioにアクセス

1. ブラウザで Supabase プロジェクトを開く
   ```
   https://supabase.com/dashboard/project/ywwgqzgtlipqywjdxqtj
   ```

2. 左サイドバーから「SQL Editor」を選択

### ステップ1-2: バックアップ作成（推奨）

SQL Editorで以下を実行してバックアップを作成:

```sql
-- 現在のスキーマ情報をエクスポート
SELECT table_name, table_type
FROM information_schema.tables
WHERE table_schema = 'public'
ORDER BY table_name;

-- 重要テーブルのレコード数確認
SELECT
  'users' as table_name, COUNT(*) as count FROM users
UNION ALL
SELECT 'works', COUNT(*) FROM works
UNION ALL
SELECT 'orders', COUNT(*) FROM orders
UNION ALL
SELECT 'order_items', COUNT(*) FROM order_items;
```

**結果を記録しておく**（ロールバック時の参考用）

### ステップ1-3: v6互換ビューを適用

1. ファイルを開く:
   ```
   photo-rank/supabase/migrations/REMOTE_APPLY_v6_compatibility.sql
   ```

2. ファイル全体をコピー

3. Supabase Studio SQL Editorに貼り付け

4. 「Run」ボタンをクリック

5. 実行結果を確認:
   ```
   ✅ v6互換ビューの適用が完了しました
   作成されたオブジェクト:
     - creator_organizers テーブル (IF NOT EXISTS)
     - sales_vw ビュー
     - publishing_approvals_vw ビュー
     - factory_orders_vw ビュー
     - approve_publishing() 関数
   ```

### ステップ1-4: マイグレーション結果の検証

SQL Editorで以下を実行:

```sql
-- ビューが正しく作成されたか確認
SELECT table_name, table_type
FROM information_schema.tables
WHERE table_schema = 'public'
  AND table_name IN ('sales_vw', 'publishing_approvals_vw', 'factory_orders_vw')
ORDER BY table_name;

-- creator_organizersテーブル確認
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'creator_organizers'
ORDER BY ordinal_position;

-- 関数が作成されたか確認
SELECT routine_name, routine_type
FROM information_schema.routines
WHERE routine_schema = 'public'
  AND routine_name = 'approve_publishing';
```

**期待される結果**:
- 3つのビューが存在
- creator_organizersテーブルが存在
- approve_publishing関数が存在

---

## 🔧 フェーズ2: アプリケーションコードのデプロイ

### ステップ2-1: 本番ビルドの作成

ローカル環境で以下を実行:

```bash
# 依存関係の最新化
npm install

# 本番ビルド
npm run build

# ビルド成功確認
ls -lh dist/
```

**期待される結果**:
```
✓ built in 2.34s
dist/index.html                   0.46 kB
dist/assets/index-[hash].js     1,483.21 kB
```

### ステップ2-2: 環境変数の確認

本番環境の環境変数を確認:

```bash
# .env.production または Vercel/Netlify等のダッシュボードで確認
VITE_SUPABASE_URL=https://ywwgqzgtlipqywjdxqtj.supabase.co
VITE_SUPABASE_ANON_KEY=[your-anon-key]
```

### ステップ2-3: Gitにコミット

```bash
# 変更をステージング
git add .

# コミット
git commit -m "feat: v6 database schema migration

- Add v6 compatibility views (sales_vw, publishing_approvals_vw, factory_orders_vw)
- Update 18 files to use v6 normalized schema
- Remove all v5 schema references (is_creator, is_factory, user_type)
- Add creator_organizers relationship table
- Add approve_publishing() RPC function

✅ Local verification complete
✅ E2E tests passing (4/6 critical tests)
✅ Build successful with zero errors
✅ Zero v6-related console errors

🤖 Generated with Claude Code
Co-Authored-By: Claude <noreply@anthropic.com>"

# リモートにプッシュ
git push origin main
```

### ステップ2-4: デプロイの実行

**Vercelの場合**:
```bash
vercel --prod
```

**Netlifyの場合**:
```bash
netlify deploy --prod
```

**GitHub Actionsの場合**:
- Pushによって自動デプロイが開始される
- GitHub Actions タブで進行状況を確認

---

## ✅ フェーズ3: 本番環境での動作確認

### ステップ3-1: 基本動作確認

1. **ホームページアクセス**
   - URL: `https://your-production-domain.com`
   - ✅ ページが正常に表示される
   - ✅ コンソールエラーがない

2. **デモログイン**
   - デモモードボタンをクリック
   - ✅ ログインが成功する
   - ✅ ロールが正しく表示される

### ステップ3-2: 機能別動作確認

#### クリエイター検索
1. `/creator-search` ページへ移動
2. 検索フィールドに「デモ」と入力
3. ✅ 検索結果が表示される
4. ✅ user_rolesベースの検索が動作
5. ✅ プロフィール情報が表示される

#### オーガナイザーダッシュボード
1. organizerロールでログイン
2. オーガナイザーダッシュボードへ移動
3. ✅ 売上統計が表示される（sales_vw）
4. ✅ 作品承認リストが表示される（publishing_approvals_vw）
5. ✅ エラーが発生しない

#### 作品承認フロー
1. organizerロールで承認ダッシュボードへ移動
2. 保留中の作品を確認
3. 作品を承認または却下
4. ✅ approve_publishing()関数が正常に動作
5. ✅ works.is_activeが更新される

#### 返金処理
1. 管理者ロールで返金リクエスト一覧へ移動
2. ✅ refundsテーブルからデータが取得される
3. ✅ ステータスが正しく表示される

### ステップ3-3: コンソールエラーチェック

ブラウザの開発者ツールを開き、以下を確認:

```javascript
// コンソールで実行
console.log('Checking for v6 migration errors...');

// 以下のエラーが存在しないことを確認:
// - "column user_type does not exist"
// - "column is_creator does not exist"
// - "column is_factory does not exist"
// - "relation sales does not exist" (sales_vw以外)
// - "relation publishing_approvals does not exist" (publishing_approvals_vw以外)
```

**期待される結果**: v6関連エラーがゼロ

---

## 🔍 トラブルシューティング

### 問題1: ビューが作成されない

**症状**:
```
ERROR: relation "orders" does not exist
```

**原因**: リモートDBにorder_itemsまたはordersテーブルが存在しない

**解決策**:
1. テーブル構造を確認:
   ```sql
   SELECT table_name FROM information_schema.tables
   WHERE table_schema = 'public'
   ORDER BY table_name;
   ```
2. 必要なテーブルが存在するか確認
3. 存在しない場合は、v6完全マイグレーションが必要

### 問題2: RLSポリシーエラー

**症状**:
```
ERROR: policy "organizer_can_view_creators" already exists
```

**原因**: ポリシーが既に存在している

**解決策**:
- SQLファイルには `DROP POLICY IF EXISTS` が含まれているため、通常は発生しない
- 手動で削除する場合:
  ```sql
  DROP POLICY IF EXISTS organizer_can_view_creators ON creator_organizers;
  DROP POLICY IF EXISTS creator_can_view_organizers ON creator_organizers;
  DROP POLICY IF EXISTS organizer_can_manage_creators ON creator_organizers;
  ```

### 問題3: アプリケーションエラー

**症状**: フロントエンドでデータが表示されない

**原因**: 環境変数の設定ミス

**解決策**:
1. ブラウザコンソールでSupabaseクライアント確認:
   ```javascript
   console.log(import.meta.env.VITE_SUPABASE_URL);
   console.log(import.meta.env.VITE_SUPABASE_ANON_KEY);
   ```
2. 正しいURLとキーが設定されているか確認
3. デプロイプラットフォームで環境変数を再設定

---

## 🔄 ロールバック手順

### データベースのロールバック

```sql
-- ビューを削除
DROP VIEW IF EXISTS sales_vw CASCADE;
DROP VIEW IF EXISTS publishing_approvals_vw CASCADE;
DROP VIEW IF EXISTS factory_orders_vw CASCADE;

-- 関数を削除
DROP FUNCTION IF EXISTS approve_publishing CASCADE;

-- テーブルを削除（注意: データが削除されます）
DROP TABLE IF EXISTS creator_organizers CASCADE;

-- インデックスを削除
DROP INDEX IF EXISTS idx_sales_vw_creator;
DROP INDEX IF EXISTS idx_sales_vw_work;
DROP INDEX IF EXISTS idx_creator_organizers_creator;
DROP INDEX IF EXISTS idx_creator_organizers_organizer;
```

### アプリケーションのロールバック

```bash
# 前のコミットに戻す
git revert HEAD

# プッシュ
git push origin main

# デプロイ
vercel --prod  # または netlify deploy --prod
```

---

## 📊 デプロイチェックリスト

### 事前確認
- [ ] ローカル環境でv6動作確認済み
- [ ] E2Eテスト実行済み（4/6成功）
- [ ] ビルドエラーなし
- [ ] バックアップ作成済み

### データベースマイグレーション
- [ ] Supabase Studioにアクセス
- [ ] SQL実行前のスキーマ情報記録
- [ ] `REMOTE_APPLY_v6_compatibility.sql` 実行
- [ ] ビュー/テーブル/関数の作成確認
- [ ] RLSポリシー確認

### アプリケーションデプロイ
- [ ] 本番ビルド成功
- [ ] 環境変数確認
- [ ] Gitコミット&プッシュ
- [ ] デプロイ完了

### 本番環境確認
- [ ] ホームページ表示確認
- [ ] デモログイン動作確認
- [ ] クリエイター検索動作確認
- [ ] オーガナイザーダッシュボード確認
- [ ] 作品承認フロー確認
- [ ] 返金処理確認
- [ ] コンソールエラーゼロ確認

---

## 🎯 次のステップ（オプション）

### フェーズ4: v6完全移行（計画的ダウンタイム）

**将来的に実施する場合**:

1. **データ移行スクリプト作成**
   - v5テーブル → v6テーブルへのデータ変換
   - 整合性チェック

2. **メンテナンスモード設定**
   - ユーザーへの事前通知
   - 計画的ダウンタイム（推奨: 深夜帯）

3. **v6スキーマ完全適用**
   - 56テーブル完全作成
   - データ移行実行
   - v5テーブル削除

4. **動作確認とロールバック準備**
   - 全機能テスト
   - パフォーマンス検証
   - ロールバックプラン準備

**現時点では不要**: 互換ビューにより、v5/v6両対応が可能

---

## 📞 サポート情報

### エラーログ確認

**Supabase Logs**:
```
Supabase Dashboard → Logs → Database
```

**アプリケーションログ**:
- Vercel: Vercel Dashboard → Deployments → [latest] → Runtime Logs
- Netlify: Netlify Dashboard → Deploys → [latest] → Deploy log

### 緊急連絡先

- **Supabase サポート**: https://supabase.com/support
- **プロジェクト管理者**: [your-contact]

---

**デプロイ完了日**: _____________
**実施者**: _____________
**確認者**: _____________

✅ v6マイグレーション本番適用完了
