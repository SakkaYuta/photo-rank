-- レート制限テーブル存在確認
-- 実行: Supabase Studio SQL Editor または psql

-- 1. テーブル存在確認
SELECT
  table_name,
  table_type
FROM information_schema.tables
WHERE table_schema = 'public'
  AND table_name IN ('rate_limit_logs', 'upload_attempts', 'rate_limits')
ORDER BY table_name;

-- 期待される結果:
-- rate_limit_logs (v6)
-- upload_attempts (v6)
-- rate_limits (v5 - 削除推奨)

-- 2. rate_limit_logs スキーマ確認
SELECT
  column_name,
  data_type,
  is_nullable,
  column_default
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'rate_limit_logs'
ORDER BY ordinal_position;

-- 3. upload_attempts スキーマ確認
SELECT
  column_name,
  data_type,
  is_nullable,
  column_default
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'upload_attempts'
ORDER BY ordinal_position;

-- 4. RLS ポリシー確認
SELECT
  schemaname,
  tablename,
  policyname,
  permissive,
  roles,
  cmd,
  qual,
  with_check
FROM pg_policies
WHERE tablename IN ('rate_limit_logs', 'upload_attempts')
ORDER BY tablename, policyname;

-- 5. 実装形状の自動判定（v6 / v5 / 未導入）
WITH rl AS (
  SELECT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='rate_limit_logs' AND column_name='occurred_at'
  ) AS has_v6
), rl_v5 AS (
  SELECT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='rate_limits' AND column_name IN ('request_count','window_start')
  ) AS has_v5
)
SELECT
  CASE 
    WHEN (SELECT has_v6 FROM rl) THEN 'v6_event_rows'
    WHEN (SELECT has_v5 FROM rl_v5) THEN 'v5_aggregate_rows'
    ELSE 'missing'
  END AS rate_limit_shape;

-- 6. 直近1分のリクエスト数（キー毎）: v6 形状
--    v6 が存在しない場合は結果 0 行
SELECT key,
       COUNT(*) AS recent_requests
FROM public.rate_limit_logs
WHERE occurred_at >= now() - interval '1 minute'
GROUP BY key
ORDER BY recent_requests DESC
LIMIT 20;

-- 7. 直近1分のアップロード試行数（ユーザー毎）
SELECT user_id,
       COUNT(*) AS recent_attempts
FROM public.upload_attempts
WHERE created_at >= now() - interval '1 minute'
GROUP BY user_id
ORDER BY recent_attempts DESC
LIMIT 20;
