// Exact-match allowlist. Scheme, host and port all have to match, so
// http://runbook.fyi and https://runbook.fyi.evil.example are both rejected.
const ALLOWED = new Set([
  "https://runbook.fyi",
  "http://localhost:8000",
]);

/**
 * Returns the echoed origin, or null when the origin is not allowed.
 * Never returns "*": the endpoint accepts an Authorization header, so a
 * wildcard would be unsafe.
 */
export function resolveCorsOrigin(requestOrigin: string | null): string | null {
  if (requestOrigin === null) return null;
  return ALLOWED.has(requestOrigin) ? requestOrigin : null;
}

/** Build response headers for an allowed origin. Empty for a rejected one. */
export function corsHeaders(origin: string | null): Record<string, string> {
  if (origin === null) return {};
  return {
    "Access-Control-Allow-Origin": origin,
    "Access-Control-Allow-Headers": "authorization, apikey, content-type",
    "Access-Control-Allow-Methods": "GET, OPTIONS",
    // Responses vary per origin, so a shared cache must not reuse one origin's
    // response for another.
    "Vary": "Origin",
  };
}
