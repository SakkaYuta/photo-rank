-- Helpful indexes for auto-finish
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes WHERE schemaname='public' AND indexname='idx_battles_status_start'
  ) THEN
    CREATE INDEX idx_battles_status_start ON public.battles(status, start_time);
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes WHERE schemaname='public' AND indexname='idx_cheer_tickets_battle'
  ) THEN
    CREATE INDEX idx_cheer_tickets_battle ON public.cheer_tickets(battle_id);
  END IF;
END $$;

