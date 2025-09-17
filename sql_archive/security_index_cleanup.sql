-- PhotoRank v5.0 危険な部分インデックス一掃パッチ
-- IMMUTABLE要件違反（now()/auth.*使用）のインデックス対策

-- =====================================
-- 1. 危険な部分インデックスの検出・確認
-- =====================================

-- 現在の危険な部分インデックスを確認
SELECT 
  n.nspname as schema_name,
  t.relname as table_name,
  i.relname as index_name,
  pg_get_expr(x.indpred, x.indrelid) AS predicate
FROM pg_index x 
JOIN pg_class i ON i.oid = x.indexrelid 
JOIN pg_class t ON t.oid = x.indrelid 
JOIN pg_namespace n ON n.oid = t.relnamespace
WHERE x.indpred IS NOT NULL 
  AND n.nspname = 'public' 
  AND (
    pg_get_expr(x.indpred, x.indrelid) ILIKE '%now(%' OR
    pg_get_expr(x.indpred, x.indrelid) ILIKE '%current_timestamp%' OR
    pg_get_expr(x.indpred, x.indrelid) ILIKE '%clock_timestamp(%' OR
    pg_get_expr(x.indpred, x.indrelid) ILIKE '%auth.%' OR
    pg_get_expr(x.indpred, x.indrelid) ILIKE '%jwt%'
  );

-- =====================================
-- 2. 既知の危険なインデックスを削除
-- =====================================

-- rate_limits テーブルの時間ベース部分インデックス削除
DROP INDEX IF EXISTS idx_rate_limits_cleanup;
DROP INDEX IF EXISTS idx_rate_limits_active;
DROP INDEX IF EXISTS idx_rate_limits_window;

-- audit_logs テーブルの時間ベース部分インデックス削除
DROP INDEX IF EXISTS idx_audit_logs_recent;
DROP INDEX IF EXISTS idx_audit_logs_current_user;

-- その他の潜在的な危険インデックス削除
DROP INDEX IF EXISTS idx_works_recent_published;
DROP INDEX IF EXISTS idx_purchases_recent;
DROP INDEX IF EXISTS idx_manufacturing_orders_recent;

-- =====================================
-- 3. 安全な代替インデックスを作成
-- =====================================

-- rate_limits - expires_at による安全なインデックス
CREATE INDEX IF NOT EXISTS idx_rate_limits_expires_at 
ON public.rate_limits(expires_at) 
WHERE expires_at IS NOT NULL;

-- rate_limits - ユーザーとアクションによる複合インデックス
CREATE INDEX IF NOT EXISTS idx_rate_limits_user_action 
ON public.rate_limits(user_id, action, created_at DESC);

-- audit_logs - 作成日時による効率的なインデックス
CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at 
ON public.audit_logs(created_at DESC);

-- audit_logs - テーブル名と操作による検索最適化
CREATE INDEX IF NOT EXISTS idx_audit_logs_table_operation 
ON public.audit_logs(table_name, operation, created_at DESC);

-- works - 公開作品の効率的な検索
CREATE INDEX IF NOT EXISTS idx_works_published_created 
ON public.works(created_at DESC) 
WHERE is_published = true;

-- purchases - 購入履歴の効率的な検索
CREATE INDEX IF NOT EXISTS idx_purchases_buyer_created 
ON public.purchases(buyer_user_id, created_at DESC);

-- manufacturing_orders - 注文状況による検索最適化
CREATE INDEX IF NOT EXISTS idx_manufacturing_orders_status_created 
ON public.manufacturing_orders(status, created_at DESC);

-- manufacturing_orders - パートナーによる注文検索
CREATE INDEX IF NOT EXISTS idx_manufacturing_orders_partner_status 
ON public.manufacturing_orders(partner_id, status, created_at DESC);

-- =====================================
-- 4. インデックス最適化確認
-- =====================================

-- 作成されたインデックスの確認
SELECT 
  schemaname,
  tablename,
  indexname,
  indexdef
FROM pg_indexes 
WHERE schemaname = 'public' 
  AND tablename IN ('rate_limits', 'audit_logs', 'works', 'purchases', 'manufacturing_orders')
ORDER BY tablename, indexname;

-- =====================================
-- 5. パフォーマンス監視用ビュー
-- =====================================

-- インデックス使用状況監視ビュー
CREATE OR REPLACE VIEW public.index_usage_stats AS
SELECT 
  schemaname,
  tablename,
  indexname,
  idx_tup_read,
  idx_tup_fetch,
  idx_scan,
  CASE 
    WHEN idx_scan = 0 THEN 'UNUSED'
    WHEN idx_scan < 100 THEN 'LOW_USAGE'
    WHEN idx_scan < 1000 THEN 'MODERATE_USAGE'
    ELSE 'HIGH_USAGE'
  END as usage_level
FROM pg_stat_user_indexes 
WHERE schemaname = 'public'
ORDER BY idx_scan DESC;

-- テーブルサイズとインデックスサイズ監視
CREATE OR REPLACE VIEW public.table_index_sizes AS
SELECT 
  schemaname,
  tablename,
  pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) as total_size,
  pg_size_pretty(pg_relation_size(schemaname||'.'||tablename)) as table_size,
  pg_size_pretty(pg_indexes_size(schemaname||'.'||tablename)) as indexes_size
FROM pg_tables 
WHERE schemaname = 'public'
ORDER BY pg_total_relation_size(schemaname||'.'||tablename) DESC;

-- =====================================
-- 確認・完了メッセージ
-- =====================================

SELECT 
  'Index Cleanup Completed' as status,
  now() as completed_at,
  'Dangerous partial indexes removed, safe alternatives created' as details;