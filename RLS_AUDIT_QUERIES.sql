-- =====================================================================
-- RLS（Row Level Security）監査クエリ
-- =====================================================================
-- 作成日: 2025-10-03
-- 目的: 全テーブルのRLS有効化状況とポリシー適用状況を確認
-- =====================================================================

-- =============================================================================
-- 1. RLS有効化状況の確認（全テーブル）
-- =============================================================================

SELECT
  schemaname,
  tablename,
  rowsecurity AS rls_enabled,
  CASE
    WHEN rowsecurity = true THEN '✅ 有効'
    ELSE '❌ 無効'
  END AS status
FROM pg_tables
WHERE schemaname = 'public'
  AND tablename NOT LIKE 'pg_%'
  AND tablename NOT LIKE 'sql_%'
ORDER BY
  CASE WHEN rowsecurity = true THEN 1 ELSE 0 END DESC,
  tablename;


-- =============================================================================
-- 2. v6テーブルのRLS状況（重点確認）
-- =============================================================================

SELECT
  tablename,
  rowsecurity AS rls_enabled,
  CASE
    WHEN rowsecurity = true THEN '✅ 有効'
    ELSE '⚠️ 無効（要対応）'
  END AS status
FROM pg_tables
WHERE schemaname = 'public'
  AND tablename IN (
    'user_roles',
    'products',
    'product_variants',
    'orders',
    'order_items',
    'fulfillments',
    'creator_organizers',
    'refunds'
  )
ORDER BY tablename;


-- =============================================================================
-- 3. 適用されているRLSポリシー一覧
-- =============================================================================

SELECT
  schemaname,
  tablename,
  policyname,
  permissive,
  roles,
  cmd AS command,
  qual AS using_expression,
  with_check AS check_expression
FROM pg_policies
WHERE schemaname = 'public'
ORDER BY tablename, policyname;


-- =============================================================================
-- 4. v6テーブルのポリシー詳細
-- =============================================================================

SELECT
  tablename,
  policyname,
  cmd AS command,
  permissive,
  roles,
  qual AS using_expression
FROM pg_policies
WHERE schemaname = 'public'
  AND tablename IN (
    'user_roles',
    'products',
    'product_variants',
    'orders',
    'order_items',
    'fulfillments',
    'creator_organizers',
    'refunds'
  )
ORDER BY tablename, policyname;


-- =============================================================================
-- 5. RLS有効だがポリシーがないテーブル（危険）
-- =============================================================================

SELECT
  t.tablename,
  '⚠️ RLS有効だがポリシーなし（全アクセス拒否）' AS issue,
  'CRITICAL' AS severity
FROM pg_tables t
WHERE t.schemaname = 'public'
  AND t.rowsecurity = true
  AND NOT EXISTS (
    SELECT 1
    FROM pg_policies p
    WHERE p.schemaname = t.schemaname
      AND p.tablename = t.tablename
  )
ORDER BY t.tablename;


-- =============================================================================
-- 6. RLS無効のテーブル（セキュリティリスク）
-- =============================================================================

SELECT
  tablename,
  '❌ RLS無効（全ユーザーアクセス可能）' AS issue,
  CASE
    WHEN tablename IN ('user_roles', 'products', 'product_variants', 'orders', 'order_items', 'fulfillments', 'creator_organizers', 'refunds')
    THEN 'CRITICAL'
    ELSE 'WARNING'
  END AS severity
FROM pg_tables
WHERE schemaname = 'public'
  AND rowsecurity = false
  AND tablename NOT LIKE 'pg_%'
  AND tablename NOT LIKE 'sql_%'
ORDER BY
  CASE
    WHEN tablename IN ('user_roles', 'products', 'product_variants', 'orders', 'order_items', 'fulfillments', 'creator_organizers', 'refunds')
    THEN 1
    ELSE 2
  END,
  tablename;


-- =============================================================================
-- 7. テーブルごとのポリシー数
-- =============================================================================

SELECT
  t.tablename,
  t.rowsecurity AS rls_enabled,
  COUNT(p.policyname) AS policy_count,
  CASE
    WHEN t.rowsecurity = false THEN '❌ RLS無効'
    WHEN COUNT(p.policyname) = 0 THEN '⚠️ ポリシーなし'
    WHEN COUNT(p.policyname) < 2 THEN '⚠️ ポリシー不足（2未満）'
    ELSE '✅ 正常'
  END AS status
FROM pg_tables t
LEFT JOIN pg_policies p ON p.schemaname = t.schemaname AND p.tablename = t.tablename
WHERE t.schemaname = 'public'
  AND t.tablename NOT LIKE 'pg_%'
  AND t.tablename NOT LIKE 'sql_%'
GROUP BY t.tablename, t.rowsecurity
ORDER BY
  CASE
    WHEN t.rowsecurity = false THEN 1
    WHEN COUNT(p.policyname) = 0 THEN 2
    WHEN COUNT(p.policyname) < 2 THEN 3
    ELSE 4
  END,
  t.tablename;


