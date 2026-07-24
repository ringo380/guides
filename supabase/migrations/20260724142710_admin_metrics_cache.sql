-- Cache for the assembled dashboard payload, and storage for the per-admin
-- rate-limit counter. Edge function instances are not shared, so an in-memory
-- counter would not hold across invocations.
create table public.admin_metrics_cache (
  key text primary key,
  payload jsonb not null,
  fetched_at timestamptz not null default now()
);

alter table public.admin_metrics_cache enable row level security;

-- Same reasoning as admin_users: public-schema default privileges attach anon
-- and authenticated DML to every new table. RLS already denies, but the cache
-- holds aggregate site metrics and should not be one policy away from public.
revoke all on public.admin_metrics_cache from anon, authenticated;

comment on table public.admin_metrics_cache is
  'Payload cache and rate-limit counters. Service-role access only.';
