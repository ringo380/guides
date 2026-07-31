import { assertEquals, assertRejects, assertStringIncludes } from "jsr:@std/assert@1";
import { checkRevoke, grantAdmin, listAdmins, revokeAdmin } from "../lib/roster.ts";
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
  const r = checkRevoke({ actorId: "a", targetId: "a", isMember: true, rosterSize: 5 });
  assertEquals(r, { ok: false, status: 403, error: "cannot revoke yourself" });
});

Deno.test("checkRevoke refuses emptying the roster", () => {
  const r = checkRevoke({ actorId: "a", targetId: "b", isMember: true, rosterSize: 1 });
  assertEquals(r, { ok: false, status: 409, error: "cannot remove the last admin" });
});

Deno.test("checkRevoke allows a normal revoke", () => {
  assertEquals(
    checkRevoke({ actorId: "a", targetId: "b", isMember: true, rosterSize: 2 }),
    { ok: true },
  );
});

Deno.test("checkRevoke checks self before roster size", () => {
  // Both conditions hold. Self-revoke is the more actionable message, and the
  // one the admin can actually fix.
  const r = checkRevoke({ actorId: "a", targetId: "a", isMember: true, rosterSize: 1 });
  assertEquals(r, { ok: false, status: 403, error: "cannot revoke yourself" });
});

Deno.test("checkRevoke checks self before membership", () => {
  // Only reachable when the actor was revoked by someone else between the admin
  // gate and the roster read. Both answers are true; "cannot revoke yourself" is
  // the one that stays true on a retry, and a retry is what "not an admin" about
  // your own id invites.
  const r = checkRevoke({ actorId: "a", targetId: "a", isMember: false, rosterSize: 3 });
  assertEquals(r, { ok: false, status: 403, error: "cannot revoke yourself" });
});

Deno.test("checkRevoke reports a non-member as a 404 even on a one-admin roster", () => {
  // Both the membership and the roster-size condition hold, and the roster-size
  // answer is the wrong one: removing an account that is not on the roster
  // removes nothing, so it could never have emptied it. "Cannot remove the last
  // admin" sends the admin off to grant a second admin when the id was simply
  // not one.
  const r = checkRevoke({ actorId: "a", targetId: "b", isMember: false, rosterSize: 1 });
  assertEquals(r, { ok: false, status: 404, error: "not an admin" });
});

Deno.test("checkRevoke reports a non-member as a 404 on a healthy roster too", () => {
  const r = checkRevoke({ actorId: "a", targetId: "b", isMember: false, rosterSize: 5 });
  assertEquals(r, { ok: false, status: 404, error: "not an admin" });
});

/**
 * Minimal stub of the PostgREST builder chain used by roster.ts.
 *
 * `calls` records every table read and every database function called. The
 * writes go through functions rather than table calls because each one has to
 * commit with its audit row or not at all; `insertError` and `deleteError` are
 * the errors those functions return.
 */
function stubClient(opts: {
  admins?: Array<{ user_id: string; note: string | null; created_at: string }>;
  deleteError?: { code?: string; message: string };
  insertError?: { code?: string; message: string };
  users?: Array<{ id: string; email: string | null }>;
  // Ids whose getUserById fails outright, as opposed to resolving to an
  // account with no address.
  lookupErrors?: Record<string, { message: string }>;
}) {
  const calls: Array<{ table: string; op: string; payload?: unknown }> = [];
  const admins = opts.admins ?? [];
  return {
    calls,
    auth: {
      admin: {
        getUserById: (id: string) => {
          const failure = (opts.lookupErrors ?? {})[id];
          if (failure) {
            return Promise.resolve({ data: { user: null }, error: failure });
          }
          return Promise.resolve({
            data: { user: (opts.users ?? []).find((u) => u.id === id) ?? null },
            error: null,
          });
        },
      },
    },
    rpc(name: string, params: Record<string, unknown>) {
      calls.push({ table: `rpc:${name}`, op: "rpc", payload: params });
      const error = name === "admin_grant_admin"
        ? (opts.insertError ?? null)
        : (opts.deleteError ?? null);
      return Promise.resolve({ data: null, error });
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
      };
    },
  };
}

Deno.test("revokeAdmin removes the row and audits it in one call", async () => {
  const c = stubClient({
    admins: [
      { user_id: "a", note: null, created_at: "2026-01-01T00:00:00Z" },
      { user_id: "b", note: null, created_at: "2026-01-01T00:00:00Z" },
    ],
  });
  const res = await revokeAdmin(c as any, "a", "b");
  assertEquals(res.status, 200);
  // One write, not a delete followed by an audit insert. Two calls here would
  // be the bug this replaced: an audit failure after a committed delete, told
  // to the admin as "nothing was revoked".
  const writes = c.calls.filter((x) => x.op !== "select");
  assertEquals(writes.length, 1);
  assertEquals(writes[0].table, "rpc:admin_revoke_admin");
  assertEquals((writes[0].payload as any).p_actor, "a");
  assertEquals((writes[0].payload as any).p_target, "b");
});

