-- v5.0 マイグレーション検証クエリ集
-- マイグレーション適用後の動作確認に使用

-- ============================================================================
-- 1. マイグレーション適用状況の確認
-- ============================================================================

-- 適用済みマイグレーション一覧
SELECT 
  version, 
  executed_at,
  checksum 
FROM public.schema_migrations 
WHERE version LIKE 'v5.0%'
ORDER BY version;

-- 期待結果: v5.0_marketplace, v5.0_rls, v5.0_backfill, v5.0_payouts

-- ============================================================================  
-- 2. テーブル構造とデータ整合性の確認
-- ============================================================================

-- パートナー関連テーブルの存在確認
SELECT 
  table_name,
  CASE 
    WHEN table_name IN (
      'manufacturing_partners', 'factory_products', 'manufacturing_orders',
      'partner_notifications', 'partner_reviews', 'price_history'
    ) THEN '✅'
    ELSE '❌'
  END as status
FROM information_schema.tables 
WHERE table_schema = 'public' 
  AND table_name IN (
    'manufacturing_partners', 'factory_products', 'manufacturing_orders',
    'partner_notifications', 'partner_reviews', 'price_history'
  )
ORDER BY table_name;

-- purchases テーブルの二段階手数料カラム確認
SELECT 
  column_name,
  data_type,
  is_nullable
FROM information_schema.columns 
WHERE table_schema = 'public' 
  AND table_name = 'purchases'
  AND column_name IN ('factory_payment', 'platform_markup', 'platform_sales_fee', 'platform_total_revenue')
ORDER BY column_name;

-- ============================================================================
-- 3. バックフィル（データ移行）の確認
-- ============================================================================

-- NULL手数料レコード数（0であることを確認）
SELECT 
  'purchases with NULL platform_total_revenue' as check_type,
  COUNT(*) as count,
  CASE WHEN COUNT(*) = 0 THEN '✅ OK' ELSE '❌ NG' END as status
FROM public.purchases 
WHERE platform_total_revenue IS NULL;

-- 手数料計算例のサンプル表示（最新10件）
SELECT 
  id,
  price as sale_price,
  COALESCE(factory_payment, 0) as factory_payment,
  COALESCE(platform_markup, 0) as platform_markup,
  COALESCE(platform_sales_fee, 0) as platform_sales_fee,
  COALESCE(platform_total_revenue, 0) as platform_total_revenue,
  -- 計算式チェック
  CASE 
    WHEN platform_total_revenue = (COALESCE(platform_markup,0) + COALESCE(platform_sales_fee,0))
    THEN '✅' ELSE '❌'
  END as fee_calc_ok
FROM public.purchases 
WHERE price > 0
ORDER BY created_at DESC 
LIMIT 10;

-- ============================================================================
-- 4. RLS（Row Level Security）ポリシーの確認  
-- ============================================================================

-- RLS有効化状況
SELECT 
  schemaname,
  tablename,
  rowsecurity,
  CASE WHEN rowsecurity THEN '✅ Enabled' ELSE '❌ Disabled' END as rls_status
FROM pg_tables 
WHERE schemaname = 'public' 
  AND tablename IN (
    'manufacturing_partners', 'factory_products', 'manufacturing_orders',
    'partner_notifications', 'partner_reviews'
  )
ORDER BY tablename;

-- ポリシー一覧（パートナー関連）
SELECT 
  schemaname,
  tablename,
  policyname,
  cmd, -- SELECT, INSERT, UPDATE, DELETE
  qual -- 条件式
FROM pg_policies 
WHERE schemaname = 'public'
  AND tablename LIKE '%partner%' OR tablename LIKE '%factory%' OR tablename LIKE '%manufacturing%'
ORDER BY tablename, policyname;

-- 追加: rate_limits テーブルRLS確認
SELECT 
  n.nspname as schema,
  c.relname as table,
  c.relrowsecurity as rls_enabled,
  c.relforcerowsecurity as rls_forced
FROM pg_class c
JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname = 'public' AND c.relname = 'rate_limits';

SELECT policyname, cmd, qual, with_check
FROM pg_policies 
WHERE schemaname = 'public' AND tablename = 'rate_limits';

-- ============================================================================
-- 5. ビューと関数の動作確認
-- ============================================================================

