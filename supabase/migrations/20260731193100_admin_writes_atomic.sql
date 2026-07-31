-- Make each admin write and its audit row one atomic operation.
--
-- Before this, the edge function issued the write and then wrote the audit row
-- as a second, separate request. When the audit insert failed, the write had
-- already committed, the error escaped the handler as the platform's default
-- 500 - which carries no CORS headers - and the page told the admin "Nothing
-- was deleted" about a row that was already gone, with no audit record of it.
--
-- A plpgsql function body runs inside a single transaction, so the pair now
-- commits or aborts together. The invariant the audit log claims for itself -
-- a missing row means the write did not happen - is enforced here rather than
-- assumed by two hopeful round trips.
--
-- `detail` is left at its default empty object on purpose: it must never carry
-- an email address. The target's id is already recorded, and an email here
-- would be a second copy of PII in a new table.
--
-- These are security definer because the tables are service-role-only (RLS on
-- with zero policies, grants revoked). Execute is revoked from public so the
-- definer rights cannot be borrowed by anon or authenticated callers.

create or replace function public.admin_reset_progress(
  p_actor uuid,
  p_target uuid
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  delete from public.runbook_progress where user_id = p_target;
  -- No row-count check: resetting an account that never saved any progress is
  -- a legitimate admin action, and it is still worth recording.
  insert into public.admin_audit (actor_user_id, action, target_user_id)
  values (p_actor, 'progress.reset', p_target);
end;
$$;

create or replace function public.admin_grant_admin(
  p_actor uuid,
  p_target uuid,
  p_note text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  -- A concurrent grant of the same account raises 23505 here, which aborts the
  -- function before the audit row is written. The caller maps it to the same
  -- 409 its own check-then-act roster read reports.
  insert into public.admin_users (user_id, note) values (p_target, p_note);
  insert into public.admin_audit (actor_user_id, action, target_user_id)
  values (p_actor, 'admin.grant', p_target);
end;
$$;

create or replace function public.admin_revoke_admin(
  p_actor uuid,
  p_target uuid
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  removed int;
begin
  delete from public.admin_users where user_id = p_target;
  get diagnostics removed = row_count;
  -- Someone else revoked this admin between the caller's roster read and this
  -- delete. Nothing was removed, so nothing may be audited: an audit row here
  -- would record a revoke that this request did not perform.
  if removed = 0 then
    raise exception 'not an admin' using errcode = 'P0002';
  end if;
  insert into public.admin_audit (actor_user_id, action, target_user_id)
  values (p_actor, 'admin.revoke', p_target);
end;
$$;

revoke all on function public.admin_reset_progress(uuid, uuid) from public, anon, authenticated;
revoke all on function public.admin_grant_admin(uuid, uuid, text) from public, anon, authenticated;
revoke all on function public.admin_revoke_admin(uuid, uuid) from public, anon, authenticated;

grant execute on function public.admin_reset_progress(uuid, uuid) to service_role;
grant execute on function public.admin_grant_admin(uuid, uuid, text) to service_role;
grant execute on function public.admin_revoke_admin(uuid, uuid) to service_role;

comment on function public.admin_reset_progress is
  'Deletes a runbook_progress row and records the audit entry atomically. Service-role only.';
comment on function public.admin_grant_admin is
  'Adds an admin_users row and records the audit entry atomically. Service-role only.';
comment on function public.admin_revoke_admin is
  'Removes an admin_users row and records the audit entry atomically. Raises P0002 if the target was not an admin. Service-role only.';
