-- Organizer leave requests table (organizer initiates creator removal)
CREATE TABLE IF NOT EXISTS public.organizer_leave_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organizer_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  creator_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  reason text,
  effective_date date,
  status text DEFAULT 'pending' CHECK (status IN ('pending','approved','rejected','cancelled')),
  created_at timestamptz DEFAULT now()
);

ALTER TABLE public.organizer_leave_requests ENABLE ROW LEVEL SECURITY;

-- Organizer can insert/select own requests
DROP POLICY IF EXISTS olr_organizer_rw ON public.organizer_leave_requests;
CREATE POLICY olr_organizer_rw ON public.organizer_leave_requests
  FOR ALL USING (organizer_id = auth.uid()) WITH CHECK (organizer_id = auth.uid());

-- Admin can manage
DROP POLICY IF EXISTS olr_admin_all ON public.organizer_leave_requests;
CREATE POLICY olr_admin_all ON public.organizer_leave_requests
  FOR ALL USING ((current_setting('request.jwt.claims', true)::jsonb ->> 'role') = 'service_role');

COMMENT ON TABLE public.organizer_leave_requests IS 'Organizer-initiated requests to remove a creator; default effective at month-end.';

