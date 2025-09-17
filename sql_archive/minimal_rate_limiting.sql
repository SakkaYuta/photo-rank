-- 最小限のrate limiting実装（IMMUTABLE問題回避）
CREATE TABLE IF NOT EXISTS public.simple_rate_limits (
  user_id uuid NOT NULL,
  action_type text NOT NULL,
  request_count integer DEFAULT 1,
  reset_time timestamptz DEFAULT (CURRENT_TIMESTAMP + interval '1 hour'),
  PRIMARY KEY (user_id, action_type)
);

-- シンプルなrate limit関数（時間計算を外部で行う）
CREATE OR REPLACE FUNCTION public.simple_rate_check(
  p_user_id uuid,
  p_action text,
  p_limit integer
) RETURNS boolean 
LANGUAGE plpgsql
VOLATILE
AS $$
DECLARE
  v_current_count integer := 0;
  v_reset_time timestamptz;
BEGIN
  -- 現在のカウントと期限を取得
  SELECT request_count, reset_time 
  INTO v_current_count, v_reset_time
  FROM public.simple_rate_limits
  WHERE user_id = p_user_id AND action_type = p_action;
  
  -- レコードが存在しないか期限切れの場合
  IF v_reset_time IS NULL OR v_reset_time < CURRENT_TIMESTAMP THEN
    INSERT INTO public.simple_rate_limits (user_id, action_type, request_count, reset_time)
    VALUES (p_user_id, p_action, 1, CURRENT_TIMESTAMP + interval '1 hour')
    ON CONFLICT (user_id, action_type) DO UPDATE SET
      request_count = 1,
      reset_time = CURRENT_TIMESTAMP + interval '1 hour';
    RETURN true;
  END IF;
  
  -- 制限チェック
  IF v_current_count >= p_limit THEN
    RETURN false;
  END IF;
  
  -- カウント増加
  UPDATE public.simple_rate_limits
  SET request_count = request_count + 1
  WHERE user_id = p_user_id AND action_type = p_action;
  
  RETURN true;
END;
$$;