Deno.test("revokeAdmin writes nothing when the guard refuses", async () => {
  const c = stubClient({
    admins: [{ user_id: "a", note: null, created_at: "2026-01-01T00:00:00Z" }],
  });
  const res = await revokeAdmin(c as any, "a", "a");
  assertEquals(res.status, 403);
  assertEquals(c.calls.some((x) => x.op === "rpc"), false);
});

Deno.test("revokeAdmin 404s a non-admin on a single-admin roster", async () => {
  // The end-to-end shape of the ordering bug: an admin pastes an id that was
  // never on the roster, and the answer describes the roster's size instead of
  // the id. Asserted through revokeAdmin, not only through checkRevoke, because
  // the call site is what decides the order of the arguments it passes.
  const c = stubClient({
    admins: [{ user_id: "a", note: null, created_at: "2026-01-01T00:00:00Z" }],
  });
  const res = await revokeAdmin(c as any, "a", "stranger");
  assertEquals(res.status, 404);
  assertEquals((res.body as any).error, "not an admin");
  assertEquals(c.calls.some((x) => x.op === "rpc"), false);
});

Deno.test("revokeAdmin still refuses to empty a roster of one", async () => {
  // The other side of the same ordering: the last-admin refusal has to survive
  // the fix, for a target that IS on the roster.
  const c = stubClient({
    admins: [{ user_id: "solo", note: null, created_at: "2026-01-01T00:00:00Z" }],
  });
  const res = await revokeAdmin(c as any, "a", "solo");
  assertEquals(res.status, 409);
  assertEquals((res.body as any).error, "cannot remove the last admin");
  assertEquals(c.calls.some((x) => x.op === "rpc"), false);
});

