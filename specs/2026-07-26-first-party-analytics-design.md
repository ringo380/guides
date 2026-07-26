# First-Party Analytics - Design

**Created**: 2026-07-26
**Status**: Approved, not yet implemented
**Scope**: First-party event collection and the dashboard views built on it. GA4 stays in place unchanged.

---

## Background

The admin dashboard shipped with two halves: a GA4 half for traffic and a progress
half for signed-in users. Verifying it in a live browser showed the GA4 half returns
all zeros, and the cause is not a bug in the edge function.

`overrides/partials/integrations/analytics/google.html` implements Consent Mode v2
and starts with `analytics_storage: "denied"`, upgrading to `granted` only when a
visitor accepts analytics cookies in the Material consent banner. GA4 accepts the
resulting hits (they return `204`) but treats them as cookieless consent-mode pings,
which feed conversion modelling and never populate standard or realtime reports.

Confirmed directly against property `525117219`:

| Check | Result |
|---|---|
| Property and stream config | Correct: `G-56L2QXTFGR` maps to `https://runbook.fyi/` |
| 28-day report, activeUsers/sessions/screenPageViews | `row_count: 0` |
| gtag loads and fires in browser | Yes, four `/g/collect` requests, `204` responses |
| Page's own gtag events in realtime | Absent |
| Raw `fetch` to `/g/collect` bypassing consent | Appears in realtime within seconds |
| Cookies set on the site | None at all |

So the pipeline works and the property is empty because nearly nobody grants consent.

This invalidates a load-bearing assumption. `admin_progress_rollup` carries the
comment "Does not include anonymous visitors, whose activity appears in GA4 instead."
Anonymous visitors appear nowhere. With one registered user, the current dashboard
describes almost none of the site's actual traffic.

Tracked as issue #163. Related fixes that landed while investigating: #158, #159,
and #161.

## Goal

Measure the site from first-party data the site itself owns, covering anonymous and
signed-in visitors alike, without reversing the site's privacy posture. GA4 remains
wired up and unchanged so nothing already working is lost.

## Decisions

| Decision | Choice | Reason |
|---|---|---|
| Collection scope | Anonymous and signed-in | Signed-in-only data describes one user; the volume is anonymous |
| Visitor identity | Rotating server-side hash | No device storage, no cookie, no consent prompt needed |
| Aggregation | SQL views over a raw events table, cached | Fewest moving parts; every metric stays re-derivable |
| GA4 | Left exactly as-is | Still useful if consent rates ever rise; costs nothing to keep |

### Visitor identity in detail

The ingest endpoint derives `visitor_hash = sha256(ip + user_agent + daily_salt)`
server-side. The salt rotates every 24 hours and previous salts are discarded, so
yesterday's hashes cannot be recomputed or joined to today's. This is the model used
by Plausible and Fathom.

Consequences, stated plainly:

- Accurate daily uniques, page views, entry pages, referrers, and same-day funnels.
- No cross-day retention or cohort analysis for anonymous visitors. That is the
  deliberate price of not storing an identifier on the device.
- No IP or user agent is ever persisted. Only the hash is stored.
- Signed-in visitors additionally carry `user_id`, which does persist and does
  support cross-day analysis, because they have an account by choice.

## Architecture

```
browser  ->  POST /functions/v1/collect  ->  analytics_events (raw)
                                                    |
                                         SQL views (traffic, funnel,
                                         engagement, per-user)
                                                    |
                             admin-api /overview  ->  admin_metrics_cache
                                                    |
                                            admin dashboard page
```

Five units, each independently understandable and testable:

1. **Client beacon** (`assets/javascripts/lib/collect.js`). Sends page views and
   forwards the interaction events the components already emit. Uses
   `navigator.sendBeacon` with a `fetch` fallback. Never blocks rendering, never
   throws into component code. Deliberately not named `analytics.js`: that filename
   is an ad-blocker filter target, which is what caused #161.
2. **Ingest function** (`supabase/functions/collect/`). Public endpoint, no auth.
   Derives the visitor hash, validates and bounds the payload, writes one row.
   Rejects anything unrecognised rather than storing arbitrary client JSON.
3. **Schema** (`analytics_events` plus the daily salt table). RLS on, no policies,
   service-role only, matching the `admin_users` precedent.
