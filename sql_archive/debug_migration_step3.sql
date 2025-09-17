-- Step 3: UNIQUE インデックス作成
CREATE UNIQUE INDEX IF NOT EXISTS idx_rate_limits_unique_window
ON public.rate_limits(user_id, action_type, window_start);