Deno.test("revokeAdmin maps P0002 to 404 rather than reporting a revoke it did not make", async () => {
  // A concurrent revoke of the same account commits between the roster read
  // and this delete. The function refuses to audit a revoke that removed no
  // row; answering 200 would put a revoke in the log that never happened.
  const c = stubClient({
    admins: [
      { user_id: "a", note: null, created_at: "2026-01-01T00:00:00Z" },
      { user_id: "b", note: null, created_at: "2026-01-01T00:00:00Z" },
    ],
    deleteError: { code: "P0002", message: "not an admin" },
  });
  const res = await revokeAdmin(c as any, "a", "b");
  assertEquals(res.status, 404);
  assertEquals((res.body as any).error, "not an admin");
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
  const ins = c.calls.find((x) => x.table === "rpc:admin_grant_admin");
  assertEquals((ins?.payload as any).p_target, "right");
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

Deno.test("grantAdmin escapes the LIKE wildcards before they reach filter=", async () => {
  // Same boundary as the lookup path, and it has to be asserted separately:
  // this call site builds its own filter argument.
  const c = stubClient({
    admins: [{ user_id: "a", note: null, created_at: "2026-01-01T00:00:00Z" }],
  });
  const { deps, urls } = stubGoTrue({ users: [{ id: "x", email: "first_last@example.com" }] });
  await grantAdmin(c as any, deps, "a", "first_last@example.com");
  assertStringIncludes(urls[0], "filter=first%5C_last%40example.com");
});

Deno.test("grantAdmin 404s when no candidate matches exactly", async () => {
  const c = stubClient({
    admins: [{ user_id: "a", note: null, created_at: "2026-01-01T00:00:00Z" }],
  });
  const { deps } = stubGoTrue({ users: [{ id: "wrong", email: "xnew@example.com" }] });
  const res = await grantAdmin(c as any, deps, "a", "new@example.com");
  assertEquals(res.status, 404);
  // The status alone would also pass for a grant that wrote the row and then
  // answered 404, which leaves the account genuinely an admin.
  assertEquals(c.calls.some((x) => x.op === "rpc"), false);
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
  assertEquals(c.calls.some((x) => x.op === "rpc"), false);
});

Deno.test("grantAdmin 409s an existing admin without a second insert", async () => {
  const c = stubClient({
    admins: [{ user_id: "dup", note: null, created_at: "2026-01-01T00:00:00Z" }],
  });
  const { deps } = stubGoTrue({ users: [{ id: "dup", email: "dup@example.com" }] });
  const res = await grantAdmin(c as any, deps, "a", "dup@example.com");
  assertEquals(res.status, 409);
  assertEquals(c.calls.some((x) => x.op === "rpc"), false);
});


Deno.test("grantAdmin maps a unique violation to 409, not 500", async () => {
  // The roster check is check-then-act: a concurrent grant of the same account
  // commits in between and the primary key rejects this insert. That is the
  // same conflict the check reports, so it gets the same status.
  const c = stubClient({
    admins: [{ user_id: "a", note: null, created_at: "2026-01-01T00:00:00Z" }],
    insertError: { code: "23505", message: "duplicate key value" },
  });
  const { deps } = stubGoTrue({ users: [{ id: "new", email: "new@example.com" }] });
  const res = await grantAdmin(c as any, deps, "a", "new@example.com");
  assertEquals(res.status, 409);
  assertEquals((res.body as any).error, "already an admin");
});

Deno.test("revokeAdmin maps a deadlock abort to a 409, not a 500", async () => {
  // Two admins revoking each other at the same instant is a lock cycle: each
  // transaction holds the other's row and wants the one it does not have.
  // Postgres breaks it by aborting one side with 40P01. That side lost a race,
  // which is a conflict the caller can retry, not a server fault.
  const c = stubClient({
    admins: [
      { user_id: "a", note: null, created_at: "2026-01-01T00:00:00Z" },
      { user_id: "b", note: null, created_at: "2026-01-01T00:00:00Z" },
    ],
    deleteError: { code: "40P01", message: "deadlock detected" },
  });
  const res = await revokeAdmin(c as any, "a", "b");
  assertEquals(res.status, 409);
  assertStringIncludes((res.body as any).error, "try again");
});

Deno.test("revokeAdmin maps a lock timeout to a 409, not a 500", async () => {
  // Same class of answer, should a lock_timeout ever be configured on the
  // connection: the row was busy, nothing was revoked, retrying is valid.
  const c = stubClient({
    admins: [
      { user_id: "a", note: null, created_at: "2026-01-01T00:00:00Z" },
      { user_id: "b", note: null, created_at: "2026-01-01T00:00:00Z" },
    ],
    deleteError: { code: "55P03", message: "lock not available" },
  });
  const res = await revokeAdmin(c as any, "a", "b");
  assertEquals(res.status, 409);
  // The status alone would also pass for the last-admin refusal, which tells
  // the admin the wrong reason and the wrong next step: one is worth retrying,
  // the other never will be.
  assertStringIncludes((res.body as any).error, "try again");
});

Deno.test("revokeAdmin still throws an error it does not recognize", async () => {
  const c = stubClient({
    admins: [
      { user_id: "a", note: null, created_at: "2026-01-01T00:00:00Z" },
      { user_id: "b", note: null, created_at: "2026-01-01T00:00:00Z" },
    ],
    deleteError: { code: "42501", message: "permission denied" },
  });
  await assertRejects(() => revokeAdmin(c as any, "a", "b"));
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

Deno.test("listAdmins distinguishes an unreadable address from an absent one", async () => {
  // Both rows end up with email null. Only one of them is a fact about the
  // account; the other is a fault. Reporting them identically told an admin
  // "no address on file" about an account whose address nobody managed to read.
  const c = stubClient({
    admins: [
      { user_id: "reads", note: null, created_at: "2026-01-01T00:00:00Z" },
      { user_id: "absent", note: null, created_at: "2026-01-02T00:00:00Z" },
      { user_id: "fails", note: null, created_at: "2026-01-03T00:00:00Z" },
    ],
    users: [
      { id: "reads", email: "someone@example.com" },
      { id: "absent", email: null },
    ],
    lookupErrors: { fails: { message: "connection reset" } },
  });
  const rows = await listAdmins(c as any);
  assertEquals(rows.map((r) => r.email), ["someone@example.com", null, null]);
  assertEquals(rows.map((r) => r.emailUnavailable), [false, false, true]);
});

Deno.test("listAdmins keeps returning the roster when one lookup fails", async () => {
  // Containment: the roster decides who can revoke whom, so one unreadable
  // address must not cost the caller the whole list.
  const c = stubClient({
    admins: [
      { user_id: "fails", note: null, created_at: "2026-01-01T00:00:00Z" },
      { user_id: "reads", note: "keeper", created_at: "2026-01-02T00:00:00Z" },
    ],
    users: [{ id: "reads", email: "someone@example.com" }],
    lookupErrors: { fails: { message: "connection reset" } },
  });
  const rows = await listAdmins(c as any);
  assertEquals(rows.length, 2);
  assertEquals(rows[1].email, "someone@example.com");
  assertEquals(rows[1].note, "keeper");
});
