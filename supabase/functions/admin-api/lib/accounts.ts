import { recordAudit } from "./audit.ts";
import { LOOKUP_PAGE_SIZE, narrowToExactEmail, type UserQuery } from "./identity.ts";

export interface AccountUser {
  id: string;
  email: string | null;
  createdAt: string | null;
  lastSignInAt: string | null;
}

function toAccountUser(u: any): AccountUser {
  return {
    id: u.id,
    email: u.email ?? null,
    createdAt: u.created_at ?? null,
    lastSignInAt: u.last_sign_in_at ?? null,
  };
}

/**
 * Resolve a query to exactly one account, or null.
 *
 * The email path deliberately does NOT trust GoTrue's filter: it is a substring
 * search over email and user_metadata, so its hits are candidates. The exact
 * comparison happens here.
 */
export async function findUser(
  supabaseAdmin: any,
  query: UserQuery,
): Promise<AccountUser | null> {
  if (query.kind === "id") {
    const { data, error } = await supabaseAdmin.auth.admin.getUserById(query.id);
    if (error) throw error;
    return data?.user ? toAccountUser(data.user) : null;
  }

  const { data, error } = await supabaseAdmin.auth.admin.listUsers({
    page: 1,
    perPage: LOOKUP_PAGE_SIZE,
    filter: query.email,
  });
  if (error) throw error;

  const candidates: Array<{ id: string; email?: string | null }> = data?.users ?? [];
  const match = narrowToExactEmail(candidates, query.email);
  return match ? toAccountUser(match) : null;
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
  query: UserQuery,
): Promise<{ status: number; body: unknown }> {
  const user = await findUser(supabaseAdmin, query);
  if (user === null) return { status: 404, body: { error: "no such user" } };

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
  query: UserQuery,
): Promise<{ status: number; body: unknown }> {
  const user = await findUser(supabaseAdmin, query);
  if (user === null) return { status: 404, body: { error: "no such user" } };

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
  const user = await findUser(supabaseAdmin, { kind: "id", id: userId });
  if (user === null) return { status: 404, body: { error: "no such user" } };

  const confirm = confirmEmail.trim().toLowerCase();
  if (
    confirm === "" ||
    user.email === null ||
    user.email.toLowerCase() !== confirm
  ) {
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
