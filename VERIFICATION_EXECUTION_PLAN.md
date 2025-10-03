# 🔍 v6スキーマ動作確認 実行プラン

**実行環境**: Supabase Studio SQL Editor
**URL**: https://supabase.com/dashboard/project/ywwgqzgtlipqywjdxqtj

---

## 実行手順

### ステップ1: 拡張機能確認（必須）
```sql
SELECT extname, extversion
FROM pg_extension
WHERE extname = 'pgcrypto';
```
**期待結果**: `pgcrypto | 1.3` (バージョンは環境により異なる)

---

### ステップ2: テーブル作成確認（必須）
```sql
-- テーブル一覧
SELECT table_name
FROM information_schema.tables
WHERE table_schema = 'public'
  AND table_name IN (
    'user_roles',
    'products',
    'product_variants',
    'orders',
    'order_items',
    'fulfillments',
    'creator_organizers',
    'refunds'
  )
ORDER BY table_name;
```
**期待結果**: 8行（全テーブル名）

```sql
-- 各テーブルのレコード数
SELECT 'user_roles' AS table_name, COUNT(*) AS count FROM user_roles
UNION ALL
SELECT 'products', COUNT(*) FROM products
UNION ALL
SELECT 'product_variants', COUNT(*) FROM product_variants
UNION ALL
SELECT 'orders', COUNT(*) FROM orders
UNION ALL
SELECT 'order_items', COUNT(*) FROM order_items
UNION ALL
SELECT 'fulfillments', COUNT(*) FROM fulfillments
UNION ALL
SELECT 'creator_organizers', COUNT(*) FROM creator_organizers
UNION ALL
SELECT 'refunds', COUNT(*) FROM refunds;
```
**期待結果**: 各テーブル 0 行（新規作成のため）

---

### ステップ3: 重要カラム存在確認（必須）
```sql
-- products.is_active
SELECT
  table_name,
  column_name,
  data_type,
  column_default
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'products'
  AND column_name = 'is_active';
```
**期待結果**: 1行（is_active | boolean | true）

```sql
-- product_variants.is_available
SELECT
  table_name,
  column_name,
  data_type,
  column_default
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'product_variants'
  AND column_name = 'is_available';
```
**期待結果**: 1行（is_available | boolean | true）

---

### ステップ4: 外部キー制約確認（推奨）
```sql
SELECT
  tc.constraint_name,
  tc.table_name,
  kcu.column_name,
  ccu.table_name AS foreign_table_name,
  ccu.column_name AS foreign_column_name,
  rc.delete_rule
FROM information_schema.table_constraints AS tc
JOIN information_schema.key_column_usage AS kcu
  ON tc.constraint_name = kcu.constraint_name
JOIN information_schema.constraint_column_usage AS ccu
  ON ccu.constraint_name = tc.constraint_name
JOIN information_schema.referential_constraints AS rc
  ON rc.constraint_name = tc.constraint_name
WHERE tc.constraint_type = 'FOREIGN KEY'
  AND tc.table_name IN ('fulfillments', 'products')
ORDER BY tc.table_name, tc.constraint_name;
```
**期待結果**:
- `fulfillments_manufacturing_partner_id_fkey | fulfillments | manufacturing_partner_id | manufacturing_partners | id | SET NULL`（manufacturing_partnersテーブルが存在する場合）

---

### ステップ5: RLSポリシー確認（推奨）
```sql
SELECT
  schemaname,
  tablename,
  policyname,
  permissive,
  cmd,
  qual
FROM pg_policies
WHERE tablename IN ('products', 'product_variants', 'orders', 'order_items')
ORDER BY tablename, policyname;
```
**期待結果**:
- `products_viewable_by_all` (SELECT, is_active = true)
- `product_variants_viewable_by_all` (SELECT, is_available = true)
- その他のポリシー

---

### ステップ6: ビュー作成確認（必須）
```sql
-- ビュー一覧
SELECT table_name
FROM information_schema.views
WHERE table_schema = 'public'
  AND table_name IN (
    'sales_vw',
    'factory_orders_vw',
    'publishing_approvals_vw',
    'purchases_vw',
    'works_vw',
    'users_vw',
    'refund_requests_vw'
  )
ORDER BY table_name;
```
**期待結果**:
- `factory_orders_vw`（必ず作成）
- その他のビュー（v5テーブル存在時のみ）

