import { assertEquals, assertThrows } from "jsr:@std/assert@1";
import { parseRange } from "../lib/range.ts";

Deno.test("parseRange defaults to 28d when absent", () => {
  assertEquals(parseRange(null), { key: "28d", days: 28 });
});

Deno.test("parseRange accepts the three supported windows", () => {
  assertEquals(parseRange("7d"), { key: "7d", days: 7 });
  assertEquals(parseRange("28d"), { key: "28d", days: 28 });
  assertEquals(parseRange("90d"), { key: "90d", days: 90 });
});

Deno.test("parseRange rejects anything else", () => {
  assertThrows(() => parseRange("365d"), RangeError);
  assertThrows(() => parseRange("28"), RangeError);
  assertThrows(() => parseRange("'; drop table--"), RangeError);
});

Deno.test("parseRange rejects prototype-pollution style keys", () => {
  // The lookup is an object literal, so these must not resolve to inherited
  // properties and slip past the allowlist.
  assertThrows(() => parseRange("constructor"), RangeError);
  assertThrows(() => parseRange("toString"), RangeError);
  assertThrows(() => parseRange("__proto__"), RangeError);
});
