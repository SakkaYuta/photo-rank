# 🚀 リモートDB即座適用ガイド（v5→v6ブリッジ）

**作成日**: 2025-10-02
**所要時間**: 3分
**リスク**: 低（既存データを維持、新規テーブル・ビュー追加のみ）

---

## ✅ 確認済み: リモートDBの状態

**スキーマ**: v5（51テーブル）

**主要テーブル**:
- ✅ users, works, purchases, sales
- ✅ organizers, organizer_profiles
- ✅ factory_products, manufacturing_orders
- ✅ publishing_approvals, refund_requests

---

## 🎯 実施内容

### 新規作成されるテーブル（5つ）
1. `user_roles` - ユーザーロール管理
2. `orders` - 注文管理（v6形式）
3. `order_items` - 注文明細
4. `creator_organizers` - クリエイター・オーガナイザー関係
5. `refunds` - 返金管理

### 新規作成されるビュー（3つ）
1. `sales_vw` - 既存salesテーブルベースの売上ビュー
2. `publishing_approvals_vw` - 既存publishing_approvalsベース
3. `factory_orders_vw` - 既存manufacturing_ordersベース

### 新規作成される関数（1つ）
1. `approve_publishing()` - 作品承認関数

### データ移行
- ✅ `organizers` → `user_roles` (organizerロール付与)
- ✅ `purchases` → `orders` + `order_items` (最大1000件/実行)

---

## 🚀 適用手順（3分）

### ステップ1: Supabase Studioにアクセス

```
https://supabase.com/dashboard/project/ywwgqzgtlipqywjdxqtj
```

### ステップ2: SQL Editorを開く

左サイドバー → **SQL Editor** → **New query**

### ステップ3: ブリッジSQLを実行

**ファイル**: `photo-rank/supabase/migrations/REMOTE_APPLY_v5_to_v6_bridge.sql`

1. ファイル全体をコピー
2. SQL Editorにペースト
3. **Run** をクリック

**実行時間**: 約1-2分

---

## 📊 実行結果（期待される出力）

```
═══════════════════════════════════════════════════════════════
✅ v5 → v6 ブリッジSQL適用完了
═══════════════════════════════════════════════════════════════

作成されたテーブル:
  ✅ user_roles (X records)
  ✅ orders (X records)
  ✅ order_items (X records)
  ✅ creator_organizers
  ✅ refunds

作成されたビュー:
  ✅ sales_vw
  ✅ publishing_approvals_vw
  ✅ factory_orders_vw

作成された関数:
  ✅ approve_publishing()

動作確認:
  SELECT COUNT(*) FROM sales_vw;
  SELECT COUNT(*) FROM publishing_approvals_vw;
  SELECT COUNT(*) FROM factory_orders_vw;

既存データ移行:
  ✅ organizers → user_roles
  ✅ purchases → orders + order_items (最大1000件)

⚠️  注意: purchasesテーブルに1000件以上データがある場合、
   このSQLを複数回実行して段階的に移行してください。

═══════════════════════════════════════════════════════════════
```

---

## ✅ 動作確認

### SQL Editorで確認

```sql
-- ビューが正常に動作するか確認
SELECT COUNT(*) FROM sales_vw;
SELECT COUNT(*) FROM publishing_approvals_vw;
SELECT COUNT(*) FROM factory_orders_vw;

-- 新規テーブルのデータ確認
SELECT COUNT(*) FROM user_roles;
SELECT COUNT(*) FROM orders;
SELECT COUNT(*) FROM order_items;

-- サンプルデータ確認
SELECT * FROM sales_vw LIMIT 5;
SELECT * FROM publishing_approvals_vw LIMIT 5;
```

---

## ⚠️ 重要な注意事項

### 1. データ移行の制限

- 1回の実行で最大1000件の`purchases`を移行
- 1000件以上ある場合、このSQLを**複数回実行**してください
- 2回目以降は既に移行済みのデータをスキップします

### 2. 既存機能への影響

- ✅ 既存テーブルは**一切変更されません**
- ✅ 既存のpurchases, sales, worksテーブルはそのまま
- ✅ 既存アプリケーションは引き続き動作

### 3. ロールバック方法

万が一問題が発生した場合:

```sql
-- 新規テーブルを削除（既存データは影響なし）
DROP TABLE IF EXISTS order_items CASCADE;
DROP TABLE IF EXISTS orders CASCADE;
DROP TABLE IF EXISTS user_roles CASCADE;
DROP TABLE IF EXISTS creator_organizers CASCADE;
DROP TABLE IF EXISTS refunds CASCADE;

-- ビューを削除
DROP VIEW IF EXISTS sales_vw CASCADE;
DROP VIEW IF EXISTS publishing_approvals_vw CASCADE;
DROP VIEW IF EXISTS factory_orders_vw CASCADE;

-- 関数を削除
DROP FUNCTION IF EXISTS approve_publishing CASCADE;
```

---

## 🔍 トラブルシューティング

### エラー: "relation already exists"

**症状**: `ERROR: relation "user_roles" already exists`

**原因**: 既に作成済み

**対応**: 問題なし。`CREATE TABLE IF NOT EXISTS`で自動スキップされます。

### エラー: "duplicate key value"

**症状**: `ERROR: duplicate key value violates unique constraint`

**原因**: 既にデータ移行済み

**対応**: 問題なし。`ON CONFLICT DO NOTHING`で自動スキップされます。

### エラー: "permission denied"

**症状**: `ERROR: permission denied for table users`

**原因**: 権限不足（通常発生しない）

**対応**: Supabase Studioで実行してください（postgres権限で自動実行）

---

## 📝 購入データが1000件以上ある場合

### 確認方法

```sql
SELECT COUNT(*) FROM purchases;
```

### 1000件以上の場合

このSQLを**複数回実行**してください:

```sql
-- 1回目: 最初の1000件を移行
（REMOTE_APPLY_v5_to_v6_bridge.sqlを実行）

-- 2回目: 次の1000件を移行
（同じSQLを再実行）

-- 全件移行まで繰り返し
```

**確認方法**:
```sql
-- 未移行データの確認
SELECT COUNT(*)
FROM purchases p
WHERE NOT EXISTS (
  SELECT 1 FROM order_items oi WHERE oi.id = p.id
);
```

0件になれば完了です。

---

## 🎉 適用後の効果

### 解決されるエラー
- ✅ `ERROR: relation "user_roles" does not exist` → 解決
- ✅ `ERROR: relation "order_items" does not exist` → 解決

### 利用可能になる機能
- ✅ オーガナイザーダッシュボード（sales_vw使用）
- ✅ 作品承認フロー（publishing_approvals_vw使用）
- ✅ ファクトリーオーダー管理（factory_orders_vw使用）

### アプリケーションの動作
- ✅ ローカル開発環境と同じAPIで動作
- ✅ 既存機能の継続性を維持
- ✅ 新機能の段階的追加が可能

---

## 🚀 次のステップ

### 即座に実施
1. ✅ `REMOTE_APPLY_v5_to_v6_bridge.sql` を実行
2. ✅ 動作確認SQLを実行
3. ✅ アプリケーションで動作確認

### 後で実施（オプション）
1. ⏳ `REMOTE_APPLY_security_hardening.sql` を実行（セキュリティ強化）
2. ⏳ 購入データが1000件以上の場合、追加実行

---

**所要時間**: 3分
**難易度**: 簡単
**リスク**: 低（既存データ保護）
**即座実施推奨**: ✅ はい
