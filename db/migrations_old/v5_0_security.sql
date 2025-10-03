-- Archived copy of v5.0 security migration (content preserved)
-- See original for full details; prefer v6 equivalents.

CREATE TABLE IF NOT EXISTS public.rate_limits (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid,
  action_type text NOT NULL,
  request_count integer DEFAULT 1,
  window_start timestamptz DEFAULT now(),
  expires_at timestamptz DEFAULT (now() + interval '1 hour'),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_rate_limits_expires_at ON public.rate_limits(expires_at);

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes 
    WHERE schemaname = 'public' AND indexname = 'uniq_rate_limits_user_action_window'
  ) THEN
    CREATE UNIQUE INDEX uniq_rate_limits_user_action_window
    ON public.rate_limits(user_id, action_type, window_start);
  END IF;
END $$;

CREATE OR REPLACE FUNCTION public.check_rate_limit(
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
  v_window_start := date_trunc('hour', CURRENT_TIMESTAMP) + 
    (EXTRACT(minute FROM CURRENT_TIMESTAMP)::integer / p_window_minutes) * 
    (p_window_minutes || ' minutes')::interval;
  SELECT COALESCE(request_count, 0) INTO v_current_count
  FROM public.rate_limits
  WHERE user_id = p_user_id 
    AND action_type = p_action
    AND window_start = v_window_start;
  IF v_current_count >= p_limit THEN
    v_limit_reached := true;
  ELSE
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

-- Other audit/rls/view parts omitted for brevity

INSERT INTO public.schema_migrations(version, checksum)
VALUES ('v5.0_security', 'local')
ON CONFLICT (version) DO NOTHING;

