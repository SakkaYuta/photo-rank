-- Make core triggers idempotent to avoid 42710 (already exists)

-- Ensure helper function exists (safe to re-create)
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger on public.works only if missing
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_trigger t
    JOIN pg_class c ON c.oid = t.tgrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE t.tgname = 'update_works_updated_at'
      AND n.nspname = 'public'
      AND c.relname = 'works'
  ) THEN
    EXECUTE 'CREATE TRIGGER update_works_updated_at
      BEFORE UPDATE ON public.works
      FOR EACH ROW EXECUTE FUNCTION update_updated_at_column()';
  END IF;
END $$;

-- Create trigger on public.cart_items only if missing
DO $$ BEGIN
  IF to_regclass('public.cart_items') IS NOT NULL AND NOT EXISTS (
    SELECT 1
    FROM pg_trigger t
    JOIN pg_class c ON c.oid = t.tgrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE t.tgname = 'update_cart_items_updated_at'
      AND n.nspname = 'public'
      AND c.relname = 'cart_items'
  ) THEN
    EXECUTE 'CREATE TRIGGER update_cart_items_updated_at
      BEFORE UPDATE ON public.cart_items
      FOR EACH ROW EXECUTE FUNCTION update_updated_at_column()';
  END IF;
END $$;
