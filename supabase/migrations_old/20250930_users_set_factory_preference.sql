-- RPC to safely update users.metadata.factory_preferences for current user
-- Invoker security relies on existing RLS (self-update only)

CREATE OR REPLACE FUNCTION public.set_factory_preference(p_category text, p_partner_id text)
RETURNS void
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = pg_catalog, public
AS $$
DECLARE
  uid uuid := auth.uid();
  current jsonb;
  next jsonb;
BEGIN
  IF uid IS NULL THEN
    RAISE EXCEPTION 'unauthorized';
  END IF;

  SELECT metadata INTO current FROM public.users WHERE id = uid;
  IF current IS NULL THEN current := '{}'::jsonb; END IF;

  next := jsonb_set(current, ARRAY['factory_preferences', p_category], to_jsonb(p_partner_id::text), true);

  UPDATE public.users SET metadata = next, updated_at = now() WHERE id = uid;
END;
$$;

GRANT EXECUTE ON FUNCTION public.set_factory_preference(text, text) TO authenticated;

