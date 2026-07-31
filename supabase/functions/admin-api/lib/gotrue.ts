/**
 * Direct GoTrue admin calls.
 *
 * The supabase-js admin client cannot express this request. `auth.admin
 * .listUsers()` builds its query string from `page` and `per_page` only
 * (verified in the pinned @supabase/auth-js 2.111.0 dist, and PageParams
 * declares no other key), so a `filter` passed to it is silently dropped and
 * the call degrades into "read the newest per_page users". The server does
 * honor `filter`, so this module talks to the REST endpoint directly.
 *
 * `fetch` is injected rather than referenced from the global so tests can
 * assert the exact URL without making a network call.
 */

export interface GoTrueUser {
  id: string;
  email?: string | null;
  created_at?: string | null;
  last_sign_in_at?: string | null;
}

export interface GoTrueDeps {
  /** Project URL, e.g. https://<ref>.supabase.co */
  url: string;
  /** Service-role key. Sent as both apikey and bearer, as GoTrue expects. */
  serviceKey: string;
  fetch: typeof fetch;
}

/** A deploy problem, not a request problem: an env var is missing or unusable. */
export class GoTrueConfigError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "GoTrueConfigError";
  }
}

/**
 * Read the deps out of the environment once, at the point they are built, and
 * name what is wrong if anything is.
 *
 * Without this an empty SUPABASE_URL travels all the way to
 * `new URL(path, "")`, which throws "TypeError: Invalid URL" from inside a
 * request handler. That reaches the admin as an unexplained 500 on every single
 * lookup and names nothing anyone can act on, when the actual problem is one
 * unset variable on the deploy.
 */
export function buildGoTrueDeps(
  env: (key: string) => string | undefined,
  fetchImpl: typeof fetch,
): GoTrueDeps {
  const url = (env("SUPABASE_URL") ?? "").trim();
  const serviceKey = (env("SUPABASE_SERVICE_ROLE_KEY") ?? "").trim();

  const missing: string[] = [];
  if (url === "") missing.push("SUPABASE_URL");
  if (serviceKey === "") missing.push("SUPABASE_SERVICE_ROLE_KEY");
  if (missing.length > 0) {
    throw new GoTrueConfigError(
      `admin-api is misconfigured: ${missing.join(" and ")} ${
        missing.length > 1 ? "are" : "is"
      } not set`,
    );
  }

  // A set but malformed url fails in exactly the same place, just later and
  // with a worse message, so it is rejected here too.
  try {
    new URL("/auth/v1/admin/users", url);
  } catch {
    throw new GoTrueConfigError(
      `admin-api is misconfigured: SUPABASE_URL is not a usable base url`,
    );
  }

  return { url, serviceKey, fetch: fetchImpl };
}

export interface ListUsersResult {
  users: GoTrueUser[];
  /** True when the filtered set extends past the requested page. */
  hasMore: boolean;
}

/**
 * GET /auth/v1/admin/users?filter=...&page=...&per_page=...
 *
 * The returned users are candidates, never an answer: GoTrue's filter is a
 * substring search across email and user_metadata. Narrowing to an exact
 * address stays the caller's job (narrowToExactEmail).
 *
 * `hasMore` is read from GoTrue's pagination headers - the Link header's
 * rel="next", or x-total-count exceeding what this page covers. When neither
 * header is present there is no evidence of a further page, so it is false.
 */
export async function listUsersByFilter(
  deps: GoTrueDeps,
  filter: string,
  page: number,
  perPage: number,
): Promise<ListUsersResult> {
  const url = new URL("/auth/v1/admin/users", deps.url);
  // URLSearchParams percent-encodes the value, so a `+` reaches GoTrue as a
  // plus rather than a space. Percent-encoding does NOT make a wildcard safe:
  // GoTrue decodes the parameter before building the LIKE pattern, so `%` and
  // `_` arrive as wildcards regardless. Neutralizing those is the caller's job,
  // through identity.gotrueFilter.
  url.searchParams.set("filter", filter);
  url.searchParams.set("page", String(page));
  url.searchParams.set("per_page", String(perPage));

  const res = await deps.fetch(url.toString(), {
    method: "GET",
    headers: {
      apikey: deps.serviceKey,
      Authorization: `Bearer ${deps.serviceKey}`,
    },
  });
  if (!res.ok) {
    throw new Error(`GoTrue admin listUsers failed: ${res.status}`);
  }

  const body = await res.json();
  const users: GoTrueUser[] = Array.isArray(body?.users) ? body.users : [];

  const link = res.headers?.get?.("link") ?? "";
  const total = Number(res.headers?.get?.("x-total-count"));
  const hasMore = /rel="next"/.test(link) ||
    (Number.isFinite(total) && total > page * perPage);

  return { users, hasMore };
}
