import { assertEquals } from "jsr:@std/assert@1";
import {
  ROUTE_NAMES,
  resolveRoute,
  type RouteName,
  routeNeedsGoTrue,
} from "../lib/routes.ts";

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

/**
 * Every route, classified. Written out rather than derived so that adding a
 * route without deciding whether it resolves an address fails here, which is
 * the whole point: the gate is a hand-maintained list, and the failure mode of
 * a desynced one is a misconfigured deploy answering with a null dereference
 * instead of the variable that is missing.
 */
const NEEDS_GOTRUE: Record<RouteName, boolean> = {
  "health": false,
  "overview": false,
  "traffic": false,
  "user": true,
  "user.export": true,
  "user.reset": false,
  "admins.list": false,
  "admins.grant": true,
  "admins.revoke": false,
};

Deno.test("every route is classified against the GoTrue gate", () => {
  assertEquals(ROUTE_NAMES.length, 9);
  for (const route of ROUTE_NAMES) {
    const expected = NEEDS_GOTRUE[route];
    assertEquals(
      typeof expected,
      "boolean",
      `route ${route} is not classified in this test`,
    );
    assertEquals(routeNeedsGoTrue(route), expected, `route ${route}`);
  }
});
