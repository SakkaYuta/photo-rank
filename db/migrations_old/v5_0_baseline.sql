-- Archived copy of v5.0 baseline bootstrap

CREATE SCHEMA IF NOT EXISTS public;
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

CREATE TABLE IF NOT EXISTS public.schema_migrations (
  version text PRIMARY KEY,
  executed_at timestamptz DEFAULT now(),
  checksum text
);

CREATE TABLE IF NOT EXISTS public.users (
  id uuid PRIMARY KEY,
  display_name text,
  avatar_url text,
  role text DEFAULT 'user',
  organizer_id uuid,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

INSERT INTO public.users (id, display_name, avatar_url)
SELECT au.id,
       COALESCE(au.raw_user_meta_data->>'full_name','User'),
       au.raw_user_meta_data->>'avatar_url'
FROM auth.users au
WHERE NOT EXISTS (SELECT 1 FROM public.users pu WHERE pu.id = au.id);

CREATE TABLE IF NOT EXISTS public.works (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  creator_id uuid REFERENCES public.users(id) NOT NULL,
  organizer_id uuid,
  title text,
  image_url text,
  price integer DEFAULT 0,
  is_published boolean DEFAULT false,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.purchases (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES public.users(id) NOT NULL,
  work_id uuid REFERENCES public.works(id) NOT NULL,
  price integer NOT NULL,
  status text DEFAULT 'paid',
  purchased_at timestamptz DEFAULT now()
);

INSERT INTO public.schema_migrations(version, checksum)
VALUES ('v5.0_baseline', 'local')
ON CONFLICT (version) DO NOTHING;

