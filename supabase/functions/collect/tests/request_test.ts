import { assertEquals } from "jsr:@std/assert@1";
import {
  clientIp,
  corsHeaders,
  isTooLarge,
  MAX_BODY_BYTES,
  parseBody,
  resolveOrigin,
} from "../lib/request.ts";

Deno.test("resolveOrigin echoes an allowed origin and rejects the rest", () => {
  assertEquals(resolveOrigin("https://runbook.fyi"), "https://runbook.fyi");
  assertEquals(resolveOrigin("http://localhost:8000"), "http://localhost:8000");
  assertEquals(resolveOrigin("http://runbook.fyi"), null);
  assertEquals(resolveOrigin("https://runbook.fyi.evil.example"), null);
  assertEquals(resolveOrigin("https://runbook.fyi:443"), null);
  assertEquals(resolveOrigin(null), null);
});

Deno.test("corsHeaders never emit a wildcard", () => {
  const h = corsHeaders("https://runbook.fyi");
  assertEquals(h["Access-Control-Allow-Origin"], "https://runbook.fyi");
  assertEquals(h["Vary"], "Origin");
  assertEquals(corsHeaders(null), {});
});

Deno.test("clientIp takes the first entry of x-forwarded-for", () => {
  // The chain is appended to by each proxy, so the client is first. Taking the
  // last would yield the edge proxy's address - identical for every visitor,
  // collapsing a whole day into one visitor hash.
  const h = new Headers({ "x-forwarded-for": "203.0.113.9, 70.41.3.18, 150.172.238.178" });
  assertEquals(clientIp(h), "203.0.113.9");
});

Deno.test("clientIp handles a single-entry and whitespace-padded chain", () => {
  assertEquals(clientIp(new Headers({ "x-forwarded-for": "203.0.113.9" })), "203.0.113.9");
  assertEquals(clientIp(new Headers({ "x-forwarded-for": "  203.0.113.9 ,x" })), "203.0.113.9");
});

Deno.test("clientIp falls back through the other proxy headers", () => {
  assertEquals(clientIp(new Headers({ "cf-connecting-ip": "198.51.100.4" })), "198.51.100.4");
  assertEquals(clientIp(new Headers({ "x-real-ip": "198.51.100.7" })), "198.51.100.7");
  assertEquals(clientIp(new Headers({ "x-forwarded-for": "" , "x-real-ip": "198.51.100.7" })), "198.51.100.7");
});

Deno.test("clientIp returns an empty string when nothing identifies the caller", () => {
  // Not an error: the hash simply has one fewer input. Throwing here would
  // turn an unusual proxy setup into a lost page view.
  assertEquals(clientIp(new Headers()), "");
});

Deno.test("isTooLarge only rejects a declared oversize body", () => {
  assertEquals(isTooLarge(String(MAX_BODY_BYTES + 1)), true);
  assertEquals(isTooLarge(String(MAX_BODY_BYTES)), false);
  assertEquals(isTooLarge("12"), false);
  assertEquals(isTooLarge(null), false);
  assertEquals(isTooLarge("not a number"), false);
});

Deno.test("parseBody returns null rather than throwing on junk", () => {
  assertEquals(parseBody('{"event":"page_view"}'), { event: "page_view" });
  assertEquals(parseBody("not json"), null);
  assertEquals(parseBody(""), null);
});

Deno.test("parseBody refuses an oversize body even without a content-length", () => {
  // A caller can simply omit the header, so the size check cannot live only
  // in isTooLarge.
  assertEquals(parseBody('{"a":"' + "x".repeat(MAX_BODY_BYTES) + '"}'), null);
});
