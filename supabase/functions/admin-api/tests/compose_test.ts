import { assertEquals } from "jsr:@std/assert@1";
import { buildFetch } from "../lib/compose.ts";

const ALLOWED = "https://runbook.fyi";

function request(): Request {
  return new Request("https://example.test/admin-api/health", {
    headers: { Origin: ALLOWED },
  });
}

/** Silence the deliberate console.error so a passing run stays readable. */
async function quiet<T>(fn: () => Promise<T>): Promise<T> {
  const original = console.error;
  console.error = () => {};
  try {
    return await fn();
  } finally {
    console.error = original;
  }
}

/** A withSupabase that never reaches the handler, the way a bad key does. */
const throwingWrapper = () => () => {
  throw new Error("service-role key rejected");
};

const okHandler = () => Promise.resolve(new Response("ok", { status: 200 }));

Deno.test("buildFetch catches a throw from the wrapper, not only from the handler", async () => {
  // The ordering test. With the floor nested INSIDE withSupabase this throw
  // escapes to the platform, which answers plain text with no CORS headers -
  // and the admin page reads that as a connection failure and says nothing was
  // written, about writes that may well have committed.
  const fetchFn = buildFetch(throwingWrapper, { auth: "user" }, okHandler);
  const res = await quiet(() => fetchFn(request(), {}));
  assertEquals(res.status, 500);
  assertEquals(await res.json(), { error: "internal error" });
  assertEquals(res.headers.get("Access-Control-Allow-Origin"), ALLOWED);
});

Deno.test("buildFetch catches a rejection from the wrapper", async () => {
  // The async shape of the same failure: withSupabase builds its client lazily
  // and the rejection surfaces on await rather than on call.
  const wrapper = () => () => Promise.reject(new Error("claims shape"));
  const fetchFn = buildFetch(wrapper, { auth: "user" }, okHandler);
  const res = await quiet(() => fetchFn(request(), {}));
  assertEquals(res.status, 500);
  assertEquals(res.headers.get("Access-Control-Allow-Origin"), ALLOWED);
});

Deno.test("buildFetch still catches a throw from the route handler", async () => {
  // The inner position must keep working: this is the case the floor was added
  // for, and it passes under BOTH nestings, which is why it cannot be the only
  // test here.
  const wrapper = (_o: unknown, h: any) => (req: Request) => h(req, {});
  const fetchFn = buildFetch(wrapper, { auth: "user" }, () => {
    throw new Error("route boom");
  });
  const res = await quiet(() => fetchFn(request(), {}));
  assertEquals(res.status, 500);
});

Deno.test("buildFetch passes a successful response through untouched", async () => {
  const wrapper = (_o: unknown, h: any) => (req: Request) => h(req, {});
  const fetchFn = buildFetch(wrapper, { auth: "user" }, () =>
    Promise.resolve(new Response("ok", { status: 200, headers: { "x-marker": "1" } })));
  const res = await fetchFn(request(), {});
  assertEquals(res.status, 200);
  assertEquals(await res.text(), "ok");
  assertEquals(res.headers.get("x-marker"), "1");
});

Deno.test("buildFetch hands the options and handler to the wrapper unchanged", async () => {
  // Guards the glue itself: a buildFetch that quietly dropped auth: "user"
  // would leave every route reachable without a user JWT, and every other test
  // in this file would still pass.
  const seen: Array<{ options: unknown; handler: unknown }> = [];
  const options = { auth: "user" };
  const handler = okHandler;
  const wrapper = (o: unknown, h: any) => {
    seen.push({ options: o, handler: h });
    return (req: Request) => h(req, {});
  };
  await buildFetch(wrapper, options, handler)(request(), {});
  assertEquals(seen.length, 1);
  assertEquals(seen[0].options, options);
  assertEquals(seen[0].handler === handler, true);
});
