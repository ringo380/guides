import { assertEquals, assertRejects, assertStringIncludes } from "jsr:@std/assert@1";
import { type GoTrueDeps, listUsersByFilter } from "../lib/gotrue.ts";

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

Deno.test("listUsersByFilter reports no further pages when the headers say so", async () => {
  const { deps } = stubDeps({
    users: [{ id: "a" }],
    headers: { "x-total-count": "1" },
  });
  const r = await listUsersByFilter(deps, "x@example.com", 1, 100);
  assertEquals(r.hasMore, false);
  assertEquals(r.users.length, 1);
});

Deno.test("listUsersByFilter throws on a non-2xx response", async () => {
  const { deps } = stubDeps({ status: 500 });
  await assertRejects(
    () => listUsersByFilter(deps, "x@example.com", 1, 100),
    Error,
    "500",
  );
});
