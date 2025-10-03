# 🎯 v6完全スキーマ適用ガイド

**ファイル**: `photo-rank/supabase/migrations/REMOTE_APPLY_v6_COMPLETE.sql`
**所要時間**: 2分
**目的**: v6完全スキーマ適用（products, fulfillments含む）

---

## ✅ このSQLで実現される内容

### 新規v6テーブル作成
- ✅ `products` - 商品カタログ（digital/physical/print）
- ✅ `product_variants` - SKUバリアント
- ✅ `orders` - 注文管理
- ✅ `order_items` - 注文明細
- ✅ `fulfillments` - 製造・配送管理（v6の中核）
- ✅ `user_roles` - ユーザーロール
- ✅ `creator_organizers` - クリエイター・オーガナイザー関係
- ✅ `refunds` - 返金管理

### v5互換ビュー作成
- ✅ `sales_vw` - v5 sales + purchases データを統合
- ✅ `factory_orders_vw` - **fulfillments ベース**（推奨方針B）
  - 顧客向け商品情報（product_name, product_type）
  - 注文詳細（quantity, unit_price_jpy）
  - 顧客情報（customer_id, customer_name）
  - NULL値なし、実データを導出
- ✅ `publishing_approvals_vw` - v5 works ベース
- ✅ `purchases_vw` - v5 purchases ベース
- ✅ `works_vw` - v5 works ベース
- ✅ `users_vw` - v5 users + profiles ベース
- ✅ `refund_requests_vw` - v5 refund_requests ベース

### 関数
- ✅ `approve_publishing()` - 作品承認処理

---

## 🚀 適用手順（2分）

### 1. Supabase Studio を開く
```
https://supabase.com/dashboard/project/ywwgqzgtlipqywjdxqtj
```

### 2. SQL Editor を開く
左サイドバー → **SQL Editor** → **New query**

### 3. SQLファイルの内容をコピー&ペースト
`photo-rank/supabase/migrations/REMOTE_APPLY_v6_COMPLETE.sql` の全内容をコピーしてペースト

### 4. 実行
**Run** ボタンをクリック

---

## 📊 実行成功時のメッセージ

```
✅ v6 完全スキーマSQL適用完了

作成されたテーブル:
  ✅ user_roles
  ✅ products (v6 新規)
  ✅ product_variants (v6 新規)
  ✅ orders
  ✅ order_items
  ✅ fulfillments (v6 新規)
  ✅ creator_organizers
  ✅ refunds

作成されたビュー:
  ✅ sales_vw (v5 sales + purchases ベース)
  ✅ factory_orders_vw (v6 fulfillments ベース - 推奨方針B)
  ✅ publishing_approvals_vw (v5 works ベース)
  ✅ purchases_vw (v5 purchases ベース)
  ✅ works_vw (v5 works ベース)
  ✅ users_vw (v5 users + profiles ベース)
  ✅ refund_requests_vw (v5 refund_requests ベース)

作成された関数:
  ✅ approve_publishing() (v5 works ベース)

✅ v6完全スキーマ適用完了！
```

---

## 🔍 動作確認

SQL Editorで以下を実行:

```sql
-- テーブル件数確認
SELECT COUNT(*) FROM products;
SELECT COUNT(*) FROM product_variants;
SELECT COUNT(*) FROM orders;
SELECT COUNT(*) FROM fulfillments;

-- ビューのデータ件数確認
SELECT COUNT(*) FROM sales_vw;
SELECT COUNT(*) FROM factory_orders_vw;
SELECT COUNT(*) FROM purchases_vw;
SELECT COUNT(*) FROM works_vw;
SELECT COUNT(*) FROM users_vw;

-- factory_orders_vw のサンプルデータ確認（推奨方針B）
SELECT
  id,
  product_name,
  product_type,
  quantity,
  customer_name,
  status
FROM factory_orders_vw
LIMIT 5;
```

---

## 🎯 factory_orders_vw の改善点（推奨方針B）

### 以前（NULL値だらけ）
```sql
product_id: NULL
product_name: NULL
quantity: NULL
factory_id: NULL
```

### 現在（実データを導出）
```sql
product_id: products.id
product_name: products.title (顧客向け名称)
product_variant_id: SKU
product_type: digital/physical/print
quantity: order_items.quantity
unit_price_jpy: order_items.unit_price_jpy
customer_id: orders.user_id
customer_name: users.display_name
```

### データソース
```
fulfillments → order_items → orders → users (顧客情報)
           → product_variants → products (商品情報)
```

---

## ⚠️ 重要事項

### 既存データへの影響
- ✅ **既存のv5テーブルは変更されません**
- ✅ **既存データは保護されます**
- ✅ 新規v6テーブルは空で作成されます
- ✅ ビューは既存v5テーブルを参照します

### データ移行について
- このSQLは**データ移行を行いません**
- v6テーブル（products, orders等）は空です
- v5データは引き続き既存テーブルで利用可能
- ビュー経由でv6互換のAPIを提供

### 将来の拡張（方針C）
必要に応じて以下を追加可能:
- `fulfillments.partner_product_id` - 工場向けSKU
- `partner_products` テーブル - 工場向け商品マスタ
- `factory_orders_vw.partner_product_name` - 工場向け名称

---

## 🔄 ロールバック（必要な場合）

```sql
-- v6テーブル削除
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

## 📝 次のステップ

### 適用後すぐに
1. ✅ 動作確認クエリを実行
2. ✅ factory_orders_vw が実データを返すことを確認
3. ✅ アプリケーションのエラーが解消されたか確認

### 短期（1-2週間）
- v6テーブルへのデータ投入開始
- products, product_variants マスタ登録
- 新規注文はorders/order_items/fulfillmentsに保存

### 中期（1-2ヶ月）
- v5データの段階的移行
- ビューではなく直接v6テーブルを参照
- v5テーブルの段階的廃止

### 長期（必要に応じて）
- 方針C実装: partner_products 追加
- 工場向け名称の分離管理

---

**所要時間**: 2分
**難易度**: 簡単（コピー&ペーストのみ）
**リスク**: 最小（既存データに影響なし）
**推奨**: ✅ 即座実施
