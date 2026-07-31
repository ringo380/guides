import { assertEquals } from "jsr:@std/assert@1";
import { resolveRoute } from "../lib/routes.ts";

Deno.test("resolveRoute maps the read routes", () => {
  assertEquals(resolveRoute("GET", "/admin-api/health"), "health");
  assertEquals(resolveRoute("GET", "/admin-api/overview"), "overview");
  assertEquals(resolveRoute("GET", "/admin-api/traffic"), "traffic");
  assertEquals(resolveRoute("GET", "/admin-api/user"), "user");
  assertEquals(resolveRoute("GET", "/admin-api/user/export"), "user.export");
  assertEquals(resolveRoute("GET", "/admin-api/admins"), "admins.list");
});

Deno.test("resolveRoute maps the write routes", () => {
  assertEquals(resolveRoute("POST", "/admin-api/user/progress/reset"), "user.reset");
  assertEquals(resolveRoute("POST", "/admin-api/admins"), "admins.grant");
  assertEquals(resolveRoute("POST", "/admin-api/admins/revoke"), "admins.revoke");
});

Deno.test("a GET can never reach a write route", () => {
  assertEquals(resolveRoute("GET", "/admin-api/user/progress/reset"), null);
  assertEquals(resolveRoute("GET", "/admin-api/admins/revoke"), null);
});

Deno.test("a POST can never reach a read route", () => {
  assertEquals(resolveRoute("POST", "/admin-api/overview"), null);
  assertEquals(resolveRoute("POST", "/admin-api/user"), null);
});

Deno.test("resolveRoute tolerates the trailing slash and the bare prefix", () => {
  assertEquals(resolveRoute("GET", "/admin-api/health/"), "health");
  assertEquals(resolveRoute("GET", "/admin-api/"), null);
});

Deno.test("resolveRoute rejects unknown paths", () => {
  assertEquals(resolveRoute("GET", "/admin-api/nope"), null);
  assertEquals(resolveRoute("DELETE", "/admin-api/admins"), null);
});
