# Admin Account Management - Design

**Created**: 2026-07-30
**Status**: Approved, not yet implemented
**Issue**: #177
**Scope**: Subsystem 2 of the admin dashboard - per-user lookup, progress reset, data export, and admin roster management. The read-only metrics of subsystem 1 are unchanged.

---

## Background

The admin dashboard shipped two of three planned subsystems. Traffic (GA4 plus
first-party) and progress aggregates are live. Account management was deferred:
`specs/2026-07-24-admin-analytics-backend-design.md:37` lists it as "User
management (first write path) | Later cycle", and line 307 puts write paths in
subsystem 2, explicitly out of scope for the first cycle.

Three consequences today:

- Granting or revoking admin access means hand-inserting into `public.admin_users`
  in the Supabase SQL editor. No UI, and no record of who was granted what.
- Progress is aggregate-only. `supabase/functions/admin-api/lib/progress.ts` reads
  `admin_progress_rollup`, so a support request like "my progress vanished" cannot
  be investigated from the dashboard at all.
- There is no deletion or export path, so a user asking to have their data removed
  is handled by hand against Postgres.

The current API is read-only. `supabase/functions/admin-api/index.ts` serves
exactly three routes - `/health`, `/overview`, `/traffic` - and contains no write
path anywhere.

### Relevant existing schema

```sql
-- public.admin_users: RLS enabled, ZERO policies, grants revoked from
-- anon+authenticated. Service-role access only.
admin_users (user_id uuid pk references auth.users on delete cascade,
             note text, created_at timestamptz)

-- public.runbook_progress: one JSONB blob per user, RLS scoped to auth.uid().
runbook_progress (id uuid pk, user_id uuid unique references auth.users
                  on delete cascade, progress jsonb, updated_at timestamptz)
```

The `on delete cascade` runs one way only: deleting an auth account removes its
progress, but deleting a progress row leaves the account intact. This design
relies on that asymmetry.

---

## Decisions

Scope was deliberately left open in #177. Settled here:

| Question | Decision |
|---|---|
| Which pieces | All three: per-user lookup, deletion/export, roster management |
| How to find a user | Exact match on full email or user id. **No enumeration endpoint.** |
| What "delete" deletes | The `runbook_progress` row only. The auth account survives. |
| Where the UI lives | A separate `/admin/accounts/` page, not a section of `/admin/` |

**Why exact-match only.** A browsable roster would mean building an endpoint that
returns every registered user's email address - the highest-exposure surface in
the design, and one a leaked admin session could dump wholesale. Support requests
always arrive with an email attached, so the enumeration buys nothing the use case
needs.

**Why progress-only deletion.** It covers the common ask ("reset my progress")
and leaves the account intact, so a GitHub re-sign-in does not resurrect a
half-state. Full account erasure stays a manual, deliberate SQL operation; making
it a dashboard button puts irreversible account destruction one misclick away.

---

## API surface

Six routes on the existing `admin-api` function, behind the unchanged `isAdmin`
guard and origin allowlist. The function currently ignores `req.method` entirely;
it begins routing on `(method, route)` so a GET can never reach a write.

| Method + route | Behavior |
|---|---|
| `GET /user?email=` \| `?id=` | Exact-match lookup. Returns user id, email, created_at, last_sign_in_at, and a progress summary. `404` if no match. |
| `GET /user/export?id=` | Full `runbook_progress.progress` JSONB verbatim plus account fields. |
| `POST /user/progress/reset` | Deletes the `runbook_progress` row for `{userId, confirmEmail}`. |
| `GET /admins` | Roster: user id, email, note, created_at. |
| `POST /admins` | Grant by exact `{email}`. |
| `POST /admins/revoke` | Revoke `{userId}`. Refuses self-revoke and refuses to empty the roster. |

### Three deliberate calls

**Revoke is `POST /admins/revoke`, not `DELETE /admins/:id`.** The route parser is
a prefix strip (`index.ts:61`); path parameters would require a real matcher. A
named action route keeps the parser unchanged and puts the two guards at an
obvious call site.

**No CSRF token.** Auth is an `Authorization: Bearer` header set by JS, never a
cookie, so a cross-site form post carries no credentials. Stated explicitly
because "first write path" normally implies CSRF work, and here it does not apply.

