-- In-app user notifications for battle flows
CREATE TABLE IF NOT EXISTS public.user_notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  type text NOT NULL, -- e.g. battle_request | battle_accepted | battle_declined | battle_started
  title text,
  message text,
  data jsonb DEFAULT '{}'::jsonb,
  read boolean DEFAULT false,
  read_at timestamptz,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_user_notifications_user ON public.user_notifications(user_id, read, created_at DESC);

ALTER TABLE public.user_notifications ENABLE ROW LEVEL SECURITY;

-- Policies: users can select and update (mark as read) their own notifications
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='user_notifications' AND policyname='select_own_user_notifications'
  ) THEN
    CREATE POLICY select_own_user_notifications ON public.user_notifications
      FOR SELECT TO authenticated
      USING (auth.uid() = user_id);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='user_notifications' AND policyname='update_own_user_notifications'
  ) THEN
    CREATE POLICY update_own_user_notifications ON public.user_notifications
      FOR UPDATE TO authenticated
      USING (auth.uid() = user_id)
      WITH CHECK (auth.uid() = user_id);
  END IF;
END $$;

-- Service role inserts (edge functions)
GRANT INSERT ON public.user_notifications TO service_role;

