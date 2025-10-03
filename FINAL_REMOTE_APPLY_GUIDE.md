# 🚀 リモートDB最終適用ガイド

**作成日**: 2025-10-02
**更新日**: 2025-10-02 (エラー修正版)
**所要時間**: 2分
**リスク**: 最小（テーブル・ビュー作成のみ、データ移行なし）

---

## ✅ 確認済み: リモートDBの状態

**スキーマ**: v5（51テーブル）

**主要テーブル**: users, works, purchases, sales, organizers, organizer_profiles, factory_products, manufacturing_orders, publishing_approvals, refund_requests

---

## 🎯 実施内容

### 新規作成（データ移行なし）

**テーブル（5つ）**:
- `user_roles` - 空テーブル
- `orders` - 空テーブル
- `order_items` - 空テーブル
- `creator_organizers` - 空テーブル
- `refunds` - 空テーブル

**ビュー（6つ）** - 既存テーブルベース:
- `sales_vw` ← sales
- `publishing_approvals_vw` ← publishing_approvals
- `factory_orders_vw` ← manufacturing_orders
- `purchases_vw` ← purchases
- `works_vw` ← works
- `users_vw` ← users + user_public_profiles

**関数（1つ）**:
- `approve_publishing()` - 作品承認

---

## 🚀 適用手順（2分）

### ステップ1: Supabase Studio

```
https://supabase.com/dashboard/project/ywwgqzgtlipqywjdxqtj
```

### ステップ2: SQL Editor

左サイドバー → **SQL Editor** → **New query**

### ステップ3: 実行

**ファイル**: `photo-rank/supabase/migrations/REMOTE_APPLY_v5_to_v6_bridge_safe.sql`

1. ファイル全体をコピー
2. SQL Editorにペースト
3. **Run** クリック

**実行時間**: 約30秒

---

## 📊 実行結果

```
✅ v5 → v6 ブリッジSQL適用完了（安全版）

作成されたテーブル:
  ✅ user_roles
  ✅ orders
  ✅ order_items
  ✅ creator_organizers
  ✅ refunds

作成されたビュー:
  ✅ sales_vw
  ✅ publishing_approvals_vw
  ✅ factory_orders_vw
  ✅ purchases_vw
  ✅ works_vw
  ✅ users_vw

作成された関数:
  ✅ approve_publishing()
```

---

## ✅ 動作確認

```sql
-- ビュー動作確認
SELECT COUNT(*) FROM sales_vw;
SELECT COUNT(*) FROM publishing_approvals_vw;
SELECT COUNT(*) FROM purchases_vw;
SELECT COUNT(*) FROM works_vw;
SELECT COUNT(*) FROM users_vw;

-- サンプルデータ確認
SELECT * FROM sales_vw LIMIT 5;
SELECT * FROM users_vw LIMIT 5;
```

---

## 🎉 解決されるエラー

- ✅ `ERROR: relation "user_roles" does not exist`
- ✅ `ERROR: relation "order_items" does not exist`
- ✅ `ERROR: relation "orders" does not exist`

---

## ⚠️ 重要事項

### データ移行について

- ❌ **このSQLはデータ移行を行いません**
- ✅ 新規テーブルは空で作成されます
- ✅ 既存テーブル（purchases, sales等）はそのまま使用可能
- ✅ ビューは既存テーブルを参照

### ロールバック

```sql
DROP TABLE IF EXISTS order_items CASCADE;
DROP TABLE IF EXISTS orders CASCADE;
DROP TABLE IF EXISTS user_roles CASCADE;
DROP TABLE IF EXISTS creator_organizers CASCADE;
DROP TABLE IF EXISTS refunds CASCADE;

DROP VIEW IF EXISTS sales_vw CASCADE;
DROP VIEW IF EXISTS publishing_approvals_vw CASCADE;
DROP VIEW IF EXISTS factory_orders_vw CASCADE;
DROP VIEW IF EXISTS purchases_vw CASCADE;
DROP VIEW IF EXISTS works_vw CASCADE;
DROP VIEW IF EXISTS users_vw CASCADE;

DROP FUNCTION IF EXISTS approve_publishing CASCADE;
```

---

## 🔍 トラブルシューティング

### "relation already exists"
→ 問題なし。既に作成済み。

### "permission denied"
→ Supabase Studioで実行（自動的にpostgres権限）

---

## 📝 次のステップ

### 即座実施
1. ✅ このSQLを実行
2. ✅ 動作確認

### 後で実施
1. ⏳ セキュリティ強化SQL（`REMOTE_APPLY_security_hardening.sql`）

---

**所要時間**: 2分
**難易度**: 簡単
**リスク**: 最小
