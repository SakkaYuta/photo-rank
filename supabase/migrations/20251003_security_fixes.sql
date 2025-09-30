-- Security fixes for database linter warnings
begin;

-- 1. Enable RLS on rate_limits table
alter table public.rate_limits enable row level security;

-- Create RLS policies for rate_limits
create policy "Service role can manage rate limits"
  on public.rate_limits
  for all
  using ((auth.jwt() ->> 'role') = 'service_role')
  with check ((auth.jwt() ->> 'role') = 'service_role');

-- 2. Fix search_path for functions with mutable search_path
create or replace function public.set_updated_at()
returns trigger
language plpgsql
security definer
set search_path = public, pg_catalog
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create or replace function public.release_live_offer(
  p_live_offer_id uuid,
  p_user_id uuid
) returns boolean as $$
declare
  v_affected integer;
begin
  -- remove one reservation row (if any)
  delete from public.live_offer_reservations
   where id in (
     select id from public.live_offer_reservations
      where live_offer_id = p_live_offer_id and user_id = p_user_id
      order by created_at asc
      limit 1
   );

  -- decrease reserved but not below 0
  update public.live_offers
     set stock_reserved = greatest(stock_reserved - 1, 0),
         updated_at = now()
   where id = p_live_offer_id;
  get diagnostics v_affected = row_count;
  return v_affected > 0;
end;
$$ language plpgsql security definer set search_path = public, pg_catalog;

create or replace function public.reserve_live_offer(
  p_live_offer_id uuid,
  p_user_id uuid,
  p_ttl_seconds integer default 300
) returns boolean as $$
declare
  v_offer public.live_offers%rowtype;
  v_available integer;
  v_now timestamptz := now();
begin
  select * into v_offer from public.live_offers where id = p_live_offer_id for update;
  if not found then return false; end if;
  if v_offer.status <> 'published' or v_now < v_offer.start_at or v_now > v_offer.end_at then
    return false;
  end if;

  -- clean expired reservations for this offer + user
  delete from public.live_offer_reservations
   where live_offer_id = p_live_offer_id and user_id = p_user_id and expires_at <= v_now;

  -- enforce per-user limit roughly (count sold for this offer to user)
  if v_offer.per_user_limit is not null and v_offer.per_user_limit > 0 then
    if (
      (select count(*) from public.live_offer_reservations r where r.live_offer_id = p_live_offer_id and r.user_id = p_user_id and r.expires_at > v_now)
    ) >= v_offer.per_user_limit then
      return false;
    end if;
  end if;

  v_available := v_offer.stock_total - v_offer.stock_reserved - v_offer.stock_sold;
  if v_available < 1 then return false; end if;

  -- upsert reservation (extend TTL if exists)
  insert into public.live_offer_reservations(live_offer_id, user_id, expires_at)
  values (p_live_offer_id, p_user_id, v_now + make_interval(secs => greatest(p_ttl_seconds, 60)))
  on conflict (live_offer_id, user_id) do update
    set expires_at = excluded.expires_at;

  update public.live_offers
     set stock_reserved = stock_reserved + 1,
         updated_at = now()
   where id = p_live_offer_id;

  return true;
end;
$$ language plpgsql security definer set search_path = public, pg_catalog;

create or replace function public.finalize_live_offer_transaction(
  p_live_offer_id uuid,
  p_user_id uuid
) returns boolean as $$
declare
  v_offer public.live_offers%rowtype;
begin
  select * into v_offer from public.live_offers where id = p_live_offer_id for update;
  if not found then return false; end if;

  update public.live_offers
     set stock_reserved = greatest(stock_reserved - 1, 0),
         stock_sold = stock_sold + 1,
         updated_at = now()
   where id = p_live_offer_id;

  delete from public.live_offer_reservations
   where id in (
     select id from public.live_offer_reservations
      where live_offer_id = p_live_offer_id and user_id = p_user_id
      order by created_at asc
      limit 1
   );

  return true;
end;
$$ language plpgsql security definer set search_path = public, pg_catalog;

create or replace function public.decrement_reserved_safely(
  p_live_offer_id uuid
) returns void as $$
begin
  update public.live_offers
     set stock_reserved = greatest(stock_reserved - 1, 0),
         updated_at = now()
   where id = p_live_offer_id;
end;
$$ language plpgsql security definer set search_path = public, pg_catalog;

create or replace function public.complete_live_offer_purchase(
  p_live_offer_id uuid,
  p_user_id uuid,
  p_payment_intent_id text,
  p_amount integer,
  p_currency text
) returns boolean as $$
declare
  v_offer public.live_offers%rowtype;
begin
  select * into v_offer from public.live_offers where id = p_live_offer_id for update;
  if not found then return false; end if;

  -- finalize counts
  update public.live_offers
     set stock_reserved = greatest(stock_reserved - 1, 0),
         stock_sold = stock_sold + 1,
         updated_at = now()
   where id = p_live_offer_id;

  -- remove one reservation by this user if present (best-effort)
  delete from public.live_offer_reservations
   where id in (
     select id from public.live_offer_reservations
      where live_offer_id = p_live_offer_id and user_id = p_user_id
      order by created_at asc
      limit 1
   );

  return true;
end;
$$ language plpgsql security definer set search_path = public, pg_catalog;

commit;
