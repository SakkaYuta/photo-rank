-- Cleanup migration: remove deprecated model-related keys from works.metadata
-- Keys: product_model_id, variants, product_specs, shipping_profile
-- Idempotent and safe: backs up affected rows before update.

DO $$
BEGIN
  -- 1) Backup table for safety (create if not exists)
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.tables 
    WHERE table_schema = 'public' AND table_name = 'works_metadata_backup'
  ) THEN
    CREATE TABLE public.works_metadata_backup (
      work_id uuid PRIMARY KEY,
      metadata jsonb NOT NULL,
      backed_up_at timestamptz NOT NULL DEFAULT now()
    );
  END IF;

  -- 2) Insert backup rows only for works that still have any deprecated keys
  INSERT INTO public.works_metadata_backup (work_id, metadata)
  SELECT w.id, w.metadata
  FROM public.works w
  LEFT JOIN public.works_metadata_backup b ON b.work_id = w.id
  WHERE b.work_id IS NULL
    AND jsonb_typeof(w.metadata) = 'object'
    AND (
      w.metadata ? 'product_model_id' OR
      w.metadata ? 'variants' OR
      w.metadata ? 'product_specs' OR
      w.metadata ? 'shipping_profile'
    );

  -- 3) Remove deprecated keys in-place
  UPDATE public.works
  SET metadata = ((metadata
    - 'product_model_id'
    - 'variants'
    - 'product_specs'
    - 'shipping_profile')::jsonb)
  WHERE jsonb_typeof(metadata) = 'object'
    AND (
      metadata ? 'product_model_id' OR
      metadata ? 'variants' OR
      metadata ? 'product_specs' OR
      metadata ? 'shipping_profile'
    );

  -- 4) Optional: Comment to document change
  COMMENT ON TABLE public.works_metadata_backup IS 'Backup of works.metadata before removing deprecated model-related keys (product_model_id, variants, product_specs, shipping_profile).';
END$$;

