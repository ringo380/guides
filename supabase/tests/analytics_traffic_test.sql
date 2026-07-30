-- pgTAP tests for analytics_traffic(), the window aggregation behind the
-- dashboard's traffic section.
--
-- Two things here matter more than the arithmetic:
--   1. The function must aggregate ACROSS more rows than PostgREST would
--      return, since dodging the silent max_rows truncation is the entire
--      reason it exists. One test seeds past that cap deliberately.
--   2. It is security definer, which grants EXECUTE to PUBLIC on creation.
--      The privilege tests assert the revoke landed, independent of data.

begin;

create extension if not exists pgtap with schema extensions;

select plan(21);

select has_function('public', 'analytics_traffic', 'analytics_traffic exists');

-- ------------------------------------------------------------ input bounds
--
-- Both arguments reach a date subtraction and a LIMIT. Rejecting them at the
-- edge of the function keeps "give me everything" from being a valid call.

select throws_ok(
  $$select public.analytics_traffic(0)$$, null, null,
  'p_days of 0 is rejected'
);
select throws_ok(
  $$select public.analytics_traffic(401)$$, null, null,
  'p_days beyond retention is rejected'
);
select throws_ok(
  $$select public.analytics_traffic(null)$$, null, null,
  'a null p_days is rejected rather than defaulting'
);
select throws_ok(
  $$select public.analytics_traffic(28, 0)$$, null, null,
  'p_limit of 0 is rejected'
);
select throws_ok(
  $$select public.analytics_traffic(28, 101)$$, null, null,
  'an oversized p_limit is rejected'
);
select lives_ok(
  $$select public.analytics_traffic(400, 100)$$,
  'the upper bound of each argument is accepted'
);

-- -------------------------------------------------------------- empty table

delete from public.analytics_events;

-- An empty window must produce empty arrays and zeroes, not nulls. A null here
-- would reach the dashboard as "no data available" for a site that simply had
-- a quiet week, and the two are not the same claim.
select is(
  (public.analytics_traffic(28) -> 'daily'),
  '[]'::jsonb,
  'an empty window yields an empty daily array, not null'
);
select is(
  (public.analytics_traffic(28) -> 'totals' ->> 'pageviews')::int,
  0,
  'an empty window totals zero pageviews'
);
select is(
  (public.analytics_traffic(28) -> 'topPages'),
  '[]'::jsonb,
  'an empty window yields an empty topPages array'
);

-- ------------------------------------------------------------- aggregation

delete from public.analytics_events;

insert into public.analytics_events
  (occurred_at, visitor_hash, event_name, page_path, topic, referrer_host, is_bot)
values
  -- Today: three visitors, four page views, one non-pageview event. The page
  -- totals are deliberately NOT tied (basics 3, root 2), or the ranking
  -- assertion below would be decided by the alphabetical tiebreak and would
  -- pass whether or not the ordering by views worked at all.
  (now(),                'v1', 'page_view',   '/Git/',        'Git', 'news.example', false),
  (now(),                'v1', 'page_view',   '/Git/basics/', 'Git', null,           false),
  (now(),                'v1', 'quiz_answer', '/Git/basics/', 'Git', null,           false),
  (now(),                'v2', 'page_view',   '/Git/basics/', 'Git', null,           false),
  (now(),                'v3', 'page_view',   '/Git/basics/', 'Git', null,           false),
  -- Yesterday: one visitor, one view.
  (now() - interval '1 day', 'v1', 'page_view', '/Git/',      'Git', null,           false),
  -- A bot today, which must not appear anywhere.
  (now(),                'bot', 'page_view',  '/Git/',        'Git', 'crawler.example', true),
  -- Outside the window: proves the date filter does something.
  (now() - interval '40 days', 'old', 'page_view', '/Old/',   'Old', null,           false);

select is(
  (public.analytics_traffic(7) -> 'totals' ->> 'pageviews')::int,
  5,
  'pageviews sum across days and exclude non-pageview events and bots'
);
select is(
  jsonb_array_length(public.analytics_traffic(7) -> 'daily'),
  2,
  'only days inside the window appear in the series'
);
select is(
  (public.analytics_traffic(7) -> 'totals' ->> 'daysWithTraffic')::int,
  2,
  'daysWithTraffic counts days present, not days elapsed'
);

-- The window total deliberately has no visitor count. Summing the daily column
-- would count one person once per day they visited, and the rotating salt
-- makes any other number impossible - so the contract is that it is absent.
select ok(
  (public.analytics_traffic(7) -> 'totals' -> 'visitors') is null,
  'totals carry no window-wide visitor count'
);
select is(
  (public.analytics_traffic(7) -> 'totals' -> 'visitorsPerDay' ->> 'peak')::int,
  3,
  'the busiest day visitor count is reported instead'
);

select is(
  (public.analytics_traffic(7) -> 'topPages' -> 0 ->> 'path'),
  '/Git/basics/',
  'topPages ranks by summed views across the window'
);
select is(
  (public.analytics_traffic(7) -> 'topReferrers' -> 0 ->> 'host'),
  'news.example',
  'bot referrers are excluded from topReferrers'
);

-- ------------------------------------------------- past the PostgREST cap
--
-- The reason this function exists. 1200 distinct paths on one day is more
-- per-day rows than PostgREST would hand back, so a dashboard summing a REST
-- response would silently report a fraction of the real total. Aggregating
-- in-database has no such ceiling.

delete from public.analytics_events;

insert into public.analytics_events
  (occurred_at, visitor_hash, event_name, page_path, topic, is_bot)
select now(), 'v' || i, 'page_view', '/p/' || i || '/', 'Bulk', false
from generate_series(1, 1200) i;

select is(
  (public.analytics_traffic(7) -> 'totals' ->> 'pageviews')::int,
  1200,
  'the sum covers more rows than PostgREST would return in one page'
);
select is(
  jsonb_array_length(public.analytics_traffic(7, 10) -> 'topPages'),
  10,
  'p_limit still bounds the returned list'
);

-- -------------------------------------------------------------- privileges

select ok(
  not has_function_privilege('anon',
    'public.analytics_traffic(integer,integer)', 'EXECUTE'),
  'anon cannot execute the aggregation over PostgREST /rpc/'
);
select ok(
  has_function_privilege('service_role',
    'public.analytics_traffic(integer,integer)', 'EXECUTE'),
  'service_role can execute the aggregation'
);

select * from finish();
rollback;
