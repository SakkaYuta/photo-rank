# 🚀 リモートDB マイグレーション実行手順

**実行日時**: _____________
**実行者**: _____________

---

## ⚠️ 実行前の確認

- [ ] バックアップ取得完了
- [ ] 本手順書を最後まで読んだ
- [ ] メンテナンス通知済み（任意）
- [ ] ロールバック手順を理解済み

**所要時間**: 約10分
**ダウンタイム**: なし（既存機能は維持）

---

## 📋 ステップ1: Supabase Studioにアクセス

### 1-1. プロジェクトを開く

ブラウザで以下のURLにアクセス:
```
https://supabase.com/dashboard/project/ywwgqzgtlipqywjdxqtj
```

### 1-2. SQL Editorを開く

左サイドバーから「**SQL Editor**」をクリック

---

## 💾 ステップ2: バックアップ作成（推奨）

### 2-1. 現在のスキーマ情報を記録

SQL Editorに以下をコピー&ペースト → **Run**をクリック:

```sql
-- 現在のテーブル一覧
SELECT table_name, table_type
FROM information_schema.tables
WHERE table_schema = 'public'
ORDER BY table_name;
```

### 2-2. 重要データ件数を記録

```sql
-- 主要テーブルのレコード数確認
SELECT
  'users' as table_name, COUNT(*) as count FROM users
UNION ALL
SELECT 'works', COUNT(*) FROM works
UNION ALL
SELECT 'orders', COUNT(*) FROM orders
UNION ALL
SELECT 'order_items', COUNT(*) FROM order_items;
```

**📝 結果をメモ**: _____________

---

## 🔧 ステップ3: v6互換ビューを適用

### 3-1. SQLファイルを開く

ローカルのエディタで以下のファイルを開く:
```
photo-rank/supabase/migrations/REMOTE_APPLY_v6_compatibility.sql
```

### 3-2. SQL全体をコピー

ファイル全体（約300行）を選択してコピー

### 3-3. Supabase Studio SQL Editorに貼り付け

1. SQL Editorの入力エリアにペースト
2. **Run**ボタンをクリック
3. 実行完了を待つ（約5-10秒）

### 3-4. 実行結果を確認

成功メッセージを確認:
```
✅ v6互換ビューの適用が完了しました
作成されたオブジェクト:
  - creator_organizers テーブル (IF NOT EXISTS)
  - sales_vw ビュー
  - publishing_approvals_vw ビュー
  - factory_orders_vw ビュー
  - approve_publishing() 関数

次のステップ: アプリケーションコードをデプロイしてください
```

**✅ 確認**: [ ] 成功メッセージが表示された

---

## ✅ ステップ4: マイグレーション結果の検証

### 4-1. ビューの作成確認

SQL Editorで以下を実行:

```sql
-- ビューが正しく作成されたか確認
SELECT table_name, table_type
FROM information_schema.tables
WHERE table_schema = 'public'
  AND table_name IN ('sales_vw', 'publishing_approvals_vw', 'factory_orders_vw')
ORDER BY table_name;
```

**期待される結果**: 3行のビューが表示される
```
factory_orders_vw      | VIEW
publishing_approvals_vw| VIEW
sales_vw               | VIEW
```

**✅ 確認**: [ ] 3つのビューが存在する

### 4-2. テーブルの作成確認

```sql
-- creator_organizersテーブル確認
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'creator_organizers'
ORDER BY ordinal_position;
```

**期待される結果**: 9列のテーブル構造が表示される
```
id                  | uuid
creator_id          | uuid
organizer_id        | uuid
status              | text
creator_share_bps   | integer
organizer_share_bps | integer
platform_share_bps  | integer
created_at          | timestamp with time zone
updated_at          | timestamp with time zone
```

**✅ 確認**: [ ] creator_organizersテーブルが存在する

### 4-3. 関数の作成確認

