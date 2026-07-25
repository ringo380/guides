# Admin and Analytics Backend - Design

**Created**: 2026-07-24
**Status**: Approved, not yet implemented
**Scope**: Foundation (server-side API, admin identity, schema-as-code) + read-only analytics dashboard

---

## Background

runbook.fyi is a static MkDocs site on GitHub Pages. The only backend today is
Supabase-as-a-service, hit directly from the browser with the anon key:

- One table, `public.runbook_progress`, RLS-scoped so each signed-in user reads and
  writes only their own row. Used solely for cross-device progress sync
  (`assets/javascripts/lib/sync.js`).
- GA4 property `G-56L2QXTFGR`, receiving 33 distinct custom events from the
  interactive components via `assets/javascripts/lib/analytics.js`.

There is no admin interface, no server-side code, and no tracked database schema.
Administration means logging into Supabase Studio and the GA4 UI by hand.

## Goal

A server-side API holding the Supabase service-role and GA4 Data API credentials,
serving a single aggregated payload to a gated dashboard page on runbook.fyi.

## Decomposition

The original request covered four independent subsystems. They are split into
separate spec/plan/build cycles:

| # | Subsystem | Status |
|---|---|---|
| 0 | Foundation - API, admin identity, migrations | **This spec** |
| 1 | Analytics dashboard (read-only) | **This spec** |
| 2 | User management (first write path) | Later cycle |
| 3 | Cohort / access control | Later cycle |
| 4 | Content ops | Revisit after 0 lands; likely shrinks substantially |

Item 4 is deliberately deferred and expected to shrink. Broken-link detection is
already covered by `mkdocs build --strict`, and a thin-guide report is better as a
local script than a dashboard. Only feedback-widget submissions and a possible
redeploy trigger genuinely need server state.

Item 3 is the only subsystem that changes public site behavior rather than adding
an admin view. It converts an open-access site into a gated one and warrants its
own design conversation.

---

## Architecture

```
runbook.fyi/admin/          (static shell, empty by default,
        |                    excluded from nav + search + sitemap)
        |  fetch() with existing Supabase session JWT
        v
<ref>.supabase.co/functions/v1/admin-api/*     (Deno edge function)
        |                    |
        | service-role       | GA4 Data API (service account)
        v                    v
   Postgres              GA4 property
   - runbook_progress    - 33 custom events
   - admin_users
   - admin_metrics_cache
```

### Runtime choice

Supabase Edge Function, chosen over a Cloudflare Worker or Vercel function because:

- The service-role key never crosses a network boundary to a third party. It is a
  secret in the same platform that issues it.
- JWT verification is native (`auth.getUser()`), not a hand-rolled JWKS check.
- One vendor, one secret store.
- The site already makes cross-origin calls to `smulobzymizulakvaito.supabase.co`,
  so CORS and CSP are already proven against that host.
- `supabase/migrations/` supplies the schema-as-code the repo currently lacks.

runbook.fyi DNS is at Namecheap (`dns1/dns2.registrar-servers.com`) pointing at
GitHub Pages. There is no Cloudflare in front of the domain, so a Worker would be
a cross-origin `workers.dev` endpoint anyway, with secrets split across two
vendors. A Worker becomes the better choice only if the domain moves to Cloudflare
for unrelated reasons.

### New paths in the repo

- `supabase/migrations/` - schema as code
- `supabase/functions/admin-api/` - the Deno function
- `assets/javascripts/admin/` - dashboard renderer, vanilla class-based JS matching
  existing component conventions; no build toolchain
- `specs/` - this document

### Migration ordering

The first migration is a `supabase db pull` capturing `runbook_progress` exactly as
it exists in production today. Current production schema lives only in Supabase's UI
and nowhere in git. That is corrected before any new table is layered on top.

---

## Admin identity

A table, not a JWT claim:

