-- Read side for first-party analytics.
--
-- These are the contract between storage and presentation. Swapping on-read
-- aggregation for scheduled rollup tables later means repointing the views;
-- the API and the dashboard do not change.
--
-- Every view is aggregated PER DAY rather than over a caller-supplied window.
-- Visitor identity is salted per day and the salt is discarded, so a distinct
-- count across a 28-day window is not a smaller number computed a harder way,
-- it is a different and meaningless one - the same person is a different hash
-- each day. Daily grain is the finest honest unit; the API sums what is
-- summable (views) and never sums what is not (visitors).
--
-- Bots are excluded here rather than at ingest, so widening the denylist later
-- retroactively improves history instead of only affecting new rows.

create view public.analytics_daily_traffic as
select
  (occurred_at at time zone 'UTC')::date as day,
  count(distinct visitor_hash)                                     as visitors,
  count(*) filter (where event_name = 'page_view')                 as pageviews,
  count(distinct user_id) filter (where user_id is not null)       as signed_in_visitors
from public.analytics_events
where not is_bot
group by 1;

create view public.analytics_daily_pages as
select
  (occurred_at at time zone 'UTC')::date as day,
  page_path,
  topic,
  count(*) filter (where event_name = 'page_view') as views,
  count(distinct visitor_hash)                     as visitors
from public.analytics_events
where not is_bot
group by 1, 2, 3;

create view public.analytics_daily_referrers as
select
  (occurred_at at time zone 'UTC')::date as day,
  referrer_host,
  count(*) filter (where event_name = 'page_view') as views,
  count(distinct visitor_hash)                     as visitors
from public.analytics_events
where not is_bot
  and referrer_host is not null
group by 1, 2;

-- Entry page: the first page a visitor viewed on a given day. distinct on
-- takes one row per (day, visitor) at the lowest occurred_at, which is the
-- entry; counting those by path gives entries per page.
create view public.analytics_daily_entries as
select
  day,
  page_path,
  count(*) as entries
from (
  select distinct on ((occurred_at at time zone 'UTC')::date, visitor_hash)
    (occurred_at at time zone 'UTC')::date as day,
    visitor_hash,
    page_path
  from public.analytics_events
  where not is_bot
    and event_name = 'page_view'
  order by (occurred_at at time zone 'UTC')::date, visitor_hash, occurred_at
) first_views
group by 1, 2;


-- Lockdown, applied to every view.
--
-- This is not boilerplate. admin_progress_rollup shipped without it and was
-- served to the published anon key over PostgREST with HTTP 200; it returned
-- no rows only because production progress happened to be empty, which would
-- have made any row-count check a false all-clear. Two independent controls,
-- neither relied on alone:
--   1. security_invoker makes RLS evaluate against the caller, so a leaked
--      grant still yields zero rows.
--   2. the revoke stops PostgREST exposing the view over the Data API at all.
-- service_role keeps select because the edge function reads through it, and it
-- bypasses RLS so it still sees every row under invoker rights.

alter view public.analytics_daily_traffic   set (security_invoker = true);
alter view public.analytics_daily_pages     set (security_invoker = true);
alter view public.analytics_daily_referrers set (security_invoker = true);
alter view public.analytics_daily_entries   set (security_invoker = true);

revoke all on public.analytics_daily_traffic   from anon, authenticated;
revoke all on public.analytics_daily_pages     from anon, authenticated;
revoke all on public.analytics_daily_referrers from anon, authenticated;
revoke all on public.analytics_daily_entries   from anon, authenticated;

grant select on public.analytics_daily_traffic   to service_role;
grant select on public.analytics_daily_pages     to service_role;
grant select on public.analytics_daily_referrers to service_role;
grant select on public.analytics_daily_entries   to service_role;

comment on view public.analytics_daily_traffic is
  'Daily uniques, page views and signed-in visitors. Bots excluded. Service-role access only.';
comment on view public.analytics_daily_pages is
  'Per-page daily views and visitors. Bots excluded. Service-role access only.';
comment on view public.analytics_daily_referrers is
  'Daily referrer hosts. Bots excluded. Service-role access only.';
comment on view public.analytics_daily_entries is
  'Daily entry pages: the first page each visitor viewed that day. Service-role access only.';
