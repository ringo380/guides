export type UserQuery =
  | { kind: "email"; email: string }
  | { kind: "id"; id: string };

/**
 * Page size for the candidate fetch. GoTrue's filter is a substring search, so
 * a full-address query can still return several accounts; anything past this
 * many candidates is treated as ambiguous rather than paged through.
 */
export const LOOKUP_PAGE_SIZE = 100;

const UUID =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Shape check for a user id, for the routes that take one in a JSON body.
 *
 * Without it a body id goes straight to GoTrue, which errors on a malformed
 * uuid, and malformed input surfaces as a 500 instead of the 400 it is.
 */
export function isUuid(value: string): boolean {
  return UUID.test(value);
}

/**
 * A complete address only. Deliberately strict: `%`, `@` alone, and a bare
 * domain must all fail, because GoTrue's filter= treats them as substring
 * sweeps that return the entire user table. Verified against the live project
 * 2026-07-30: filter=% and filter=@ each returned every account.
 *
 * This is not trying to be RFC 5322. It is trying to guarantee that whatever
 * reaches filter= is specific enough that a sweep is impossible.
 */
const EMAIL = /^[^\s@%,]+@[^\s@%,.]+(\.[^\s@%,.]+)+$/;

/**
 * Parse the ?email= / ?id= pair into exactly one identifier.
 * Throws RangeError on none, both, or malformed input, so free text can never
 * flow into a GoTrue filter.
 */
export function parseUserQuery(
  email: string | null,
  id: string | null,
): UserQuery {
  const hasEmail = email !== null && email !== "";
  const hasId = id !== null && id !== "";

  if (hasEmail && hasId) {
    throw new RangeError("provide either email or id, not both");
  }
  if (!hasEmail && !hasId) {
    throw new RangeError("provide an email or an id");
  }

  if (hasId) {
    if (!UUID.test(id!)) throw new RangeError("malformed user id");
    return { kind: "id", id: id! };
  }

  const trimmed = email!.trim();
  if (!EMAIL.test(trimmed)) throw new RangeError("malformed email address");
  return { kind: "email", email: trimmed.toLowerCase() };
}

/**
 * Reduce GoTrue's fuzzy candidate set to the one exact address, or null.
 *
 * GoTrue's filter= matches substrings of the email AND of user_metadata, so a
 * hit is a candidate rather than an answer. Email is unique in auth.users, so
 * at most one candidate can match exactly.
 */
export function narrowToExactEmail<T extends { email?: string | null }>(
  candidates: T[],
  email: string,
): T | null {
  const want = email.toLowerCase();
  for (const c of candidates) {
    if ((c.email ?? "").toLowerCase() === want) return c;
  }
  return null;
}
