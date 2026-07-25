export type RangeKey = "7d" | "28d" | "90d";

export interface ParsedRange {
  key: RangeKey;
  days: number;
}

// A Map, not an object literal. Object lookup would resolve inherited keys such
// as "__proto__" and "constructor" to truthy values, letting them slip past the
// undefined check below and into the cache key.
const RANGES = new Map<string, number>([
  ["7d", 7],
  ["28d", 28],
  ["90d", 90],
]);

/**
 * Parse the ?range= query parameter. Defaults to 28d.
 * Throws RangeError on anything not in the allowlist, so the value can never
 * flow into a query or a cache key as free text.
 */
export function parseRange(raw: string | null): ParsedRange {
  const key = raw ?? "28d";
  const days = RANGES.get(key);
  if (days === undefined) {
    throw new RangeError(`unsupported range: ${raw}`);
  }
  return { key: key as RangeKey, days };
}
