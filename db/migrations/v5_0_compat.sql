-- v5.0 compatibility bootstrap for missing v3.1 artifacts
-- Ensures tables required by RLS/payouts exist even if v3.1 migration was not applied

-- organizers (minimal)
CREATE TABLE IF NOT EXISTS public.organizers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  company_type text,
  tax_id text,
  representative_name text,
  contact_email text,
  approval_mode text DEFAULT 'manual',
  status text DEFAULT 'active',
  created_at timestamptz DEFAULT now()
);

-- publishing approvals (minimal)
CREATE TABLE IF NOT EXISTS public.publishing_approvals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  work_id uuid REFERENCES public.works(id) NOT NULL,
  organizer_id uuid REFERENCES public.organizers(id) NOT NULL,
  reviewer_id uuid REFERENCES public.users(id),
  status text DEFAULT 'pending' CHECK (status IN ('pending','approved','rejected')),
  rejection_reason text,
  reviewed_at timestamptz,
  requested_at timestamptz DEFAULT now(),
  created_at timestamptz DEFAULT now()
);

-- sales aggregation (minimal)
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
CREATE INDEX IF NOT EXISTS idx_sales_created ON public.sales(created_at);

-- payouts v31 (used by v5.0 payouts function)
CREATE TABLE IF NOT EXISTS public.payouts_v31 (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  recipient_type text CHECK (recipient_type IN ('creator','organizer')) NOT NULL,
  recipient_id uuid NOT NULL,
  period_start date NOT NULL,
  period_end date NOT NULL,
  gross_amount integer NOT NULL,
  platform_fee integer NOT NULL,
  net_amount integer NOT NULL,
  bank_transfer_fee integer DEFAULT 250,
  final_payout integer NOT NULL,
  status text DEFAULT 'scheduled',
  scheduled_date date NOT NULL,
  transaction_id text,
  notes text,
  paid_at timestamptz,
  created_at timestamptz DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_payouts_v31_sched ON public.payouts_v31(scheduled_date, status);

-- mark migration
INSERT INTO public.schema_migrations(version, checksum)
VALUES ('v5.0_compat', 'local')
ON CONFLICT (version) DO NOTHING;

