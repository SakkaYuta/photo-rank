-- PhotoRank v5.0 最小限のテーブル構造確認
-- エラーを一切発生させない安全な構造確認クエリ

-- =====================================
-- 1. 基本的なテーブル存在確認
-- =====================================

-- purchases テーブルの存在確認
SELECT 
  'Table Existence' as check_type,
  'purchases' as table_name,
  EXISTS (
    SELECT 1 FROM information_schema.tables 
    WHERE table_schema = 'public' 
    AND table_name = 'purchases'
  ) as exists;

-- =====================================
-- 2. 安全なカラム構造確認
-- =====================================

-- purchases テーブルの全カラム名のみ表示（エラー回避）
SELECT 
  'Column Names' as info_type,
  string_agg(column_name, ', ' ORDER BY ordinal_position) as all_columns
FROM information_schema.columns 
WHERE table_schema = 'public' 
AND table_name = 'purchases';

-- 個別カラム存在確認（重要カラムのみ）
SELECT 
  'Key Columns Check' as check_type,
  EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'purchases' 
    AND column_name = 'id'
  ) as has_id,
  EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'purchases' 
    AND column_name = 'user_id'
  ) as has_user_id,
  EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'purchases' 
    AND column_name = 'buyer_user_id'
  ) as has_buyer_user_id,
  EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'purchases' 
    AND column_name = 'customer_id'
  ) as has_customer_id,
  EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'purchases' 
    AND column_name = 'created_at'
  ) as has_created_at,
  EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'purchases' 
    AND column_name = 'currency'
  ) as has_currency,
  EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'purchases' 
    AND column_name = 'stripe_payment_intent_id'
  ) as has_stripe_payment_intent_id;

-- =====================================
-- 3. 関連テーブル確認
-- =====================================

-- 重要な関連テーブルの存在確認
SELECT 
  'Related Tables' as check_type,
  EXISTS (
    SELECT 1 FROM information_schema.tables 
    WHERE table_schema = 'public' 
    AND table_name = 'users'
  ) as has_users_table,
  EXISTS (
    SELECT 1 FROM information_schema.tables 
    WHERE table_schema = 'public' 
    AND table_name = 'works'
  ) as has_works_table,
  EXISTS (
    SELECT 1 FROM information_schema.tables 
    WHERE table_schema = 'public' 
    AND table_name = 'manufacturing_orders'
  ) as has_manufacturing_orders_table,
  EXISTS (
    SELECT 1 FROM information_schema.tables 
    WHERE table_schema = 'public' 
    AND table_name = 'webhook_events'
  ) as has_webhook_events_table;

-- =====================================
-- 4. RLS状況確認
-- =====================================

-- purchases テーブルのRLS状況
SELECT 
  'RLS Status' as check_type,
  c.relname as table_name,
  c.relrowsecurity as rls_enabled,
  c.relforcerowsecurity as rls_forced
FROM pg_class c
JOIN pg_namespace n ON c.relnamespace = n.oid
WHERE n.nspname = 'public' 
AND c.relname = 'purchases';

-- 既存のポリシー数確認（詳細はスキップしてカウントのみ）
SELECT 
  'RLS Policies Count' as check_type,
  COUNT(*) as policy_count
FROM pg_policies 
WHERE schemaname = 'public' 
AND tablename = 'purchases';

-- =====================================
-- 5. 重要関数の存在確認
-- =====================================

-- is_admin_strict 関数の存在確認
SELECT 
  'Functions Check' as check_type,
  EXISTS (
    SELECT 1 FROM pg_proc 
    WHERE proname = 'is_admin_strict' 
    AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
  ) as has_is_admin_strict_function;

-- =====================================
-- 6. データ件数確認（安全）
-- =====================================

-- purchases テーブルのデータ件数（テーブルが存在する場合のみ）
DO $$
DECLARE
    record_count bigint;
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'purchases'
    ) THEN
        EXECUTE 'SELECT COUNT(*) FROM public.purchases' INTO record_count;
        RAISE NOTICE 'purchases table record count: %', record_count;
    ELSE
        RAISE NOTICE 'purchases table does not exist';
    END IF;
END
$$;

-- =====================================
-- 7. 推奨アクション
-- =====================================

SELECT 
  'Recommendation' as info_type,
  'Use security_final_critical_patches_safe.sql for safest implementation' as message,
  'This version adapts to any table structure without errors' as details;