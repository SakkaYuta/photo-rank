-- Idempotency keys table to prevent duplicate processing
CREATE TABLE IF NOT EXISTS public.idempotency_keys (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES public.users(id),
  key text NOT NULL,
  scope text NOT NULL,
  created_at timestamptz DEFAULT now(),
  expires_at timestamptz DEFAULT (now() + interval '24 hours')
);

CREATE UNIQUE INDEX IF NOT EXISTS uniq_idempotency_keys_key_scope
ON public.idempotency_keys(key, scope);

CREATE INDEX IF NOT EXISTS idx_idempotency_keys_expires
ON public.idempotency_keys(expires_at);

