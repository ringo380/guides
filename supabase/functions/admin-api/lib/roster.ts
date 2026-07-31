import { gotrueFilter, LOOKUP_PAGE_SIZE, narrowToExactEmail } from "./identity.ts";
import { type GoTrueDeps, listUsersByFilter } from "./gotrue.ts";
import { recordRefusal, REFUSAL, type RefusalReason } from "./audit.ts";

export interface AdminRow {
  userId: string;
  email: string | null;
  /**
   * True when the address could not be read at all, as opposed to being read
   * and found absent. Both leave `email` null, and collapsing them tells an
   * admin an account has no address on file when the truth is that nobody
   * knows - which is the wrong thing to act on, because one is a property of
   * the account and the other is a fault to retry.
   */
  emailUnavailable: boolean;
  note: string | null;
  createdAt: string;
}

export type RevokeCheck =
  | { ok: true }
  // The refusal strings ARE the audit vocabulary, one type rather than two
  // copies: a message reworded on the way to the caller but not in the log
  // would leave the log describing a refusal the admin never saw.
  | { ok: false; status: number; error: RefusalReason };

/**
 * Guard a revoke before touching the database.
 *
 * The last-admin case is ALSO enforced by a before-delete trigger, which is the
 * authoritative check because this one is a check-then-act race. This exists so
 * the common case returns a clean 409 rather than a raw Postgres error.
 *
 * The order of the three checks is the whole point of this function:
 *
 * 1. Self-revoke. An actor is an admin by definition of having reached here, so
 *    this can never be the non-member case, and it is the message the admin can
 *    act on when the roster is also down to one.
 * 2. Membership. Revoking an account that is not on the roster removes nothing,
 *    so it cannot empty the roster - answering "cannot remove the last admin"
 *    describes a consequence that was never on the table and sends the admin
 *    looking for a second admin to grant when the address was simply wrong.
 * 3. Roster size, which is only meaningful once the target is known to be on it.
 */
