-- Free cheer counters per user x battle with rolling window
CREATE TABLE IF NOT EXISTS public.cheer_free_counters (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  battle_id uuid NOT NULL REFERENCES public.battles(id) ON DELETE CASCADE,
  window_start timestamptz NOT NULL,
  window_minutes integer NOT NULL DEFAULT 60,
  used_count integer NOT NULL DEFAULT 0,
  reset_at timestamptz NOT NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS uniq_cheer_free_counters_user_battle_window
ON public.cheer_free_counters(user_id, battle_id, window_start);

CREATE INDEX IF NOT EXISTS idx_cheer_free_counters_reset
ON public.cheer_free_counters(reset_at);

CREATE OR REPLACE FUNCTION public.use_free_cheer(
  p_user_id uuid,
  p_battle_id uuid,
  p_limit integer DEFAULT 30,
  p_window_minutes integer DEFAULT 60
) RETURNS TABLE(allowed boolean, remaining integer, reset_at timestamptz)
LANGUAGE plpgsql
AS $$
DECLARE
  v_window_start timestamptz;
  v_reset_at timestamptz;
  v_used integer;
BEGIN
  IF p_limit <= 0 THEN
    RETURN QUERY SELECT false, 0, now() + (p_window_minutes || ' minutes')::interval;
    RETURN;
  END IF;

  v_window_start := date_trunc('minute', CURRENT_TIMESTAMP) - 
    (EXTRACT(minute FROM CURRENT_TIMESTAMP)::int % p_window_minutes) * interval '1 minute';
  v_reset_at := v_window_start + (p_window_minutes || ' minutes')::interval;

  LOOP
    -- Try insert a new window row
    BEGIN
      INSERT INTO public.cheer_free_counters(user_id, battle_id, window_start, window_minutes, used_count, reset_at)
      VALUES (p_user_id, p_battle_id, v_window_start, p_window_minutes, 1, v_reset_at);
      RETURN QUERY SELECT true, GREATEST(0, p_limit - 1), v_reset_at;
      RETURN;
    EXCEPTION WHEN unique_violation THEN
      -- Row exists; try to increment if below limit
      UPDATE public.cheer_free_counters
      SET used_count = used_count + 1,
          updated_at = CURRENT_TIMESTAMP
      WHERE user_id = p_user_id AND battle_id = p_battle_id AND window_start = v_window_start AND used_count < p_limit;
      IF FOUND THEN
        SELECT used_count INTO v_used FROM public.cheer_free_counters
        WHERE user_id = p_user_id AND battle_id = p_battle_id AND window_start = v_window_start;
        RETURN QUERY SELECT true, GREATEST(0, p_limit - v_used), v_reset_at;
        RETURN;
      ELSE
        -- Already at or over limit
        SELECT used_count INTO v_used FROM public.cheer_free_counters
        WHERE user_id = p_user_id AND battle_id = p_battle_id AND window_start = v_window_start;
        RETURN QUERY SELECT false, 0, v_reset_at;
        RETURN;
      END IF;
    END;
  END LOOP;
END;
$$;

