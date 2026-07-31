import { assertEquals } from "jsr:@std/assert@1";
import { buildPayload, GA4_POPULATION } from "../lib/merge.ts";

const NOW = new Date("2026-07-24T12:00:00Z");

Deno.test("buildPayload labels both sections with their population", () => {
  const out = buildPayload("28d", { activeUsers: 10, sessions: 12, topPages: [], events: {} }, {
    registeredUsers: 3,
    pages: [],
  }, NOW) as any;
  // Not "all visitors": the tag sits behind a cookie banner, so a label that
  // claims everyone turns a small true number into an apparently broken one.
  assertEquals(out.ga4.population, GA4_POPULATION);
  assertEquals(out.ga4.population.includes("all visitors"), false);
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

Deno.test("buildPayload labels the GA4 error case with the same population", () => {
  // The heading is on screen either way. A failure that widens the claimed
  // population re-creates the confusion the label exists to prevent.
  const out = buildPayload("28d", null, { registeredUsers: 0, pages: [] }, NOW) as any;
  assertEquals(out.ga4.population, GA4_POPULATION);
});

Deno.test("buildPayload passes the reported flag through untouched", () => {
  // The merge layer must not invent it: a section that answered with no rows
  // has to arrive at the page still saying so.
  const out = buildPayload("28d", {
    activeUsers: 0,
    sessions: 0,
    topPages: [],
    events: {},
    propertyId: "525117219",
    reported: false,
  }, { registeredUsers: 1, pages: [] }, NOW) as any;
  assertEquals(out.ga4.reported, false);
  assertEquals(out.ga4.propertyId, "525117219");
});
