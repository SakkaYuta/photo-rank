-- User payout and identity tables with RLS

create table if not exists public.user_bank_accounts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  bank_name text not null,
  branch_code text not null,
  account_number text not null,
  account_type text not null check (account_type in ('普通','当座')),
  account_holder_kana text not null,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists public.user_identities (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  last_name text not null,
  first_name text not null,
  last_name_kana text not null,
  first_name_kana text not null,
  birthday date not null,
  postal_code text,
  prefecture text,
  city text,
  address1 text,
  address2 text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists public.user_account_extra (
  user_id uuid primary key references auth.users(id) on delete cascade,
  gender text,
  birthday date,
  reasons jsonb,
  updated_at timestamptz default now()
);

-- updated_at triggers
create or replace function public.set_updated_at()
returns trigger as $$ begin new.updated_at = now(); return new; end; $$ language plpgsql;

drop trigger if exists trg_uba_updated on public.user_bank_accounts;
create trigger trg_uba_updated before update on public.user_bank_accounts for each row execute function public.set_updated_at();

drop trigger if exists trg_uid_updated on public.user_identities;
create trigger trg_uid_updated before update on public.user_identities for each row execute function public.set_updated_at();

-- RLS
alter table public.user_bank_accounts enable row level security;
alter table public.user_identities enable row level security;
alter table public.user_account_extra enable row level security;

drop policy if exists uba_owner_all on public.user_bank_accounts;
create policy uba_owner_all on public.user_bank_accounts for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists uid_owner_all on public.user_identities;
create policy uid_owner_all on public.user_identities for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists uae_owner_all on public.user_account_extra;
create policy uae_owner_all on public.user_account_extra for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- indexes
create index if not exists idx_uba_user on public.user_bank_accounts(user_id);
create index if not exists idx_uid_user on public.user_identities(user_id);

