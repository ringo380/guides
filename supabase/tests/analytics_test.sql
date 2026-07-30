-- pgTAP tests for the first-party analytics schema.
--
-- Run with ./verify-db.sh (needs Docker), not ./verify.sh.
--
-- The privilege tests at the end are the point of this file as much as the
-- aggregation ones. admin_progress_rollup shipped exposed to the anon key and
-- the mistake was invisible because the table happened to be empty - a
-- row-count check would have returned a clean all-clear. These assert the
-- grant itself, which is true or false regardless of what data exists.

begin;

create extension if not exists pgtap with schema extensions;

-- Count kept exact rather than using no_plan(): a plan is what catches a test
-- that silently stopped running partway.
select plan(39);

-- ---------------------------------------------------------------- structure

select has_table('public', 'analytics_events', 'analytics_events exists');
select has_table('public', 'analytics_salt', 'analytics_salt exists');
select has_view('public', 'analytics_daily_traffic', 'daily traffic view exists');
select has_view('public', 'analytics_daily_pages', 'daily pages view exists');
select has_view('public', 'analytics_daily_referrers', 'daily referrers view exists');
select has_view('public', 'analytics_daily_entries', 'daily entries view exists');

-- Exactly one salt row, and the constraint that keeps it that way.
select is(
  (select count(*)::int from public.analytics_salt),
  1,
  'exactly one salt row'
);
select throws_ok(
  $$insert into public.analytics_salt (id, salt) values (2, 'x')$$,
  '23514',
  null,
  'a second salt row is rejected by the check constraint'
);

-- ------------------------------------------------------------- write path

select public.analytics_record(
  '203.0.113.9', 'Mozilla/5.0', 'page_view', '/Git/git-basics/', 'Git', 'example.org'
);

select is(
  (select count(*)::int from public.analytics_events),
  1,
  'analytics_record writes one row'
);
select is(
  (select length(visitor_hash) from public.analytics_events limit 1),
  64,
  'visitor_hash is a 64-character sha256 hex digest'
);
select is(
  (select page_path from public.analytics_events limit 1),
  '/Git/git-basics/',
  'page_path is stored verbatim'
);
select is(
  (select referrer_host from public.analytics_events limit 1),
  'example.org',
  'referrer_host is stored'
);
select ok(
  (select props = '{}'::jsonb from public.analytics_events limit 1),
  'props defaults to an empty object'
);

-- Neither the IP nor the user agent may appear anywhere in the stored row.
-- This is the whole privacy claim, so assert it rather than trusting the
-- insert list.
select is(
  (select count(*)::int from public.analytics_events
    where visitor_hash like '%203.0.113.9%'
       or visitor_hash like '%Mozilla%'
       or props::text like '%203.0.113.9%'),
  0,
  'the raw IP and user agent are not stored'
);

-- Same visitor, same day: same hash. Different IP: different hash.
select public.analytics_record('203.0.113.9', 'Mozilla/5.0', 'page_view', '/a/');
select public.analytics_record('198.51.100.4', 'Mozilla/5.0', 'page_view', '/a/');

select is(
  (select count(distinct visitor_hash)::int from public.analytics_events),
  2,
  'the same IP and agent hash alike; a different IP does not'
);

-- Rotating the salt must change the hash for an identical visitor. Without
-- this, "the salt rotates" would be an untested comment.
select is(
  (select count(distinct visitor_hash)::int from public.analytics_events
    where page_path = '/rotation/'),
  0,
  'precondition: no rotation-test rows yet'
);
select public.analytics_record('203.0.113.9', 'Mozilla/5.0', 'page_view', '/rotation/');
update public.analytics_salt set rotated_at = now() - interval '2 days' where id = 1;
select public.analytics_record('203.0.113.9', 'Mozilla/5.0', 'page_view', '/rotation/');

select is(
  (select count(distinct visitor_hash)::int from public.analytics_events
    where page_path = '/rotation/'),
  2,
  'an identical visitor hashes differently after the salt rotates'
);
select ok(
  (select rotated_at >= date_trunc('day', now()) from public.analytics_salt where id = 1),
  'the salt rotated rather than being reused'
);

-- ------------------------------------------------------------ aggregation

delete from public.analytics_events;

-- Seeded directly: view behaviour should not depend on the RPC, and these
-- need explicit timestamps, which analytics_record does not accept.
insert into public.analytics_events
  (occurred_at, visitor_hash, event_name, page_path, topic, referrer_host, is_bot)
