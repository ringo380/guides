import { assertEquals, assertRejects, assertStringIncludes } from "jsr:@std/assert@1";
import {
  confirmsAccount,
  findUser,
  lookupAccount,
  resetProgress,
} from "../lib/accounts.ts";
import type { GoTrueDeps } from "../lib/gotrue.ts";

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
  deleteError?: unknown;
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
              if (opts.deleteError) {
                return Promise.resolve({ error: opts.deleteError });
              }
              deleted.push(v);
              return Promise.resolve({ error: null });
            },
          };
        },
      };
    },
  };
}

/**
 * GoTrue stub. The injected fetch is the module's only route to the network,
 * so a test that forgets to stub it fails rather than dials out.
 */
function stubGoTrue(opts: { users?: any[]; headers?: Record<string, string> } = {}) {
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

Deno.test("findUser by email discards substring-only candidates", async () => {
  // GoTrue returns both for filter=someone@example.com.
  const c = stubClient();
  const { deps } = stubGoTrue({
    users: [{ ...USER, id: "wrong", email: "xsomeone@example.com" }, USER],
  });
  const r = await findUser(c as any, deps, {
    kind: "email",
    email: "someone@example.com",
  });
  assertEquals(r.kind === "found" ? r.user.id : null, USER.id);
});

Deno.test("findUser by email sends the address as filter=, not as a page read", async () => {
  // Without filter= on the wire this is "fetch the newest 100 users and hope",
  // which 404s any account outside that window.
  const c = stubClient();
  const { deps, urls } = stubGoTrue({ users: [USER] });
  await findUser(c as any, deps, { kind: "email", email: "someone@example.com" });
  assertStringIncludes(urls[0], "filter=someone%40example.com");
  assertStringIncludes(urls[0], "per_page=100");
});

Deno.test("findUser by email returns none when nothing matches exactly", async () => {
  const c = stubClient();
  const { deps } = stubGoTrue({ users: [{ ...USER, email: "other@example.com" }] });
  const r = await findUser(c as any, deps, {
    kind: "email",
    email: "someone@example.com",
  });
  assertEquals(r.kind, "none");
});

Deno.test("findUser reports ambiguous when the candidates span more than one page", async () => {
  // Dropping the extra pages silently would answer 404 for an account that
  // exists on page 2.
  const c = stubClient();
  const { deps } = stubGoTrue({
    users: [{ ...USER, id: "other", email: "other@example.com" }],
    headers: { link: '</admin/users?page=2>; rel="next"' },
  });
  const r = await findUser(c as any, deps, {
    kind: "email",
    email: "someone@example.com",
  });
  assertEquals(r.kind, "ambiguous");
});

Deno.test("lookupAccount answers 409 for an ambiguous candidate set", async () => {
  const c = stubClient();
  const { deps } = stubGoTrue({
    users: [{ ...USER, id: "other", email: "other@example.com" }],
    headers: { link: '</admin/users?page=2>; rel="next"' },
  });
  const res = await lookupAccount(c as any, deps, {
    kind: "email",
    email: "someone@example.com",
  });
  assertEquals(res.status, 409);
});

Deno.test("lookupAccount still answers 404 when page one is the whole set", async () => {
  const c = stubClient();
  const { deps } = stubGoTrue({ users: [], headers: { "x-total-count": "0" } });
  const res = await lookupAccount(c as any, deps, {
    kind: "email",
    email: "someone@example.com",
  });
  assertEquals(res.status, 404);
});

Deno.test("findUser by id returns none for an unknown id", async () => {
  const c = stubClient({ byId: null });
  const { deps } = stubGoTrue();
  const r = await findUser(c as any, deps, { kind: "id", id: USER.id });
  assertEquals(r.kind, "none");
});

Deno.test("findUser normalizes an empty account email to null", async () => {
  // GoTrue serializes an account with no address as "", not null. Left as "",
  // it is a second shape every downstream comparison has to remember.
  const c = stubClient({ byId: { ...USER, email: "" } });
  const { deps } = stubGoTrue();
  const r = await findUser(c as any, deps, { kind: "id", id: USER.id });
  assertEquals(r.kind === "found" ? r.user.email : "unset", null);
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

Deno.test("resetProgress refuses an empty confirmEmail against a null-email account", async () => {
  const c = stubClient({ byId: { ...USER, email: null } });
  const res = await resetProgress(c as any, "actor", USER.id, "");
  assertEquals(res.status, 403);
  assertEquals(c.deleted.length, 0);
});

Deno.test("resetProgress refuses a whitespace-only confirmEmail against a null-email account", async () => {
  const c = stubClient({ byId: { ...USER, email: null } });
  const res = await resetProgress(c as any, "actor", USER.id, "   ");
  assertEquals(res.status, 403);
  assertEquals(c.deleted.length, 0);
});

Deno.test("resetProgress refuses a matching-looking confirmEmail when the account has no email at all", async () => {
  // A null account email must never be treated as matching anything, including
  // another empty/whitespace confirmation - there is no valid confirmation for
  // an account with no email on file.
  const c = stubClient({ byId: { ...USER, email: null } });
  const res = await resetProgress(c as any, "actor", USER.id, "\t\n");
  assertEquals(res.status, 403);
  assertEquals(c.deleted.length, 0);
  assertEquals(c.calls.some((x) => x.table === "admin_audit"), false);
});

// GoTrue serializes an account with no address as "" rather than null, so
// these fixtures use "" - a null-email fixture cannot express the case the
// blank-confirmation clause exists to refuse.

Deno.test("confirmsAccount refuses a blank confirmation for an emailless account", () => {
  // This is the case that makes the blank-confirmation clause load-bearing:
  // "" is what the account holds, so an equality test alone would pass it.
  assertEquals(confirmsAccount("", ""), false);
  assertEquals(confirmsAccount("", "   "), false);
  assertEquals(confirmsAccount("", "\t\n"), false);
});

Deno.test("confirmsAccount refuses a blank confirmation for a normal account", () => {
  assertEquals(confirmsAccount("someone@example.com", "  "), false);
});

Deno.test("confirmsAccount refuses any confirmation for an account with no email", () => {
  assertEquals(confirmsAccount(null, "someone@example.com"), false);
  assertEquals(confirmsAccount("", "someone@example.com"), false);
});

Deno.test("confirmsAccount accepts the exact address, case-insensitively", () => {
  assertEquals(confirmsAccount("someone@example.com", " SOMEONE@example.com "), true);
});

Deno.test("resetProgress refuses a blank confirmEmail against an empty-string account email", async () => {
  const c = stubClient({ byId: { ...USER, email: "" } });
  const res = await resetProgress(c as any, "actor", USER.id, "");
  assertEquals(res.status, 403);
  assertEquals(c.deleted.length, 0);
  assertEquals(c.calls.some((x) => x.table === "admin_audit"), false);
});

Deno.test("resetProgress refuses a whitespace-only confirmEmail against an empty-string account email", async () => {
  const c = stubClient({ byId: { ...USER, email: "" } });
  const res = await resetProgress(c as any, "actor", USER.id, "   ");
  assertEquals(res.status, 403);
  assertEquals(c.deleted.length, 0);
  assertEquals(c.calls.some((x) => x.table === "admin_audit"), false);
});

Deno.test("resetProgress refuses a real address against an empty-string account email", async () => {
  const c = stubClient({ byId: { ...USER, email: "" } });
  const res = await resetProgress(c as any, "actor", USER.id, "someone@example.com");
  assertEquals(res.status, 403);
  assertEquals(c.deleted.length, 0);
  assertEquals(c.calls.some((x) => x.table === "admin_audit"), false);
});

Deno.test("resetProgress records the audit only after the delete succeeds", async () => {
  const c = stubClient({ byId: USER, deleteError: new Error("delete failed") });
  await assertRejects(
    () => resetProgress(c as any, "actor", USER.id, USER.email),
    Error,
    "delete failed",
  );
  assertEquals(c.deleted.length, 0);
  assertEquals(c.calls.some((x) => x.table === "admin_audit"), false);
});
