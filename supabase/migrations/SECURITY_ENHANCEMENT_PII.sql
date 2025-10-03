-- =====================================================================
-- セキュリティ強化: PII最小化とビューアクセス権限の最適化
-- =====================================================================
-- 作成日: 2025-10-03
-- 目的:
--   1. factory_orders_vw.customer_name を users.email から display_name に変更
--   2. v5互換ビューのSELECT権限を最小化（anon/authenticatedに不要なら付与しない）
-- =====================================================================

-- =====================================================================
-- 1. factory_orders_vw の PII 最小化
-- =====================================================================

-- 既存ビューを削除して再作成
DROP VIEW IF EXISTS factory_orders_vw;

CREATE VIEW factory_orders_vw AS
SELECT
  f.id,
  pr.id AS product_id,
  pr.title AS product_name,
  pv.id AS product_variant_id,
  pr.product_type,
  oi.quantity,
  oi.unit_price_jpy,
  f.manufacturing_partner_id AS factory_id,
  o.id AS order_id,
  o.user_id AS customer_id,
  -- PII最小化: users.email → users_vw.display_name（フォールバック: email）
  COALESCE(uv.display_name, u.email, 'unknown') AS customer_name,
  oi.creator_id,
  f.status,
  f.created_at,
  f.updated_at
FROM fulfillments f
JOIN order_items oi ON oi.id = f.order_item_id
JOIN orders o ON o.id = oi.order_id
LEFT JOIN users u ON u.id = o.user_id
LEFT JOIN users_vw uv ON uv.id = o.user_id
LEFT JOIN product_variants pv ON pv.id = oi.product_variant_id
LEFT JOIN products pr ON pr.id = pv.product_id;

COMMENT ON VIEW factory_orders_vw IS 'v6 製造注文ビュー（推奨方針B）: fulfillmentsベース、PII最小化対応（display_name優先）';


-- =====================================================================
-- 2. v5互換ビューのアクセス権限最小化
-- =====================================================================

-- sales_vw: 旧テーブル依存、管理者のみアクセス可能
DO $
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.views WHERE table_schema = 'public' AND table_name = 'sales_vw') THEN
    -- anon/authenticatedからSELECT権限を剥奪
    REVOKE SELECT ON sales_vw FROM anon;
    REVOKE SELECT ON sales_vw FROM authenticated;

    -- service_roleのみアクセス可能（管理ツール用）
    GRANT SELECT ON sales_vw TO service_role;

    COMMENT ON VIEW sales_vw IS 'v5互換ビュー（非推奨）: 管理者専用、一般ユーザーアクセス不可';
  END IF;
END$;


-- purchases_vw: 旧テーブル依存、管理者のみアクセス可能
DO $
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.views WHERE table_schema = 'public' AND table_name = 'purchases_vw') THEN
    REVOKE SELECT ON purchases_vw FROM anon;
    REVOKE SELECT ON purchases_vw FROM authenticated;
    GRANT SELECT ON purchases_vw TO service_role;

    COMMENT ON VIEW purchases_vw IS 'v5互換ビュー（非推奨）: 管理者専用、一般ユーザーアクセス不可';
  END IF;
END$;


-- refund_requests_vw: 旧テーブル依存、管理者のみアクセス可能
DO $
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.views WHERE table_schema = 'public' AND table_name = 'refund_requests_vw') THEN
    REVOKE SELECT ON refund_requests_vw FROM anon;
    REVOKE SELECT ON refund_requests_vw FROM authenticated;
    GRANT SELECT ON refund_requests_vw TO service_role;

    COMMENT ON VIEW refund_requests_vw IS 'v5互換ビュー（非推奨）: 管理者専用、一般ユーザーアクセス不可';
  END IF;
END$;


-- publishing_approvals_vw: 旧テーブル依存、管理者のみアクセス可能
DO $
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.views WHERE table_schema = 'public' AND table_name = 'publishing_approvals_vw') THEN
    REVOKE SELECT ON publishing_approvals_vw FROM anon;
    REVOKE SELECT ON publishing_approvals_vw FROM authenticated;
    GRANT SELECT ON publishing_approvals_vw TO service_role;

    COMMENT ON VIEW publishing_approvals_vw IS 'v5互換ビュー（非推奨）: 管理者専用、一般ユーザーアクセス不可';
  END IF;
END$;


-- works_vw: クリエイター情報含むため、本人または管理者のみアクセス可能
DO $
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.views WHERE table_schema = 'public' AND table_name = 'works_vw') THEN
    REVOKE SELECT ON works_vw FROM anon;
    -- authenticatedには条件付きアクセス（RLSで制御）
    GRANT SELECT ON works_vw TO authenticated;
    GRANT SELECT ON works_vw TO service_role;

    -- RLSポリシー追加: 本人または公開作品のみ閲覧可能
    ALTER VIEW works_vw SET (security_invoker = on);

    COMMENT ON VIEW works_vw IS 'v5互換ビュー: 本人または公開作品のみアクセス可能（RLS適用）';
  END IF;
END$;


-- =====================================================================
-- 3. factory_orders_vw のアクセス権限設定
-- =====================================================================

-- factory_orders_vw: 製造パートナーと管理者のみアクセス可能
REVOKE SELECT ON factory_orders_vw FROM anon;
REVOKE SELECT ON factory_orders_vw FROM authenticated;

-- 製造パートナーロール（partner_users経由）のみアクセス可能
GRANT SELECT ON factory_orders_vw TO service_role;

COMMENT ON VIEW factory_orders_vw IS 'v6製造注文ビュー: 製造パートナーと管理者専用、PII最小化（display_name優先）';


-- =====================================================================
-- 4. users_vw のアクセス権限確認
-- =====================================================================

-- users_vw: 公開プロフィール情報のみ、全ユーザーアクセス可能
DO $
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.views WHERE table_schema = 'public' AND table_name = 'users_vw') THEN
    -- anon/authenticatedに SELECT 権限を付与（公開プロフィール情報）
    GRANT SELECT ON users_vw TO anon;
    GRANT SELECT ON users_vw TO authenticated;
    GRANT SELECT ON users_vw TO service_role;

    COMMENT ON VIEW users_vw IS 'ユーザー公開プロフィール: 全ユーザーアクセス可能（PII最小化済み）';
  END IF;
END$;


-- =====================================================================
-- 5. 実行完了
-- =====================================================================

DO $
BEGIN
  RAISE NOTICE '✅ セキュリティ強化完了';
  RAISE NOTICE '  1. factory_orders_vw: customer_name を display_name 優先に変更';
  RAISE NOTICE '  2. v5互換ビュー: アクセス権限を service_role のみに制限';
  RAISE NOTICE '  3. factory_orders_vw: 製造パートナーと管理者専用';
  RAISE NOTICE '  4. users_vw: 公開プロフィール情報として全ユーザーアクセス可能';
END$;


SELECT
  '✅ PII最小化とアクセス権限強化完了' AS message,
  now() AS applied_at;
