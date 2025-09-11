-- v0.6: pg_cron schedule for cleanup

CREATE EXTENSION IF NOT EXISTS pg_cron;

-- Run cleanup every 5 minutes
SELECT cron.schedule(
  'cleanup-expired-locks',
  '*/5 * * * *',
  $$SELECT cleanup_expired_locks()$$
);

-- Convenience view of scheduled jobs
CREATE OR REPLACE VIEW public.scheduled_jobs AS
SELECT jobid, jobname, schedule, active, command
FROM cron.job
ORDER BY jobid;

