-- Archived copy of v3.1 differential migration (see history for original context)
-- (Content preserved from original file)

-- v3.1 differential migration (non-destructive)
-- Creates new org/sales/approvals/payouts_v31 tables and helper functions
-- Marks schema_migrations with version 'v3.1_differential_update'

-- Organizers (independent from users)
CREATE TABLE IF NOT EXISTS public.organizers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  company_type text,
  tax_id text,
  representative_name text NOT NULL,
  contact_email text NOT NULL,
  bank_account_id uuid REFERENCES public.payout_accounts(id),
  approval_mode text DEFAULT 'manual', -- 全商品承認必須
  status text DEFAULT 'active',
  created_at timestamptz DEFAULT now()
);

-- Publishing approvals for works (all items under organizer require approval)
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
CREATE INDEX IF NOT EXISTS idx_pub_approvals_pending ON public.publishing_approvals(status) WHERE status = 'pending';

-- Sales aggregation (platform fee 30%, net 70%)
CREATE TABLE IF NOT EXISTS public.sales (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  work_id uuid REFERENCES public.works(id) NOT NULL,
  creator_id uuid REFERENCES public.users(id) NOT NULL,
  organizer_id uuid REFERENCES public.organizers(id), -- nullable for individual creators
  amount integer NOT NULL,
  platform_fee integer NOT NULL,
  net_amount integer NOT NULL,
  created_at timestamptz DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_sales_created ON public.sales(created_at);
CREATE INDEX IF NOT EXISTS idx_sales_org ON public.sales(organizer_id) WHERE organizer_id IS NOT NULL;

-- Manufacturing orders log (for partner API integration)
CREATE TABLE IF NOT EXISTS public.manufacturing_orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id text NOT NULL,
  partner text NOT NULL,
  partner_order_id text,
  request_payload jsonb,
  response_payload jsonb,
  status text DEFAULT 'submitted',
  created_at timestamptz DEFAULT now()
);

-- v3.1 payouts (non-destructive: keep existing public.payouts intact)
CREATE TABLE IF NOT EXISTS public.payouts_v31 (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  recipient_type text CHECK (recipient_type IN ('creator','organizer')) NOT NULL,
  recipient_id uuid NOT NULL, -- users.id or organizers.id
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

-- Approve publishing RPC
CREATE OR REPLACE FUNCTION public.approve_publishing(
  p_work_id uuid,
  p_organizer_id uuid,
  p_approved boolean,
  p_reviewer_id uuid,
  p_reason text
) RETURNS void AS $$
BEGIN
  UPDATE public.publishing_approvals
    SET status = CASE WHEN p_approved THEN 'approved' ELSE 'rejected' END,
        rejection_reason = CASE WHEN p_approved THEN NULL ELSE p_reason END,
        reviewer_id = p_reviewer_id,
        reviewed_at = now()
  WHERE work_id = p_work_id AND organizer_id = p_organizer_id AND status = 'pending';

  IF p_approved THEN
    UPDATE public.works SET is_published = true WHERE id = p_work_id;
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Monthly payouts generator for v3.1 rules (30% fee, threshold on net, pay EOM+2 months)
CREATE OR REPLACE FUNCTION public.generate_monthly_payouts_v31()
RETURNS void AS $$
DECLARE
  v_period_start date;
  v_period_end date;
  v_payment_date date;
BEGIN
  v_period_start := date_trunc('month', CURRENT_DATE - interval '1 month');
  v_period_end := (date_trunc('month', CURRENT_DATE) - interval '1 day')::date;
  v_payment_date := (date_trunc('month', CURRENT_DATE + interval '2 month') - interval '1 day')::date;

  -- creators (no organizer)
  INSERT INTO public.payouts_v31 (recipient_type, recipient_id, period_start, period_end,
    gross_amount, platform_fee, net_amount, final_payout, scheduled_date)
  SELECT
    'creator', s.creator_id, v_period_start, v_period_end,
    SUM(s.amount), SUM(s.platform_fee), SUM(s.net_amount),
    CASE WHEN SUM(s.net_amount) >= 5000 THEN SUM(s.net_amount) - 250 ELSE 0 END,
    v_payment_date
  FROM public.sales s
  WHERE s.created_at >= v_period_start AND s.created_at <= v_period_end
    AND s.organizer_id IS NULL
  GROUP BY s.creator_id;

  -- organizers (collective payouts)
  INSERT INTO public.payouts_v31 (recipient_type, recipient_id, period_start, period_end,
    gross_amount, platform_fee, net_amount, final_payout, scheduled_date)
  SELECT
    'organizer', s.organizer_id, v_period_start, v_period_end,
    SUM(s.amount), SUM(s.platform_fee), SUM(s.net_amount),
    CASE WHEN SUM(s.net_amount) >= 5000 THEN SUM(s.net_amount) - 250 ELSE 0 END,
    v_payment_date
  FROM public.sales s
  WHERE s.created_at >= v_period_start AND s.created_at <= v_period_end
    AND s.organizer_id IS NOT NULL
  GROUP BY s.organizer_id;
END;
$$ LANGUAGE plpgsql;

-- mark migration
INSERT INTO public.schema_migrations(version, checksum)
VALUES ('v3.1_differential_update', 'local')
ON CONFLICT (version) DO NOTHING;

