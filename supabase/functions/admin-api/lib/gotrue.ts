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
  // URLSearchParams percent-encodes the value, so a `+` or `%` in the address
  // reaches GoTrue as itself rather than as a wildcard or a space.
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
