-- Make the last-admin guard actually close the race it exists to close.
--
-- The first version counted the surviving rows with a plain select. That is a
-- non-locking read: under READ COMMITTED it runs against a snapshot that cannot
-- see another transaction's uncommitted delete. Two admins revoking each other
-- at the same time therefore both saw a survivor, both allowed the delete, and
-- both committed - leaving an empty roster and a recovery that needs the SQL
-- editor, which is exactly what this trigger is for.
--
-- Locking the would-be survivors instead makes the second transaction block on
-- the first one's row and re-evaluate after it commits, at which point there is
-- no survivor left to find and the delete is refused.
--
-- `select count(*) ... for update` is not an option: Postgres rejects FOR UPDATE
-- with an aggregate (0A000). `perform ... for update` is the form that parses.
create or replace function public.admin_users_last_admin_guard()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  -- Inside a BEFORE DELETE the target row is still present, so exclude it
  -- explicitly rather than relying on visibility rules. Postgres locks the
  -- target tuple before firing the row trigger, so a concurrent deleter's row
  -- is genuinely locked by the time this runs.
  perform 1 from public.admin_users where user_id <> old.user_id for update;
  if not found then
    raise exception 'cannot remove the last admin' using errcode = 'P0001';
  end if;
  return old;
end;
$$;

comment on function public.admin_users_last_admin_guard is
  'Refuses a delete that would leave zero admins. Locks the surviving rows so '
  'two concurrent revokes cannot both see a survivor and both proceed.';
