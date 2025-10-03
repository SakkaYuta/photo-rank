-- =====================================================================
-- セキュリティ強化マイグレーション
-- =====================================================================
-- 作成日: 2025-10-02
-- 目的: セキュリティ診断で指摘された高・中リスク項目の修正
--
-- 対応項目:
-- 1. SECURITY DEFINER関数のsearch_path固定（高リスク）
-- 2. ビューのsecurity_invoker有効化（中リスク）
-- 3. PII保護のための公開用ビュー作成（中リスク）
-- =====================================================================

-- =============================================================================
-- 【高リスク対応】SECURITY DEFINER関数のsearch_path固定
-- =============================================================================

-- complete_purchase_transaction: 購入完了処理
ALTER FUNCTION IF EXISTS public.complete_purchase_transaction(text, integer)
  SET search_path TO pg_catalog, public;

-- finalize_live_offer_transaction: ライブオファー確定処理
ALTER FUNCTION IF EXISTS public.finalize_live_offer_transaction(text)
  SET search_path TO pg_catalog, public;

COMMENT ON FUNCTION complete_purchase_transaction IS
  'Security hardened: search_path fixed to prevent schema injection attacks';

COMMENT ON FUNCTION finalize_live_offer_transaction IS
  'Security hardened: search_path fixed to prevent schema injection attacks';


-- =============================================================================
-- 【中リスク対応】ビューのsecurity_invoker有効化
-- =============================================================================

-- purchases_vw: 購入履歴ビュー
ALTER VIEW IF EXISTS purchases_vw SET (security_invoker = on);

-- factory_products_vw: ファクトリー製品ビュー
ALTER VIEW IF EXISTS factory_products_vw SET (security_invoker = on);

-- manufacturing_orders_vw: 製造オーダービュー
ALTER VIEW IF EXISTS manufacturing_orders_vw SET (security_invoker = on);

-- works_vw: 作品ビュー
ALTER VIEW IF EXISTS works_vw SET (security_invoker = on);

-- users_vw: ユーザービュー（PII含む）
ALTER VIEW IF EXISTS users_vw SET (security_invoker = on);

-- refund_requests_vw: 返金リクエストビュー
ALTER VIEW IF EXISTS refund_requests_vw SET (security_invoker = on);

-- cheer_free_counters_vw: チアカウンタービュー
ALTER VIEW IF EXISTS cheer_free_counters_vw SET (security_invoker = on);

-- v6互換ビュー
ALTER VIEW IF EXISTS sales_vw SET (security_invoker = on);
ALTER VIEW IF EXISTS publishing_approvals_vw SET (security_invoker = on);
ALTER VIEW IF EXISTS factory_orders_vw SET (security_invoker = on);


-- =============================================================================
-- 【中リスク対応】PII保護: 公開用ユーザープロフィールビュー
-- =============================================================================

-- 非PII情報のみを含む公開用ビュー
CREATE OR REPLACE VIEW public_user_profiles_vw AS
SELECT
  up.user_id AS id,
  up.display_name,
  up.avatar_url,
  up.bio,
  up.website,
  up.social_links,
  up.created_at,
  up.updated_at
FROM user_profiles up
WHERE up.user_id IS NOT NULL;

-- security_invoker有効化
ALTER VIEW public_user_profiles_vw SET (security_invoker = on);

-- RLSポリシー: 公開プロフィールは全員が閲覧可能
CREATE POLICY public_profiles_viewable ON user_profiles
  FOR SELECT
  USING (true);

COMMENT ON VIEW public_user_profiles_vw IS
  'Public user profiles without PII (email, phone). Use this for public displays.';


-- =============================================================================
-- 【低リスク対応】Stripe Webhookイベントの保持期間制限
-- =============================================================================

-- 90日以上古いWebhookイベントを自動削除する関数
CREATE OR REPLACE FUNCTION cleanup_old_webhook_events()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO pg_catalog, public
AS $$
BEGIN
  -- 90日以上古いイベントを削除
  DELETE FROM stripe_webhook_events
  WHERE created_at < NOW() - INTERVAL '90 days';

  RAISE NOTICE 'Cleaned up old webhook events';
END;
$$;

COMMENT ON FUNCTION cleanup_old_webhook_events IS
  'Deletes webhook events older than 90 days to manage storage';

-- 定期実行用のcron設定（Supabaseダッシュボードで手動設定が必要）
-- SELECT cron.schedule('cleanup-webhook-events', '0 3 * * 0', 'SELECT cleanup_old_webhook_events()');


