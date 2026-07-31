import { recordAudit } from "./audit.ts";
import { LOOKUP_PAGE_SIZE, narrowToExactEmail } from "./identity.ts";
import { type GoTrueDeps, listUsersByFilter } from "./gotrue.ts";

export interface AdminRow {
  userId: string;
  email: string | null;
  note: string | null;
  createdAt: string;
}

export type RevokeCheck =
  | { ok: true }
  | { ok: false; status: number; error: string };

/**
 * Guard a revoke before touching the database.
 *
 * The last-admin case is ALSO enforced by a before-delete trigger, which is the
 * authoritative check because this one is a check-then-act race. This exists so
 * the common case returns a clean 409 rather than a raw Postgres error.
 *
 * Self-revoke is checked first: when both conditions hold, "you cannot revoke
 * yourself" is the message the admin can act on.
 */
export function checkRevoke(args: {
  actorId: string;
  targetId: string;
  rosterSize: number;
}): RevokeCheck {
  if (args.actorId === args.targetId) {
    return { ok: false, status: 403, error: "cannot revoke yourself" };
  }
  if (args.rosterSize <= 1) {
    return { ok: false, status: 409, error: "cannot remove the last admin" };
  }
  return { ok: true };
}

async function rosterRows(supabaseAdmin: any) {
  const { data, error } = await supabaseAdmin
    .from("admin_users")
    .select("user_id, note, created_at")
    .order("created_at", { ascending: true });
  if (error) throw error;
  return (data ?? []) as Array<
    { user_id: string; note: string | null; created_at: string }
  >;
}

/** Roster with emails resolved from auth.users. */
export async function listAdmins(supabaseAdmin: any): Promise<AdminRow[]> {
  const rows = await rosterRows(supabaseAdmin);
  const out: AdminRow[] = [];
  for (const r of rows) {
    // getUserById, not a list+filter: the id is exact, so there is nothing to
    // narrow and no reason to pull other accounts into memory.
    const { data } = await supabaseAdmin.auth.admin.getUserById(r.user_id);
    out.push({
      userId: r.user_id,
      email: data?.user?.email ?? null,
      note: r.note,
      createdAt: r.created_at,
    });
  }
  return out;
}

export async function grantAdmin(
  supabaseAdmin: any,
  deps: GoTrueDeps,
  actorId: string,
  email: string,
): Promise<{ status: number; body: unknown }> {
  // Through lib/gotrue.ts, not supabase-js: the admin client drops `filter`.
  const { users, hasMore } = await listUsersByFilter(
    deps,
    email,
    1,
    LOOKUP_PAGE_SIZE,
  );

  const user = narrowToExactEmail(users, email);
  if (user === null) {
    // An unmatched page-1 with more pages behind it is not "no such user" - the
    // account may be on a page we never asked for. Say so rather than 404.
    if (hasMore) {
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

  const existing = await rosterRows(supabaseAdmin);
  if (existing.some((r) => r.user_id === user.id)) {
    return { status: 409, body: { error: "already an admin" } };
  }

  const { error: insErr } = await supabaseAdmin
    .from("admin_users")
    .insert({ user_id: user.id, note: `granted by ${actorId}` });
  if (insErr) {
    // The check above is check-then-act: a concurrent grant of the same account
    // commits between the read and this insert, and the primary key rejects it.
    // That is the same conflict the check reports, so it gets the same answer
    // rather than surfacing as a 500. Mirrors the revoke path's P0001 mapping.
    if ((insErr as { code?: string }).code === "23505") {
      return { status: 409, body: { error: "already an admin" } };
    }
    throw insErr;
  }

  await recordAudit(supabaseAdmin, {
    actorUserId: actorId,
    action: "admin.grant",
    targetUserId: user.id,
  });
  return { status: 200, body: { userId: user.id } };
}

export async function revokeAdmin(
  supabaseAdmin: any,
  actorId: string,
  targetId: string,
): Promise<{ status: number; body: unknown }> {
  const rows = await rosterRows(supabaseAdmin);
  const check = checkRevoke({
    actorId,
    targetId,
    rosterSize: rows.length,
  });
  if (!check.ok) return { status: check.status, body: { error: check.error } };

  if (!rows.some((r) => r.user_id === targetId)) {
    return { status: 404, body: { error: "not an admin" } };
  }

  const { error } = await supabaseAdmin
    .from("admin_users")
    .delete()
    .eq("user_id", targetId);

  if (error) {
    // The trigger fired: this delete would have emptied the roster, even though
    // our own count said otherwise. The trigger is authoritative.
    if (error.code === "P0001") {
      return { status: 409, body: { error: "cannot remove the last admin" } };
    }
    throw error;
  }

  await recordAudit(supabaseAdmin, {
    actorUserId: actorId,
    action: "admin.revoke",
    targetUserId: targetId,
  });
  return { status: 200, body: { userId: targetId } };
}
