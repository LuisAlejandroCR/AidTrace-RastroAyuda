-- AidTrace queue retry helper.
-- Run this in Supabase SQL editor after aidtrace_queue.sql.
--
-- Resets a single failed queue row back to pending so the
-- next process-queue.yml run picks it up again.
-- Called by POST /api/retry-queue (requires AIDTRACE_QUEUE_WORKER_TOKEN).

create or replace function public.retry_aidtrace_message(p_id uuid)
returns jsonb
language plpgsql
security definer
as $$
declare
  v_updated int;
begin
  update public.aidtrace_message_queue
  set
    status      = 'pending',
    next_run_at = now(),
    attempts    = 0,
    last_error  = null,
    locked_at   = null,
    locked_by   = null
  where id     = p_id
    and status = 'failed';

  get diagnostics v_updated = row_count;
  return jsonb_build_object('ok', v_updated > 0, 'updated', v_updated);
end;
$$;

notify pgrst, 'reload schema';
