-- v5.0 security migration: simplified version to avoid IMMUTABLE function errors
-- Rate limits table for tracking API usage per user/action
CREATE TABLE IF NOT EXISTS public.rate_limits (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  action_type text NOT NULL,
  request_count integer DEFAULT 1,
  window_start timestamptz DEFAULT CURRENT_TIMESTAMP,
  expires_at timestamptz DEFAULT (CURRENT_TIMESTAMP + interval '1 hour'),
  created_at timestamptz DEFAULT CURRENT_TIMESTAMP,
  updated_at timestamptz DEFAULT CURRENT_TIMESTAMP
);

-- Simple indexes (no predicates to avoid IMMUTABLE issues)
CREATE INDEX IF NOT EXISTS idx_rate_limits_user_action 
ON public.rate_limits(user_id, action_type, window_start);

CREATE INDEX IF NOT EXISTS idx_rate_limits_expires_at 
ON public.rate_limits(expires_at);

-- Rate limit check function (explicitly VOLATILE)
CREATE OR REPLACE FUNCTION public.check_rate_limit_v2(
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

-- Add unique constraint for rate limiting windows
ALTER TABLE public.rate_limits 
ADD CONSTRAINT IF NOT EXISTS rate_limits_unique_window 
UNIQUE (user_id, action_type, window_start);

-- Enhance existing audit_logs table if it exists
DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables 
    WHERE table_schema='public' AND table_name='audit_logs'
  ) THEN
    -- Add security columns if missing
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
  ELSE
    -- Create audit_logs table if it doesn't exist
    CREATE TABLE public.audit_logs (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id uuid,
      action text NOT NULL,
      table_name text,
      record_id uuid,
      old_data jsonb,
      new_data jsonb,
      ip_address inet,
      user_agent text,
      severity text DEFAULT 'info' CHECK (severity IN ('debug','info','warning','error','critical')),
      risk_score integer DEFAULT 0 CHECK (risk_score BETWEEN 0 AND 10),
      created_at timestamptz DEFAULT CURRENT_TIMESTAMP
    );
  END IF;
END $$;

-- Simple audit log index (no predicates)
CREATE INDEX IF NOT EXISTS idx_audit_logs_security 
ON public.audit_logs(severity, risk_score, created_at);

-- Enable RLS
ALTER TABLE public.rate_limits ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

-- Security functions
CREATE OR REPLACE FUNCTION public.is_admin_strict_v2(p_user_id uuid)
RETURNS boolean 
LANGUAGE plpgsql
STABLE SECURITY DEFINER
AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.users 
    WHERE id = p_user_id AND role = 'admin'
  );
END;
$$;

-- RLS policies
DROP POLICY IF EXISTS rate_limits_policy ON public.rate_limits;
CREATE POLICY rate_limits_policy ON public.rate_limits
  FOR SELECT USING (
    user_id = auth.uid() OR public.is_admin_strict_v2(auth.uid())
  );

DROP POLICY IF EXISTS audit_logs_admin_only ON public.audit_logs;
CREATE POLICY audit_logs_admin_only ON public.audit_logs
  FOR SELECT USING (public.is_admin_strict_v2(auth.uid()));

-- Mark migration as applied
CREATE TABLE IF NOT EXISTS public.schema_migrations (
  version text PRIMARY KEY,
  executed_at timestamptz DEFAULT CURRENT_TIMESTAMP,
  checksum text
);

INSERT INTO public.schema_migrations(version, checksum)
VALUES ('v5.0_security', 'local')
ON CONFLICT (version) DO NOTHING;