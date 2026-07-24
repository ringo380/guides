-- Admin identity. Membership in this table is the ONLY thing that grants
-- admin access. RLS is enabled with no policies, so no client-side key can
-- read or write it; only the service-role client inside the edge function
-- can see it.
create table public.admin_users (
  user_id uuid primary key references auth.users(id) on delete cascade,
  note text,
  created_at timestamptz not null default now()
);

alter table public.admin_users enable row level security;

-- Defense in depth. The public schema has default privileges granting anon and
-- authenticated full DML on new tables, so this table is created with those
-- grants attached. RLS already denies every row while no policy exists, but
-- revoking means a future accidental policy cannot expose the allowlist.
revoke all on public.admin_users from anon, authenticated;

comment on table public.admin_users is
  'Admin allowlist. Intentionally has no RLS policies: service-role access only.';
