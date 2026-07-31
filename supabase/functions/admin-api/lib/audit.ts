export type AuditAction = "progress.reset" | "admin.grant" | "admin.revoke";

export interface AuditEntry {
  actorUserId: string;
  action: AuditAction;
  targetUserId: string | null;
  detail?: Record<string, unknown>;
}

/**
 * Append one row to admin_audit.
 *
 * Called BEFORE the write it describes returns, never after a failure. A
 * missing audit row must mean the write did not happen.
 *
 * `detail` must never carry an email address. The target's id is already
 * recorded; an email here would be a second copy of PII in a new table.
 */
export async function recordAudit(
  supabaseAdmin: any,
  entry: AuditEntry,
): Promise<void> {
  const { error } = await supabaseAdmin.from("admin_audit").insert({
    actor_user_id: entry.actorUserId,
    action: entry.action,
    target_user_id: entry.targetUserId,
    detail: entry.detail ?? {},
  });
  if (error) throw error;
}
