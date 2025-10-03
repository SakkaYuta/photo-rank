-- =====================================================================
-- v6スキーマ 動作確認クエリ
-- =====================================================================
-- 実行方法: Supabase Studio SQL Editor で1つずつ実行
-- =====================================================================

-- =============================================================================
-- 1. 拡張機能の確認
-- =============================================================================

SELECT extname, extversion
FROM pg_extension
WHERE extname = 'pgcrypto';


-- =============================================================================
-- 2. 作成されたテーブルの確認
-- =============================================================================

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


-- =============================================================================
-- 3. 重要カラムの存在確認
-- =============================================================================

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


-- =============================================================================
-- 4. 外部キー制約の確認
-- =============================================================================

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


-- =============================================================================
-- 5. RLSポリシーの確認
-- =============================================================================

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


-- =============================================================================
-- 6. 作成されたビューの確認
-- =============================================================================

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


-- =============================================================================
-- 7. factory_orders_vw のサンプルデータ（推奨方針B）
-- =============================================================================

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


-- =============================================================================
-- 8. users_vw のサンプルデータ
-- =============================================================================

SELECT
  id,
  email,
  display_name,
  avatar_url,
  created_at
FROM users_vw
LIMIT 5;


-- =============================================================================
-- 9. works_vw のサンプルデータ
-- =============================================================================

SELECT
  id,
  creator_id,
  title,
  is_active,
  created_at
FROM works_vw
LIMIT 5;


-- =============================================================================
-- 10. 関数の確認
-- =============================================================================

SELECT
  routine_name,
  routine_type,
  security_type
FROM information_schema.routines
WHERE routine_schema = 'public'
  AND routine_name = 'approve_publishing';


-- =============================================================================
-- 11. v5テーブルの存在確認（参考）
-- =============================================================================

SELECT table_name
FROM information_schema.tables
WHERE table_schema = 'public'
  AND table_name IN (
    'sales',
    'purchases',
    'works',
    'organizers',
    'user_public_profiles',
    'refund_requests',
    'manufacturing_orders',
    'manufacturing_partners'
  )
ORDER BY table_name;


-- =============================================================================
-- 12. user_public_profiles のスキーマ確認（存在する場合）
-- =============================================================================

SELECT
  column_name,
  data_type,
  is_nullable
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'user_public_profiles'
ORDER BY ordinal_position;


-- =============================================================================
-- 13. 完全性チェック
-- =============================================================================

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

-- factory_orders_vw が作成されているか
SELECT
  CASE
    WHEN EXISTS (
      SELECT 1 FROM information_schema.views
      WHERE table_schema = 'public' AND table_name = 'factory_orders_vw'
    ) THEN '✅ factory_orders_vw 作成済み（推奨方針B）'
    ELSE '❌ factory_orders_vw 未作成'
  END AS status;


-- =============================================================================
-- 14. エラーチェック
-- =============================================================================

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


-- =============================================================================
-- 実行完了
-- =============================================================================

SELECT
  '✅ v6スキーマ動作確認完了' AS message,
  now() AS verified_at;