4. **Views** (`analytics_traffic`, `analytics_topic_funnel`,
   `analytics_engagement`, `analytics_users`). Pure SQL, reviewable and testable on
   their own, following the `admin_progress_rollup` precedent.
5. **Dashboard sections**. New render functions in the existing admin dashboard,
   still emitting real tables rather than canvas-only charts.

### Why the boundary sits where it does

The views are the contract between storage and presentation. Swapping on-read
aggregation for scheduled rollup tables later means repointing the views at summary
tables; the API and the dashboard do not change. That is the upgrade path to the
approach rejected as premature today.

## Schema sketch

```sql
create table public.analytics_events (
  id           bigint generated always as identity primary key,
  occurred_at  timestamptz not null default now(),
  visitor_hash text not null,
  user_id      uuid references auth.users(id) on delete set null,
  event_name   text not null,
  page_path    text not null,
  topic        text,
  referrer_host text,
  props        jsonb not null default '{}'::jsonb
);
```

- `event_name` is constrained to a known set. An unknown name is rejected at ingest,
  not stored, so the table cannot become a dumping ground.
- `topic` is denormalised at write time from `page_path` so funnel queries do not
  re-parse paths on every read.
- `referrer_host` stores host only, never the full referring URL, which can carry
  query strings and personal data.
- `props` is bounded in key count and value length at ingest.
- Indexes on `(occurred_at)`, `(page_path, occurred_at)`, and `(topic, occurred_at)`.

## Metrics the first version answers

| Area | Metrics |
|---|---|
| Traffic and top content | Daily and weekly uniques, page views, top guides, entry pages, referrer hosts |
| Course and topic funnels | Per-topic start vs completion, per-guide drop-off within a topic's sequence, using the topic-to-guide map in `topics.js` |
| Interaction engagement | Quiz attempts and pass rate, exercise completions, walkthrough and terminal step depth, command-builder use |
| User listing and detail | Registered users with signup date, last seen, guides touched, and drill-down to one user's progress |

## Privacy posture

The site currently sets no cookies. This design keeps that true. Nothing is written
to the visitor's device for analytics purposes, no persistent identifier is created,
and no IP or user agent is retained. The existing consent banner continues to govern
GA4 only.

Raw events are retained for a bounded window (proposed: 400 days) with a scheduled
delete. The retention period is a stated policy, not an accident of never deleting.

## Phasing

Each phase is independently shippable and useful on its own.

| Phase | Contents | Rationale |
|---|---|---|
| 1 | Schema, ingest function, client beacon, traffic view, traffic dashboard section | Closes the total blind spot. Useful the day it lands |
| 2 | Engagement view and dashboard section | Reuses events phase 1 already collects; no new client work |
| 3 | Topic funnel view and dashboard section | Needs the topic map and the most query design |
| 4 | User listing and per-user drill-down | Smallest audience today; grows with signups |

## Verification

- Deno tests for the ingest function's pure parts: payload validation, event-name
  allowlist, props bounding, referrer-host extraction, visitor-hash derivation
  including that the same input under a rotated salt yields a different hash.
- SQL tests for each view against seeded fixtures, including malformed `props`,
  matching the defensive posture already in `admin_progress_rollup`.
- Vitest for the beacon: fires on page view, degrades silently when the endpoint is
  unreachable, and never throws into component code.
- Every new guard gets a mutation check, and the guard set is re-run as a matrix
  after any refactor, so a passing test is known to have failed for the right reason.
- `./verify.sh` remains the single local gate.

## Open questions for the next session

1. Bot filtering. A user-agent denylist is cheap and catches most crawlers, but it is
   never complete. Worth deciding whether phase 1 filters at ingest or at read.
2. Whether the dashboard should show GA4 and first-party numbers side by side. They
   will disagree, sometimes wildly, and an unexplained discrepancy invites more
   confusion than it resolves.
3. Whether to fix the consent banner separately. If visitors never actually see it,
   that is its own bug worth filing regardless of this work.

## Not in scope

- Replacing or removing GA4.
- Scheduled rollup tables. Revisit above roughly a million events.
- Real-time dashboards. The existing cache-and-refresh model is sufficient.
