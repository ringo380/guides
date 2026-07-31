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

/**
 * The shape @supabase/auth-js 2.111.0 actually returns for a well-formed but
 * unknown id: a null user AND an AuthApiError carrying status 404. It does not
 * return a null user with a null error, so a stub that does cannot exercise the
 * not-found path at all.
 */
function authApiError(status: number, code: string, message: string) {
  const e = new Error(message) as Error & { status: number; code: string };
  e.name = "AuthApiError";
  e.status = status;
  e.code = code;
  return e;
}

function stubClient(opts: {
  users?: any[];
  byId?: any;
  byIdError?: unknown;
  progress?: any;
  deleted?: string[];
  rpcError?: unknown;
} = {}) {
  const calls: Array<{ table: string; op: string; payload?: unknown }> = [];
  const deleted = opts.deleted ?? [];
  // No fixture user means the id is unknown, which is what GoTrue reports with
  // a 404 AuthApiError rather than with a quiet null.
  const notFound = authApiError(404, "user_not_found", "User not found");
  return {
    calls,
    deleted,
    auth: {
      admin: {
        listUsers: (_a: unknown) =>
          Promise.resolve({ data: { users: opts.users ?? [] }, error: null }),
        getUserById: (_id: string) =>
          Promise.resolve(
            opts.byIdError
              ? { data: { user: null }, error: opts.byIdError }
              : opts.byId
              ? { data: { user: opts.byId }, error: null }
              : { data: { user: null }, error: notFound },
          ),
      },
    },
    // The destructive write goes through one database function, so the stub
    // records rpc calls the same way it records table calls. `deleted` is
    // appended by the reset function itself, which is what makes the existing
    // "nothing was deleted" assertions still mean what they say.
    rpc(name: string, params: Record<string, unknown>) {
      calls.push({ table: `rpc:${name}`, op: "rpc", payload: params });
      if (opts.rpcError) return Promise.resolve({ data: null, error: opts.rpcError });
      if (name === "admin_reset_progress") deleted.push(params.p_target as string);
      return Promise.resolve({ data: null, error: null });
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
          return { eq: (_c: string, _v: string) => Promise.resolve({ error: null }) };
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
  // The client answers a well-formed but unknown id with a 404 AuthApiError.
  // Rethrowing it turns a 404 into an uncaught 500 with no CORS headers, which
  // the browser cannot even read.
  const c = stubClient({ byId: null });
  const { deps } = stubGoTrue();
  const r = await findUser(c as any, deps, { kind: "id", id: USER.id });
  assertEquals(r.kind, "none");
});

Deno.test("lookupAccount answers 404 for a well-formed but unknown id", async () => {
  const c = stubClient({ byId: null });
  const { deps } = stubGoTrue();
  const res = await lookupAccount(c as any, deps, { kind: "id", id: USER.id });
  assertEquals(res.status, 404);
});

Deno.test("findUser by id rethrows a 404 that is not a missing user", async () => {
  // A 404 from the auth path itself - a gateway route change, GoTrue not
  // serving /auth/v1/admin/users/<id> - carries its own code. Reading the
  // status alone reports a real account as gone, which is worse than an error.
  const c = stubClient({
    byIdError: authApiError(404, "not_found", "Requested path is invalid"),
  });
  const { deps } = stubGoTrue();
  await assertRejects(
    () => findUser(c as any, deps, { kind: "id", id: USER.id }),
    Error,
    "Requested path is invalid",
  );
});

Deno.test("findUser by id still treats a codeless 404 as a missing user", async () => {
  // Older auth-js releases answer without a code at all, so the status has to
  // remain sufficient on its own.
  const e = new Error("User not found") as Error & { status: number };
  e.status = 404;
  const c = stubClient({ byIdError: e });
  const { deps } = stubGoTrue();
  const r = await findUser(c as any, deps, { kind: "id", id: USER.id });
  assertEquals(r.kind, "none");
});

Deno.test("findUser by id rethrows an error that is not a missing user", async () => {
  // Only "no such user" is an answer. A 500 from GoTrue, or a rejected service
  // key, must not be laundered into "no such user".
  const c = stubClient({
    byIdError: authApiError(500, "unexpected_failure", "boom"),
  });
  const { deps } = stubGoTrue();
  await assertRejects(
    () => findUser(c as any, deps, { kind: "id", id: USER.id }),
    Error,
    "boom",
  );
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
  assertEquals(c.calls.some((x) => x.op === "rpc"), false);
});

Deno.test("resetProgress deletes and audits when the pair agrees", async () => {
  const c = stubClient({ byId: USER });
  const res = await resetProgress(c as any, "actor", USER.id, USER.email);
  assertEquals(res.status, 200);
  assertEquals(c.deleted, [USER.id]);
  const write = c.calls.find((x) => x.op === "rpc");
  assertEquals(write?.table, "rpc:admin_reset_progress");
  assertEquals((write?.payload as any).p_actor, "actor");
  assertEquals((write?.payload as any).p_target, USER.id);
});

Deno.test("resetProgress writes the row and its audit entry in one call", async () => {
  // The point of the database function. As two round trips, an audit insert
  // that failed after the delete had committed escaped as a CORS-less 500 and
  // the page told the admin nothing was deleted - about a row that was gone.
  // Two separate database calls here would be that bug back.
  const c = stubClient({ byId: USER });
  await resetProgress(c as any, "actor", USER.id, USER.email);
  const writes = c.calls.filter((x) => x.op !== "select");
  assertEquals(writes.length, 1);
  assertEquals(writes[0].op, "rpc");
});

Deno.test("resetProgress reports a failed write as a failure, not a success", async () => {
  const c = stubClient({
    byId: USER,
    rpcError: new Error("delete failed"),
  });
  await assertRejects(
    () => resetProgress(c as any, "actor", USER.id, USER.email),
    Error,
    "delete failed",
  );
  assertEquals(c.deleted.length, 0);
});

Deno.test("resetProgress matches confirmEmail case-insensitively", async () => {
  const c = stubClient({ byId: USER });
  const res = await resetProgress(c as any, "actor", USER.id, "SOMEONE@EXAMPLE.COM");
  assertEquals(res.status, 200);
});

Deno.test("resetProgress 404s an unknown user without deleting", async () => {
  // Same 404 AuthApiError as the lookup path. Rethrowing it here answers a
  // destructive request with an unreadable 500.
  const c = stubClient({ byId: null });
  const res = await resetProgress(c as any, "actor", USER.id, USER.email);
  assertEquals(res.status, 404);
  assertEquals(c.deleted.length, 0);
});

Deno.test("resetProgress never sends an email to the audit write", async () => {
  // The audit row records ids only. The confirmation address the admin typed
  // must not travel to the database function that writes it.
  const c = stubClient({ byId: USER });
  await resetProgress(c as any, "actor", USER.id, USER.email);
  const write = c.calls.find((x) => x.op === "rpc");
  assertEquals(JSON.stringify(write?.payload).includes("@"), false);
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
  assertEquals(c.calls.some((x) => x.op === "rpc"), false);
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
  assertEquals(c.calls.some((x) => x.op === "rpc"), false);
});

Deno.test("resetProgress refuses a whitespace-only confirmEmail against an empty-string account email", async () => {
  const c = stubClient({ byId: { ...USER, email: "" } });
  const res = await resetProgress(c as any, "actor", USER.id, "   ");
  assertEquals(res.status, 403);
  assertEquals(c.deleted.length, 0);
  assertEquals(c.calls.some((x) => x.op === "rpc"), false);
});

Deno.test("resetProgress refuses a real address against an empty-string account email", async () => {
  const c = stubClient({ byId: { ...USER, email: "" } });
  const res = await resetProgress(c as any, "actor", USER.id, "someone@example.com");
  assertEquals(res.status, 403);
  assertEquals(c.deleted.length, 0);
  assertEquals(c.calls.some((x) => x.op === "rpc"), false);
});

