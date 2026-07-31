import { assertEquals, assertStringIncludes } from "jsr:@std/assert@1";
import { checkRevoke, grantAdmin, revokeAdmin } from "../lib/roster.ts";
import type { GoTrueDeps } from "../lib/gotrue.ts";

/**
 * GoTrue stub. fetch is injected, so no test here can reach the network.
 */
function stubGoTrue(opts: {
  users?: Array<{ id: string; email: string }>;
  headers?: Record<string, string>;
} = {}) {
  const urls: string[] = [];
  const deps: GoTrueDeps = {
    url: "https://project.supabase.co",
    serviceKey: "service-role-key",
    fetch: ((input: any) => {
      urls.push(String(input));
      return Promise.resolve(
        new Response(JSON.stringify({ users: opts.users ?? [] }), {
          status: 200,
          headers: opts.headers ?? {},
        }),
      );
    }) as typeof fetch,
  };
  return { deps, urls };
}

Deno.test("checkRevoke refuses self-revoke", () => {
  const r = checkRevoke({ actorId: "a", targetId: "a", rosterSize: 5 });
  assertEquals(r, { ok: false, status: 403, error: "cannot revoke yourself" });
});

Deno.test("checkRevoke refuses emptying the roster", () => {
  const r = checkRevoke({ actorId: "a", targetId: "b", rosterSize: 1 });
  assertEquals(r, { ok: false, status: 409, error: "cannot remove the last admin" });
});

Deno.test("checkRevoke allows a normal revoke", () => {
  assertEquals(checkRevoke({ actorId: "a", targetId: "b", rosterSize: 2 }), { ok: true });
});

Deno.test("checkRevoke checks self before roster size", () => {
  // Both conditions hold. Self-revoke is the more actionable message, and the
  // one the admin can actually fix.
  const r = checkRevoke({ actorId: "a", targetId: "a", rosterSize: 1 });
  assertEquals(r, { ok: false, status: 403, error: "cannot revoke yourself" });
});

/**
 * Minimal stub of the PostgREST builder chain used by roster.ts.
 * `calls` records every table touched so a test can assert the audit write.
 */
function stubClient(opts: {
  admins?: Array<{ user_id: string; note: string | null; created_at: string }>;
  deleteError?: { code?: string; message: string };
  users?: Array<{ id: string; email: string }>;
}) {
  const calls: Array<{ table: string; op: string; payload?: unknown }> = [];
  const admins = opts.admins ?? [];
  return {
    calls,
    auth: {
      admin: {
        getUserById: (id: string) =>
          Promise.resolve({
            data: { user: (opts.users ?? []).find((u) => u.id === id) ?? null },
            error: null,
          }),
      },
    },
    from(table: string) {
      return {
        select() {
          calls.push({ table, op: "select" });
          return {
            order: () => Promise.resolve({ data: admins, error: null }),
            then: (r: any) => r({ data: admins, error: null }),
          };
        },
        insert(payload: unknown) {
          calls.push({ table, op: "insert", payload });
          return Promise.resolve({ error: null });
        },
        delete() {
          calls.push({ table, op: "delete" });
          return {
            eq: () =>
              Promise.resolve({ error: opts.deleteError ?? null }),
          };
        },
      };
    },
  };
}

Deno.test("revokeAdmin writes an audit row on success", async () => {
  const c = stubClient({
    admins: [
      { user_id: "a", note: null, created_at: "2026-01-01T00:00:00Z" },
      { user_id: "b", note: null, created_at: "2026-01-01T00:00:00Z" },
    ],
  });
  const res = await revokeAdmin(c as any, "a", "b");
  assertEquals(res.status, 200);
  const audit = c.calls.find((x) => x.table === "admin_audit");
  assertEquals(audit?.op, "insert");
  assertEquals((audit?.payload as any).action, "admin.revoke");
  assertEquals((audit?.payload as any).target_user_id, "b");
});

