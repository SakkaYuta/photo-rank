-- v0.6: cleanup expired locks function

CREATE OR REPLACE FUNCTION cleanup_expired_locks()
RETURNS integer AS $$
DECLARE
  v_released_count integer;
BEGIN
  WITH released AS (
    UPDATE public.work_availability
    SET locked_until = NULL,
        updated_at = NOW()
    WHERE locked_until < NOW()
      AND locked_until IS NOT NULL
    RETURNING work_id
  )
  SELECT COUNT(*) INTO v_released_count FROM released;

  IF v_released_count > 0 THEN
    INSERT INTO public.audit_logs (action, table_name, new_data, created_at)
    VALUES (
      'CLEANUP_EXPIRED_LOCKS',
      'work_availability',
      jsonb_build_object('released_count', v_released_count),
      NOW()
    );
  END IF;

  RETURN v_released_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION cleanup_expired_locks() TO service_role;

