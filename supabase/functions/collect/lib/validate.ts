/**
 * Payload validation for the public ingest endpoint.
 *
 * This endpoint is unauthenticated and reachable by anyone, so the rule is
 * that nothing reaches the database unless it was recognised. An unknown event
 * name is rejected rather than stored, which is what keeps analytics_events
 * from becoming a dumping ground for arbitrary client JSON.
 *
 * Everything here is pure so it can be tested without a network or a database.
 */

/**
 * Events worth storing. Deliberately narrower than the set analytics.js emits
 * for GA4: auth clicks, lightbox opens, visibility flips and sync chatter are
 * noise for this purpose and would dominate the row count.
 *
 * Phase 2 (engagement) reads from this same set, so it is stocked ahead of the
 * dashboard that will use it - no client change needed later.
 */
export const ALLOWED_EVENTS: ReadonlySet<string> = new Set([
  "page_view",
  "topic_page_view",
  "section_read",
  "page_progress_milestone",
  "guide_navigation",
  "quiz_start",
  "quiz_answer",
  "quiz_retry",
  "exercise_start",
  "exercise_hint",
  "exercise_solution_view",
  "exercise_complete",
  "terminal_start",
  "terminal_step",
  "terminal_complete",
  "walkthrough_start",
  "walkthrough_step",
  "walkthrough_complete",
  "command_builder_reset",
  "command_copy",
  "code_copy",
  "search_query",
  "search_result_click",
]);

export const MAX_PATH_LENGTH = 512;
export const MAX_TOPIC_LENGTH = 120;
export const MAX_HOST_LENGTH = 253;
export const MAX_PROP_KEYS = 8;
export const MAX_PROP_KEY_LENGTH = 40;
export const MAX_PROP_VALUE_LENGTH = 200;

export interface CollectEvent {
  eventName: string;
  pagePath: string;
  topic: string | null;
  referrerHost: string | null;
  props: Record<string, string | number | boolean>;
}

export type ValidateResult =
  | { ok: true; value: CollectEvent }
  | { ok: false; error: string };

/**
 * User agents we do not want in the numbers. A denylist is never complete,
 * which is exactly why the result is stored as a flag and filtered in the
 * views rather than dropped here: widening this list later retroactively
 * improves history instead of only affecting new rows.
 */
const BOT_PATTERN =
  /bot|crawl|spider|slurp|scrape|search|preview|monitor|uptime|ping|lighthouse|headless|phantom|selenium|puppeteer|playwright|curl|wget|python-requests|httpx|axios|node-fetch|go-http-client|java\/|okhttp|libwww|scrapy|feed/i;

export function isBot(userAgent: string | null | undefined): boolean {
  // A browser always sends a user agent. Something that does not is not a
  // reader, and counting it would inflate exactly the number this whole
  // exercise exists to get right.
  if (!userAgent || userAgent.trim() === "") return true;
  return BOT_PATTERN.test(userAgent);
}

/**
 * Reduce a referrer to its host. The full URL can carry query strings and
 * personal data, and is never needed for the question being asked.
 *
 * Same-site referrers return null: internal navigation is not a referral, and
 * counting it would make the site its own top traffic source.
 */
export function referrerHost(
  raw: unknown,
  siteHost: string,
): string | null {
  if (typeof raw !== "string" || raw === "") return null;
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    return null;
  }
  if (url.protocol !== "http:" && url.protocol !== "https:") return null;
  const host = url.hostname.toLowerCase();
  if (host === "" || host.length > MAX_HOST_LENGTH) return null;
  if (host === siteHost.toLowerCase()) return null;
  return host;
}

/**
 * First path segment, which is the topic directory on this site
 * ("/Git/git-basics/" -> "Git").
 *
 * Not checked against the real topic list. That map lives in topics.js and
 * duplicating it here would give two copies to drift apart, for no benefit
 * until phase 3 needs per-guide sequencing. An unrecognised segment simply
 * becomes a topic with no guides, which harms nothing.
 */
export function topicFromPath(path: string): string | null {
  const trimmed = path.replace(/^\/+/, "");
  if (trimmed === "") return null;
  const first = trimmed.split("/")[0];
  if (first === "" || first.length > MAX_TOPIC_LENGTH) return null;
  let decoded: string;
  try {
    decoded = decodeURIComponent(first);
  } catch {
    // A malformed escape is not worth rejecting the whole event over.
    decoded = first;
  }
  // A path whose first segment is a file ("index.html", "sitemap.xml") is not
  // a topic.
  if (decoded.includes(".")) return null;
  return decoded;
}

function cleanPath(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  // Drop query and fragment: neither is needed and both can carry anything.
  const path = raw.split("#")[0].split("?")[0];
  if (path === "" || !path.startsWith("/")) return null;
  if (path.length > MAX_PATH_LENGTH) return null;
  // Control characters have no business in a path and would make the stored
  // value hard to read back safely.
  // deno-lint-ignore no-control-regex
  if (/[\x00-\x1f\x7f]/.test(path)) return null;
  return path;
}

function cleanProps(raw: unknown): Record<string, string | number | boolean> {
  if (raw === null || typeof raw !== "object" || Array.isArray(raw)) return {};
  const out: Record<string, string | number | boolean> = {};
  let n = 0;
  for (const [key, value] of Object.entries(raw as Record<string, unknown>)) {
    if (n >= MAX_PROP_KEYS) break;
    if (key.length === 0 || key.length > MAX_PROP_KEY_LENGTH) continue;
    if (typeof value === "string") {
      out[key] = value.slice(0, MAX_PROP_VALUE_LENGTH);
    } else if (typeof value === "boolean") {
      out[key] = value;
    } else if (typeof value === "number" && Number.isFinite(value)) {
      out[key] = value;
    } else {
      // Nested objects, arrays, null, undefined, NaN and Infinity are dropped
      // rather than coerced. Coercion here would let a caller store arbitrary
      // structure as a string.
      continue;
    }
    n++;
  }
  return out;
}

export function validate(body: unknown, siteHost: string): ValidateResult {
  if (body === null || typeof body !== "object" || Array.isArray(body)) {
    return { ok: false, error: "body must be an object" };
  }
  const b = body as Record<string, unknown>;

  const eventName = b.event;
  if (typeof eventName !== "string" || !ALLOWED_EVENTS.has(eventName)) {
    return { ok: false, error: "unknown event" };
  }

  const pagePath = cleanPath(b.path);
  if (pagePath === null) {
    return { ok: false, error: "invalid path" };
  }

  return {
    ok: true,
    value: {
      eventName,
      pagePath,
      topic: topicFromPath(pagePath),
      referrerHost: referrerHost(b.referrer, siteHost),
      props: cleanProps(b.props),
    },
  };
}
