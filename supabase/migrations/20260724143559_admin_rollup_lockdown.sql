-- Lock down admin_progress_rollup.
--
-- As originally created the view was exploitable: public-schema default
-- privileges granted anon and authenticated SELECT on it, and a Postgres view
-- runs with the owner's rights by default, so it bypassed the RLS on
-- runbook_progress. PostgREST served it to the published anon key with HTTP
-- 200. It returned no rows only because production progress happened to be
-- empty at the time, which would have made any row-count check a false
-- all-clear.
--
-- Two independent fixes, deliberately not relying on either alone:
--   1. security_invoker makes RLS evaluate against the caller, so even if a
--      grant leaks back, anon sees zero rows.
--   2. the revoke stops PostgREST exposing the view over the Data API at all.
--
-- service_role keeps SELECT because the edge function reads through it, and
-- service_role bypasses RLS, so it still sees every row under invoker rights.

alter view public.admin_progress_rollup set (security_invoker = true);

revoke all on public.admin_progress_rollup from anon, authenticated;

grant select on public.admin_progress_rollup to service_role;