export function checkRevoke(args: {
  actorId: string;
  targetId: string;
  isMember: boolean;
  rosterSize: number;
}): RevokeCheck {
  if (args.actorId === args.targetId) {
    return { ok: false, status: 403, error: REFUSAL.selfRevoke };
  }
  if (!args.isMember) {
    return { ok: false, status: 404, error: REFUSAL.notAnAdmin };
  }
  if (args.rosterSize <= 1) {
    return { ok: false, status: 409, error: REFUSAL.lastAdmin };
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
    const { data, error } = await supabaseAdmin.auth.admin.getUserById(r.user_id);
    // A failed lookup is reported, not thrown: one unreadable address must not
    // cost the admin the whole roster, which is the part that decides who can
    // revoke whom. It is also not silently flattened to null - see
    // emailUnavailable on AdminRow.
    const failed = Boolean(error);
    const email = failed ? null : (data?.user?.email ?? null);
    out.push({
      userId: r.user_id,
      email: email === "" ? null : email,
      emailUnavailable: failed,
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
  // Escaped for the same reason as the lookup path: filter= is a LIKE pattern.
  const { users, hasMore } = await listUsersByFilter(
    deps,
    gotrueFilter(email),
    1,
    LOOKUP_PAGE_SIZE,
  );

  const user = narrowToExactEmail(users, email);
  if (user === null) {
    // An unmatched page-1 with more pages behind it is not "no such user" - the
    // account may be on a page we never asked for. Say so rather than 404.
    //
    // Both refusals are recorded with a null target: there is no account id to
    // name, which is the whole reason they were refused. The address itself is
    // deliberately not stored - the audit table holds ids, never emails.
    if (hasMore) {
      await recordRefusal(
        supabaseAdmin,
        actorId,
        "admin.grant",
        null,
        REFUSAL.ambiguousAddress,
      );
      return {
        status: 409,
        body: { error: REFUSAL.ambiguousAddress },
      };
    }
    await recordRefusal(
      supabaseAdmin,
      actorId,
      "admin.grant",
      null,
      REFUSAL.noSuchUser,
    );
    return { status: 404, body: { error: REFUSAL.noSuchUser } };
  }

  const existing = await rosterRows(supabaseAdmin);
  if (existing.some((r) => r.user_id === user.id)) {
    await recordRefusal(
      supabaseAdmin,
      actorId,
      "admin.grant",
      user.id,
      REFUSAL.alreadyAnAdmin,
    );
    return { status: 409, body: { error: REFUSAL.alreadyAnAdmin } };
  }

  // The insert and its audit row go in one transaction. Written as two requests,
  // a failed audit insert left an admin granted with no record of who granted
  // them, and answered the caller as though the grant had failed.
  const { error: insErr } = await supabaseAdmin.rpc("admin_grant_admin", {
    p_actor: actorId,
    p_target: user.id,
    p_note: `granted by ${actorId}`,
  });
  if (insErr) {
    // The check above is check-then-act: a concurrent grant of the same account
    // commits between the read and this insert, and the primary key rejects it.
    // That is the same conflict the check reports, so it gets the same answer
    // rather than surfacing as a 500. Mirrors the revoke path's P0001 mapping.
    if ((insErr as { code?: string }).code === "23505") {
      await recordRefusal(
        supabaseAdmin,
        actorId,
        "admin.grant",
        user.id,
        REFUSAL.alreadyAnAdmin,
      );
      return { status: 409, body: { error: REFUSAL.alreadyAnAdmin } };
    }
    throw insErr;
  }

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
    isMember: rows.some((r) => r.user_id === targetId),
    rosterSize: rows.length,
  });
  if (!check.ok) {
    // The refusals worth having on record: a self-revoke, a revoke that would
    // have emptied the roster, and a revoke of an id that was never on it. All
    // three leave the roster exactly as it was, so without this they leave no
    // trace of having been attempted.
    await recordRefusal(
      supabaseAdmin,
      actorId,
      "admin.revoke",
      targetId,
      check.error,
    );
    return { status: check.status, body: { error: check.error } };
  }

  // Delete and audit in one transaction, so a failed audit insert can never
  // leave an admin revoked with no record of it - nor report a completed revoke
  // as a failure.
  const { error } = await supabaseAdmin.rpc("admin_revoke_admin", {
    p_actor: actorId,
    p_target: targetId,
  });

  if (error) {
    // The trigger fired: this delete would have emptied the roster, even though
    // our own count said otherwise. The trigger is authoritative.
    if (error.code === "P0001") {
      await recordRefusal(
        supabaseAdmin,
        actorId,
        "admin.revoke",
        targetId,
        REFUSAL.lastAdmin,
      );
      return { status: 409, body: { error: REFUSAL.lastAdmin } };
    }
    // The membership check above is check-then-act too: a concurrent revoke of
    // the same account commits in between and this delete matches no row. The
    // function refuses to audit a revoke it did not perform, and says so.
    if (error.code === "P0002") {
      await recordRefusal(
        supabaseAdmin,
        actorId,
        "admin.revoke",
        targetId,
        REFUSAL.notAnAdmin,
      );
      return { status: 404, body: { error: REFUSAL.notAnAdmin } };
    }
    // Deliberately NOT recorded as a refusal: nothing refused this revoke. It
    // lost a race, and the same request repeated a second later succeeds. A log
    // of blocked attempts that fills with transient lock noise is a log nobody
    // reads.
    //
    // Two admins revoking each other at the same instant is a lock cycle, and
    // Postgres breaks it by aborting one side (40P01) - or by giving up on the
    // lock, should a lock_timeout ever be set (55P03). Either way this
    // transaction lost a race and changed nothing, which is a conflict the
    // caller can retry rather than a server fault.
    if (error.code === "40P01" || error.code === "55P03") {
      return {
        status: 409,
        body: {
          error:
            "another admin change was in flight, so nothing was revoked - try again",
        },
      };
    }
    throw error;
  }

  return { status: 200, body: { userId: targetId } };
}
