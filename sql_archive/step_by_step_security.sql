-- ステップ1: 既存テーブル削除とクリーンアップ
DROP TABLE IF EXISTS public.rate_limits CASCADE;
DROP FUNCTION IF EXISTS public.check_rate_limit CASCADE;
DROP FUNCTION IF EXISTS public.check_rate_limit_safe CASCADE;