**Email lookup uses the service-role `auth.admin` API, not a SQL join.**
`auth.users` is outside the public schema and PostgREST cannot reach it. The exact
behavior of that API was probed against the live project before this design was
finalized; see "GoTrue filter behavior" below, because it does not do what the
route needs and the route is shaped around that.

### GoTrue filter behavior (probed 2026-07-30, live project)

Probed against `smulobzymizulakvaito` with the service-role key, with **two**
accounts present. Two accounts matters: with only one user in the table, a query
param that is silently ignored returns the same count as one that matched
exactly, and every result is ambiguous. The first probe run had one user and
produced a false positive; the numbers below are from the two-user run.

| Query | Users returned | Conclusion |
|---|---|---|
| `zzz_bogus=<unknown>` (control) | 2 | Unrecognized params are ignored, full list returned |
| `email=<unknown>` | 2 | **`email=` is not honored** - identical to the control |
| `email=<exact real>` | 2 | Ignored, not matched |
| `filter=<exact real email>` | 1 | `filter=` is honored |
| `filter=<unknown email>` | 0 | Genuinely applied, not a passthrough |
| `filter=%` | 2 | Full sweep |
| `filter=@` | 2 | Full sweep |
| `filter=ro` | 2 | Substring, and see below |
| `filter=Robson` | 1 | **Matches `user_metadata`, not just email** |
| `filter=Ryan` | 1 | Same |

The last two rows are the important ones. `Robson` appears nowhere in
`ringo380@gmail.com`; it exists only in that account's `user_metadata.full_name`.
GitHub OAuth populates `full_name`, `name`, `user_name`, and
`preferred_username`, and `filter=` searches across them.

So `filter=` is a **substring search over email and metadata**, not an email
lookup. Three consequences the implementation must honor:

1. **Exactness is enforced in the edge function, never delegated.** Take the
   returned set, compare each `email` to the query case-insensitively, and return
   `404` unless exactly one matches exactly. A `filter=` hit is a candidate, not
   an answer.
2. **Raw admin input never reaches `filter=`.** `%` and `@` each return the entire
   user table. Input is validated as a syntactically complete address first, so a
   typed `%` is a `400` rather than a roster dump - which is the enumeration the
   no-enumeration decision exists to prevent.
3. **A single-row response cannot be assumed.** A full-email filter can still
   return several accounts, since another user's metadata may contain that string.
   Request with an explicit `per_page`, narrow to the exact match, and treat "more
   candidates than one page" as a `409` rather than paging the user table.

---

## Safety model

Four mechanisms, ordered by how much they actually protect.

### 1. The last-admin guard lives in Postgres

A `before delete` trigger on `admin_users` that raises when the delete would leave
zero rows.

Implementing this in TypeScript as "count, then delete" is a check-then-act race:
two concurrent revokes both read `count = 2`, both proceed, the roster empties,
and recovery requires the SQL editor. The trigger closes the race regardless of
the caller - including hand-run SQL. The API keeps its own check only so the
common case returns a clean `409` rather than a raw Postgres error.

### 2. Destructive calls are self-validating

`POST /user/progress/reset` takes `{userId, confirmEmail}` and refuses unless both
belong to the same account.

The failure this prevents is concrete: an admin looks up user A, is interrupted,
looks up user B, and a stale `userId` still in page state deletes the wrong
person's progress. Requiring the pair to agree makes that impossible server-side
instead of trusting the UI to clear its own state.

### 3. Self-revoke is refused outright

Not because it is unrecoverable - the trigger already prevents total lockout - but
because the admin who would have to recover is the one locked out.

### 4. An `admin_audit` table

```sql
admin_audit (id uuid pk, actor_user_id uuid, action text,
             target_user_id uuid, detail jsonb, created_at timestamptz)
```

RLS enabled, zero policies, grants revoked - the same posture as `admin_users`.
Every write route inserts a row before returning. This answers #177's "no audit
trail of who was granted what", and is the only thing that makes a write path
reviewable after the fact.

It stores target **user ids, never emails**. The ids are already in these tables;
the emails would be a second copy of PII in a new place.

### Status codes

