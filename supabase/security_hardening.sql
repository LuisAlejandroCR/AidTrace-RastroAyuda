-- AidTrace security hardening
--
-- Run this file LAST, in the Supabase SQL editor, after all other
-- aidtrace_*.sql / center_*.sql files have been applied.
--
-- Problem: every SECURITY DEFINER function is granted only to service_role,
-- but PostgreSQL grants EXECUTE to PUBLIC by default, so anyone holding the
-- anon key (shipped in the PWA) can call enqueue/complete/register RPCs and
-- mint fake proofs, flood the queue, or drain the relayer's gas.
--
-- This file revokes EXECUTE from PUBLIC/anon/authenticated for every
-- SECURITY DEFINER function in the public schema whose name mentions
-- aidtrace (or the center helpers), then re-grants EXECUTE to service_role
-- only. It is idempotent — safe to re-run after schema changes.
--
-- Verify after running:
--   SELECT p.proname, has_function_privilege('anon', p.oid, 'EXECUTE') AS anon_exec
--   FROM pg_proc p
--   JOIN pg_namespace n ON n.oid = p.pronamespace
--   WHERE n.nspname = 'public' AND p.prosecdef;
-- All rows should show anon_exec = f.

DO $$
DECLARE
  fn RECORD;
BEGIN
  FOR fn IN
    SELECT p.proname,
           pg_get_function_identity_arguments(p.oid) AS args
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND p.prosecdef
      AND (
        p.proname LIKE '%aidtrace%'
        OR p.proname IN ('record_center_delivery', 'get_center_summary')
      )
  LOOP
    EXECUTE format(
      'REVOKE ALL ON FUNCTION public.%I(%s) FROM PUBLIC, anon, authenticated',
      fn.proname,
      fn.args
    );
    EXECUTE format(
      'GRANT EXECUTE ON FUNCTION public.%I(%s) TO service_role',
      fn.proname,
      fn.args
    );
  END LOOP;
END $$;