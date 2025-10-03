-- Moved from root: registration applications + email outbox (optional)

CREATE TABLE IF NOT EXISTS public.registration_applications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid,
  type text NOT NULL CHECK (type IN ('manufacturing_partner','organizer')),
  applicant_name text,
  applicant_email text,
  payload jsonb NOT NULL,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','approved','denied')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.registration_applications IS 'Approval-based registration applications.';

-- Lightweight email outbox (optional; used by Edge Functions to enqueue emails)
CREATE TABLE IF NOT EXISTS public.email_outbox (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  to_email text NOT NULL,
  subject text NOT NULL,
  body_text text,
  body_html text,
  status text NOT NULL DEFAULT 'queued' CHECK (status IN ('queued','sent','failed','skipped')),
  error text,
  created_at timestamptz NOT NULL DEFAULT now(),
  sent_at timestamptz
);

ALTER TABLE public.registration_applications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.email_outbox ENABLE ROW LEVEL SECURITY;

-- Deny-all by default
DROP POLICY IF EXISTS registration_applications_deny_all ON public.registration_applications;
CREATE POLICY registration_applications_deny_all ON public.registration_applications FOR ALL TO PUBLIC USING (false) WITH CHECK (false);

DROP POLICY IF EXISTS email_outbox_deny_all ON public.email_outbox;
CREATE POLICY email_outbox_deny_all ON public.email_outbox FOR ALL TO PUBLIC USING (false) WITH CHECK (false);

-- Service role full access
DROP POLICY IF EXISTS registration_applications_service ON public.registration_applications;
CREATE POLICY registration_applications_service ON public.registration_applications FOR ALL TO service_role USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS email_outbox_service ON public.email_outbox;
CREATE POLICY email_outbox_service ON public.email_outbox FOR ALL TO service_role USING (true) WITH CHECK (true);

