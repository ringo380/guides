import { assertEquals } from "jsr:@std/assert@1";
import { withErrorFloor } from "../lib/error-floor.ts";

const ALLOWED = "https://runbook.fyi";

function request(origin: string | null = ALLOWED): Request {
  return new Request("https://example.test/admin-api/user", {
    headers: origin === null ? {} : { Origin: origin },
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

Deno.test("withErrorFloor passes a normal response through untouched", async () => {
  const inner = new Response("ok", { status: 201, headers: { "x-marker": "1" } });
  const wrapped = withErrorFloor(() => Promise.resolve(inner));
  const res = await wrapped(request(), {});
  assertEquals(res.status, 201);
  assertEquals(await res.text(), "ok");
  assertEquals(res.headers.get("x-marker"), "1");
});

Deno.test("withErrorFloor turns an uncaught throw into a readable 500", async () => {
  const wrapped = withErrorFloor(() => {
    throw new Error("boom");
  });
  const res = await quiet(() => wrapped(request(), {}));
  assertEquals(res.status, 500);
  assertEquals(await res.json(), { error: "internal error" });
});

Deno.test("withErrorFloor puts CORS headers on the 500 so the browser can read it", async () => {
  // The whole point. Without these the browser sees an opaque failure it cannot
  // distinguish from the network dropping, and the page guesses what happened.
  const wrapped = withErrorFloor(() => Promise.reject(new Error("boom")));
  const res = await quiet(() => wrapped(request(), {}));
  assertEquals(res.headers.get("Access-Control-Allow-Origin"), ALLOWED);
});

Deno.test("withErrorFloor catches a rejected promise, not only a synchronous throw", async () => {
  // Every route is async, so the realistic failure is a rejection.
  const wrapped = withErrorFloor(async () => {
    await Promise.resolve();
    throw new Error("late boom");
  });
  const res = await quiet(() => wrapped(request(), {}));
  assertEquals(res.status, 500);
});

Deno.test("withErrorFloor does not echo the error message to the caller", async () => {
  // Messages can name internal schema. The log gets the detail, the caller does not.
  const wrapped = withErrorFloor(() => {
    throw new Error("relation \"admin_users\" does not exist");
  });
  const res = await quiet(() => wrapped(request(), {}));
  assertEquals((await res.text()).includes("admin_users"), false);
});

Deno.test("withErrorFloor withholds CORS from a disallowed origin even when failing", async () => {
  // The allowlist still applies on the error path: a failure must not become a
  // way to get a response any origin can read.
  const wrapped = withErrorFloor(() => {
    throw new Error("boom");
  });
  const res = await quiet(() => wrapped(request("https://evil.example"), {}));
  assertEquals(res.status, 500);
  assertEquals(res.headers.get("Access-Control-Allow-Origin"), null);
});
