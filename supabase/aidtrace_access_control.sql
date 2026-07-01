-- AidTrace sender allowlist + per-sender rate limiting.
-- Protects the Telegram (and WhatsApp/SMS) channels from abuse.
--
-- Run in Supabase SQL Editor AFTER aidtrace_relay_guard.sql.
--
-- How it works:
--   1. A field worker sends AIDTRACE_REGISTRATION_KEYWORD to the bot once.
--      The server calls register_aidtrace_sender() — they are added to the allowlist.
--   2. On every subsequent message check_and_admit_aidtrace_sender() is called.
--      It verifies the sender is active AND under the hourly event cap.
--   3. To block a user: set is_active = false in aidtrace_allowed_senders.
--   4. To change the keyword: rotate AIDTRACE_REGISTRATION_KEYWORD in Vercel env vars.
--      Existing registrations remain valid (is_active stays true).

-- ── Tables ────────────────────────────────────────────────────────────────────

create table if not exists public.aidtrace_allowed_senders (
  chat_id       text primary key,
  channel       text not null default 'telegram',
  display_name  text,
  is_active     boolean not null default true,
  registered_at timestamptz not null default now()
);

create index if not exists aidtrace_allowed_senders_active_idx
  on public.aidtrace_allowed_senders (is_active, channel);

create table if not exists public.aidtrace_sender_rate_buckets (
  bucket_key   text primary key,
  chat_id      text not null,
  window_start timestamptz not null,
  count        integer not null default 0,
  updated_at   timestamptz not null default now()
);

create index if not exists aidtrace_sender_rate_buckets_window_idx
  on public.aidtrace_sender_rate_buckets (window_start desc);

alter table public.aidtrace_allowed_senders    enable row level security;
alter table public.aidtrace_sender_rate_buckets enable row level security;

-- ── register_aidtrace_sender ──────────────────────────────────────────────────
-- Called server-side after the keyword token has been verified in JS.
-- Upserts the sender into the allowlist (re-activates if previously deactivated).

create or replace function public.register_aidtrace_sender(
  p_chat_id      text,
  p_channel      text,
  p_display_name text
)
returns table (
  registered     boolean,
  already_existed boolean
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_exists boolean;
begin
  select true into v_exists
  from public.aidtrace_allowed_senders
  where chat_id = p_chat_id;

  insert into public.aidtrace_allowed_senders (chat_id, channel, display_name, is_active)
  values (p_chat_id, coalesce(nullif(p_channel, ''), 'telegram'), p_display_name, true)
  on conflict (chat_id) do update
    set is_active    = true,
        display_name = coalesce(excluded.display_name,
                                public.aidtrace_allowed_senders.display_name);

  registered      := true;
  already_existed := coalesce(v_exists, false);
  return next;
end;
$$;

-- ── check_and_admit_aidtrace_sender ──────────────────────────────────────────
-- Called before processing any inbound Telegram/WhatsApp/SMS message.
-- Returns allowed=true + increments the hourly bucket when the sender is admitted.
-- Returns allowed=false + reason ('not_registered' | 'rate_limited') when denied.

create or replace function public.check_and_admit_aidtrace_sender(
  p_chat_id         text,
  p_channel         text,
  p_rate_limit_hour integer default 20
)
returns table (
  allowed boolean,
  reason  text
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_is_active   boolean;
  v_window_start timestamptz := date_trunc('hour', now());
  v_bucket_key  text := p_chat_id || ':' || v_window_start::text;
  v_count       integer;
begin
  -- 1. Allowlist check
  select s.is_active into v_is_active
  from public.aidtrace_allowed_senders s
  where s.chat_id = p_chat_id;

  if not found or not v_is_active then
    allowed := false;
    reason  := 'not_registered';
    return next;
    return;
  end if;

  -- 2. Read current bucket count before incrementing
  select b.count into v_count
  from public.aidtrace_sender_rate_buckets b
  where b.bucket_key = v_bucket_key;

  if coalesce(v_count, 0) >= p_rate_limit_hour then
    allowed := false;
    reason  := 'rate_limited';
    return next;
    return;
  end if;

  -- 3. Increment bucket (upsert)
  insert into public.aidtrace_sender_rate_buckets (bucket_key, chat_id, window_start, count)
  values (v_bucket_key, p_chat_id, v_window_start, 1)
  on conflict (bucket_key) do update
    set count      = public.aidtrace_sender_rate_buckets.count + 1,
        updated_at = now();

  allowed := true;
  reason  := 'ok';
  return next;
end;
$$;

-- ── Grants ────────────────────────────────────────────────────────────────────

grant execute on function public.register_aidtrace_sender(text, text, text)                  to service_role;
grant execute on function public.check_and_admit_aidtrace_sender(text, text, integer)        to service_role;

notify pgrst, 'reload schema';
