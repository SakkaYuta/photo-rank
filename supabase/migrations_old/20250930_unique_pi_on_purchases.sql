-- Ensure idempotency on purchase completion by enforcing unique Stripe PI per purchase

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes WHERE schemaname='public' AND indexname='idx_purchases_pi_unique'
  ) THEN
    CREATE UNIQUE INDEX idx_purchases_pi_unique ON public.purchases(stripe_payment_intent_id);
  END IF;
END $$;

COMMENT ON INDEX public.idx_purchases_pi_unique IS 'Guarantees at most one purchase row per Stripe Payment Intent (NULLs allowed multiple times).';

