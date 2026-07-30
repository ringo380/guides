-- First-party analytics event storage.
--
-- Background: the GA4 half of the admin dashboard reports nothing useful. Two
-- independent causes, one fixed (consent acceptance was discarded, #165) and
-- one that no GA4-side change can reach (ad blockers drop gtag.js outright).
-- This table is the collection the site owns. See
-- specs/2026-07-26-first-party-analytics-design.md.
--
-- Privacy posture: nothing is written to the visitor's device, no cookie, no
-- persistent identifier, and neither IP nor user agent is ever stored. Only a
-- hash derived from them under a salt that is discarded daily.

create table public.analytics_salt (
  -- Single row, enforced by the check constraint rather than by convention, so
  -- a second salt cannot appear and silently split visitors into two identity
  -- spaces for the same day.
  id          smallint primary key default 1 check (id = 1),
  salt        text not null,
  rotated_at  timestamptz not null default now()
);

alter table public.analytics_salt enable row level security;
revoke all on public.analytics_salt from anon, authenticated;

comment on table public.analytics_salt is
  'Rotating salt for visitor hashing. Never leaves the database. Service-role access only.';

-- gen_random_bytes lives in pgcrypto, which Supabase installs into `extensions`.
insert into public.analytics_salt (id, salt)
values (1, encode(extensions.gen_random_bytes(32), 'hex'));


create table public.analytics_events (
  id            bigint generated always as identity primary key,
  occurred_at   timestamptz not null default now(),
  -- Derived server-side from IP + user agent + the day's salt. Yesterday's
  -- salt is gone, so yesterday's hashes cannot be recomputed or joined to
  -- today's. This is what buys accurate daily uniques without storing an
  -- identifier on the device, and it is also why cross-day analysis of
  -- anonymous visitors is impossible by construction rather than by policy.
  visitor_hash  text not null,
  -- Signed-in visitors additionally carry a stable id, because they chose to
  -- have an account. This is the only cross-day identity in the table.
  user_id       uuid references auth.users(id) on delete set null,
  event_name    text not null,
  page_path     text not null,
  -- Denormalised at write time so funnel queries do not re-parse paths on
  -- every read.
  topic         text,
  -- Host only. A full referring URL can carry query strings and personal data.
  referrer_host text,
  -- Flagged at ingest, filtered in the views. A user-agent denylist is never
  -- complete, so discarding these rows at ingest would leave every future
  -- improvement unable to reach the data it should have caught.
  is_bot        boolean not null default false,
  props         jsonb not null default '{}'::jsonb
);

alter table public.analytics_events enable row level security;
revoke all on public.analytics_events from anon, authenticated;

comment on table public.analytics_events is
  'Raw first-party analytics events. Service-role access only; written through analytics_record().';

-- Every read is time-bounded and excludes bots, so the indexes carry that
-- predicate rather than paying for rows no query wants.
create index analytics_events_occurred_idx
  on public.analytics_events (occurred_at desc) where not is_bot;
create index analytics_events_page_idx
  on public.analytics_events (page_path, occurred_at desc) where not is_bot;
create index analytics_events_topic_idx
  on public.analytics_events (topic, occurred_at desc) where not is_bot and topic is not null;


-- Write path. One round trip: the salt is read, rotated if stale, and applied
-- without ever leaving the database, so it cannot appear in an edge-function
-- log or an error trace.
--
-- security definer because the caller (service_role) must not need direct
-- privileges on analytics_salt. search_path is pinned: a security definer
-- function without it can be hijacked by a caller-controlled search_path.
create or replace function public.analytics_record(
  p_ip            text,
  p_ua            text,
  p_event_name    text,
  p_page_path     text,
  p_topic         text default null,
  p_referrer_host text default null,
  p_props         jsonb default '{}'::jsonb,
  p_user_id       uuid default null,
  p_is_bot        boolean default false
) returns void
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_salt text;
begin
  -- Rotate first. The update takes a row lock, so a concurrent caller waits
  -- and then matches zero rows rather than generating a second salt for the
  -- same day.
  update public.analytics_salt
     set salt = encode(gen_random_bytes(32), 'hex'),
         rotated_at = now()
   where id = 1
     and rotated_at < date_trunc('day', now());

  select salt into v_salt from public.analytics_salt where id = 1;

  insert into public.analytics_events (
    visitor_hash, user_id, event_name, page_path, topic,
    referrer_host, is_bot, props
  ) values (
    encode(digest(coalesce(p_ip, '') || '|' || coalesce(p_ua, '') || '|' || v_salt, 'sha256'), 'hex'),
    p_user_id, p_event_name, p_page_path, p_topic,
    p_referrer_host, p_is_bot, coalesce(p_props, '{}'::jsonb)
  );
end;
$$;

revoke all on function public.analytics_record(
  text, text, text, text, text, text, jsonb, uuid, boolean
) from public, anon, authenticated;
grant execute on function public.analytics_record(
  text, text, text, text, text, text, jsonb, uuid, boolean
) to service_role;

comment on function public.analytics_record(text, text, text, text, text, text, jsonb, uuid, boolean) is
  'Sole write path for analytics_events. Derives the visitor hash from the rotating daily salt.';


-- Retention is a stated policy, not an accident of never deleting.
create or replace function public.analytics_prune(retain_days integer default 400)
returns bigint
language plpgsql
security definer
set search_path = public
as $$
declare
  v_deleted bigint;
begin
  if retain_days is null or retain_days < 1 then
    raise exception 'retain_days must be >= 1, got %', retain_days;
  end if;
  delete from public.analytics_events
   where occurred_at < now() - make_interval(days => retain_days);
  get diagnostics v_deleted = row_count;
  return v_deleted;
end;
$$;

revoke all on function public.analytics_prune(integer) from public, anon, authenticated;
grant execute on function public.analytics_prune(integer) to service_role;

comment on function public.analytics_prune(integer) is
  'Deletes events older than retain_days (default 400). Returns the row count deleted.';
