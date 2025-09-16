-- v5.0 security migration: rate limiting, audit logging, and security enhancements
-- Addresses high-priority security vulnerabilities in the marketplace system

-- ============================================================================
-- Rate Limiting System
-- ============================================================================

-- Rate limits table for tracking API usage per user/action
CREATE TABLE IF NOT EXISTS public.rate_limits (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES public.users(id) NOT NULL,
  action_type text NOT NULL,
  request_count integer DEFAULT 1,
  window_start timestamptz DEFAULT now(),
  expires_at timestamptz DEFAULT (now() + interval '1 hour'),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Indexes for efficient rate limit lookups
-- Drop legacy/unsafe indexes if they exist
DROP INDEX IF EXISTS idx_rate_limits_user_action; -- redundant with UNIQUE index below
DROP INDEX IF EXISTS idx_rate_limits_cleanup;     -- contained now() in predicate

-- Safe index for expiration-based cleanup/queries
CREATE INDEX IF NOT EXISTS idx_rate_limits_expires_at 
ON public.rate_limits(expires_at);

-- Rate limit check function
CREATE OR REPLACE FUNCTION public.check_rate_limit(
  p_user_id uuid,
  p_action text,
  p_limit integer,
  p_window_minutes integer DEFAULT 60
) RETURNS boolean 
LANGUAGE plpgsql
VOLATILE  -- Explicitly mark as VOLATILE since it uses timestamps
AS $$
DECLARE
  v_window_start timestamptz;
  v_current_count integer;
  v_limit_reached boolean := false;
BEGIN
  -- Calculate window start time
  v_window_start := date_trunc('hour', CURRENT_TIMESTAMP) + 
    (EXTRACT(minute FROM CURRENT_TIMESTAMP)::integer / p_window_minutes) * 
    (p_window_minutes || ' minutes')::interval;
  
  -- Get current count for this window
  SELECT COALESCE(request_count, 0) INTO v_current_count
  FROM public.rate_limits
  WHERE user_id = p_user_id 
    AND action_type = p_action
    AND window_start = v_window_start;
  
  -- Check if limit exceeded
  IF v_current_count >= p_limit THEN
    v_limit_reached := true;
  ELSE
    -- Increment counter or create new record
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

-- Cleanup function for expired rate limit records
CREATE OR REPLACE FUNCTION public.cleanup_expired_rate_limits()
RETURNS void AS $$
BEGIN
  DELETE FROM public.rate_limits 
  WHERE expires_at < CURRENT_TIMESTAMP - interval '1 day';
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- Audit Logging System
-- ============================================================================

-- Enhanced audit logs table (extend existing if present)
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.tables 
    WHERE table_schema='public' AND table_name='audit_logs'
  ) THEN
    CREATE TABLE public.audit_logs (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id uuid REFERENCES public.users(id),
      action text NOT NULL,
      table_name text,
      record_id uuid,
      old_data jsonb,
      new_data jsonb,
      ip_address inet,
      user_agent text,
      created_at timestamptz DEFAULT now()
    );
  END IF;
  
  -- Add security-specific columns if missing
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema='public' AND table_name='audit_logs' AND column_name='severity'
  ) THEN
    ALTER TABLE public.audit_logs ADD COLUMN severity text DEFAULT 'info' 
    CHECK (severity IN ('debug','info','warning','error','critical'));
  END IF;
  
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema='public' AND table_name='audit_logs' AND column_name='risk_score'
  ) THEN
    ALTER TABLE public.audit_logs ADD COLUMN risk_score integer DEFAULT 0
    CHECK (risk_score BETWEEN 0 AND 10);
  END IF;
END $$;

-- Create audit log index
-- Use a regular index to avoid predicate function classification issues across environments
CREATE INDEX IF NOT EXISTS idx_audit_logs_security 
ON public.audit_logs(severity, risk_score, created_at);

