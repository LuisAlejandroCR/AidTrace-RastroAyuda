-- AidTrace browser relay idempotency and rate limiting.
-- Run this in Supabase SQL editor with the service-role backed API.

create table if not exists public.aidtrace_browser_relay_events (
  event_id text primary key,
  batch_id text not null,
  action_type text not null,
  requester_ip text,
  status text not null default 'processing',
  tx_hash text,
  last_error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint aidtrace_browser_relay_events_status_check
    check (status in ('processing', 'completed', 'failed'))
);

create table if not exists public.aidtrace_browser_relay_buckets (
  bucket_key text primary key,
  requester_ip text not null,
  batch_id text not null,
  window_start timestamptz not null,
  count integer not null default 0,
  updated_at timestamptz not null default now()
);

create index if not exists aidtrace_browser_relay_events_batch_idx
  on public.aidtrace_browser_relay_events (batch_id, created_at desc);

create index if not exists aidtrace_browser_relay_buckets_window_idx
  on public.aidtrace_browser_relay_buckets (window_start desc);

alter table public.aidtrace_browser_relay_events enable row level security;
alter table public.aidtrace_browser_relay_buckets enable row level security;

create or replace function public.begin_aidtrace_browser_relay_event(
  p_event_id text,
  p_batch_id text,
  p_action_type text,
  p_requester_ip text,
  p_rate_limit integer default 30
)
returns table (
  accepted boolean,
  duplicate boolean,
  rate_limited boolean,
  tx_hash text
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_existing public.aidtrace_browser_relay_events%rowtype;
  v_window_start timestamptz := date_trunc('minute', now());
  v_bucket_key text := coalesce(nullif(p_requester_ip, ''), 'unknown') || ':' || p_batch_id || ':' || v_window_start::text;
  v_count integer;
begin
  select * into v_existing
  from public.aidtrace_browser_relay_events
  where event_id = p_event_id;

  if found then
    accepted := false;
    duplicate := true;
    rate_limited := false;
    tx_hash := v_existing.tx_hash;
    return next;
    return;
  end if;

  insert into public.aidtrace_browser_relay_buckets (
    bucket_key,
    requester_ip,
    batch_id,
    window_start,
    count
  )
  values (
    v_bucket_key,
    coalesce(nullif(p_requester_ip, ''), 'unknown'),
    p_batch_id,
    v_window_start,
    1
  )
  on conflict (bucket_key) do update
    set
      count = public.aidtrace_browser_relay_buckets.count + 1,
      updated_at = now()
  returning count into v_count;

  if v_count > p_rate_limit then
    accepted := false;
    duplicate := false;
    rate_limited := true;
    tx_hash := null;
    return next;
    return;
  end if;

  insert into public.aidtrace_browser_relay_events (
    event_id,
    batch_id,
    action_type,
    requester_ip,
    status
  )
  values (
    p_event_id,
    p_batch_id,
    p_action_type,
    p_requester_ip,
    'processing'
  );

  accepted := true;
  duplicate := false;
  rate_limited := false;
  tx_hash := null;
  return next;
end;
$$;

create or replace function public.complete_aidtrace_browser_relay_event(
  p_event_id text,
  p_tx_hash text
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.aidtrace_browser_relay_events
  set
    status = 'completed',
    tx_hash = p_tx_hash,
    last_error = null,
    updated_at = now()
  where event_id = p_event_id;

  return found;
end;
$$;

create or replace function public.fail_aidtrace_browser_relay_event(
  p_event_id text,
  p_error text
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.aidtrace_browser_relay_events
  set
    status = 'failed',
    last_error = left(coalesce(p_error, 'unknown error'), 500),
    updated_at = now()
  where event_id = p_event_id and status <> 'completed';

  return found;
end;
$$;

grant execute on function public.begin_aidtrace_browser_relay_event(text, text, text, text, integer) to service_role;
grant execute on function public.complete_aidtrace_browser_relay_event(text, text) to service_role;
grant execute on function public.fail_aidtrace_browser_relay_event(text, text) to service_role;

notify pgrst, 'reload schema';
