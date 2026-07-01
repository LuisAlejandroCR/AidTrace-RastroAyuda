-- AidTrace center summary aggregate.
-- Run in Supabase SQL editor after center_inventory.sql.
--
-- Called by GET /api/center-inventory?all=true
-- Returns every center code with delivery count and last delivery timestamp.

create or replace function public.get_center_summary()
returns table (
  center_code      text,
  total_deliveries bigint,
  last_delivery    timestamptz
)
language sql
security definer
as $$
  select
    center_code,
    count(*)       as total_deliveries,
    max(recorded_at) as last_delivery
  from public.aidtrace_center_inventory
  group by center_code
  order by max(recorded_at) desc;
$$;

notify pgrst, 'reload schema';
