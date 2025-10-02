-- Hotfix: ensure is_creator and user_type exist before backfilling

-- Some environments may not have users.is_creator yet when running the
-- user_types migration. Add required columns idempotently, then backfill.

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS is_creator boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS user_type text DEFAULT 'general'
    CHECK (user_type IN ('general','creator','factory','organizer'));

-- Backfill user_type safely using is_creator
UPDATE users
SET user_type = CASE WHEN is_creator = true THEN 'creator' ELSE 'general' END
WHERE user_type = 'general';

