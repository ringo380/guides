-- Range aggregation for the admin dashboard.
--
-- Why an RPC rather than the dashboard reading the daily views over PostgREST:
-- PostgREST caps a response at max_rows (1000 by default) and does so
-- SILENTLY - a truncated result is a normal 200 with fewer rows, and a
-- dashboard summing it would report a confidently wrong smaller number. Per-day
-- per-page rows cross 1000 quickly on a site with a few hundred pages, so the
-- summation has to happen in the database where nothing is capped.
--
-- The whole window is returned as one jsonb document in one round trip, which
-- also means the API layer cannot accidentally sum a partial page of results.

create or replace function public.analytics_traffic(
  p_days  integer default 28,
  p_limit integer default 10
)
returns jsonb
language plpgsql
security definer
set search_path = public
stable
as $$
declare
  v_from date;
  v_to   date;
  v_out  jsonb;
begin
  -- Bound both inputs. p_days feeds a date subtraction and p_limit feeds a
  -- LIMIT, so an unbounded value is a cheap way to ask for the entire table.
  if p_days is null or p_days < 1 or p_days > 400 then
    raise exception 'p_days must be between 1 and 400, got %', p_days;
  end if;
  if p_limit is null or p_limit < 1 or p_limit > 100 then
    raise exception 'p_limit must be between 1 and 100, got %', p_limit;
  end if;

  -- Inclusive window ending today, in UTC, matching the views' day boundary.
  v_to   := (now() at time zone 'UTC')::date;
  v_from := v_to - (p_days - 1);

  select jsonb_build_object(
    'from', v_from,
    'to',   v_to,
    'days', p_days,

    -- Per-day series. Days with no traffic are absent rather than zero-filled;
    -- the presentation layer fills gaps, because a zero row here would be
    -- indistinguishable from a real day that genuinely saw nothing.
    'daily', coalesce((
      select jsonb_agg(jsonb_build_object(
               'day',       t.day,
               'visitors',  t.visitors,
               'pageviews', t.pageviews,
               'signedIn',  t.signed_in_visitors
             ) order by t.day)
      from public.analytics_daily_traffic t
      where t.day between v_from and v_to
    ), '[]'::jsonb),

    -- Totals contain pageviews but NOT a window visitor count, and that
    -- omission is deliberate. Visitor identity is salted per day and the salt
    -- is discarded, so the same person is a different hash tomorrow: summing
    -- the daily columns counts them once per day they visited, and there is no
    -- other number to compute. What is honest is the shape of the daily series,
    -- so that is what is reported.
    'totals', (
      select jsonb_build_object(
               'pageviews',       coalesce(sum(t.pageviews), 0),
               'visitorsPerDay',  jsonb_build_object(
                 'avg',  coalesce(round(avg(t.visitors), 1), 0),
                 'peak', coalesce(max(t.visitors), 0)
               ),
               'daysWithTraffic', count(*)
             )
      from public.analytics_daily_traffic t
      where t.day between v_from and v_to
    ),

    'topPages', coalesce((
      select jsonb_agg(x)
      from (
        select jsonb_build_object(
                 'path',  p.page_path,
                 'topic', p.topic,
                 'views', sum(p.views)
               ) as x
        from public.analytics_daily_pages p
        where p.day between v_from and v_to
        group by p.page_path, p.topic
        order by sum(p.views) desc, p.page_path
        limit p_limit
      ) ranked
    ), '[]'::jsonb),

    'topReferrers', coalesce((
      select jsonb_agg(x)
      from (
        select jsonb_build_object(
                 'host',  r.referrer_host,
                 'views', sum(r.views)
               ) as x
        from public.analytics_daily_referrers r
        where r.day between v_from and v_to
        group by r.referrer_host
        order by sum(r.views) desc, r.referrer_host
        limit p_limit
      ) ranked
    ), '[]'::jsonb),

    'topEntryPages', coalesce((
      select jsonb_agg(x)
      from (
        select jsonb_build_object(
                 'path',    e.page_path,
                 'entries', sum(e.entries)
               ) as x
        from public.analytics_daily_entries e
        where e.day between v_from and v_to
        group by e.page_path
        order by sum(e.entries) desc, e.page_path
        limit p_limit
      ) ranked
    ), '[]'::jsonb)
  ) into v_out;

  return v_out;
end;
$$;

-- A security definer function is granted EXECUTE to PUBLIC on creation, so the
-- revoke is what actually locks it down. Without it the published anon key
-- could call this over PostgREST's /rpc/ endpoint and read the whole dataset
-- straight through the definer rights.
revoke all on function public.analytics_traffic(integer, integer) from public, anon, authenticated;
grant execute on function public.analytics_traffic(integer, integer) to service_role;

comment on function public.analytics_traffic(integer, integer) is
  'Window aggregation for the admin dashboard, computed in-database so PostgREST row caps cannot silently truncate a sum. Service-role only.';