```sql
-- 各ビューのレコード数
SELECT 'factory_orders_vw' AS view_name, COUNT(*) AS count FROM factory_orders_vw
UNION ALL
SELECT 'sales_vw', COUNT(*) FROM sales_vw
UNION ALL
SELECT 'publishing_approvals_vw', COUNT(*) FROM publishing_approvals_vw
UNION ALL
SELECT 'purchases_vw', COUNT(*) FROM purchases_vw
UNION ALL
SELECT 'works_vw', COUNT(*) FROM works_vw
UNION ALL
SELECT 'users_vw', COUNT(*) FROM users_vw
UNION ALL
SELECT 'refund_requests_vw', COUNT(*) FROM refund_requests_vw;
```
**期待結果**: 各ビュー 0行（v6テーブル空のため）またはエラー（ビュー未作成）

---

### ステップ7: factory_orders_vw サンプルデータ（推奨方針B確認）
```sql
SELECT
  id,
  product_name,
  product_type,
  quantity,
  customer_name,
  status,
  created_at
FROM factory_orders_vw
LIMIT 5;
```
**期待結果**: 0行（fulfillmentsテーブルが空のため）

---

### ステップ8: users_vw サンプルデータ
```sql
SELECT
  id,
  email,
  display_name,
  avatar_url,
  created_at
FROM users_vw
LIMIT 5;
```
**期待結果**: usersテーブルのレコード（1行以上）

---

### ステップ9: works_vw サンプルデータ
```sql
SELECT
  id,
  creator_id,
  title,
  is_active,
  created_at
FROM works_vw
LIMIT 5;
```
**期待結果**: worksテーブルのレコード（存在する場合）

---

### ステップ10: 関数確認
```sql
SELECT
  routine_name,
  routine_type,
  security_type
FROM information_schema.routines
WHERE routine_schema = 'public'
  AND routine_name = 'approve_publishing';
```
**期待結果**: 1行（approve_publishing | FUNCTION | DEFINER）

---

### ステップ11: 完全性チェック（必須）
```sql
-- v6必須テーブルが全て作成されているか
SELECT
  CASE
    WHEN COUNT(*) = 8 THEN '✅ v6テーブル完全作成済み'
    ELSE '⚠️ 一部テーブル未作成'
  END AS status,
  COUNT(*) AS created_count,
  8 AS expected_count
FROM information_schema.tables
WHERE table_schema = 'public'
  AND table_name IN (
    'user_roles',
    'products',
    'product_variants',
    'orders',
    'order_items',
    'fulfillments',
    'creator_organizers',
    'refunds'
  );
```
**期待結果**: `✅ v6テーブル完全作成済み | 8 | 8`

```sql
-- factory_orders_vw が作成されているか
SELECT
  CASE
    WHEN EXISTS (
      SELECT 1 FROM information_schema.views
      WHERE table_schema = 'public' AND table_name = 'factory_orders_vw'
    ) THEN '✅ factory_orders_vw 作成済み（推奨方針B）'
    ELSE '❌ factory_orders_vw 未作成'
  END AS status;
```
**期待結果**: `✅ factory_orders_vw 作成済み（推奨方針B）`

---

### ステップ12: エラーチェック（必須）
```sql
-- is_activeカラムが存在するか
SELECT
  CASE
    WHEN EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = 'products'
        AND column_name = 'is_active'
    ) THEN '✅ products.is_active 存在'
    ELSE '❌ products.is_active なし'
  END AS status;
```
**期待結果**: `✅ products.is_active 存在`

```sql
-- is_availableカラムが存在するか
SELECT
  CASE
    WHEN EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = 'product_variants'
        AND column_name = 'is_available'
    ) THEN '✅ product_variants.is_available 存在'
    ELSE '❌ product_variants.is_available なし'
  END AS status;
```
**期待結果**: `✅ product_variants.is_available 存在`

---

### ステップ13: 実行完了確認
```sql
SELECT
  '✅ v6スキーマ動作確認完了' AS message,
  now() AS verified_at;
```
**期待結果**: `✅ v6スキーマ動作確認完了 | 2025-10-03 ...`

---

## 📊 実行結果の記録

実行後、以下の情報を記録してください:

1. ✅ 作成されたテーブル数: ____ / 8
2. ✅ 作成されたビュー数: ____ / 7（環境依存）
3. ✅ products.is_active存在: はい / いいえ
4. ✅ product_variants.is_available存在: はい / いいえ
5. ✅ factory_orders_vw作成: はい / いいえ
6. ✅ FK制約数: ____
7. ✅ RLSポリシー数: ____

---

## ⚠️ トラブルシューティング

### エラーが発生した場合

**エラー: relation "xxx" does not exist**
→ 該当テーブルまたはビューが作成されていません。REMOTE_APPLY_v6_SAFE.sqlを再実行してください。

**エラー: column "xxx" does not exist**
→ カラムが追加されていません。ALTER TABLE部分を確認してください。

**警告: ビューが作成されていない**
→ v5テーブルが存在しない場合、対応するビューは作成されません（正常動作）。

---

**ステータス**: 準備完了
**所要時間**: 5-10分
**推奨**: 即座実施
