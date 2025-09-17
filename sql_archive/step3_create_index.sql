-- ステップ3: インデックス作成
CREATE INDEX idx_rate_limits_reset ON public.rate_limits(last_reset);