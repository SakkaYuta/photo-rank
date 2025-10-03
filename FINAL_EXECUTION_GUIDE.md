# 🎯 v6スキーマ 最終実行ガイド

**SQLファイル**: `photo-rank/supabase/migrations/REMOTE_APPLY_v6_SAFE.sql`
**ステータス**: ✅ 完全対応版（既存テーブル対応）
**作成日**: 2025-10-02

---

## ✅ 全エラー対策完了

### 1. is_activeカラム参照エラー（42703）対策
```sql
-- 既存productsテーブルに列を安全に追加
ALTER TABLE products
  ADD COLUMN IF NOT EXISTS is_active boolean DEFAULT true;

-- その後、ポリシーで参照
CREATE POLICY products_viewable_by_all ON products
  FOR SELECT USING (is_active = true);
```

### 2. is_availableカラム参照エラー対策
```sql
-- 既存product_variantsテーブルに列を安全に追加
ALTER TABLE product_variants
  ADD COLUMN IF NOT EXISTS is_available boolean DEFAULT true;
```

### 3. テーブル存在チェック対策
- sales_vw - sales + purchases 存在時のみ作成
- publishing_approvals_vw - works 存在時のみ作成
- purchases_vw - purchases 存在時のみ作成
- works_vw - works 存在時のみ作成
- users_vw - user_public_profiles なしでも動作
- refund_requests_vw - refund_requests 存在時のみ作成

### 4. 拡張機能対策
```sql
-- gen_random_uuid()用
CREATE EXTENSION IF NOT EXISTS pgcrypto;
```

---

## 🛡️ 安全性の保証

### CREATE TABLE IF NOT EXISTS + ALTER TABLE IF NOT EXISTS
```sql
-- 新規作成 OR 既存テーブルをそのまま利用
CREATE TABLE IF NOT EXISTS products (...);

-- 既存テーブルにカラムを安全に追加
ALTER TABLE products
  ADD COLUMN IF NOT EXISTS is_active boolean DEFAULT true;
```

### DROP POLICY IF EXISTS + CREATE POLICY
```sql
-- ポリシーの冪等作成
DROP POLICY IF EXISTS products_viewable_by_all ON products;
CREATE POLICY products_viewable_by_all ON products
  FOR SELECT USING (is_active = true);
```

### NOT VALID → VALIDATE（FK制約）
```sql
-- 既存データに影響を与えずFK追加
ALTER TABLE fulfillments
  ADD CONSTRAINT fulfillments_manufacturing_partner_id_fkey
  FOREIGN KEY (manufacturing_partner_id)
  REFERENCES manufacturing_partners(id)
  ON DELETE SET NULL
  NOT VALID;

-- その後検証
ALTER TABLE fulfillments
  VALIDATE CONSTRAINT fulfillments_manufacturing_partner_id_fkey;
```

---

## 📦 作成されるもの

### 必ず作成（8テーブル + 1ビュー）
1. **user_roles** - ユーザーロール
2. **products** - 商品カタログ（is_active列追加）
3. **product_variants** - SKU（is_available列追加）
4. **orders** - 注文
5. **order_items** - 注文明細
6. **fulfillments** - 製造・配送管理
7. **creator_organizers** - クリエイター・オーガナイザー関係
8. **refunds** - 返金
9. **factory_orders_vw** - v6ネイティブビュー（推奨方針B）

### 条件付き作成（v5互換ビュー）
- sales_vw（sales + purchases必要）
- publishing_approvals_vw（works必要）
- purchases_vw（purchases必要）
- works_vw（works必要）
- users_vw（users必須、user_public_profiles任意）
- refund_requests_vw（refund_requests必要）
- approve_publishing()（works必要）

---

## 🚀 実行手順（2分）

### ステップ1: Supabase Studio
```
https://supabase.com/dashboard/project/ywwgqzgtlipqywjdxqtj
```

### ステップ2: SQL Editor
左サイドバー → **SQL Editor** → **New query**

### ステップ3: SQLファイルをコピー&ペースト
`photo-rank/supabase/migrations/REMOTE_APPLY_v6_SAFE.sql` の全内容

### ステップ4: 実行
**Run** ボタンをクリック

---

## 📊 実行成功メッセージ

```
✅ v6 完全スキーマSQL適用完了（安全版）

作成されたテーブル:
  ✅ user_roles
  ✅ products
  ✅ product_variants
  ✅ orders
  ✅ order_items
  ✅ fulfillments
  ✅ creator_organizers
  ✅ refunds

作成されたビュー（環境依存）:
  ✅ factory_orders_vw (v6 fulfillments - 推奨方針B)
  ※ 以下は該当テーブルが存在する場合のみ作成:
     - sales_vw (sales + purchases必要)
     - publishing_approvals_vw (works必要)
     - purchases_vw (purchases必要)
     - works_vw (works必要)
     - users_vw (user_public_profiles任意)
     - refund_requests_vw (refund_requests必要)

動作確認:
  SELECT COUNT(*) FROM products;
  SELECT COUNT(*) FROM fulfillments;
  SELECT COUNT(*) FROM factory_orders_vw;

✅ v6完全スキーマ適用完了（安全版）！
```

