-- ============================================================================
-- manufacturing_orders 集計クエリ修正
-- ============================================================================
-- 問題: updated_at カラムが存在しない環境で平均処理時間計算がエラー
-- 対応: COALESCE で代替カラムを使用

-- ============================================================================
-- 修正前（エラー発生）
-- ============================================================================
-- SELECT
--   AVG(EXTRACT(EPOCH FROM (updated_at - created_at))/3600) AS avg_processing_hours
-- FROM manufacturing_orders;

-- ============================================================================
-- 修正後（安全）
-- ============================================================================

-- 平均処理時間（時間）
-- updated_at が存在しない場合、shipped_at, assigned_at, または現在時刻を使用
SELECT
  COUNT(*) AS total_orders,
  AVG(
    EXTRACT(EPOCH FROM (
      COALESCE(updated_at, shipped_at, assigned_at, now()) - created_at
    )) / 3600
  ) AS avg_processing_hours,
  MIN(
    EXTRACT(EPOCH FROM (
      COALESCE(updated_at, shipped_at, assigned_at, now()) - created_at
    )) / 3600
  ) AS min_processing_hours,
  MAX(
    EXTRACT(EPOCH FROM (
      COALESCE(updated_at, shipped_at, assigned_at, now()) - created_at
    )) / 3600
  ) AS max_processing_hours
FROM manufacturing_orders
WHERE created_at IS NOT NULL;

-- ============================================================================
-- manufacturing_orders スキーマ確認
-- ============================================================================

SELECT
  column_name,
  data_type,
  is_nullable,
  column_default
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'manufacturing_orders'
ORDER BY ordinal_position;

-- ============================================================================
-- ステータス別集計
-- ============================================================================

SELECT
  status,
  COUNT(*) AS order_count,
  AVG(
    EXTRACT(EPOCH FROM (
      COALESCE(updated_at, shipped_at, assigned_at, now()) - created_at
    )) / 3600
  ) AS avg_hours
FROM manufacturing_orders
WHERE created_at IS NOT NULL
GROUP BY status
ORDER BY status;

-- ============================================================================
-- v6 互換性: fulfillments テーブルとの比較
-- ============================================================================

-- v6 では manufacturing_orders は fulfillments に統合
-- 既存の manufacturing_orders データを確認
SELECT
  'manufacturing_orders' AS table_name,
  COUNT(*) AS record_count
FROM manufacturing_orders

UNION ALL

SELECT
  'fulfillments' AS table_name,
  COUNT(*) AS record_count
FROM fulfillments;

-- ============================================================================
-- マイグレーション推奨: manufacturing_orders → fulfillments
-- ============================================================================

-- v6 では fulfillments が生産・配送を統合管理
-- manufacturing_orders が存在する場合、データ移行を検討

COMMENT ON TABLE manufacturing_orders IS '
レガシーテーブル: v6 では fulfillments に統合
集計クエリは updated_at 存在を想定せず、
COALESCE(updated_at, shipped_at, assigned_at, now()) を使用
';