values
  ('2026-07-01 09:00+00', 'v1', 'page_view', '/Git/',        'Git', 'news.example', false),
  ('2026-07-01 09:05+00', 'v1', 'page_view', '/Git/basics/', 'Git', null,           false),
  ('2026-07-01 09:06+00', 'v1', 'quiz_answer', '/Git/basics/', 'Git', null,         false),
  ('2026-07-01 10:00+00', 'v2', 'page_view', '/Git/basics/', 'Git', null,           false),
  ('2026-07-02 09:00+00', 'v1', 'page_view', '/Git/',        'Git', null,           false),
  ('2026-07-01 11:00+00', 'bot', 'page_view', '/Git/',       'Git', 'crawler.example', true);

select is(
  (select visitors::int from public.analytics_daily_traffic where day = '2026-07-01'),
  2,
  'daily visitors counts distinct hashes and excludes the bot'
);
select is(
  (select pageviews::int from public.analytics_daily_traffic where day = '2026-07-01'),
  3,
  'pageviews counts only page_view events, not the quiz answer'
);
select is(
  (select count(*)::int from public.analytics_daily_traffic),
  2,
  'traffic is grouped per day'
);
select is(
  (select signed_in_visitors::int from public.analytics_daily_traffic where day = '2026-07-01'),
  0,
  'anonymous rows contribute no signed-in visitors'
);

select is(
  (select views::int from public.analytics_daily_pages
    where day = '2026-07-01' and page_path = '/Git/basics/'),
  2,
  'per-page views exclude non-pageview events on the same path'
);
select is(
  (select count(*)::int from public.analytics_daily_pages where page_path = '/Git/' and day = '2026-07-01'),
  1,
  'the bot does not create a second row for the same page'
);

select is(
  (select count(*)::int from public.analytics_daily_referrers where day = '2026-07-01'),
  1,
  'referrers exclude null hosts and the bot'
);
select is(
  (select referrer_host from public.analytics_daily_referrers where day = '2026-07-01'),
  'news.example',
  'the surviving referrer is the human one'
);

-- v1 entered on /Git/, v2 entered on /Git/basics/. The 09:05 view by v1 is
-- not an entry.
select is(
  (select entries::int from public.analytics_daily_entries
    where day = '2026-07-01' and page_path = '/Git/'),
  1,
  'entry pages count the first view of the day, once per visitor'
);
select is(
  (select entries::int from public.analytics_daily_entries
    where day = '2026-07-01' and page_path = '/Git/basics/'),
  1,
  'a second visitor entering elsewhere is counted separately'
);
select is(
  (select coalesce(sum(entries), 0)::int from public.analytics_daily_entries
    where day = '2026-07-01'),
  2,
  'entries for the day total one per visitor, not one per view'
);

-- ---------------------------------------------------------------- pruning

select is(
  public.analytics_prune(1)::int,
  6,
  'prune deletes rows older than the retention window and reports the count'
);
select is(
  (select count(*)::int from public.analytics_events),
  0,
  'the pruned rows are gone'
);
select throws_ok(
  $$select public.analytics_prune(0)$$,
  null,
  null,
  'prune refuses a retention window below one day'
);

-- -------------------------------------------------------------- privileges

-- The regression that mattered: a view exposed to the published anon key.
select ok(
  not has_table_privilege('anon', 'public.analytics_events', 'SELECT'),
  'anon cannot select analytics_events'
);
select ok(
  not has_table_privilege('authenticated', 'public.analytics_events', 'SELECT'),
  'authenticated cannot select analytics_events'
);
select ok(
  not has_table_privilege('anon', 'public.analytics_salt', 'SELECT'),
  'anon cannot select the salt'
);
select ok(
  not (
    has_table_privilege('anon', 'public.analytics_daily_traffic', 'SELECT') or
    has_table_privilege('anon', 'public.analytics_daily_pages', 'SELECT') or
    has_table_privilege('anon', 'public.analytics_daily_referrers', 'SELECT') or
    has_table_privilege('anon', 'public.analytics_daily_entries', 'SELECT')
  ),
  'anon cannot select any analytics view'
);
select ok(
  not has_function_privilege('anon',
    'public.analytics_record(text,text,text,text,text,text,jsonb,uuid,boolean)', 'EXECUTE'),
  'anon cannot execute the write path'
);

-- The revoke above is one of two controls. This asserts the other, which no
-- privilege check can see: without security_invoker a view runs with its
-- owner's rights and bypasses RLS on the underlying table, which is exactly
-- how admin_progress_rollup became readable.
select is(
  (select count(*)::int
     from pg_class c
     join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public'
      and c.relname in (
        'analytics_daily_traffic', 'analytics_daily_pages',
        'analytics_daily_referrers', 'analytics_daily_entries')
      and c.reloptions @> array['security_invoker=true']),
  4,
  'every analytics view runs with invoker rights'
);
select ok(
  has_function_privilege('service_role',
    'public.analytics_record(text,text,text,text,text,text,jsonb,uuid,boolean)', 'EXECUTE'),
  'service_role can execute the write path'
);

select * from finish();
rollback;
