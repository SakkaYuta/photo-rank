-- Create upload_attempts table for rate limiting
CREATE TABLE IF NOT EXISTS upload_attempts (
  id BIGSERIAL PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  ip_address INET,
  user_agent TEXT
);

-- Index for efficient rate limit queries
CREATE INDEX IF NOT EXISTS idx_upload_attempts_user_time
ON upload_attempts(user_id, created_at DESC);

-- RLS policies
ALTER TABLE upload_attempts ENABLE ROW LEVEL SECURITY;

-- Only service role can manage upload attempts (Edge Functions use service role)
CREATE POLICY upload_attempts_service_only ON upload_attempts
FOR ALL USING (false);

-- Auto-cleanup old records (keep only last 24 hours)
-- This prevents the table from growing indefinitely
CREATE OR REPLACE FUNCTION cleanup_old_upload_attempts()
RETURNS void AS $$
BEGIN
  DELETE FROM upload_attempts
  WHERE created_at < NOW() - INTERVAL '24 hours';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Optional: Create a scheduled job to run cleanup (requires pg_cron extension)
-- SELECT cron.schedule('cleanup-upload-attempts', '0 * * * *', 'SELECT cleanup_old_upload_attempts();');