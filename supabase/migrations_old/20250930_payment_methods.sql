-- Extend purchases for konbini / bank transfer and refunds
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='purchases' AND column_name='payment_method'
  ) THEN
    ALTER TABLE public.purchases ADD COLUMN payment_method text;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='purchases' AND column_name='payment_status'
  ) THEN
    ALTER TABLE public.purchases ADD COLUMN payment_status text DEFAULT 'requires_payment'
      CHECK (payment_status IN ('requires_payment','processing','succeeded','canceled','failed','refunded'));
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='purchases' AND column_name='konbini_voucher_number'
  ) THEN
    ALTER TABLE public.purchases ADD COLUMN konbini_voucher_number text;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='purchases' AND column_name='konbini_store'
  ) THEN
    ALTER TABLE public.purchases ADD COLUMN konbini_store text;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='purchases' AND column_name='payment_due_at'
  ) THEN
    ALTER TABLE public.purchases ADD COLUMN payment_due_at timestamptz;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='purchases' AND column_name='payment_instructions'
  ) THEN
    ALTER TABLE public.purchases ADD COLUMN payment_instructions jsonb;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='purchases' AND column_name='refund_status'
  ) THEN
    ALTER TABLE public.purchases ADD COLUMN refund_status text CHECK (refund_status IN ('requested','processing','refunded','failed'));
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='purchases' AND column_name='refund_amount'
  ) THEN
    ALTER TABLE public.purchases ADD COLUMN refund_amount integer;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='purchases' AND column_name='refund_requested_at'
  ) THEN
    ALTER TABLE public.purchases ADD COLUMN refund_requested_at timestamptz;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='purchases' AND column_name='refund_processed_at'
  ) THEN
    ALTER TABLE public.purchases ADD COLUMN refund_processed_at timestamptz;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_purchases_payment_status ON public.purchases(payment_status);

-- Optional: refund requests tracking table (manual/offline fallback)
CREATE TABLE IF NOT EXISTS public.refund_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  purchase_id uuid NOT NULL REFERENCES public.purchases(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  amount integer NOT NULL,
  reason text,
  status text NOT NULL DEFAULT 'requested' CHECK (status IN ('requested','processing','refunded','rejected','failed')),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE public.refund_requests ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS refund_requests_owner_rw ON public.refund_requests;
CREATE POLICY refund_requests_owner_rw ON public.refund_requests
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_refund_requests_user ON public.refund_requests(user_id);