| Code | Meaning |
|---|---|
| `400` | Malformed input (no identifier, both identifiers, unparseable body) |
| `403` | Guard violation (not an admin, self-revoke) |
| `404` | No such user |
| `409` | Conflict (last admin, already granted) |
| `200` | Success |

### Explicitly not doing

No soft-delete or undo for progress reset. A reset user signs in and starts over -
the same outcome as the "my progress vanished" case that motivates the feature. A
restore path would require progress snapshots the site does not keep.

---

## Frontend

New page `admin-accounts.md` at repo root, mirroring `admin.md` and reusing
`overrides/admin.html` for the noindex meta. No new template.

Wiring requires four edits:

1. `setup-docs.sh` - symlink into `docs/`
2. `assets/javascripts/interactive.js` - `COMPONENT_SCRIPTS` entry plus the two
   `getElementById` load guards that currently gate `dashboard.js`
3. `check-site.sh` - see below
4. `assets/stylesheets/admin.css` - reused, extended for forms

**`mkdocs.yml` needs no edit.** The config sets no `validation` block, so MkDocs
leaves `not_in_nav` at INFO and `--strict` (which fails on WARNING and above) does
not trip on it. This is why `admin.md` builds today while absent from the nav, and
the new page inherits the same behavior.

### The check-site.sh edit is load-bearing

`check-site.sh` currently asserts three things about `/admin/`: absent from
`sitemap.xml`, carries a `noindex` robots meta, absent from the search index. A
second admin page inherits **none** of these automatically.

The existing checks get parameterized over both pages. Without this,
`/admin/accounts/` can ship indexed - which is how a page that resolves email
addresses ends up in a search engine.

### Module structure

`assets/javascripts/components/admin/accounts.js`, sibling to `dashboard.js` and
following its contract: pure `render*` functions taking a payload, table text
only, nothing that exists solely in a canvas.

Backend splits into `lib/accounts.ts` (lookup, export, reset) and `lib/roster.ts`
(list, grant, revoke guards), leaving `index.ts` as routing only.

### Failure containment

Each section renders independently, as Traffic does on `/admin/`. A roster fetch
failure must not blank a successful user lookup.

---

## Testing

| Layer | Covers |
|---|---|
| Deno, pure | Input parsing (email vs id vs neither vs both), `confirmEmail` mismatch, revoke guards, status-code mapping |
| Deno, stubbed client | Lookup, reset, grant, revoke against a fake `supabaseAdmin`, following `tests/traffic_test.ts` |
| Vitest | DOM render tests for `accounts.js`, following `tests/js/admin-dashboard.test.js` |

### Mutation check

Break each guard in turn - remove the self-revoke check, remove the `confirmEmail`
comparison, invert the last-admin condition - and confirm that exactly the intended
test fails, with no collateral. A guard whose test still passes when the guard is
deleted is not a guard.

Run the whole matrix again after any refactor of the code under test. Restore the
mutated file with a `trap ... EXIT INT TERM`, not on the happy path only, and
`git diff` after the matrix to confirm the tree is clean.

---

## Verification

`./verify.sh` covers the pure modules, the DOM tests, and the strict MkDocs build.

**Two things it cannot cover**, because they only exist against real Supabase:

1. **The last-admin trigger.** Verified by hand: with two rows, delete one
   (succeeds); with one row, delete it (must raise). Run in a transaction that is
   rolled back, against the real project.
2. **The `auth.admin` filter behavior.** Already probed - see "GoTrue filter
   behavior" above. What remains is verifying the route built on top of it:
   against the deployed function, a known email returns exactly one user, an
   unknown email returns `404`, a bare `%` returns `400` and not a roster, and a
   partial address returns `404` rather than a fuzzy hit.

Both are manual steps in the implementation plan, not something the green gate
proves. Neither may be reported as verified on the strength of `verify.sh`
passing.

### Probing precondition

Any future probe of the lookup route needs **at least two accounts** in the
project. With one, an ignored parameter and a working filter both return one row,
and the probe cannot fail. Assert the user count before believing any result.

---

## Out of scope

- Full account deletion (`auth.admin.deleteUser`) - stays a manual SQL operation
- User enumeration or a browsable roster of registered users
- Per-user progress editing - reset is all-or-nothing
- Progress snapshots or undo
