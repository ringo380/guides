import { assertEquals, assertRejects } from "jsr:@std/assert@1";
import { recordAudit } from "../lib/audit.ts";

function stub(error: unknown = null) {
  const seen: unknown[] = [];
  return {
    seen,
    from(_t: string) {
      return {
        insert(payload: unknown) {
          seen.push(payload);
          return Promise.resolve({ error });
        },
      };
    },
  };
}

Deno.test("recordAudit maps the entry onto the table columns", async () => {
  const c = stub();
  await recordAudit(c as any, {
    actorUserId: "actor",
    action: "admin.grant",
    targetUserId: "target",
  });
  assertEquals(c.seen[0], {
    actor_user_id: "actor",
    action: "admin.grant",
    target_user_id: "target",
    detail: {},
  });
});

Deno.test("recordAudit throws when the insert fails", async () => {
  // A swallowed audit failure means a completed write with no trail. The
  // caller must not be able to report success on the strength of a write
  // whose audit row never landed.
  const c = stub({ message: "insert failed" });
  await assertRejects(() =>
    recordAudit(c as any, {
      actorUserId: "actor",
      action: "progress.reset",
      targetUserId: "target",
    })
  );
});
