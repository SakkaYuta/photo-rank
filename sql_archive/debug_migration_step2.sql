-- Step 2: インデックス作成のみ
CREATE INDEX IF NOT EXISTS idx_rate_limits_expires_at 
ON public.rate_limits(expires_at);