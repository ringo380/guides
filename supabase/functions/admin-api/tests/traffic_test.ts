import { assertEquals, assertRejects } from "jsr:@std/assert@1";
import { fetchTraffic, fillDays } from "../lib/traffic.ts";

const EMPTY = { day: "", visitors: 0, pageviews: 0, signedIn: 0 };
const day = (d: string, pv: number) => ({ ...EMPTY, day: d, pageviews: pv, visitors: 1 });

Deno.test("fillDays returns one entry per day in the window", () => {
  const out = fillDays([day("2026-07-03", 5)], "2026-07-01", "2026-07-05");
  assertEquals(out.length, 5);
  assertEquals(out.map((d) => d.day), [
    "2026-07-01",
    "2026-07-02",
    "2026-07-03",
    "2026-07-04",
    "2026-07-05",
  ]);
});

Deno.test("fillDays zero-fills the days the database omitted", () => {
  const out = fillDays([day("2026-07-03", 5)], "2026-07-01", "2026-07-03");
  assertEquals(out[0], { day: "2026-07-01", visitors: 0, pageviews: 0, signedIn: 0 });
  assertEquals(out[1].pageviews, 0);
  assertEquals(out[2].pageviews, 5);
});

Deno.test("fillDays preserves the real values it was given", () => {
  const real = { day: "2026-07-02", visitors: 9, pageviews: 40, signedIn: 3 };
  const out = fillDays([real], "2026-07-01", "2026-07-02");
  assertEquals(out[1], real);
});

Deno.test("fillDays crosses a month boundary without skipping a day", () => {
  // Naive day-of-month arithmetic produces "2026-07-32" here.
  const out = fillDays([], "2026-07-30", "2026-08-02");
  assertEquals(out.map((d) => d.day), [
    "2026-07-30",
    "2026-07-31",
    "2026-08-01",
    "2026-08-02",
  ]);
});

Deno.test("fillDays crosses a year boundary", () => {
  const out = fillDays([], "2026-12-31", "2027-01-01");
  assertEquals(out.map((d) => d.day), ["2026-12-31", "2027-01-01"]);
});

Deno.test("fillDays covers a leap day", () => {
  const out = fillDays([], "2028-02-28", "2028-03-01");
  assertEquals(out.map((d) => d.day), ["2028-02-28", "2028-02-29", "2028-03-01"]);
});

Deno.test("fillDays handles a single-day window", () => {
  const out = fillDays([], "2026-07-01", "2026-07-01");
  assertEquals(out.length, 1);
  assertEquals(out[0].day, "2026-07-01");
});

Deno.test("fillDays returns nothing for an inverted window", () => {
  assertEquals(fillDays([], "2026-07-05", "2026-07-01"), []);
});

Deno.test("fillDays returns nothing for unparseable dates", () => {
  assertEquals(fillDays([], "not-a-date", "2026-07-01"), []);
  assertEquals(fillDays([], "2026-07-01", "nonsense"), []);
});

Deno.test("fillDays cannot loop unboundedly on an absurd window", () => {
  // The RPC bounds p_days, but this function must not depend on that: a bad
  // pair reaching it should terminate rather than hang the request handler.
  const out = fillDays([], "1970-01-01", "2100-01-01");
  assertEquals(out.length, 400);
});

Deno.test("fillDays does not shift days by a local timezone offset", () => {
  // Date.parse("2026-07-01") without the Z is UTC, but constructing days via
  // getDate()/setDate() in a negative-offset zone rolls each label back one
  // day. The first entry must equal `from` exactly.
  const out = fillDays([], "2026-07-01", "2026-07-04");
  assertEquals(out[0].day, "2026-07-01");
  assertEquals(out[out.length - 1].day, "2026-07-04");
});

// ------------------------------------------------------------- fetchTraffic

function stubClient(response: { data?: unknown; error?: unknown }) {
  const calls: Array<{ fn: string; args: unknown }> = [];
  return {
    calls,
    rpc(fn: string, args: unknown) {
      calls.push({ fn, args });
      return Promise.resolve({ data: response.data ?? null, error: response.error ?? null });
    },
  };
}

const PAYLOAD = {
  from: "2026-07-01",
  to: "2026-07-03",
  days: 3,
  daily: [{ day: "2026-07-02", visitors: 2, pageviews: 7, signedIn: 1 }],
  totals: { pageviews: 7, visitorsPerDay: { avg: 2, peak: 2 }, daysWithTraffic: 1 },
  topPages: [],
  topReferrers: [],
  topEntryPages: [],
};

Deno.test("fetchTraffic calls the aggregation RPC, not a table select", () => {
  // Selecting the daily views over PostgREST would be silently truncated at
  // max_rows; the whole point is that the sum happens in the database.
  const client = stubClient({ data: PAYLOAD });
  return fetchTraffic(client, 28).then(() => {
    assertEquals(client.calls.length, 1);
    assertEquals(client.calls[0].fn, "analytics_traffic");
    assertEquals(client.calls[0].args, { p_days: 28, p_limit: 10 });
  });
});

Deno.test("fetchTraffic passes an explicit limit through", async () => {
  const client = stubClient({ data: PAYLOAD });
  await fetchTraffic(client, 7, 25);
  assertEquals(client.calls[0].args, { p_days: 7, p_limit: 25 });
});

Deno.test("fetchTraffic fills the daily series before returning", async () => {
  const out = await fetchTraffic(stubClient({ data: PAYLOAD }), 3);
  assertEquals(out.daily.length, 3);
  assertEquals(out.daily.map((d) => d.pageviews), [0, 7, 0]);
});

Deno.test("fetchTraffic leaves the totals exactly as the database computed them", async () => {
  const out = await fetchTraffic(stubClient({ data: PAYLOAD }), 3);
  // Zero-filling the series must not change any total. Recomputing totals in
  // the API from a filled series is how a padded day becomes a real one.
  assertEquals(out.totals, PAYLOAD.totals);
});

Deno.test("fetchTraffic reports no window-wide visitor count", async () => {
  const out = await fetchTraffic(stubClient({ data: PAYLOAD }), 3);
  assertEquals((out.totals as Record<string, unknown>).visitors, undefined);
});

Deno.test("fetchTraffic surfaces a database error rather than returning empty", async () => {
  // Swallowing this would render an empty chart, which claims "no traffic" for
  // what is actually "the query failed".
  await assertRejects(() => fetchTraffic(stubClient({ error: { message: "boom" } }), 28));
});

Deno.test("fetchTraffic tolerates a payload with no daily array", async () => {
  const client = stubClient({ data: { ...PAYLOAD, daily: null } });
  const out = await fetchTraffic(client, 3);
  assertEquals(out.daily.length, 3);
  assertEquals(out.daily.every((d) => d.pageviews === 0), true);
});