-- =============================================================================
-- 8. 公開テーブル（anon/authenticatedに権限あり）
-- =============================================================================

SELECT DISTINCT
  table_name,
  grantee,
  privilege_type
FROM information_schema.table_privileges
WHERE table_schema = 'public'
  AND grantee IN ('anon', 'authenticated')
  AND privilege_type = 'SELECT'
ORDER BY table_name, grantee;


-- =============================================================================
-- 9. v5テーブルのRLS状況
-- =============================================================================

SELECT
  tablename,
  rowsecurity AS rls_enabled,
  CASE
    WHEN rowsecurity = true THEN '✅ 有効'
    ELSE '⚠️ 無効'
  END AS status
FROM pg_tables
WHERE schemaname = 'public'
  AND tablename IN (
    'sales',
    'purchases',
    'works',
    'organizers',
    'refund_requests',
    'manufacturing_orders',
    'manufacturing_partners',
    'user_public_profiles'
  )
ORDER BY tablename;


-- =============================================================================
-- 10. auth.users テーブルへの参照確認
-- =============================================================================

SELECT
  schemaname,
  tablename,
  policyname,
  qual AS using_expression
FROM pg_policies
WHERE schemaname = 'public'
  AND qual LIKE '%auth.uid()%'
ORDER BY tablename, policyname;


-- =============================================================================
-- 11. 推奨されるRLS設定（v6テーブル）
-- =============================================================================

SELECT
  'products' AS table_name,
  'products_viewable_by_all' AS expected_policy,
  EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'products' AND policyname = 'products_viewable_by_all'
  ) AS exists,
  CASE
    WHEN EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'products' AND policyname = 'products_viewable_by_all')
    THEN '✅ 存在'
    ELSE '❌ 不足'
  END AS status

UNION ALL

SELECT
  'products',
  'products_public_or_owner_select',
  EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'products' AND policyname = 'products_public_or_owner_select'),
  CASE WHEN EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'products' AND policyname = 'products_public_or_owner_select') THEN '✅ 存在' ELSE '❌ 不足' END

UNION ALL

SELECT
  'products',
  'products_owner_write',
  EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'products' AND policyname = 'products_owner_write'),
  CASE WHEN EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'products' AND policyname = 'products_owner_write') THEN '✅ 存在' ELSE '❌ 不足' END

UNION ALL

SELECT
  'product_variants',
  'product_variants_viewable_by_all',
  EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'product_variants' AND policyname = 'product_variants_viewable_by_all'),
  CASE WHEN EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'product_variants' AND policyname = 'product_variants_viewable_by_all') THEN '✅ 存在' ELSE '❌ 不足' END

UNION ALL

SELECT
  'orders',
  'users_can_view_own_orders',
  EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'orders' AND policyname = 'users_can_view_own_orders'),
  CASE WHEN EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'orders' AND policyname = 'users_can_view_own_orders') THEN '✅ 存在' ELSE '❌ 不足' END

UNION ALL

SELECT
  'order_items',
  'users_can_view_order_items',
  EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'order_items' AND policyname = 'users_can_view_order_items'),
  CASE WHEN EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'order_items' AND policyname = 'users_can_view_order_items') THEN '✅ 存在' ELSE '❌ 不足' END

ORDER BY table_name, expected_policy;


-- =============================================================================
-- 12. セキュリティサマリー
-- =============================================================================

SELECT
  '全テーブル数' AS metric,
  COUNT(*) AS value
FROM pg_tables
WHERE schemaname = 'public'
  AND tablename NOT LIKE 'pg_%'
  AND tablename NOT LIKE 'sql_%'

UNION ALL

SELECT
  'RLS有効テーブル数',
  COUNT(*)
FROM pg_tables
WHERE schemaname = 'public'
  AND rowsecurity = true

UNION ALL

SELECT
  'RLS無効テーブル数',
  COUNT(*)
FROM pg_tables
WHERE schemaname = 'public'
  AND rowsecurity = false
  AND tablename NOT LIKE 'pg_%'
  AND tablename NOT LIKE 'sql_%'

UNION ALL

SELECT
  '適用中ポリシー総数',
  COUNT(*)
FROM pg_policies
WHERE schemaname = 'public'

UNION ALL

SELECT
  'v6テーブルRLS有効数',
  COUNT(*)
FROM pg_tables
WHERE schemaname = 'public'
  AND tablename IN ('user_roles', 'products', 'product_variants', 'orders', 'order_items', 'fulfillments', 'creator_organizers', 'refunds')
  AND rowsecurity = true

UNION ALL

SELECT
  'v6テーブルポリシー数',
  COUNT(*)
FROM pg_policies
WHERE schemaname = 'public'
  AND tablename IN ('user_roles', 'products', 'product_variants', 'orders', 'order_items', 'fulfillments', 'creator_organizers', 'refunds');


-- =============================================================================
-- 実行完了
-- =============================================================================

SELECT
  '✅ RLS監査クエリ実行完了' AS message,
  now() AS audited_at;
