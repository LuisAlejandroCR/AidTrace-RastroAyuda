-- AidTrace center inventory events.
-- Run this in Supabase SQL editor before enabling center integration.
--
-- Each row records a delivered batch event linked to a center code.
-- Idempotent: duplicate (center_code, batch_id, action_type) tuples update tx_hash only.
--
-- Env vars required in Vercel after running this:
--   AIDTRACE_CENTER_WEBHOOK_URL  (optional) — POST target for external inventory systems

create table if not exists public.aidtrace_center_inventory (
  id            uuid primary key default gen_random_uuid(),
  center_code   text not null,
  batch_id      text not null,
  action_type   text not null default 'DELIVERED',
  details       text not null default '',
  tx_hash       text,
  recorded_at   timestamptz not null default now(),
  constraint aidtrace_center_inventory_unique
    unique (center_code, batch_id, action_type)
);

create index if not exists aidtrace_center_inventory_center_idx
  on public.aidtrace_center_inventory (center_code, recorded_at desc);

create index if not exists aidtrace_center_inventory_batch_idx
  on public.aidtrace_center_inventory (batch_id);

-- RLS: enable so anon/authenticated keys cannot write directly.
-- Reads are public (data is already on-chain on Celoscan).
-- Writes go through record_center_delivery (SECURITY DEFINER) which
-- bypasses RLS — the service role key is never exposed to clients.
alter table public.aidtrace_center_inventory enable row level security;

create policy "aidtrace_center_inventory_public_read"
  on public.aidtrace_center_inventory
  for select
  using (true);

-- Idempotent upsert: safe to call multiple times for the same delivery.
create or replace function public.record_center_delivery(
  p_center_code  text,
  p_batch_id     text,
  p_action_type  text default 'DELIVERED',
  p_details      text default '',
  p_tx_hash      text default null
)
returns jsonb
language plpgsql
security definer
as $$
declare
  v_id uuid;
begin
  insert into public.aidtrace_center_inventory
    (center_code, batch_id, action_type, details, tx_hash)
  values
    (upper(p_center_code), upper(p_batch_id), upper(p_action_type), coalesce(p_details, ''), p_tx_hash)
  on conflict (center_code, batch_id, action_type)
  do update set
    tx_hash = coalesce(excluded.tx_hash, public.aidtrace_center_inventory.tx_hash)
  returning id into v_id;

  return jsonb_build_object('ok', true, 'id', v_id);
end;
$$;

notify pgrst, 'reload schema';
