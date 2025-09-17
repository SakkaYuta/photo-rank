-- ステップ4: 関数作成
CREATE OR REPLACE FUNCTION public.check_rate_limit_safe(
  p_user_id uuid,
  p_action text,
  p_limit integer
) RETURNS boolean 
LANGUAGE plpgsql
VOLATILE
AS $$
DECLARE
  v_current_hour integer;
  v_current_count integer := 0;
  v_stored_hour integer := 0;
BEGIN
  -- 現在の時間を数値化
  v_current_hour := EXTRACT(epoch FROM CURRENT_TIMESTAMP)::integer / 3600;
  
  -- 現在のレコード取得
  SELECT request_count, window_hour 
  INTO v_current_count, v_stored_hour
  FROM public.rate_limits
  WHERE user_id = p_user_id AND action_type = p_action;
  
  -- レコードが存在しないか、時間窓が違う場合はリセット
  IF v_stored_hour IS NULL OR v_stored_hour != v_current_hour THEN
    INSERT INTO public.rate_limits (
      user_id, action_type, request_count, window_hour, last_reset
    ) VALUES (
      p_user_id, p_action, 1, v_current_hour, CURRENT_TIMESTAMP
    ) ON CONFLICT (user_id, action_type) DO UPDATE SET
      request_count = 1,
      window_hour = v_current_hour,
      last_reset = CURRENT_TIMESTAMP;
    RETURN true;
  END IF;
  
  -- 制限チェック
  IF v_current_count >= p_limit THEN
    RETURN false;
  END IF;
  
  -- カウント増加
  UPDATE public.rate_limits
  SET request_count = request_count + 1
  WHERE user_id = p_user_id AND action_type = p_action;
  
  RETURN true;
END;
$$;