```sql
create table admin_users (
  user_id uuid primary key references auth.users(id) on delete cascade,
  note text,
  created_at timestamptz default now()
);
alter table admin_users enable row level security;
-- Intentionally no policies: nothing client-side can read or write this table.
-- Only the service-role client inside the edge function sees it.
```

Request flow:

1. Read `Authorization: Bearer <jwt>`.
2. Verify with an anon-key client via `auth.getUser()`, which validates the
   signature server-side. Reject with 401 if invalid.
3. Take the returned user id and look it up in `admin_users` using the service-role
   client. Reject with 403 if absent.

The client never asserts its own role. The only thing it sends is a JWT it cannot
forge. Admin status is deliberately not a JWT custom claim, because a table lookup
is simpler to reason about and revocation is immediate.

Bootstrap: insert your own `auth.users` id once via Studio or a seed migration.

## Secrets

`SUPABASE_SERVICE_ROLE_KEY` and `SUPABASE_URL` are injected into edge functions
automatically. Two are added via `supabase secrets set` and stored in 1Password:

- `GA4_PROPERTY_ID` - the numeric property ID. **This is not `G-56L2QXTFGR`**, which
  is the measurement ID. Passing the measurement ID produces a confusing permission
  error rather than a clear one.
- `GA4_SA_KEY` - a GCP service account JSON, base64-encoded, granted Viewer on the
  GA4 property.

---

## Endpoints

| Endpoint | Returns |
|---|---|
| `GET /admin-api/health` | `{ admin: true }` or 401/403. Cheap. The page calls this first and renders nothing until it returns true. |
| `GET /admin-api/overview?range=28d` | The entire dashboard payload in one response. `range` accepts `7d`, `28d`, `90d`. |

One aggregated endpoint rather than many thin ones: the cache is per-payload, and a
single round trip keeps page logic trivial. Drill-down endpoints are deferred until
the overview has been in use long enough to show which figure needs expanding.

## Metrics

The payload carries two clearly separated sections, because they describe two
different populations:

**`ga4` - all visitors.** Anonymous traffic, the overwhelming majority. DAU/WAU/MAU,
sessions, top guides by pageview, traffic sources, and counts for the existing
custom events: `quiz_answer`, `exercise_complete`, `terminal_complete`,
`walkthrough_complete`, `section_read`, `search_query`, `command_copy`.

**`progress` - signed-in users only.** Registered user count, per-guide completion
counts, quiz pass rates, and a funnel: signed up -> any progress recorded ->
completed at least one guide.

### Population caveat

Quiz data exists in both sections. GA4 records `quiz_answer` events from all
visitors; Supabase holds actual scores for signed-in users only. These numbers will
never agree, and the gap is population, not a defect. Every rendered figure carries
its source label, so a pass rate derived from the signed-in slice is never read as
site-wide.

### Progress aggregation

`runbook_progress.progress` is a jsonb blob keyed by page. Aggregating across users
requires `jsonb_each`. That query lives in a SQL view, `admin_progress_rollup`,
defined in a migration - not as a query string embedded in the function. This keeps
the SQL independently reviewable and testable.

## Cache

```sql
create table admin_metrics_cache (
  key text primary key,          -- e.g. 'overview:28d'
  payload jsonb not null,
  fetched_at timestamptz not null default now()
);
```

TTL is 15 minutes, fetch-on-demand, no cron. GA4 itself lags 24-48 hours on some
metrics, so sub-hour freshness is largely illusory. On a cache miss the function
fetches GA4 and Postgres in parallel and writes the merged result.

A cache is required rather than optional: the GA4 Data API typically takes 1-3
seconds per report, several reports are needed per dashboard load, and the API is
quota-limited.

### Stale-on-error

If GA4 fails or times out, the function serves the expired cache with `stale: true`
and its age, rather than returning an error. GA4's Data API fails often enough
(quota, transient 503s) that treating its failure as fatal would make the dashboard
appear broken when only one of two sources is down.

