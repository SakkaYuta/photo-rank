-- Explicitly set search_path for SECURITY DEFINER functions (idempotent)

-- complete_purchase_transaction(text, uuid, uuid, integer, text, uuid)
DO $$ BEGIN
  BEGIN
    ALTER FUNCTION public.complete_purchase_transaction(text, uuid, uuid, integer, text, uuid)
      SET search_path TO public, pg_temp;
  EXCEPTION WHEN undefined_function THEN
    -- function not present; skip
    NULL;
  END;
END $$;

-- restore_work_availability(uuid, integer)
DO $$ BEGIN
  BEGIN
    ALTER FUNCTION public.restore_work_availability(uuid, integer)
      SET search_path TO public, pg_temp;
  EXCEPTION WHEN undefined_function THEN
    -- function not present; skip
    NULL;
  END;
END $$;

-- (Optional) normalize others if needed
DO $$ BEGIN
  BEGIN
    ALTER FUNCTION public.is_admin_strict(uuid)
      SET search_path TO public, pg_temp;
  EXCEPTION WHEN undefined_function THEN NULL; END;
  BEGIN
    ALTER FUNCTION public.is_moderator_or_admin(uuid)
      SET search_path TO public, pg_temp;
  EXCEPTION WHEN undefined_function THEN NULL; END;
  BEGIN
    ALTER FUNCTION public.audit_trigger()
      SET search_path TO public, pg_temp;
  EXCEPTION WHEN undefined_function THEN NULL; END;
END $$;

