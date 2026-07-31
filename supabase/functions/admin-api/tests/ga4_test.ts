import { assertEquals } from "jsr:@std/assert@1";
import { toSection } from "../lib/ga4.ts";

const TOTALS = { rows: [{ metricValues: [{ value: "42" }, { value: "57" }] }] };
const PAGES = {
  rows: [{ dimensionValues: [{ value: "/Git/" }], metricValues: [{ value: "9" }] }],
};
const EVENTS = {
  rows: [{ dimensionValues: [{ value: "page_view" }], metricValues: [{ value: "12" }] }],
};

Deno.test("toSection folds the three reports into one section", () => {
  const s = toSection("525117219", TOTALS, PAGES, EVENTS);
  assertEquals(s.activeUsers, 42);
  assertEquals(s.sessions, 57);
  assertEquals(s.topPages, [{ path: "/Git/", views: 9 }]);
  assertEquals(s.events, { page_view: 12 });
  assertEquals(s.propertyId, "525117219");
  assertEquals(s.reported, true);
});

Deno.test("toSection marks a rowless answer as reporting nothing", () => {
  // The case that made #163 unreadable: three successful responses, every one
  // of them empty. The numbers below are indistinguishable from a query that
  // asked the wrong property, so the flag is the only thing carrying the
  // difference.
  const s = toSection("525117219", { rows: [] }, { rows: [] }, { rows: [] });
  assertEquals(s.reported, false);
  assertEquals(s.activeUsers, 0);
  assertEquals(s.sessions, 0);
  assertEquals(s.topPages, []);
  assertEquals(s.events, {});
});

Deno.test("toSection treats a response with no rows key as rowless", () => {
  // The Data API omits `rows` entirely rather than sending an empty array when
  // a report matches nothing, so the absent key has to count the same way.
  const s = toSection("525117219", {}, {}, {});
  assertEquals(s.reported, false);
});

Deno.test("toSection reports rows even when every metric is zero", () => {
  // A real row carrying zero is not the same as no row: the property answered
  // about a population it knows, and it counted none of them that period. Only
  // the missing row means "nothing came back at all".
  const s = toSection("525117219", {
    rows: [{ metricValues: [{ value: "0" }, { value: "0" }] }],
  }, { rows: [] }, { rows: [] });
  assertEquals(s.reported, true);
  assertEquals(s.activeUsers, 0);
});

Deno.test("toSection reports rows when only the events report matched", () => {
  // Any one of the three is enough. Keying the flag off the totals report alone
  // would call a section empty while its own event table listed counts.
  const s = toSection("525117219", { rows: [] }, { rows: [] }, EVENTS);
  assertEquals(s.reported, true);
});

Deno.test("toSection carries the property id through the empty case", () => {
  // The empty case is exactly when someone needs to know which property was
  // asked, so it must not be the case that drops the attribution.
  assertEquals(toSection("999", {}, {}, {}).propertyId, "999");
});