-- Payout status change audit function
CREATE OR REPLACE FUNCTION public.audit_payout_changes()
RETURNS trigger AS $$
BEGIN
  -- Only log status changes and critical updates
  IF (TG_OP = 'UPDATE' AND (
    OLD.status IS DISTINCT FROM NEW.status OR
    OLD.final_payout IS DISTINCT FROM NEW.final_payout OR
    OLD.transaction_id IS DISTINCT FROM NEW.transaction_id
  )) THEN
    INSERT INTO public.audit_logs (
      user_id,
      action,
      table_name,
      record_id,
      old_data,
      new_data,
      severity,
      risk_score
    ) VALUES (
      COALESCE(auth.uid(), NULLIF(current_setting('request.jwt.claim.sub', true), '')::uuid),
      CASE 
        WHEN OLD.status IS DISTINCT FROM NEW.status THEN 'payout_status_change'
        WHEN OLD.final_payout IS DISTINCT FROM NEW.final_payout THEN 'payout_amount_change'
        WHEN OLD.transaction_id IS DISTINCT FROM NEW.transaction_id THEN 'payout_transaction_update'
        ELSE 'payout_update'
      END,
      'payouts_v31',
      NEW.id,
      jsonb_build_object(
        'status', OLD.status,
        'final_payout', OLD.final_payout,
        'transaction_id', OLD.transaction_id
      ),
      jsonb_build_object(
        'status', NEW.status,
        'final_payout', NEW.final_payout,
        'transaction_id', NEW.transaction_id
      ),
      CASE 
        WHEN NEW.status = 'completed' AND OLD.status = 'ready_for_transfer' THEN 'info'
        WHEN NEW.status = 'failed' THEN 'warning'
        WHEN OLD.final_payout IS DISTINCT FROM NEW.final_payout THEN 'error'
        ELSE 'info'
      END,
      CASE 
        WHEN OLD.final_payout IS DISTINCT FROM NEW.final_payout THEN 8
        WHEN NEW.status = 'failed' THEN 5
        WHEN NEW.status = 'completed' THEN 2
        ELSE 1
      END
    );
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create audit trigger for payouts_v31
DROP TRIGGER IF EXISTS audit_payouts_v31_changes ON public.payouts_v31;
CREATE TRIGGER audit_payouts_v31_changes
  AFTER UPDATE ON public.payouts_v31
  FOR EACH ROW EXECUTE FUNCTION public.audit_payout_changes();

-- ============================================================================
-- Security Enhancement Functions
-- ============================================================================

-- MIME type validation function
CREATE OR REPLACE FUNCTION public.validate_image_mime_type(
  p_content_type text,
  p_file_signature bytea
) RETURNS boolean AS $$
DECLARE
  v_allowed_types text[] := ARRAY['image/jpeg', 'image/png', 'image/webp'];
  v_signature_hex text;
BEGIN
  -- Check content type whitelist
  IF p_content_type IS NULL OR NOT (p_content_type = ANY(v_allowed_types)) THEN
    RETURN false;
  END IF;
  
  -- Check file signature (magic number)
  v_signature_hex := encode(p_file_signature, 'hex');
  
  RETURN CASE p_content_type
    WHEN 'image/jpeg' THEN v_signature_hex LIKE 'ffd8ff%'
    WHEN 'image/png' THEN v_signature_hex LIKE '89504e47%'
    WHEN 'image/webp' THEN v_signature_hex LIKE '52494646________57454250%'
    ELSE false
  END;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Admin privilege validation function (strict)
CREATE OR REPLACE FUNCTION public.is_admin_strict(p_user_id uuid)
RETURNS boolean AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.users 
    WHERE id = p_user_id AND role = 'admin'
  );
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER;