Deno.test("revokeAdmin does not write an audit row when the guard refuses", async () => {
  const c = stubClient({
    admins: [{ user_id: "a", note: null, created_at: "2026-01-01T00:00:00Z" }],
  });
  const res = await revokeAdmin(c as any, "a", "a");
  assertEquals(res.status, 403);
  assertEquals(c.calls.some((x) => x.table === "admin_audit"), false);
});

Deno.test("grantAdmin discards substring-only candidates from the filter", async () => {
  // GoTrue's filter= returns both for filter=new@example.com. Granting admin to
  // the wrong account because it merely CONTAINS the address is the worst
  // available outcome of the fuzzy filter, so it gets its own test.
  const c = stubClient({
    admins: [{ user_id: "a", note: null, created_at: "2026-01-01T00:00:00Z" }],
  });
  const { deps } = stubGoTrue({
    users: [
      { id: "wrong", email: "xnew@example.com" },
      { id: "right", email: "new@example.com" },
    ],
  });
  const res = await grantAdmin(c as any, deps, "a", "new@example.com");
  assertEquals(res.status, 200);
  const ins = c.calls.find((x) => x.table === "admin_users" && x.op === "insert");
  assertEquals((ins?.payload as any).user_id, "right");
});

Deno.test("grantAdmin sends the address as filter=, not as a page read", async () => {
  const c = stubClient({
    admins: [{ user_id: "a", note: null, created_at: "2026-01-01T00:00:00Z" }],
  });
  const { deps, urls } = stubGoTrue({ users: [{ id: "right", email: "new@example.com" }] });
  await grantAdmin(c as any, deps, "a", "new@example.com");
  assertStringIncludes(urls[0], "filter=new%40example.com");
  assertStringIncludes(urls[0], "per_page=100");
});

Deno.test("grantAdmin 404s when no candidate matches exactly", async () => {
  const c = stubClient({
    admins: [{ user_id: "a", note: null, created_at: "2026-01-01T00:00:00Z" }],
  });
  const { deps } = stubGoTrue({ users: [{ id: "wrong", email: "xnew@example.com" }] });
  const res = await grantAdmin(c as any, deps, "a", "new@example.com");
  assertEquals(res.status, 404);
  assertEquals(c.calls.some((x) => x.table === "admin_audit"), false);
});

Deno.test("grantAdmin 409s rather than 404s when the candidates span more than one page", async () => {
  // The account may be on a page nobody asked for. "No such user" would be a
  // claim this code cannot support, and it would block granting a real admin.
  const c = stubClient({
    admins: [{ user_id: "a", note: null, created_at: "2026-01-01T00:00:00Z" }],
  });
  const { deps } = stubGoTrue({
    users: [{ id: "wrong", email: "xnew@example.com" }],
    headers: { link: '</admin/users?page=2>; rel="next"' },
  });
  const res = await grantAdmin(c as any, deps, "a", "new@example.com");
  assertEquals(res.status, 409);
  assertEquals(c.calls.some((x) => x.op === "insert"), false);
});

Deno.test("grantAdmin 409s an existing admin without a second insert", async () => {
  const c = stubClient({
    admins: [{ user_id: "dup", note: null, created_at: "2026-01-01T00:00:00Z" }],
  });
  const { deps } = stubGoTrue({ users: [{ id: "dup", email: "dup@example.com" }] });
  const res = await grantAdmin(c as any, deps, "a", "dup@example.com");
  assertEquals(res.status, 409);
  assertEquals(c.calls.some((x) => x.op === "insert"), false);
});


Deno.test("revokeAdmin maps the trigger's P0001 to a 409", async () => {
  // The API's own rosterSize check and the trigger can disagree under a race.
  // The trigger is authoritative; its error must not surface as a 500.
  const c = stubClient({
    admins: [
      { user_id: "a", note: null, created_at: "2026-01-01T00:00:00Z" },
      { user_id: "b", note: null, created_at: "2026-01-01T00:00:00Z" },
    ],
    deleteError: { code: "P0001", message: "cannot remove the last admin" },
  });
  const res = await revokeAdmin(c as any, "a", "b");
  assertEquals(res.status, 409);
});
