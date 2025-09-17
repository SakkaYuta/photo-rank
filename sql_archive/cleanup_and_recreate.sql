-- 完全クリーンアップ後の再作成
-- 既存のセキュリティ関連オブジェクトを削除してから再作成

-- 1. 既存のインデックス削除
DROP INDEX IF EXISTS public.idx_rate_limits_user_action;
DROP INDEX IF EXISTS public.idx_rate_limits_cleanup;
DROP INDEX IF EXISTS public.idx_rate_limits_expires_at;
DROP INDEX IF EXISTS public.idx_rate_limits_unique_window;

-- 2. 既存のテーブル削除（データが存在する場合は注意）
DROP TABLE IF EXISTS public.rate_limits CASCADE;

-- 3. 関数削除
DROP FUNCTION IF EXISTS public.check_rate_limit CASCADE;
DROP FUNCTION IF EXISTS public.cleanup_expired_rate_limits CASCADE;

-- 4. 新しいテーブル作成（CURRENT_TIMESTAMPを使用）
CREATE TABLE public.rate_limits (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  action_type text NOT NULL,
  request_count integer DEFAULT 1,
  window_start timestamptz DEFAULT CURRENT_TIMESTAMP,
  expires_at timestamptz DEFAULT (CURRENT_TIMESTAMP + interval '1 hour'),
  created_at timestamptz DEFAULT CURRENT_TIMESTAMP,
  updated_at timestamptz DEFAULT CURRENT_TIMESTAMP
);

-- 5. シンプルなインデックス作成
CREATE INDEX idx_rate_limits_expires_at ON public.rate_limits(expires_at);
CREATE UNIQUE INDEX idx_rate_limits_unique_window ON public.rate_limits(user_id, action_type, window_start);

-- 6. 関数作成（明示的にVOLATILE指定）
CREATE OR REPLACE FUNCTION public.check_rate_limit(
  p_user_id uuid,
  p_action text,
  p_limit integer,
  p_window_minutes integer DEFAULT 60
) RETURNS boolean 
LANGUAGE plpgsql
VOLATILE
AS $$
DECLARE
  v_window_start timestamptz;
  v_current_count integer;
  v_limit_reached boolean := false;
BEGIN
  v_window_start := date_trunc('hour', CURRENT_TIMESTAMP) + 
    (EXTRACT(minute FROM CURRENT_TIMESTAMP)::integer / p_window_minutes) * 
    (p_window_minutes || ' minutes')::interval;
  
  SELECT COALESCE(request_count, 0) INTO v_current_count
  FROM public.rate_limits
  WHERE user_id = p_user_id 
    AND action_type = p_action
    AND window_start = v_window_start;
  
  IF v_current_count >= p_limit THEN
    v_limit_reached := true;
  ELSE
    INSERT INTO public.rate_limits (
      user_id, action_type, request_count, window_start, expires_at
    ) VALUES (
      p_user_id, p_action, 1, v_window_start, v_window_start + interval '1 hour'
    ) ON CONFLICT (user_id, action_type, window_start) DO UPDATE SET
      request_count = rate_limits.request_count + 1,
      updated_at = CURRENT_TIMESTAMP;
  END IF;
  
  RETURN NOT v_limit_reached;
END;
$$;

-- 7. RLS有効化
ALTER TABLE public.rate_limits ENABLE ROW LEVEL SECURITY;

-- 8. ポリシー作成
CREATE POLICY rate_limits_policy ON public.rate_limits
  FOR SELECT USING (
    user_id = auth.uid() OR 
    EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'admin')
  );