-- Input sanitization for XML/SVG content
CREATE OR REPLACE FUNCTION public.sanitize_xml_text(p_text text)
RETURNS text AS $$
BEGIN
  IF p_text IS NULL THEN
    RETURN '';
  END IF;
  
  RETURN replace(replace(replace(replace(replace(
    p_text,
    '&', '&amp;'),
    '<', '&lt;'),
    '>', '&gt;'),
    '"', '&quot;'),
    '''', '&apos;'
  );
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- ============================================================================
-- Rate Limiting Triggers and Constraints
-- ============================================================================

-- Unique index for rate limit windows (required by ON CONFLICT)
CREATE UNIQUE INDEX IF NOT EXISTS idx_rate_limits_unique_window
ON public.rate_limits(user_id, action_type, window_start);

-- ============================================================================
-- Security Monitoring Views
-- ============================================================================

-- Rate limit monitoring view
CREATE OR REPLACE VIEW public.security_rate_limit_stats AS
SELECT 
  action_type,
  COUNT(DISTINCT user_id) as unique_users,
  SUM(request_count) as total_requests,
  AVG(request_count) as avg_requests_per_user,
  MAX(request_count) as max_requests_per_user,
  COUNT(*) FILTER (WHERE request_count >= 50) as users_near_limit
FROM public.rate_limits
WHERE window_start >= CURRENT_TIMESTAMP - interval '24 hours'
GROUP BY action_type
ORDER BY total_requests DESC;

-- Audit log security dashboard
CREATE OR REPLACE VIEW public.security_audit_dashboard AS
SELECT 
  severity,
  COUNT(*) as event_count,
  COUNT(DISTINCT user_id) as unique_users,
  AVG(risk_score) as avg_risk_score,
  MAX(created_at) as last_event
FROM public.audit_logs
WHERE created_at >= CURRENT_TIMESTAMP - interval '24 hours'
GROUP BY severity
ORDER BY 
  CASE severity 
    WHEN 'critical' THEN 1
    WHEN 'error' THEN 2
    WHEN 'warning' THEN 3
    WHEN 'info' THEN 4
    WHEN 'debug' THEN 5
  END;

-- High-risk events view
CREATE OR REPLACE VIEW public.security_high_risk_events AS
SELECT 
  al.*,
  u.email as user_email,
  u.role as user_role
FROM public.audit_logs al
LEFT JOIN public.users u ON u.id = al.user_id
WHERE risk_score >= 7 OR severity IN ('error', 'critical')
ORDER BY created_at DESC, risk_score DESC
LIMIT 100;

-- ============================================================================
-- RLS Policies for Security Tables
-- ============================================================================

-- Enable RLS on security tables
ALTER TABLE public.rate_limits ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

-- Rate limits: users can see their own, admins see all
DROP POLICY IF EXISTS rate_limits_policy ON public.rate_limits;
CREATE POLICY rate_limits_policy ON public.rate_limits
  FOR SELECT USING (
    user_id = auth.uid() OR public.is_admin_strict(auth.uid())
  );

-- Audit logs: admin only for security reasons
DROP POLICY IF EXISTS audit_logs_admin_only ON public.audit_logs;
CREATE POLICY audit_logs_admin_only ON public.audit_logs
  FOR SELECT USING (public.is_admin_strict(auth.uid()));

-- ============================================================================
-- Cleanup Job Setup
-- ============================================================================

-- Set up automatic cleanup job if pg_cron is available
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
    -- Daily cleanup of expired rate limits
    PERFORM cron.schedule(
      'security-cleanup-rate-limits',
      '0 2 * * *', -- 2 AM daily
      'SELECT public.cleanup_expired_rate_limits();'
    );
    
    -- Weekly cleanup of old audit logs (keep 90 days)
    PERFORM cron.schedule(
      'security-cleanup-audit-logs',
      '0 3 * * 0', -- 3 AM on Sundays
      'DELETE FROM public.audit_logs WHERE created_at < CURRENT_TIMESTAMP - interval ''90 days'';'
    );
  END IF;
EXCEPTION WHEN OTHERS THEN
  -- pg_cron not available, cleanup jobs will need manual setup
  NULL;
END $$;

-- Mark migration as applied
INSERT INTO public.schema_migrations(version, checksum)
VALUES ('v5.0_security', 'local')
ON CONFLICT (version) DO NOTHING;
