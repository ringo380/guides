-- Record refused admin actions, not only successful writes.
--
-- Until now a row in admin_audit meant "a write happened", so a destructive
-- action that was REFUSED left no trace at all: a reset submitted with the
-- wrong confirmation address, a self-revoke, a revoke that would have emptied
-- the roster. Those are the events most worth having on record - a successful
-- reset is an admin doing their job, an attempted one that was blocked is the
-- thing you want to find later.
--
-- Two changes make room for them without weakening what the table already
-- claims:
--
--   * `outcome` splits the two kinds of row. It defaults to 'succeeded', so
--     every row written before this migration keeps exactly the meaning it had,
--     and the invariant "a succeeded row means the write committed" survives -
--     it is still only written inside the atomic write functions.
--   * `reason` says why a refusal was refused, as one of a fixed set of
--     strings the edge function already returns to the caller. It is nullable
--     and must stay null on success: "why did this succeed" has no answer.
--
-- `reason` carries no user input. The refusal that is most tempting to
-- describe in detail - a confirmation address that did not match - must record
-- only that it did not match. Storing the submitted address would put an email
-- in this table, which is the one thing its comment promises it does not do,
-- and would do it on the path where the address is most likely to be the wrong
-- person's.

alter table public.admin_audit
  add column outcome text not null default 'succeeded',
  add column reason text;

-- A free-text outcome would let a future caller invent a third value and
-- silently divide the log into groups no query knows to look for.
alter table public.admin_audit
  add constraint admin_audit_outcome_check
  check (outcome in ('succeeded', 'refused'));

-- A refusal without a reason is barely more useful than no row, and a success
-- with one implies something went wrong that did not.
alter table public.admin_audit
  add constraint admin_audit_reason_matches_outcome
  check (
    (outcome = 'refused' and reason is not null) or
    (outcome = 'succeeded' and reason is null)
  );

-- Refusals are read as "what was blocked recently", which is a scan by outcome
-- over a time window. The existing created_at index alone would have to read
-- every successful write to find them.
create index idx_admin_audit_refusals
  on public.admin_audit (created_at desc)
  where outcome = 'refused';

-- Retention: refusals are kept exactly as long as writes, which is to say
-- indefinitely, and deliberately.
--
-- analytics_events gets a 400-day prune because it holds a row per page view
-- from every reader. This table holds a row per deliberate action by an
-- account that is already an admin, and there is one admin. Its growth rate is
-- bounded by human effort, so a retention window would be solving a problem
-- that cannot occur while removing the record that makes the log worth having.
-- Expiring refusals SOONER than writes would be the worst of the options: the
-- security-interesting half would be the half that disappears.

create or replace function public.admin_record_refusal(
  p_actor uuid,
  p_action text,
  p_target uuid,
  p_reason text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if p_reason is null or btrim(p_reason) = '' then
    raise exception 'a refusal must carry a reason' using errcode = 'P0003';
  end if;
  insert into public.admin_audit (actor_user_id, action, target_user_id, outcome, reason)
  values (p_actor, p_action, p_target, 'refused', p_reason);
end;
$$;

-- Deliberately cannot write a 'succeeded' row. Success is recorded only inside
-- the functions that perform the write it is claiming, in the same transaction,
-- and a second door into the log that skips the write would make every success
-- row a claim rather than a fact.
revoke all on function public.admin_record_refusal(uuid, text, uuid, text) from public, anon, authenticated;
grant execute on function public.admin_record_refusal(uuid, text, uuid, text) to service_role;

comment on function public.admin_record_refusal is
  'Records a refused admin action. Cannot record a success. Service-role only.';

comment on column public.admin_audit.outcome is
  'succeeded (the write committed, written only inside the atomic write functions) or refused (a guard blocked it).';
comment on column public.admin_audit.reason is
  'Why a refusal was refused. Null on success. Never contains user input.';
