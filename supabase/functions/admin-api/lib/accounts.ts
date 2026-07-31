import { recordAudit } from "./audit.ts";
import { LOOKUP_PAGE_SIZE, narrowToExactEmail, type UserQuery } from "./identity.ts";
import { type GoTrueDeps, listUsersByFilter } from "./gotrue.ts";

export interface AccountUser {
  id: string;
  email: string | null;
  createdAt: string | null;
  lastSignInAt: string | null;
}

/**
 * Outcome of a lookup. "ambiguous" is not an error case to swallow: it means
 * the filtered candidate set spans more than one page, so an exact match could
 * be sitting on a page we never fetched. Answering 404 there would be a lie.
 */
export type FindResult =
  | { kind: "found"; user: AccountUser }
  | { kind: "none" }
  | { kind: "ambiguous" };

function toAccountUser(u: any): AccountUser {
  // Normalize the emailless account to one shape. GoTrue serializes an account
  // with no address as "" rather than null, and `??` does not collapse the
  // empty string, so without this `""` and `null` travel downstream as two
  // different values and every email comparison has to handle both.
  const raw = typeof u.email === "string" ? u.email.trim() : "";
  return {
    id: u.id,
    email: raw === "" ? null : raw,
    createdAt: u.created_at ?? null,
    lastSignInAt: u.last_sign_in_at ?? null,
  };
}

/**
 * Is this getUserById error just "no account with that id"?
 *
 * @supabase/auth-js answers a well-formed but unknown id with an AuthApiError
 * carrying status 404, not with a quiet null user. Treating that as a throw
 * makes the not-found branch unreachable and answers the caller with the
 * platform's default 500 - plain text, and with no CORS headers, so the browser
 * cannot read it either.
 *
 * Matched on status and code rather than on message text, which is not a
 * stable interface.
 *
 * The code wins over the status when there is one. A bare 404 is not proof of a
 * missing user: if the auth path itself ever 404s at the edge - a gateway route
 * change, or GoTrue not serving /auth/v1/admin/users/<id> - then status alone
 * reports "no such user" for an account that is sitting right there, which is
 * the one wrong answer an admin has no way to question.
 */
function isMissingUser(error: unknown): boolean {
  if (!error || typeof error !== "object") return false;
  const e = error as { status?: number; code?: string };
  if (typeof e.code === "string" && e.code !== "") return e.code === "user_not_found";
  return e.status === 404;
}

/** Resolve a uuid to an account, or null. No filter, so nothing to narrow. */
export async function findUserById(
  supabaseAdmin: any,
  id: string,
): Promise<AccountUser | null> {
  const { data, error } = await supabaseAdmin.auth.admin.getUserById(id);
  // Only a missing user is an answer. Anything else - a rejected service key, a
  // GoTrue outage - still throws, because reporting it as "no such user" would
  // be a claim this code cannot support.
  if (error && !isMissingUser(error)) throw error;
  if (error) return null;
  return data?.user ? toAccountUser(data.user) : null;
}

/**
 * Resolve a query to exactly one account.
 *
 * The email path deliberately does NOT trust GoTrue's filter: it is a substring
 * search over email and user_metadata, so its hits are candidates. The exact
 * comparison happens here, in narrowToExactEmail.
 *
 * The request goes through lib/gotrue.ts rather than the supabase-js admin
 * client, which drops the filter parameter entirely.
 */
export async function findUser(
  supabaseAdmin: any,
  deps: GoTrueDeps,
  query: UserQuery,
): Promise<FindResult> {
  if (query.kind === "id") {
    const user = await findUserById(supabaseAdmin, query.id);
    return user === null ? { kind: "none" } : { kind: "found", user };
  }

  const { users, hasMore } = await listUsersByFilter(
    deps,
    query.email,
    1,
    LOOKUP_PAGE_SIZE,
  );

  const match = narrowToExactEmail(users, query.email);
  if (match) return { kind: "found", user: toAccountUser(match) };
  // Only ambiguous once this page has been ruled out: an exact hit on page 1 is
  // the answer, because email is unique in auth.users.
  if (hasMore) return { kind: "ambiguous" };
  return { kind: "none" };
}

