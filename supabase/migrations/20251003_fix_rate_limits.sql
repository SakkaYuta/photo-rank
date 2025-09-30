-- Fix rate_limits table structure
begin;

-- Drop existing table if structure is incorrect
drop table if exists public.rate_limits cascade;

-- Create rate_limits table with correct structure
create table public.rate_limits (
  key text primary key,
  count integer not null default 0,
  window_started_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.rate_limits is 'Rate limit counters per arbitrary key (e.g., user:action)';

-- Create index
create index if not exists idx_rate_limits_updated_at on public.rate_limits(updated_at);

-- Grant permissions
grant select, insert, update, delete on public.rate_limits to anon, authenticated, service_role;

-- Function (SECURITY DEFINER)
create or replace function public.enforce_rate_limit(
  p_key text,
  p_limit integer,
  p_window_seconds integer,
  p_cost integer default 1
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_now timestamptz := now();
  v_allowed boolean := false;
  v_row public.rate_limits;
begin
  if p_limit is null or p_limit <= 0 then
    return true; -- unlimited
  end if;

  -- Lock row if present to avoid races
  perform 1 from public.rate_limits where key = p_key for update;

  select * into v_row from public.rate_limits where key = p_key;

  if v_row is null then
    insert into public.rate_limits(key, count, window_started_at, updated_at)
      values (p_key, p_cost, v_now, v_now);
    v_allowed := true;
  else
    if v_row.window_started_at + make_interval(secs := p_window_seconds) <= v_now then
      update public.rate_limits
        set count = p_cost,
            window_started_at = v_now,
            updated_at = v_now
        where key = p_key;
      v_allowed := true;
    else
      if v_row.count + p_cost <= p_limit then
        update public.rate_limits
          set count = v_row.count + p_cost,
              updated_at = v_now
          where key = p_key;
        v_allowed := true;
      else
        update public.rate_limits set updated_at = v_now where key = p_key;
        v_allowed := false;
      end if;
    end if;
  end if;

  return v_allowed;
end;
$$;

revoke all on function public.enforce_rate_limit(text, integer, integer, integer) from public;
grant execute on function public.enforce_rate_limit(text, integer, integer, integer) to anon, authenticated, service_role;

commit;
