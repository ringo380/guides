-- Append-only record of every admin write. Same posture as admin_users: RLS on
-- with zero policies plus revoked grants, so only the service-role client inside
-- the edge function can read or write it.
--
-- Stores target user ids, never emails. The ids are already in these tables; the
-- emails would be a second copy of PII in a new place.
create table public.admin_audit (
  id uuid primary key default gen_random_uuid(),
  -- Nullable, and `on delete set null` rather than cascade: deleting an account
  -- must not erase the record of what that account did while it was an admin.
  -- A null actor means "the acting account has since been deleted", which is
  -- information worth keeping. `not null` here would contradict the set-null.
  actor_user_id uuid references auth.users(id) on delete set null,
  action text not null,
  target_user_id uuid,
  detail jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

alter table public.admin_audit enable row level security;
revoke all on public.admin_audit from anon, authenticated;

create index idx_admin_audit_created_at on public.admin_audit (created_at desc);

comment on table public.admin_audit is
  'Admin write audit log. Service-role access only. Stores user ids, never emails.';
