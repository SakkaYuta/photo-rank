create table if not exists public.user_mfa (
  user_id uuid primary key references auth.users(id) on delete cascade,
  secret text not null,
  enabled boolean not null default false,
  updated_at timestamptz default now()
);

alter table public.user_mfa enable row level security;
drop policy if exists user_mfa_owner_all on public.user_mfa;
create policy user_mfa_owner_all on public.user_mfa for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

