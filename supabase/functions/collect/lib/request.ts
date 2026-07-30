/**
 * Request-shaped helpers for the ingest endpoint. Pure, so they can be tested
 * without a server.
 */

/** Exact-match allowlist, same posture as the admin API's. */
const ALLOWED_ORIGINS: ReadonlySet<string> = new Set([
  "https://runbook.fyi",
  "http://localhost:8000",
]);

export function resolveOrigin(requestOrigin: string | null): string | null {
  if (requestOrigin === null) return null;
  return ALLOWED_ORIGINS.has(requestOrigin) ? requestOrigin : null;
}

/**
 * CORS headers for an allowed origin.
 *
 * The beacon sends `text/plain`, which makes the POST a CORS "simple request"
 * with no preflight. That is deliberate: a preflight would double the request
 * count for every page view and give an ad blocker a second thing to block.
 * The endpoint therefore parses JSON out of a text/plain body rather than
 * requiring a content type that would trigger one.
 */
export function corsHeaders(origin: string | null): Record<string, string> {
  if (origin === null) return {};
  return {
    "Access-Control-Allow-Origin": origin,
    "Access-Control-Allow-Headers": "content-type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Vary": "Origin",
  };
}

/**
 * The caller's IP, used only as hash input and never stored.
 *
 * x-forwarded-for is a comma-separated chain appended to by each proxy, so the
 * client is the FIRST entry. Taking the last would yield the edge proxy's own
 * address, which is identical for every visitor and would collapse the entire
 * day's traffic into a single visitor hash.
 */
export function clientIp(headers: Headers): string {
  const forwarded = headers.get("x-forwarded-for");
  if (forwarded) {
    const first = forwarded.split(",")[0].trim();
    if (first !== "") return first;
  }
  return headers.get("cf-connecting-ip") ?? headers.get("x-real-ip") ?? "";
}

/** Bodies larger than this are refused unread. */
export const MAX_BODY_BYTES = 4096;

export function isTooLarge(contentLength: string | null): boolean {
  if (contentLength === null) return false;
  const n = Number(contentLength);
  if (!Number.isFinite(n)) return false;
  return n > MAX_BODY_BYTES;
}

export function parseBody(text: string): unknown | null {
  if (text.length > MAX_BODY_BYTES) return null;
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}
