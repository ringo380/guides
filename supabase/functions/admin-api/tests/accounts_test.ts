import { assertEquals } from "jsr:@std/assert@1";
import { findUser, resetProgress } from "../lib/accounts.ts";

const USER = {
  id: "3f2504e0-4f89-11d3-9a0c-0305e82c3301",
  email: "someone@example.com",
  created_at: "2026-01-01T00:00:00Z",
  last_sign_in_at: "2026-07-01T00:00:00Z",
};

function stubClient(opts: {
  users?: any[];
  byId?: any;
  progress?: any;
  deleted?: string[];
} = {}) {
  const calls: Array<{ table: string; op: string; payload?: unknown }> = [];
  const deleted = opts.deleted ?? [];
  return {
    calls,
    deleted,
    auth: {
      admin: {
        listUsers: (_a: unknown) =>
          Promise.resolve({ data: { users: opts.users ?? [] }, error: null }),
        getUserById: (_id: string) =>
          Promise.resolve({ data: { user: opts.byId ?? null }, error: null }),
      },
    },
    from(table: string) {
      return {
        select() {
          calls.push({ table, op: "select" });
          return {
            eq: () => ({
              maybeSingle: () =>
                Promise.resolve({ data: opts.progress ?? null, error: null }),
            }),
          };
        },
        insert(payload: unknown) {
          calls.push({ table, op: "insert", payload });
          return Promise.resolve({ error: null });
        },
        delete() {
          calls.push({ table, op: "delete" });
          return {
            eq: (_c: string, v: string) => {
              deleted.push(v);
              return Promise.resolve({ error: null });
            },
          };
        },
      };
    },
  };
}

Deno.test("findUser by email discards substring-only candidates", async () => {
  // GoTrue returns both for filter=someone@example.com.
  const c = stubClient({
    users: [{ ...USER, id: "wrong", email: "xsomeone@example.com" }, USER],
  });
  const u = await findUser(c as any, {
    kind: "email",
    email: "someone@example.com",
  });
  assertEquals(u?.id, USER.id);
});

Deno.test("findUser by email returns null when nothing matches exactly", async () => {
  const c = stubClient({ users: [{ ...USER, email: "other@example.com" }] });
  const u = await findUser(c as any, {
    kind: "email",
    email: "someone@example.com",
  });
  assertEquals(u, null);
});

Deno.test("findUser by id returns null for an unknown id", async () => {
  const c = stubClient({ byId: null });
  const u = await findUser(c as any, { kind: "id", id: USER.id });
  assertEquals(u, null);
});

Deno.test("resetProgress refuses when confirmEmail belongs to another account", async () => {
  // The stale-id case: admin looked up A, then B, and the page still held A's id.
  const c = stubClient({ byId: USER });
  const res = await resetProgress(
    c as any,
    "actor",
    USER.id,
    "someone-else@example.com",
  );
  assertEquals(res.status, 403);
  assertEquals(c.deleted.length, 0);
  assertEquals(c.calls.some((x) => x.table === "admin_audit"), false);
});

Deno.test("resetProgress deletes and audits when the pair agrees", async () => {
  const c = stubClient({ byId: USER });
  const res = await resetProgress(c as any, "actor", USER.id, USER.email);
  assertEquals(res.status, 200);
  assertEquals(c.deleted, [USER.id]);
  const audit = c.calls.find((x) => x.table === "admin_audit");
  assertEquals((audit?.payload as any).action, "progress.reset");
  assertEquals((audit?.payload as any).target_user_id, USER.id);
});

Deno.test("resetProgress matches confirmEmail case-insensitively", async () => {
  const c = stubClient({ byId: USER });
  const res = await resetProgress(c as any, "actor", USER.id, "SOMEONE@EXAMPLE.COM");
  assertEquals(res.status, 200);
});

Deno.test("resetProgress 404s an unknown user without deleting", async () => {
  const c = stubClient({ byId: null });
  const res = await resetProgress(c as any, "actor", USER.id, USER.email);
  assertEquals(res.status, 404);
  assertEquals(c.deleted.length, 0);
});

Deno.test("resetProgress never puts an email in the audit detail", async () => {
  const c = stubClient({ byId: USER });
  await resetProgress(c as any, "actor", USER.id, USER.email);
  const audit = c.calls.find((x) => x.table === "admin_audit");
  assertEquals(JSON.stringify(audit?.payload).includes("@"), false);
});
