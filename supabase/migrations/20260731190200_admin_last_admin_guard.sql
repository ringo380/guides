-- Refuse to empty the admin roster.
--
-- This lives in Postgres rather than the edge function because the TypeScript
-- version is a check-then-act race: two concurrent revokes both read count = 2,
-- both proceed, and the roster empties. Recovery then needs the SQL editor.
-- A trigger closes the race for every caller, including hand-run SQL.
create or replace function public.admin_users_last_admin_guard()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  -- Count rows that would remain. Inside a BEFORE DELETE the row is still
  -- present, so exclude it explicitly rather than relying on visibility rules.
  if (select count(*) from public.admin_users where user_id <> old.user_id) = 0 then
    raise exception 'cannot remove the last admin' using errcode = 'P0001';
  end if;
  return old;
end;
$$;

create trigger admin_users_last_admin_guard
  before delete on public.admin_users
  for each row execute function public.admin_users_last_admin_guard();

comment on function public.admin_users_last_admin_guard is
  'Refuses a delete that would leave zero admins. Guards against lockout.';
