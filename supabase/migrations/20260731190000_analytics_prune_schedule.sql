-- Make the 400-day retention real.
--
-- analytics_prune() has existed since 20260730220000 but nothing called it, so
-- the retention window was a claim the system did not honour and
-- analytics_events would have grown without bound.
--
-- Scheduled with pg_cron rather than an external scheduler on purpose: the
-- retention rule then lives in the same database as the data it governs and
-- keeps running whether or not any other service is up. A GitHub Actions cron
-- would make a privacy property depend on a workflow in a different system
-- staying green, and a silently disabled workflow looks exactly like a working
-- one from here.

create extension if not exists pg_cron;

-- Idempotent: migrations get replayed against a fresh database on every
-- verify-db run, and cron.schedule on an existing name would either error or
-- quietly leave a duplicate depending on version.
do $$
begin
  if exists (select 1 from cron.job where jobname = 'analytics-prune') then
    perform cron.unschedule('analytics-prune');
  end if;
end;
$$;

-- 03:20 UTC daily. Deliberately not midnight: analytics_record() rotates the
-- salt on the first write after a day boundary, and stacking the two at the
-- same instant makes any future problem in one look like a problem in the
-- other.
select cron.schedule(
  'analytics-prune',
  '20 3 * * *',
  $$select public.analytics_prune(400)$$
);