/** The 404/409 body for a lookup that resolved to no single account. */
function notFound(r: FindResult): { status: number; body: unknown } {
  if (r.kind === "ambiguous") {
    return {
      status: 409,
      body: {
        error:
          "too many candidate accounts for that address to resolve it safely",
      },
    };
  }
  return { status: 404, body: { error: "no such user" } };
}

async function progressRow(supabaseAdmin: any, userId: string) {
  const { data, error } = await supabaseAdmin
    .from("runbook_progress")
    .select("progress, updated_at")
    .eq("user_id", userId)
    .maybeSingle();
  if (error) throw error;
  return data as { progress: Record<string, unknown>; updated_at: string } | null;
}

/** Account fields plus a size summary of the progress blob. */
export async function lookupAccount(
  supabaseAdmin: any,
  deps: GoTrueDeps,
  query: UserQuery,
): Promise<{ status: number; body: unknown }> {
  const found = await findUser(supabaseAdmin, deps, query);
  if (found.kind !== "found") return notFound(found);
  const user = found.user;

  const row = await progressRow(supabaseAdmin, user.id);
  return {
    status: 200,
    body: {
      user,
      progress: row === null ? null : {
        updatedAt: row.updated_at,
        pageCount: Object.keys(row.progress ?? {}).length,
      },
    },
  };
}

/** The full progress blob, verbatim. */
export async function exportAccount(
  supabaseAdmin: any,
  deps: GoTrueDeps,
  query: UserQuery,
): Promise<{ status: number; body: unknown }> {
  const found = await findUser(supabaseAdmin, deps, query);
  if (found.kind !== "found") return notFound(found);
  const user = found.user;

  const row = await progressRow(supabaseAdmin, user.id);
  return {
    status: 200,
    body: {
      user,
      exportedAt: new Date().toISOString(),
      progress: row?.progress ?? null,
      updatedAt: row?.updated_at ?? null,
    },
  };
}

/**
 * Does `confirmEmail` confirm a reset of the account holding `accountEmail`?
 *
 * Extracted and total on purpose. It must be correct for the raw shapes GoTrue
 * emits, not only for the normalized ones findUser produces, because it is the
 * last thing standing between a blank form field and a delete:
 *
 * - A blank confirmation is never a confirmation, whatever the account holds.
 *   GoTrue serializes an emailless account as "" (not null), so without this
 *   clause a blank confirmation against such an account compares "" to "" and
 *   passes.
 * - An account with no address on file has no valid confirmation at all.
 */
export function confirmsAccount(
  accountEmail: string | null,
  confirmEmail: string,
): boolean {
  const confirm = confirmEmail.trim().toLowerCase();
  if (confirm === "") return false;
  if (accountEmail === null) return false;
  return accountEmail.toLowerCase() === confirm;
}

/**
 * Delete the runbook_progress row. The auth account is untouched.
 *
 * Requires userId and confirmEmail to belong to the same account. This is not
 * ceremony: without it, a stale userId left in the page after the admin moved on
 * to a second lookup deletes the wrong person's progress. Making the pair agree
 * puts that check on the server, where the UI cannot skip it.
 */
export async function resetProgress(
  supabaseAdmin: any,
  actorId: string,
  userId: string,
  confirmEmail: string,
): Promise<{ status: number; body: unknown }> {
  const user = await findUserById(supabaseAdmin, userId);
  if (user === null) return { status: 404, body: { error: "no such user" } };

  if (!confirmsAccount(user.email, confirmEmail)) {
    return {
      status: 403,
      body: { error: "confirmation email does not match that user id" },
    };
  }

  const { error } = await supabaseAdmin
    .from("runbook_progress")
    .delete()
    .eq("user_id", userId);
  if (error) throw error;

  await recordAudit(supabaseAdmin, {
    actorUserId: actorId,
    action: "progress.reset",
    targetUserId: userId,
  });
  return { status: 200, body: { userId, reset: true } };
}