If there is no cache to fall back on, the response still returns the `progress`
section with `ga4: { error: ... }`. Partial degradation, not total failure.

---

## Error handling

| Case | Response |
|---|---|
| No, malformed, or expired JWT | `401`, opaque body |
| Valid user, not in `admin_users` | `403`, opaque body |
| Too many requests | `429`, per-admin counter (see below) |
| GA4 unavailable | `200` with stale cache and `stale: true`, or partial payload |
| Unexpected failure | `500` with a correlation id and nothing else |

Rate limiting is a row in `admin_metrics_cache` keyed `ratelimit:<user_id>`, holding
a request count and window start. Edge function instances are not shared, so an
in-memory counter would not hold; the existing cache table avoids adding another.
The limit is generous (60 requests/minute) and exists to stop a polling tab from
burning GA4 quota, not to defend against an attacker who already holds an admin JWT.

CORS uses an explicit allowlist - `https://runbook.fyi` plus `http://localhost:8000`
for `mkdocs serve` - never `*`. With `Authorization` among the allowed headers, a
wildcard would be careless.

Logging records admin user id, endpoint, and duration. Never the JWT, never the
service-role key, never the GA4 service account JSON.

The `/admin/` page ships `<meta name="robots" content="noindex">` via a dedicated
template in `overrides/`, and is excluded from nav (omitted from `mkdocs.yml`), from
the search index (`search.exclude: true` in page frontmatter), and from the sitemap. Its HTML shell remains publicly fetchable;
this is accepted by design, because the shell contains no data. All real content
arrives from an authorized API call.

---

## Accessibility contract

A build requirement, not a polish pass:

- Every metric renders as a semantic `<table>` with `<caption>` and `<th scope>`.
  The table is the primary artifact.
- Charts are optional decoration. Any chart carries `aria-hidden="true"` and never
  holds a number absent from the table.
- Trend direction is stated in words ("up 12% vs previous 28 days"), never conveyed
  by an arrow glyph or by red/green alone.
- Reuses the existing `--rb-color-*` semantic tokens, `:focus-visible` rules, and
  `prefers-reduced-motion` blocks from `assets/stylesheets/interactive.css`. No new
  hardcoded hex values.
- Verification is a DOM text assertion, never a screenshot.

---

## Testing

Pure logic is extracted out of the request handler so it can be tested without a
network: cache TTL decision, range parsing, payload merge, stale-on-error selection.

- **Deno tests** cover that logic plus the auth guard.
- **Vitest + jsdom** covers the renderer using the existing `tests/js/helpers.js`
  mocks, including an assertion that every metric value appears as text.

### Mutation matrix

Run as a single pass over the whole guard set rather than test-by-test. Delete or
invert each guard in turn and record which tests fail:

1. JWT verification
2. `admin_users` membership check
3. CORS origin allowlist
4. Cache TTL expiry
5. Stale-on-error fallback
6. Service-role key never reaching the client

Any row with zero failures is either dead code or an unguarded rule, and the two
cannot be distinguished without inspection. Rows are classified on exit code as well
as failure count, so a mutation that crashes the harness is not misread as
"untested". Before trusting any zero row, confirm the mutation is a real semantic
change and that its anchor matches exactly one site.

### Verification gate

Everything runs from one local script, `./verify.sh`: python tests, vitest, deno
test, and `mkdocs build --strict`. The existing `.github/workflows/pr-check.yml` is
changed to call that script rather than duplicating the steps in YAML. No new
workflow is added.

### Known baseline

`tests/js/storage.test.js` already fails on `main` (10 tests, jsdom/RunbookStorage
init issue). Record this before starting; it is pre-existing and not a regression
introduced by this work.

---

## Out of scope

- User management write paths (subsystem 2)
- Cohort and access control (subsystem 3)
- Content ops (subsystem 4)
- Historical trend storage beyond GA4's own retention
- Drill-down endpoints beyond the single overview payload