```sql
-- 関数が作成されたか確認
SELECT routine_name, routine_type
FROM information_schema.routines
WHERE routine_schema = 'public'
  AND routine_name = 'approve_publishing';
```

**期待される結果**:
```
approve_publishing | FUNCTION
```

**✅ 確認**: [ ] approve_publishing関数が存在する

---

## 🎯 ステップ5: データ確認（オプション）

### 5-1. ビューの動作確認

```sql
-- sales_vwの動作確認（データがあれば表示される）
SELECT COUNT(*) as total_sales FROM sales_vw;

-- publishing_approvals_vwの動作確認
SELECT COUNT(*) as total_approvals FROM publishing_approvals_vw;

-- factory_orders_vwの動作確認
SELECT COUNT(*) as total_factory_orders FROM factory_orders_vw;
```

**📝 結果をメモ**: _____________

---

## 🚨 トラブルシューティング

### エラー1: "relation already exists"

**症状**:
```
ERROR: relation "creator_organizers" already exists
```

**対応**: 問題なし。`CREATE TABLE IF NOT EXISTS`により既存テーブルはスキップされます。続行してください。

### エラー2: "column does not exist"

**症状**:
```
ERROR: column "order_items.creator_id" does not exist
```

**原因**: リモートDBのスキーマがv6構造と異なる

**対応**:
1. 既存のテーブル構造を確認:
```sql
SELECT column_name FROM information_schema.columns
WHERE table_name = 'order_items';
```
2. 不足しているカラムがあればv6完全マイグレーションが必要

### エラー3: "permission denied"

**症状**:
```
ERROR: permission denied for schema public
```

**対応**:
1. Supabase Dashboardで管理者権限を確認
2. プロジェクトオーナーでログインしているか確認

---

## 📊 完了チェックリスト

### マイグレーション実行
- [ ] SQLファイル実行完了
- [ ] 成功メッセージ確認
- [ ] 3つのビュー作成確認
- [ ] creator_organizersテーブル作成確認
- [ ] approve_publishing関数作成確認
- [ ] エラーなし

### 次のステップ準備
- [ ] アプリケーションデプロイ準備完了
- [ ] 環境変数確認済み
- [ ] デプロイプラットフォーム確認済み

---

## ➡️ 次のステップ

**マイグレーション完了後**、以下のいずれかの方法でアプリケーションをデプロイ:

### オプションA: Vercel
```bash
vercel --prod
```

### オプションB: Netlify
```bash
netlify deploy --prod
```

### オプションC: 自動デプロイ
- GitHub Actionsが自動的に実行される（gitプッシュ済み）
- デプロイ状況をGitHub Actionsタブで確認

---

## 🔄 ロールバック手順（緊急時のみ）

問題が発生した場合、以下のSQLで元に戻せます:

```sql
-- ビューを削除
DROP VIEW IF EXISTS sales_vw CASCADE;
DROP VIEW IF EXISTS publishing_approvals_vw CASCADE;
DROP VIEW IF EXISTS factory_orders_vw CASCADE;

-- 関数を削除
DROP FUNCTION IF EXISTS approve_publishing CASCADE;

-- テーブルを削除（⚠️ データも削除されます）
DROP TABLE IF EXISTS creator_organizers CASCADE;
```

**⚠️ 注意**: ロールバックは既存機能に影響しません（v5スキーマは維持）

---

## 📞 サポート情報

### 問題が発生した場合

1. **エラーメッセージを確認**: SQL Editorの下部に表示される詳細を読む
2. **トラブルシューティングを確認**: 上記のエラー対応を試す
3. **ログを確認**: Supabase Dashboard → Logs → Database

### 緊急連絡先

- **Supabase サポート**: https://supabase.com/support
- **GitHub Issues**: https://github.com/SakkaYuta/photo-rank/issues

---

**実行完了日時**: _____________
**実行結果**: [ ] 成功 / [ ] 失敗
**メモ**: _____________________________________________

---

✅ **DBマイグレーション完了 → 次はアプリケーションデプロイへ進む**
