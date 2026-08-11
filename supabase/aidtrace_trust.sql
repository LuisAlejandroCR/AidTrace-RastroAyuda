-- AidTrace trust & data-integrity foundation (anti-troll P0).
--
-- Run in Supabase SQL Editor AFTER aidtrace_queue.sql / relay_guard /
-- timeline. If security_hardening.sql already ran, this file re-applies
-- the revokes for its own RPCs, so it is safe to run at any point.
--
-- Principles:
--   1. Client code can NEVER write these tables directly (RLS closed,
--      only SECURITY DEFINER RPCs called by the service role can write).
--   2. reputation_score / trust_level / report status / corroboration
--      counts are server-computed, never client-settable.
--   3. Evidence integrity: exact-duplicate evidence is detected by
--      SHA-256 and surfaced as a review signal, not proof of fraud.
--   4. Verify privately, trust publicly: emails/IPs stay out of the
--      public tables; only status labels are exposed.

-- ── Tables ────────────────────────────────────────────────────────────────────

create table if not exists public.aidtrace_profiles (
  user_id          uuid primary key references auth.users (id) on delete cascade,
  trust_level      text not null default 'NEW'
                   check (trust_level in ('NEW','EMAIL_VERIFIED','ESTABLISHED','TRUSTED','COMMUNITY_VERIFIER')),
  reputation_score integer not null default 0,
  email_verified   boolean not null default false,
  created_at       timestamptz not null default now(),
  last_activity_at timestamptz not null default now()
);

create table if not exists public.aidtrace_reports (
  id              uuid primary key default gen_random_uuid(),
  batch_id        text not null,
  action_type     text not null,
  details         text,
  author_id       uuid references auth.users (id) on delete set null,
  status          text not null default 'SUBMITTED'
                  check (status in ('DRAFT','SUBMITTED','PENDING_REVIEW','PUBLISHED','CORROBORATED','DISPUTED','FLAGGED','REJECTED','ARCHIVED')),
  evidence_hash   text,
  blockchain_hash text,
  blockchain_tx   text,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  published_at    timestamptz
);

create index if not exists aidtrace_reports_author_idx on public.aidtrace_reports (author_id, created_at desc);
create index if not exists aidtrace_reports_batch_idx  on public.aidtrace_reports (batch_id, created_at desc);

create table if not exists public.aidtrace_evidence (
  id           uuid primary key default gen_random_uuid(),
  report_id    uuid references public.aidtrace_reports (id) on delete cascade,
  uploaded_by  uuid references auth.users (id) on delete set null,
  sha256       text not null,
  mime_type    text,
  file_size    bigint,
  storage_path text,
  created_at   timestamptz not null default now()
);

create index if not exists aidtrace_evidence_sha_idx on public.aidtrace_evidence (sha256);

create table if not exists public.aidtrace_corroborations (
  id             uuid primary key default gen_random_uuid(),
  report_id      uuid references public.aidtrace_reports (id) on delete cascade,
  contributor_id uuid references auth.users (id) on delete cascade,
  type           text not null default 'was_there'
                 check (type in ('was_there','received_aid','independent_evidence')),
  created_at     timestamptz not null default now(),
  unique (report_id, contributor_id)
);

create table if not exists public.aidtrace_abuse_reports (
  id          uuid primary key default gen_random_uuid(),
  report_id   uuid references public.aidtrace_reports (id) on delete cascade,
  reported_by uuid references auth.users (id) on delete set null,
  reason      text not null check (reason in ('false_information','duplicate','manipulated_evidence','incorrect_location','spam','other')),
  status      text not null default 'FLAGGED' check (status in ('FLAGGED','REVIEW','RESOLVED')),
  created_at  timestamptz not null default now(),
  resolved_at timestamptz
);

create table if not exists public.aidtrace_trust_events (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid references auth.users (id) on delete cascade,
  event_type text not null,
  points     integer not null default 0,
  report_id  uuid references public.aidtrace_reports (id) on delete set null,
  created_at timestamptz not null default now()
);

