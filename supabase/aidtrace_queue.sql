-- AidTrace durable queue for Celo writes.
-- Run this in Supabase SQL editor with a service-role backed API.

create table if not exists public.aidtrace_message_queue (
  id uuid primary key default gen_random_uuid(),
  inbound_message_id text not null,
  source text not null default 'unknown',
  channel text not null default 'unknown',
  recipient text,
  batch_id text,
  action_type text,
  details text,
  payload jsonb not null default '{}'::jsonb,
  status text not null default 'pending',
  attempts integer not null default 0,
  next_run_at timestamptz not null default now(),
  locked_at timestamptz,
  locked_by text,
  last_error text,
  tx_hash text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint aidtrace_message_queue_status_check
    check (status in ('pending', 'processing', 'completed', 'failed'))
);

create unique index if not exists aidtrace_message_queue_inbound_message_id_key
  on public.aidtrace_message_queue (inbound_message_id);

create index if not exists aidtrace_message_queue_claim_idx
  on public.aidtrace_message_queue (status, next_run_at, created_at)
  where status in ('pending', 'processing');

create index if not exists aidtrace_message_queue_batch_idx
  on public.aidtrace_message_queue (batch_id, created_at desc);

alter table public.aidtrace_message_queue enable row level security;

create or replace function public.set_aidtrace_queue_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists aidtrace_queue_set_updated_at on public.aidtrace_message_queue;

create trigger aidtrace_queue_set_updated_at
before update on public.aidtrace_message_queue
for each row
execute function public.set_aidtrace_queue_updated_at();

create or replace function public.enqueue_aidtrace_message(
  p_inbound_message_id text,
  p_source text,
  p_channel text,
  p_recipient text,
  p_batch_id text,
  p_action_type text,
  p_details text,
  p_payload jsonb
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id uuid;
begin
  insert into public.aidtrace_message_queue (
    inbound_message_id,
    source,
    channel,
    recipient,
    batch_id,
    action_type,
    details,
    payload
  )
  values (
    p_inbound_message_id,
    coalesce(nullif(p_source, ''), 'unknown'),
    coalesce(nullif(p_channel, ''), 'unknown'),
    p_recipient,
    p_batch_id,
    p_action_type,
    p_details,
    coalesce(p_payload, '{}'::jsonb)
  )
  on conflict (inbound_message_id) do update
    set updated_at = public.aidtrace_message_queue.updated_at
  returning id into v_id;

  return v_id;
end;
$$;

create or replace function public.claim_aidtrace_message(
  p_worker_id text,
  p_lock_seconds integer default 120
)
returns table (
  id uuid,
  inbound_message_id text,
  source text,
  channel text,
  recipient text,
  batch_id text,
  action_type text,
  details text,
  payload jsonb,
  attempts integer
)
language plpgsql
security definer
set search_path = public
as $$
begin
  return query
  with candidate as (
    select q.id
    from public.aidtrace_message_queue q
    where
      (
        q.status = 'pending'
        and q.next_run_at <= now()
      )
      or
      (
        q.status = 'processing'
        and q.locked_at < now() - make_interval(secs => p_lock_seconds)
      )
    order by q.created_at
    for update skip locked
    limit 1
  )
  update public.aidtrace_message_queue q
  set
    status = 'processing',
    attempts = q.attempts + 1,
    locked_at = now(),
    locked_by = p_worker_id,
    last_error = null
  from candidate
  where q.id = candidate.id
  returning
    q.id,
    q.inbound_message_id,
    q.source,
    q.channel,
    q.recipient,
    q.batch_id,
    q.action_type,
    q.details,
    q.payload,
    q.attempts;
end;
$$;

create or replace function public.complete_aidtrace_message(
  p_id uuid,
  p_tx_hash text
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.aidtrace_message_queue
  set
    status = 'completed',
    tx_hash = p_tx_hash,
    locked_at = null,
    locked_by = null,
    last_error = null
  where id = p_id;

  return found;
end;
$$;

create or replace function public.retry_aidtrace_message(
  p_id uuid,
  p_error text,
  p_retry_seconds integer default 30,
  p_max_attempts integer default 8
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.aidtrace_message_queue
  set
    status = case when attempts >= p_max_attempts then 'failed' else 'pending' end,
    next_run_at = now() + make_interval(secs => p_retry_seconds),
    locked_at = null,
    locked_by = null,
    last_error = left(coalesce(p_error, 'unknown error'), 500)
  where id = p_id;

  return found;
end;
$$;

grant execute on function public.enqueue_aidtrace_message(text, text, text, text, text, text, text, jsonb) to service_role;
grant execute on function public.claim_aidtrace_message(text, integer) to service_role;
grant execute on function public.complete_aidtrace_message(uuid, text) to service_role;
grant execute on function public.retry_aidtrace_message(uuid, text, integer, integer) to service_role;

notify pgrst, 'reload schema';