---

## 🔍 動作確認クエリ

```sql
-- 拡張機能確認
SELECT * FROM pg_extension WHERE extname = 'pgcrypto';

-- テーブル確認
SELECT COUNT(*) FROM products;
SELECT COUNT(*) FROM product_variants;
SELECT COUNT(*) FROM orders;
SELECT COUNT(*) FROM fulfillments;

-- カラム存在確認
SELECT column_name, data_type, column_default
FROM information_schema.columns
WHERE table_name = 'products' AND column_name = 'is_active';

SELECT column_name, data_type, column_default
FROM information_schema.columns
WHERE table_name = 'product_variants' AND column_name = 'is_available';

-- ビュー確認
SELECT COUNT(*) FROM factory_orders_vw;

-- v5互換ビュー確認（存在する場合のみ）
SELECT COUNT(*) FROM sales_vw;  -- sales + purchases 必要
SELECT COUNT(*) FROM works_vw;  -- works 必要
SELECT COUNT(*) FROM users_vw;  -- users 必須

-- factory_orders_vw の実データ確認
SELECT
  product_name,
  product_type,
  quantity,
  customer_name,
  status
FROM factory_orders_vw
LIMIT 5;

-- ポリシー確認
SELECT
  schemaname,
  tablename,
  policyname,
  permissive,
  roles,
  cmd,
  qual
FROM pg_policies
WHERE tablename IN ('products', 'product_variants')
ORDER BY tablename, policyname;
```

---

## ⚠️ トラブルシューティング

### エラー: relation "products" already exists
→ 問題なし。既存テーブルを使用します。

### エラー: column "is_active" does not exist
→ このSQLで解決済み。`ALTER TABLE ... ADD COLUMN IF NOT EXISTS`で対応。

### エラー: permission denied for extension pgcrypto
→ Supabase Studioから実行すれば自動的にpostgres権限で実行されます。

### 警告: ⚠️ sales_vw スキップ（sales または purchases テーブルなし）
→ 正常動作。該当テーブルが存在しないため、ビューは作成されません。

---

## 🎯 このSQLの特徴

### 1. 既存テーブル対応
```sql
CREATE TABLE IF NOT EXISTS products (...);  -- 新規 OR 既存
ALTER TABLE products ADD COLUMN IF NOT EXISTS is_active boolean DEFAULT true;  -- 列追加
```

### 2. 冪等性の保証
- 何度実行しても同じ結果
- エラーなく完了
- 既存データを保護

### 3. 環境適応型
- テーブル存在チェック
- カラム存在チェック
- FK制約の安全な追加

### 4. 推奨方針B準拠
- factory_orders_vw は fulfillments ベース
- 顧客向け商品情報（products.title）
- NULL値なし、実データ導出

---

## 📝 次のアクション

### 即座実施（必須）
1. ✅ `REMOTE_APPLY_v6_SAFE.sql` を実行
2. ✅ 動作確認クエリを実行
3. ✅ エラーがないことを確認

### 短期（1-2週間）
- products, product_variants マスタ登録
- 新規注文をv6テーブルに保存開始

### 中期（1-2ヶ月）
- v5データの段階的移行
- ビューではなく直接v6テーブル参照

---

## 🔄 ロールバック（必要な場合）

```sql
-- FK制約削除
ALTER TABLE fulfillments DROP CONSTRAINT IF EXISTS fulfillments_manufacturing_partner_id_fkey;

-- テーブル削除
DROP TABLE IF EXISTS fulfillments CASCADE;
DROP TABLE IF EXISTS order_items CASCADE;
DROP TABLE IF EXISTS orders CASCADE;
DROP TABLE IF EXISTS product_variants CASCADE;
DROP TABLE IF EXISTS products CASCADE;
DROP TABLE IF EXISTS user_roles CASCADE;
DROP TABLE IF EXISTS creator_organizers CASCADE;
DROP TABLE IF EXISTS refunds CASCADE;

-- ビュー削除
DROP VIEW IF EXISTS sales_vw CASCADE;
DROP VIEW IF EXISTS factory_orders_vw CASCADE;
DROP VIEW IF EXISTS publishing_approvals_vw CASCADE;
DROP VIEW IF EXISTS purchases_vw CASCADE;
DROP VIEW IF EXISTS works_vw CASCADE;
DROP VIEW IF EXISTS users_vw CASCADE;
DROP VIEW IF EXISTS refund_requests_vw CASCADE;

-- 関数削除
DROP FUNCTION IF EXISTS approve_publishing CASCADE;
```

---

**ステータス**: ✅ 実行準備完了
**所要時間**: 2分
**安全性**: 最大（既存テーブル対応、冪等性保証）
**推奨**: 即座実施
