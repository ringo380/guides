import { assertEquals } from "jsr:@std/assert@1";
import { isFresh, selectPayload } from "../lib/cache.ts";

const NOW = new Date("2026-07-24T12:00:00Z");

Deno.test("isFresh is true inside the TTL", () => {
  assertEquals(isFresh("2026-07-24T11:50:00Z", NOW), true);
});

Deno.test("isFresh is false past the TTL", () => {
  assertEquals(isFresh("2026-07-24T11:40:00Z", NOW), false);
});

Deno.test("isFresh is false exactly at the boundary", () => {
  assertEquals(isFresh("2026-07-24T11:45:00Z", NOW), false);
});

Deno.test("selectPayload prefers fresh data when available", () => {
  const cached = { payload: { old: true }, fetched_at: "2026-07-24T11:00:00Z" };
  const got = selectPayload(cached, { new: true }, NOW);
  assertEquals(got, { payload: { new: true }, stale: false, ageSeconds: 0 });
});

Deno.test("selectPayload falls back to stale cache when fresh fetch failed", () => {
  const cached = { payload: { old: true }, fetched_at: "2026-07-24T11:00:00Z" };
  const got = selectPayload(cached, null, NOW);
  assertEquals(got.stale, true);
  assertEquals(got.payload, { old: true });
  assertEquals(got.ageSeconds, 3600);
});

Deno.test("selectPayload reports no payload when both are missing", () => {
  const got = selectPayload(null, null, NOW);
  assertEquals(got, { payload: null, stale: false, ageSeconds: null });
});
