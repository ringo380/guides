export const TTL_MS = 15 * 60 * 1000;

export interface CachedRow {
  payload: unknown;
  fetched_at: string;
}

export interface Selection {
  payload: unknown;
  stale: boolean;
  ageSeconds: number | null;
}

/** True when a cached row is still inside the TTL. The boundary counts as expired. */
export function isFresh(
  fetchedAt: string,
  now: Date,
  ttlMs: number = TTL_MS,
): boolean {
  const age = now.getTime() - new Date(fetchedAt).getTime();
  return age < ttlMs;
}

/**
 * Decide what to serve. A successful fresh fetch always wins. If the fresh
 * fetch failed (null) but a cached row exists, serve it flagged stale rather
 * than erroring - GA4 fails often enough that treating it as fatal would make
 * the dashboard look broken when only one source is down.
 */
export function selectPayload(
  cached: CachedRow | null,
  fresh: unknown | null,
  now: Date,
): Selection {
  if (fresh !== null) {
    return { payload: fresh, stale: false, ageSeconds: 0 };
  }
  if (cached !== null) {
    const ageSeconds = Math.round(
      (now.getTime() - new Date(cached.fetched_at).getTime()) / 1000,
    );
    return { payload: cached.payload, stale: true, ageSeconds };
  }
  return { payload: null, stale: false, ageSeconds: null };
}
