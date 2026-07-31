/**
 * Recording refused admin actions.
 *
 * Successful writes are audited inside the database functions that perform
 * them, in the same transaction, so a missing row proves the write did not
 * happen. A refusal has no write to be atomic with, so it is recorded here on
 * its way out.
 */

/** The fixed vocabulary. Every value is a constant, never user input. */
export const REFUSAL = {
  noSuchUser: "no such user",
  confirmationMismatch: "confirmation email does not match that user id",
  selfRevoke: "cannot revoke yourself",
  notAnAdmin: "not an admin",
  lastAdmin: "cannot remove the last admin",
  alreadyAnAdmin: "already an admin",
  ambiguousAddress:
    "too many candidate accounts for that address to resolve it safely",
} as const;

export type RefusalReason = typeof REFUSAL[keyof typeof REFUSAL];

/**
 * Record one refusal.
 *
 * Never throws, and never changes the caller's answer. The action was refused
 * whether or not the log accepted the row, and turning a clean 403 into a 500
 * because the audit insert failed would tell the admin their request MIGHT have
 * gone through - which is the opposite of what a refusal means. The failure is
 * logged instead of swallowed, because a log that quietly stops recording looks
 * exactly like a period with nothing to record.
 */
export async function recordRefusal(
  supabaseAdmin: any,
  actorId: string,
  action: string,
  targetId: string | null,
  reason: RefusalReason,
): Promise<void> {
  try {
    const { error } = await supabaseAdmin.rpc("admin_record_refusal", {
      p_actor: actorId,
      p_action: action,
      p_target: targetId,
      p_reason: reason,
    });
    if (error) {
      console.warn(
        `[admin-api] refusal not audited (${action}): ${error.message ?? error}`,
      );
    }
  } catch (e) {
    console.warn(
      `[admin-api] refusal not audited (${action}): ${(e as Error).message}`,
    );
  }
}