-- creator_earnings_v50 ビューの確認
SELECT 
  'creator_earnings_v50 view' as check_type,
  COUNT(*) as record_count,
  CASE WHEN COUNT(*) >= 0 THEN '✅ OK' ELSE '❌ NG' END as status
FROM public.creator_earnings_v50;

-- 月次集計関数の動作テスト（実際には実行しない）
SELECT 
  'generate_monthly_payouts_v50 function' as check_type,
  CASE 
    WHEN EXISTS (
      SELECT 1 FROM information_schema.routines 
      WHERE routine_schema = 'public' 
        AND routine_name = 'generate_monthly_payouts_v50'
    ) THEN '✅ Function exists'
    ELSE '❌ Function missing'
  END as status;

-- 月次サマリー関数テスト（サンプル）
-- SELECT public.get_creator_monthly_summary(
--   'xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx'::uuid, -- 実際のcreator_id
--   2024, 1
-- );

-- ============================================================================
-- 6. 支払い生成ロジックの検証
-- ============================================================================

-- クリエイター利益集計例（前月分）
SELECT 
  creator_id,
  creator_name,
  COUNT(*) as sales_count,
  SUM(sale_price) as total_sales,
  SUM(factory_payment) as total_factory_payment,  
  SUM(platform_total_revenue) as total_platform_fees,
  SUM(creator_profit) as total_creator_profit
FROM public.creator_earnings_v50
WHERE purchased_at >= date_trunc('month', CURRENT_DATE - interval '1 month')
  AND purchased_at < date_trunc('month', CURRENT_DATE)
  AND creator_profit > 0
GROUP BY creator_id, creator_name
HAVING SUM(creator_profit) >= 5000 -- 最低支払額
ORDER BY total_creator_profit DESC
LIMIT 10;

-- 追加: SECURITY DEFINER 関数の search_path 設定確認
SELECT 
  n.nspname as schema,
  p.proname as function,
  pg_get_function_identity_arguments(p.oid) as args,
  p.prosecdef as security_definer,
  p.proconfig as config
FROM pg_proc p
JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE n.nspname = 'public'
  AND p.prosecdef = true
ORDER BY 1,2;

-- pg_cron ジョブ確認（拡張が有効な場合のみ）
-- SELECT * FROM cron.job WHERE jobname = 'monthly-payout-generation-v50';

-- ============================================================================
-- 7. パフォーマンスとインデックスの確認
-- ============================================================================

-- 重要なインデックス存在確認
SELECT 
  schemaname,
  tablename,
  indexname,
  indexdef
FROM pg_indexes 
WHERE schemaname = 'public'
  AND (
    indexname LIKE '%partner%' OR 
    indexname LIKE '%factory%' OR
    indexname LIKE '%manufacturing%'
  )
ORDER BY tablename, indexname;

-- テーブルサイズ確認
SELECT 
  schemaname,
  tablename,
  pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) as size
FROM pg_tables 
WHERE schemaname = 'public'
  AND tablename IN (
    'manufacturing_partners', 'factory_products', 'manufacturing_orders',
    'purchases', 'works', 'users'
  )
ORDER BY pg_total_relation_size(schemaname||'.'||tablename) DESC;

-- ============================================================================
-- 8. 運用データの初期確認
-- ============================================================================

-- 製造パートナー登録状況
SELECT 
  status,
  COUNT(*) as partner_count,
  AVG(avg_rating) as avg_rating,
  SUM(ratings_count) as total_ratings
FROM public.manufacturing_partners
GROUP BY status
ORDER BY status;

-- 工場商品登録状況  
SELECT 
  product_type,
  COUNT(*) as product_count,
  AVG(base_cost) as avg_base_cost,
  AVG(lead_time_days) as avg_lead_time,
  COUNT(*) FILTER (WHERE is_active = true) as active_count
FROM public.factory_products
GROUP BY product_type
ORDER BY product_count DESC;

-- 製造オーダー状況
SELECT 
  status,
  COUNT(*) as order_count,
  AVG(EXTRACT(epoch FROM (updated_at - created_at))/3600) as avg_processing_hours
FROM public.manufacturing_orders
GROUP BY status
ORDER BY order_count DESC;
