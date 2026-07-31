import { assertEquals, assertThrows } from "jsr:@std/assert@1";
import {
  gotrueFilter,
  isUuid,
  narrowToExactEmail,
  parseUserQuery,
} from "../lib/identity.ts";

Deno.test("parseUserQuery accepts a complete email", () => {
  assertEquals(parseUserQuery("someone@example.com", null), {
    kind: "email",
    email: "someone@example.com",
  });
});

Deno.test("parseUserQuery lowercases the email so matching is case-insensitive", () => {
  assertEquals(parseUserQuery("Someone@Example.COM", null), {
    kind: "email",
    email: "someone@example.com",
  });
});

Deno.test("parseUserQuery accepts a uuid", () => {
  const id = "3f2504e0-4f89-11d3-9a0c-0305e82c3301";
  assertEquals(parseUserQuery(null, id), { kind: "id", id });
});

Deno.test("parseUserQuery rejects neither identifier", () => {
  assertThrows(() => parseUserQuery(null, null), RangeError);
});

Deno.test("parseUserQuery rejects both identifiers at once", () => {
  // Ambiguous: which one wins would be an invisible policy decision.
  assertThrows(
    () => parseUserQuery("a@b.com", "3f2504e0-4f89-11d3-9a0c-0305e82c3301"),
    RangeError,
  );
});

Deno.test("parseUserQuery rejects the wildcards that sweep the user table", () => {
  // filter=% and filter=@ each return every user. Neither may reach GoTrue.
  for (const bad of ["%", "@", "%@%", "gmail.com", "ro", ""]) {
    assertThrows(() => parseUserQuery(bad, null), RangeError, undefined, bad);
  }
});

Deno.test("parseUserQuery rejects a malformed uuid", () => {
  assertThrows(() => parseUserQuery(null, "not-a-uuid"), RangeError);
  assertThrows(() => parseUserQuery(null, "3f2504e0-4f89-11d3-9a0c"), RangeError);
});

Deno.test("narrowToExactEmail picks the exact match out of substring noise", () => {
  // What GoTrue actually returns for filter=someone@example.com
  const candidates = [
    { id: "1", email: "xsomeone@example.com" },
    { id: "2", email: "someone@example.com" },
  ];
  assertEquals(narrowToExactEmail(candidates, "someone@example.com")?.id, "2");
});

Deno.test("narrowToExactEmail is case-insensitive", () => {
  const candidates = [{ id: "1", email: "Someone@Example.com" }];
  assertEquals(narrowToExactEmail(candidates, "someone@example.com")?.id, "1");
});

Deno.test("narrowToExactEmail returns null when only substrings matched", () => {
  const candidates = [{ id: "1", email: "someone-else@example.com" }];
  assertEquals(narrowToExactEmail(candidates, "someone@example.com"), null);
});

Deno.test("narrowToExactEmail tolerates a candidate with no email", () => {
  const candidates = [{ id: "1", email: null }, { id: "2", email: "a@b.com" }];
  assertEquals(narrowToExactEmail(candidates, "a@b.com")?.id, "2");
});

Deno.test("narrowToExactEmail returns null for an empty candidate set", () => {
  assertEquals(narrowToExactEmail([], "a@b.com"), null);
});

Deno.test("isUuid accepts a canonical uuid and rejects free text", () => {
  // The write routes take a userId in the JSON body, where parseUserQuery does
  // not run. Unvalidated, "abc" reaches GoTrue and the caller gets a 500 for
  // what is plainly a 400.
  assertEquals(isUuid("3f2504e0-4f89-11d3-9a0c-0305e82c3301"), true);
  assertEquals(isUuid("3F2504E0-4F89-11D3-9A0C-0305E82C3301"), true);
  assertEquals(isUuid("abc"), false);
  assertEquals(isUuid(""), false);
  assertEquals(isUuid("3f2504e0-4f89-11d3-9a0c-0305e82c3301x"), false);
  assertEquals(isUuid("3f2504e0_4f89_11d3_9a0c_0305e82c3301"), false);
});

Deno.test("gotrueFilter escapes the LIKE wildcards", () => {
  // filter= is `LIKE '%' || filter || '%'`, so an unescaped `_` matches any
  // single character. Verified live 2026-07-31: filter=robworksmusi_@gmail.com
  // matched robworksmusic@gmail.com; the escaped form matched nothing.
  assertEquals(gotrueFilter("_@_._"), "\\_@\\_.\\_");
  assertEquals(gotrueFilter("a%b@example.com"), "a\\%b@example.com");
});

Deno.test("gotrueFilter escapes the escape character itself", () => {
  // Otherwise an address containing a backslash smuggles an escape sequence in:
  // `a\_b` would reach LIKE with `_` already escaped by the caller's own text.
  assertEquals(gotrueFilter("a\\_b@example.com"), "a\\\\\\_b@example.com");
});

Deno.test("gotrueFilter leaves an ordinary address alone", () => {
  // The escape must not become a reason a normal lookup stops matching.
  assertEquals(gotrueFilter("someone@example.com"), "someone@example.com");
});

Deno.test("parseUserQuery accepts an underscore, which is a valid address character", () => {
  // `_` is a LIKE wildcard but an ordinary character in a real address.
  // Rejecting it here would answer a valid address with "malformed", so it is
  // neutralized at the boundary (gotrueFilter) instead of refused.
  assertEquals(parseUserQuery("first_last@example.com", null), {
    kind: "email",
    email: "first_last@example.com",
  });
});
