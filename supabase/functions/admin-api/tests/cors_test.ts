import { assertEquals } from "jsr:@std/assert@1";
import { corsHeaders, resolveCorsOrigin } from "../lib/cors.ts";

Deno.test("allows the production origin", () => {
  assertEquals(resolveCorsOrigin("https://runbook.fyi"), "https://runbook.fyi");
});

Deno.test("allows local mkdocs serve", () => {
  assertEquals(resolveCorsOrigin("http://localhost:8000"), "http://localhost:8000");
});

Deno.test("rejects unknown origins", () => {
  assertEquals(resolveCorsOrigin("https://evil.example"), null);
  assertEquals(resolveCorsOrigin("https://runbook.fyi.evil.example"), null);
  assertEquals(resolveCorsOrigin(null), null);
});

Deno.test("rejects a scheme downgrade on the production host", () => {
  assertEquals(resolveCorsOrigin("http://runbook.fyi"), null);
});

Deno.test("never returns a wildcard", () => {
  for (const origin of ["*", "null", "https://runbook.fyi"]) {
    assertEquals(resolveCorsOrigin(origin) === "*", false);
  }
});

Deno.test("corsHeaders is empty for a rejected origin", () => {
  assertEquals(corsHeaders(null), {});
});

Deno.test("corsHeaders echoes the allowed origin and varies on Origin", () => {
  const h = corsHeaders("https://runbook.fyi");
  assertEquals(h["Access-Control-Allow-Origin"], "https://runbook.fyi");
  assertEquals(h["Vary"], "Origin");
});

Deno.test("allowed methods include POST for the write routes", () => {
  const h = corsHeaders("https://runbook.fyi");
  assertEquals(h["Access-Control-Allow-Methods"], "GET, POST, OPTIONS");
});