-- ── RLS: closed to every client role ──────────────────────────────────────────

alter table public.aidtrace_profiles         enable row level security;
alter table public.aidtrace_reports          enable row level security;
alter table public.aidtrace_evidence         enable row level security;
alter table public.aidtrace_corroborations   enable row level security;
alter table public.aidtrace_abuse_reports    enable row level security;
alter table public.aidtrace_trust_events     enable row level security;

-- No policy = no access for anon/authenticated. Only SECURITY DEFINER
-- RPCs (invoked with the service role key) can touch these tables.
-- Read access for the app comes exclusively through safe RPCs.

-- ── record_aidtrace_report_evidence ───────────────────────────────────────────
-- Creates a report + its evidence record in one call. Returns
-- duplicate_evidence = true when the exact SHA-256 already exists on
-- another report (a review signal, not a verdict).

create or replace function public.record_aidtrace_report_evidence(
  p_batch_id       text,
  p_action_type    text,
  p_details        text,
  p_author_id      uuid,
  p_evidence_sha256 text,
  p_evidence_ref   text,
  p_tx_hash        text
)
returns table (
  report_id          uuid,
  duplicate_evidence boolean
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_duplicate boolean;
  v_report_id uuid;
begin
  select exists (
    select 1 from public.aidtrace_evidence
    where sha256 = p_evidence_sha256
  ) into v_duplicate;

  insert into public.aidtrace_reports (
    batch_id, action_type, details, author_id,
    evidence_hash, blockchain_tx, status, published_at
  )
  values (
    p_batch_id, p_action_type, p_details, p_author_id,
    p_evidence_sha256, p_tx_hash, 'SUBMITTED', now()
  )
  returning id into v_report_id;

  insert into public.aidtrace_evidence (
    report_id, uploaded_by, sha256, storage_path
  )
  values (
    v_report_id, p_author_id, p_evidence_sha256, p_evidence_ref
  );

  if p_author_id is not null then
    insert into public.aidtrace_trust_events (user_id, event_type, points, report_id)
    values (p_author_id, 'report_submitted', 10, v_report_id);

    update public.aidtrace_profiles
    set last_activity_at = now()
    where user_id = p_author_id;
  end if;

  report_id          := v_report_id;
  duplicate_evidence := v_duplicate;
  return next;
end;
$$;

-- ── check_aidtrace_contributor_limit ──────────────────────────────────────────
-- Per-day report cap by trust level: NEW 2, EMAIL_VERIFIED 5,
-- ESTABLISHED 10, TRUSTED 20, COMMUNITY_VERIFIER 50.

create or replace function public.check_aidtrace_contributor_limit(
  p_user_id uuid
)
returns table (
  allowed   boolean,
  count_today integer,
  daily_limit integer,
  trust_level text
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_level text := 'NEW';
  v_count integer;
  v_limit integer;
begin
  select coalesce(trust_level, 'NEW') into v_level
  from public.aidtrace_profiles
  where user_id = p_user_id;

  select count(*) into v_count
  from public.aidtrace_reports
  where author_id = p_user_id
    and created_at >= date_trunc('day', now());

  v_limit := case v_level
    when 'COMMUNITY_VERIFIER' then 50
    when 'TRUSTED'            then 20
    when 'ESTABLISHED'        then 10
    when 'EMAIL_VERIFIED'     then 5
    else 2
  end;

  allowed      := v_count < v_limit;
  count_today  := v_count;
  daily_limit  := v_limit;
  trust_level  := v_level;
  return next;
end;
$$;

-- ── corroborate_aidtrace_report ───────────────────────────────────────────────
-- A distinct contributor confirms a report. Independently-typed
-- corroborations earn trust points; once 3+ corroborations exist the
-- report moves to CORROBORATED.

create or replace function public.corroborate_aidtrace_report(
  p_report_id      uuid,
  p_contributor_id uuid,
  p_type           text
)
returns table (
  corroborations integer
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_count integer;
begin
  insert into public.aidtrace_corroborations (report_id, contributor_id, type)
  values (p_report_id, p_contributor_id, coalesce(nullif(p_type,''), 'was_there'))
  on conflict (report_id, contributor_id) do nothing;

  select count(*) into v_count
  from public.aidtrace_corroborations
  where report_id = p_report_id;

  if v_count >= 3 then
    update public.aidtrace_reports
    set status = 'CORROBORATED', updated_at = now()
    where id = p_report_id and status not in ('DISPUTED','REJECTED');
  end if;

  insert into public.aidtrace_trust_events (user_id, event_type, points, report_id)
  values (p_contributor_id, 'corroboration', 20, p_report_id);

  corroborations := v_count;
  return next;
end;
$$;

-- ── report_aidtrace_abuse ─────────────────────────────────────────────────────
-- Escalation ladder: 1 abuse report -> FLAGGED, 3+ -> REVIEW.
-- No auto-delete; moderation stays transparent.

create or replace function public.report_aidtrace_abuse(
  p_report_id   uuid,
  p_reported_by uuid,
  p_reason      text
)
returns table (
  report_status text,
  abuse_count   integer
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_count   integer;
  v_current text;
begin
  insert into public.aidtrace_abuse_reports (report_id, reported_by, reason, status)
  values (p_report_id, p_reported_by, p_reason, 'FLAGGED');

  select status into v_current
  from public.aidtrace_reports
  where id = p_report_id;

  select count(*) into v_count
  from public.aidtrace_abuse_reports
  where report_id = p_report_id;

  update public.aidtrace_reports
  set status = case when v_count >= 3 then 'FLAGGED' else v_current end,
      updated_at = now()
  where id = p_report_id;

  report_status := case when v_count >= 3 then 'FLAGGED' else v_current end;
  abuse_count   := v_count;
  return next;
end;
$$;

-- ── refresh_aidtrace_trust ────────────────────────────────────────────────────
-- Recomputes reputation (sum of trust events) and trust level from
-- contribution history. Called server-side after each meaningful event
-- (or on demand); never callable by the client.

create or replace function public.refresh_aidtrace_trust(
  p_user_id uuid
)
returns table (
  trust_level      text,
  reputation_score integer
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_score   integer;
  v_reports integer;
  v_corrobs integer;
  v_level   text;
begin
  select coalesce(sum(points), 0) into v_score
  from public.aidtrace_trust_events
  where user_id = p_user_id;

  select count(*) into v_reports
  from public.aidtrace_reports
  where author_id = p_user_id;

  select count(*) into v_corrobs
  from public.aidtrace_corroborations
  where contributor_id = p_user_id;

  v_level := case
    when v_reports >= 50 and v_corrobs >= 40 then 'COMMUNITY_VERIFIER'
    when v_reports >= 20 and v_corrobs >= 15 then 'TRUSTED'
    when v_reports >= 5  and v_corrobs >= 3  then 'ESTABLISHED'
    when v_reports > 0                       then 'EMAIL_VERIFIED'
    else 'NEW'
  end;

  insert into public.aidtrace_profiles (user_id, trust_level, reputation_score, last_activity_at)
  values (p_user_id, v_level, v_score, now())
  on conflict (user_id) do update
    set trust_level      = excluded.trust_level,
        reputation_score = excluded.reputation_score,
        last_activity_at = excluded.last_activity_at;

  trust_level      := v_level;
  reputation_score := v_score;
  return next;
end;
$$;

-- ── Hardening: only the service role may execute these RPCs ───────────────────

revoke execute on function public.record_aidtrace_report_evidence(text, text, text, uuid, text, text, text) from public;
revoke execute on function public.check_aidtrace_contributor_limit(uuid)           from public;
revoke execute on function public.corroborate_aidtrace_report(uuid, uuid, text)    from public;
revoke execute on function public.report_aidtrace_abuse(uuid, uuid, text)          from public;
revoke execute on function public.refresh_aidtrace_trust(uuid)                     from public;