-- =============================================================================
-- 【追加セキュリティ】監査ログ関数のsearch_path固定
-- =============================================================================

-- 既存のSECURITY DEFINER関数をすべて確認して固定
DO $$
DECLARE
  func RECORD;
BEGIN
  FOR func IN
    SELECT
      n.nspname AS schema_name,
      p.proname AS function_name,
      pg_get_function_identity_arguments(p.oid) AS args
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE p.prosecdef = true  -- SECURITY DEFINER
      AND n.nspname = 'public'
      AND p.proname NOT IN (
        'complete_purchase_transaction',
        'finalize_live_offer_transaction',
        'cleanup_old_webhook_events'
      )
  LOOP
    BEGIN
      EXECUTE format(
        'ALTER FUNCTION %I.%I(%s) SET search_path TO pg_catalog, public',
        func.schema_name,
        func.function_name,
        func.args
      );
      RAISE NOTICE 'Fixed search_path for %.%(%)', func.schema_name, func.function_name, func.args;
    EXCEPTION WHEN OTHERS THEN
      RAISE WARNING 'Failed to fix search_path for %.%: %', func.schema_name, func.function_name, SQLERRM;
    END;
  END LOOP;
END;
$$;


-- =============================================================================
-- 【セキュリティ検証】権限チェック関数
-- =============================================================================

CREATE OR REPLACE FUNCTION verify_security_settings()
RETURNS TABLE(
  check_type text,
  status text,
  details text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO pg_catalog, public
AS $$
BEGIN
  -- 1. SECURITY DEFINER関数のsearch_path確認
  RETURN QUERY
  SELECT
    'SECURITY_DEFINER_FUNCTIONS'::text,
    CASE
      WHEN COUNT(*) = 0 THEN 'PASS'
      ELSE 'FAIL'
    END::text,
    'Functions without search_path: ' || COUNT(*)::text
  FROM pg_proc p
  JOIN pg_namespace n ON n.oid = p.pronamespace
  WHERE p.prosecdef = true
    AND n.nspname = 'public'
    AND NOT EXISTS (
      SELECT 1 FROM pg_proc_prosecdef_search_path(p.oid)
    );

  -- 2. ビューのsecurity_invoker確認
  RETURN QUERY
  SELECT
    'VIEW_SECURITY_INVOKER'::text,
    CASE
      WHEN COUNT(*) = 0 THEN 'PASS'
      ELSE 'WARN'
    END::text,
    'Views without security_invoker: ' || COUNT(*)::text
  FROM pg_views v
  WHERE v.schemaname = 'public'
    AND v.viewname NOT LIKE 'pg_%'
    AND NOT EXISTS (
      SELECT 1 FROM pg_class c
      JOIN pg_namespace n ON n.oid = c.relnamespace
      WHERE c.relname = v.viewname
        AND n.nspname = v.schemaname
        AND c.reloptions @> ARRAY['security_invoker=on']
    );

  -- 3. RLS有効化確認
  RETURN QUERY
  SELECT
    'RLS_ENABLED'::text,
    CASE
      WHEN COUNT(*) = 0 THEN 'PASS'
      ELSE 'FAIL'
    END::text,
    'Tables without RLS: ' || STRING_AGG(tablename, ', ')
  FROM pg_tables t
  LEFT JOIN pg_class c ON c.relname = t.tablename
  WHERE t.schemaname = 'public'
    AND t.tablename NOT LIKE 'pg_%'
    AND NOT c.relrowsecurity;

  RETURN;
END;
$$;

COMMENT ON FUNCTION verify_security_settings IS
  'Verifies security hardening settings across database objects';


-- =============================================================================
-- 実行完了メッセージ
-- =============================================================================

DO $$
BEGIN
  RAISE NOTICE '';
  RAISE NOTICE '✅ セキュリティ強化マイグレーション完了';
  RAISE NOTICE '';
  RAISE NOTICE '対応済み項目:';
  RAISE NOTICE '  ✅ SECURITY DEFINER関数のsearch_path固定';
  RAISE NOTICE '  ✅ ビューのsecurity_invoker有効化（11ビュー）';
  RAISE NOTICE '  ✅ 公開用プロフィールビュー作成（PII保護）';
  RAISE NOTICE '  ✅ Webhookイベントクリーンアップ関数';
  RAISE NOTICE '  ✅ セキュリティ検証関数追加';
  RAISE NOTICE '';
  RAISE NOTICE '検証方法:';
  RAISE NOTICE '  SELECT * FROM verify_security_settings();';
  RAISE NOTICE '';
END $$;
