import { assertEquals } from "jsr:@std/assert@1";
import { buildPayload } from "../lib/merge.ts";

const NOW = new Date("2026-07-24T12:00:00Z");

Deno.test("buildPayload labels both sections with their population", () => {
  const out = buildPayload("28d", { activeUsers: 10, sessions: 12, topPages: [], events: {} }, {
    registeredUsers: 3,
    pages: [],
  }, NOW) as any;
  assertEquals(out.ga4.population, "all visitors");
  assertEquals(out.progress.population, "signed-in users only");
});

Deno.test("buildPayload surfaces a GA4 error without dropping progress", () => {
  const out = buildPayload("28d", null, { registeredUsers: 3, pages: [] }, NOW) as any;
  assertEquals(out.ga4.error, "unavailable");
  assertEquals(out.progress.registeredUsers, 3);
});

Deno.test("buildPayload records the range and timestamp", () => {
  const out = buildPayload("7d", null, { registeredUsers: 0, pages: [] }, NOW) as any;
  assertEquals(out.range, "7d");
  assertEquals(out.generatedAt, "2026-07-24T12:00:00.000Z");
});
