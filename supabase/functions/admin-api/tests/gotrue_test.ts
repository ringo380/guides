import {
  assertEquals,
  assertRejects,
  assertStringIncludes,
  assertThrows,
} from "jsr:@std/assert@1";
import {
  buildGoTrueDeps,
  GoTrueConfigError,
  type GoTrueDeps,
  listUsersByFilter,
} from "../lib/gotrue.ts";

/**
 * Records every requested URL and answers from a canned body. Nothing here
 * touches the network: the injected fetch is the only one the module can use.
 */
function stubDeps(opts: {
  users?: unknown[];
  headers?: Record<string, string>;
  status?: number;
} = {}) {
  const urls: string[] = [];
  const init: RequestInit[] = [];
  const deps: GoTrueDeps = {
    url: "https://project.supabase.co",
    serviceKey: "service-role-key",
    fetch: ((input: any, i: any) => {
      urls.push(String(input));
      init.push(i);
      return Promise.resolve(
        new Response(JSON.stringify({ users: opts.users ?? [] }), {
          status: opts.status ?? 200,
          headers: opts.headers ?? {},
        }),
      );
    }) as typeof fetch,
  };
  return { deps, urls, init };
}

Deno.test("listUsersByFilter puts filter and per_page on the wire", async () => {
  // The whole point of this module: supabase-js drops `filter`. If it is
  // missing from the request line, the lookup is reading the newest N users.
  const { deps, urls } = stubDeps({ users: [] });
  await listUsersByFilter(deps, "someone@example.com", 1, 100);

  const url = new URL(urls[0]);
  assertEquals(url.pathname, "/auth/v1/admin/users");
  assertEquals(url.searchParams.get("filter"), "someone@example.com");
  assertEquals(url.searchParams.get("per_page"), "100");
  assertEquals(url.searchParams.get("page"), "1");
});

Deno.test("listUsersByFilter percent-encodes the filter", async () => {
  const { deps, urls } = stubDeps({ users: [] });
  await listUsersByFilter(deps, "a+b@example.com", 1, 100);
  // Raw, a `+` on a query string decodes to a space and the filter matches
  // the wrong account.
  assertStringIncludes(urls[0], "filter=a%2Bb%40example.com");
});

Deno.test("listUsersByFilter authenticates with the service key", async () => {
  const { deps, init } = stubDeps({ users: [] });
  await listUsersByFilter(deps, "someone@example.com", 1, 100);
  const headers = (init[0].headers ?? {}) as Record<string, string>;
  assertEquals(headers.apikey, "service-role-key");
  assertEquals(headers.Authorization, "Bearer service-role-key");
});

Deno.test("listUsersByFilter reports hasMore from the Link header", async () => {
  const { deps } = stubDeps({
    users: [{ id: "a" }],
    headers: { link: '</admin/users?page=2>; rel="next"' },
  });
  const r = await listUsersByFilter(deps, "x@example.com", 1, 100);
  assertEquals(r.hasMore, true);
});

Deno.test("listUsersByFilter reports hasMore from x-total-count", async () => {
  const { deps } = stubDeps({
    users: [{ id: "a" }],
    headers: { "x-total-count": "150" },
  });
  const r = await listUsersByFilter(deps, "x@example.com", 1, 100);
  assertEquals(r.hasMore, true);
});

Deno.test("listUsersByFilter reads hasMore from the headers in both directions", async () => {
  // Asserting only the false side is vacuous: a hardcoded `false` satisfies it.
  // Both directions are asserted here from the header shapes GoTrue actually
  // sends, including the boundary where the count exactly fills the page.
  const lastPage = { link: '</admin/users?page=1>; rel="prev"', "x-total-count": "100" };

  const a = stubDeps({ users: [{ id: "a" }], headers: lastPage });
  assertEquals((await listUsersByFilter(a.deps, "x@example.com", 1, 100)).hasMore, false);

  // One more account than this page window covers: there is a page 2.
  const b = stubDeps({ users: [{ id: "a" }], headers: { "x-total-count": "101" } });
  assertEquals((await listUsersByFilter(b.deps, "x@example.com", 1, 100)).hasMore, true);

  // A rel="next" link is enough on its own, with no count header at all.
  const c = stubDeps({
    users: [{ id: "a" }],
    headers: { link: '</admin/users?page=2>; rel="next"' },
  });
  assertEquals((await listUsersByFilter(c.deps, "x@example.com", 1, 100)).hasMore, true);

  // The window moves with the page: 101 accounts is not a third page.
  const d = stubDeps({ users: [{ id: "a" }], headers: { "x-total-count": "101" } });
  const dr = await listUsersByFilter(d.deps, "x@example.com", 2, 100);
  assertEquals(dr.hasMore, false);
  assertEquals(dr.users.length, 1);
});

Deno.test("listUsersByFilter throws on a non-2xx response", async () => {
  const { deps } = stubDeps({ status: 500 });
  await assertRejects(
    () => listUsersByFilter(deps, "x@example.com", 1, 100),
    Error,
    "500",
  );
});

/**
 * The env vars are read once, where the deps are built. An empty value there
 * surfaces much later as `new URL(path, "")` throwing TypeError: Invalid URL,
 * which reaches the admin as an unexplained 500 on every lookup and names
 * nothing the operator can fix.
 */
Deno.test("buildGoTrueDeps names a missing project url", () => {
  const err = assertThrows(
    () =>
      buildGoTrueDeps(
        (k) => (k === "SUPABASE_SERVICE_ROLE_KEY" ? "service-role-key" : ""),
        fetch,
      ),
    GoTrueConfigError,
  );
  assertStringIncludes((err as Error).message, "SUPABASE_URL");
});

Deno.test("buildGoTrueDeps names a missing service key", () => {
  const err = assertThrows(
    () =>
      buildGoTrueDeps(
        (k) => (k === "SUPABASE_URL" ? "https://project.supabase.co" : undefined),
        fetch,
      ),
    GoTrueConfigError,
  );
  assertStringIncludes((err as Error).message, "SUPABASE_SERVICE_ROLE_KEY");
});

Deno.test("buildGoTrueDeps names both when both are missing", () => {
  const err = assertThrows(() => buildGoTrueDeps(() => "", fetch), GoTrueConfigError);
  assertStringIncludes((err as Error).message, "SUPABASE_URL");
  assertStringIncludes((err as Error).message, "SUPABASE_SERVICE_ROLE_KEY");
  // The message is read by an admin trying to fix a deploy, so it agrees with
  // itself: two variables are not set, one is.
  assertStringIncludes((err as Error).message, "are not set");
});

Deno.test("buildGoTrueDeps rejects a url that is not a usable base", () => {
  // A truthy but malformed value fails the same way an empty one does, just
  // later and with a worse message.
  assertThrows(
    () => buildGoTrueDeps((k) => (k === "SUPABASE_URL" ? "project.supabase.co" : "key"), fetch),
    GoTrueConfigError,
    "SUPABASE_URL",
  );
});

Deno.test("buildGoTrueDeps returns usable deps when both are set", () => {
  const deps = buildGoTrueDeps(
    (k) => (k === "SUPABASE_URL" ? "https://project.supabase.co" : "service-role-key"),
    fetch,
  );
  assertEquals(deps.url, "https://project.supabase.co");
  assertEquals(deps.serviceKey, "service-role-key");
  assertEquals(typeof deps.fetch, "function");
});
