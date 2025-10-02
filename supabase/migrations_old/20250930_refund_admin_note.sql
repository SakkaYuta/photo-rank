-- Add admin_note and ensure updated_at maintained on refund_requests
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='refund_requests' AND column_name='admin_note'
  ) THEN
    ALTER TABLE public.refund_requests ADD COLUMN admin_note text;
  END IF;
END $$;

-- Optional: update trigger for updated_at (create if missing)
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS trigger AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS set_refund_requests_updated_at ON public.refund_requests;
CREATE TRIGGER set_refund_requests_updated_at
BEFORE UPDATE ON public.refund_requests
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

