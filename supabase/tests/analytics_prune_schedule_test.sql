-- pgTAP tests for the retention schedule.
--
-- The interesting failure here is not a broken job but an ABSENT one: without
-- a schedule, analytics_prune() still exists, still passes its own tests, and
-- still never runs. Retention would read as implemented and be unenforced.

begin;

create extension if not exists pgtap with schema extensions;

select plan(6);

select has_function('public', 'analytics_prune', 'the prune function exists');

select is(
  (select count(*)::int from cron.job where jobname = 'analytics-prune'),
  1,
  'exactly one prune job is scheduled'
);

select is(
  (select active from cron.job where jobname = 'analytics-prune'),
  true,
  'the prune job is active, not merely present'
);

select is(
  (select schedule from cron.job where jobname = 'analytics-prune'),
  '20 3 * * *',
  'the prune job runs daily'
);

-- The scheduled command must call the function with an explicit window. A bare
-- call would still work today, but the retention period would then live only
-- in a default and change silently if that default were ever edited.
select matches(
  (select command from cron.job where jobname = 'analytics-prune'),
  'analytics_prune\(400\)',
  'the schedule pins the retention window explicitly'
);

-- Prove the job body actually deletes. A schedule pointing at a no-op would
-- satisfy every assertion above.
delete from public.analytics_events;
insert into public.analytics_events (occurred_at, visitor_hash, event_name, page_path)
values
  (now() - interval '401 days', 'old',  'page_view', '/old/'),
  (now(),                       'new',  'page_view', '/new/');
select public.analytics_prune(400);
select is(
  (select count(*)::int from public.analytics_events),
  1,
  'the scheduled window deletes expired rows and keeps current ones'
);

select * from finish();
rollback;
