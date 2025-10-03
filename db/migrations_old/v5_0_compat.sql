-- Archived copy of v5.0 compatibility (truncated)

CREATE TABLE IF NOT EXISTS public.organizers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.publishing_approvals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  work_id uuid REFERENCES public.works(id) NOT NULL,
  organizer_id uuid REFERENCES public.organizers(id) NOT NULL,
  status text DEFAULT 'pending'
);

CREATE TABLE IF NOT EXISTS public.sales (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  work_id uuid REFERENCES public.works(id) NOT NULL,
  creator_id uuid REFERENCES public.users(id) NOT NULL,
  organizer_id uuid,
  amount integer NOT NULL,
  platform_fee integer NOT NULL,
  net_amount integer NOT NULL,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.payouts_v31 (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  recipient_type text CHECK (recipient_type IN ('creator','organizer')) NOT NULL,
  recipient_id uuid NOT NULL
);

INSERT INTO public.schema_migrations(version, checksum)
VALUES ('v5.0_compat', 'local')
ON CONFLICT (version) DO NOTHING;

