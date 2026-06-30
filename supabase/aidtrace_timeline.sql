-- AidTrace indexed timeline cache.
-- Run this in Supabase SQL editor after aidtrace_queue.sql.

create table if not exists public.aidtrace_timeline_state (
  contract_address text primary key,
  last_indexed_block bigint not null default 0,
  updated_at timestamptz not null default now()
);

create table if not exists public.aidtrace_timeline_events (
  id text primary key,
  contract_address text not null,
  batch_id text not null,
  action_type text not null,
  sender text not null,
  data_hash text not null,
  reference_uri text not null,
  source text,
  details text,
  status text not null default 'sent_to_relayer',
  tx_hash text not null,
  tx_url text not null,
  qr_link text not null,
  block_number bigint not null,
  log_index integer not null,
  block_timestamp timestamptz not null,
  created_at timestamptz not null default now()
);

create index if not exists aidtrace_timeline_events_contract_order_idx
  on public.aidtrace_timeline_events (contract_address, block_number desc, log_index desc);

create index if not exists aidtrace_timeline_events_batch_idx
  on public.aidtrace_timeline_events (batch_id, block_number desc);

alter table public.aidtrace_timeline_state enable row level security;
alter table public.aidtrace_timeline_events enable row level security;

grant select, insert, update on public.aidtrace_timeline_state to service_role;
grant select, insert, update on public.aidtrace_timeline_events to service_role;

notify pgrst, 'reload schema';
