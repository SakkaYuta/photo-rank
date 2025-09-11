-- v0.6: monitoring views and refresh job

CREATE OR REPLACE VIEW public.realtime_metrics AS
SELECT
  (SELECT COUNT(*) FROM public.purchases WHERE purchased_at >= NOW() - INTERVAL '1 hour') AS hourly_purchases,
  (SELECT SUM(price) FROM public.purchases WHERE purchased_at >= NOW() - INTERVAL '1 hour') AS hourly_revenue,
  (SELECT COUNT(*) FROM public.work_availability WHERE locked_until > NOW()) AS active_locks,
  (SELECT COUNT(*) FROM public.work_availability WHERE locked_until < NOW() AND locked_until IS NOT NULL) AS expired_locks,
  (SELECT COUNT(*) FROM public.webhook_events WHERE created_at >= NOW() - INTERVAL '1 hour') AS hourly_webhooks;

CREATE MATERIALIZED VIEW IF NOT EXISTS public.daily_summary AS
SELECT 
  DATE(purchased_at) AS date,
  COUNT(*) AS total_purchases,
  SUM(price) AS total_revenue,
  COUNT(DISTINCT user_id) AS unique_buyers,
  AVG(price) AS avg_order_value
FROM public.purchases
WHERE status = 'paid'
GROUP BY DATE(purchased_at)
ORDER BY date DESC;

CREATE OR REPLACE FUNCTION public.refresh_daily_summary()
RETURNS void AS $$
BEGIN
  REFRESH MATERIALIZED VIEW CONCURRENTLY public.daily_summary;
END; $$ LANGUAGE plpgsql;

SELECT cron.schedule(
  'refresh-daily-summary',
  '0 2 * * *',
  $$SELECT public.refresh_daily_summary()$$
);

