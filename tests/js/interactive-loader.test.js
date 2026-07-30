/**
 * Regression tests for the interactive.js script-loading chain.
 *
 * lib/analytics.js matches common ad-blocker filter rules for "/analytics.js"
 * and is blocked outright in the browser for a large share of readers. It used
 * to sit inside the main .then() chain, so that one blocked file rejected
 * everything downstream and took the auth chain with it: no sign-in control
 * anywhere on the site, and the admin dashboard reporting a broken auth chain.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { readFileSync } from "fs";
import { resolve } from "path";

const SOURCE = readFileSync(
  resolve(__dirname, "../../assets/javascripts/interactive.js"),
  "utf8"
);

/**
 * Run interactive.js with a fake script loader. Scripts whose src matches an
 * entry in `blocked` fire onerror, like a blocked request; everything else
 * fires onload. Returns the list of every src the page attempted.
 */
async function runLoader(blocked = []) {
  const attempted = [];
  const realAppend = document.head.appendChild.bind(document.head);

  vi.spyOn(document.head, "appendChild").mockImplementation((node) => {
    if (node.tagName !== "SCRIPT" || !node.src) return realAppend(node);
    attempted.push(node.src);
    const isBlocked = blocked.some((b) => node.src.includes(b));
    // Async, like a real network response.
    setTimeout(() => {
      if (isBlocked) {
        if (node.onerror) node.onerror(new Event("error"));
        return;
      }
      // Reproduce the one side effect the chain reads back: without it the
      // auth chain bails on "No CDN URL" and never reaches auth.js, which
      // would make these tests pass for the wrong reason.
      if (node.src.includes("lib/supabase-config.js")) {
        window.RunbookSupabaseConfig = {
          url: "https://example.supabase.co",
          anonKey: "anon",
          cdnUrl: "https://cdn.example/supabase.js",
        };
      }
      if (node.onload) node.onload();
    }, 0);
    return node;
  });

  // eslint-disable-next-line no-new-func
  new Function(SOURCE)();

  // Let the promise chain drain.
  for (let i = 0; i < 40; i++) {
    await new Promise((r) => setTimeout(r, 0));
  }
  return attempted;
}

describe("interactive.js loading chain", () => {
  beforeEach(() => {
    window.__md_scope = "https://runbook.fyi/";
    vi.spyOn(console, "warn").mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
    delete window.__md_scope;
    delete window.RunbookSupabaseConfig;
  });

  it("reaches the auth chain when nothing is blocked", async () => {
    const attempted = await runLoader();
    expect(attempted.some((s) => s.includes("lib/supabase-config.js"))).toBe(true);
    // Baseline: the harness can actually get all the way to auth.js. Without
    // this the blocked-analytics cases below could pass for the wrong reason.
    expect(attempted.some((s) => s.includes("lib/auth.js"))).toBe(true);
  });

  it("still reaches the auth chain when analytics.js is blocked", async () => {
    const attempted = await runLoader(["lib/analytics.js"]);
    expect(attempted.some((s) => s.includes("lib/analytics.js"))).toBe(true);
    expect(attempted.some((s) => s.includes("lib/supabase-config.js"))).toBe(true);
    expect(attempted.some((s) => s.includes("lib/auth.js"))).toBe(true);
  });

  it("keeps the normal path when analytics.js is blocked", async () => {
    // The failure path skips progress tracking and topic cards. A blocked
    // optional script must not divert us into it: the run should look exactly
    // like an unblocked one apart from analytics itself.
    const attempted = await runLoader(["lib/analytics.js"]);
    expect(attempted.some((s) => s.includes("components/progress.js"))).toBe(true);
    expect(attempted.some((s) => s.includes("components/topic-cards.js"))).toBe(true);
    expect(console.warn).not.toHaveBeenCalledWith(
      expect.stringContaining("Storage unavailable")
    );
  });

  it("still reaches the auth chain when every optional lib is blocked", async () => {
    const attempted = await runLoader([
      "lib/analytics.js",
      "lib/analytics-observers.js",
      "lib/analytics-journey.js",
      "lib/topics.js",
      "lib/collect.js",
    ]);
    expect(attempted.some((s) => s.includes("lib/supabase-config.js"))).toBe(true);
    expect(attempted.some((s) => s.includes("lib/auth.js"))).toBe(true);
  });

  it("loads the first-party beacon even when analytics.js is blocked", async () => {
    // These two must stay independent: analytics.js is an ad-blocker filter
    // target and collect.js is the collection that survives it.
    const attempted = await runLoader(["lib/analytics.js"]);
    expect(attempted.some((s) => s.includes("lib/collect.js"))).toBe(true);
  });

  it("loads the beacon on the storage-failure path too", async () => {
    const attempted = await runLoader(["lib/storage.js"]);
    expect(attempted.some((s) => s.includes("lib/collect.js"))).toBe(true);
  });

  it("brings up auth even when storage itself is blocked", async () => {
    const attempted = await runLoader(["lib/storage.js"]);
    expect(attempted.some((s) => s.includes("lib/supabase-config.js"))).toBe(true);
    expect(attempted.some((s) => s.includes("components/auth-ui.js"))).toBe(true);
  });

  it("loads the admin dashboard only when #admin-root is on the page", async () => {
    const without = await runLoader();
    expect(without.some((s) => s.includes("admin/dashboard.js"))).toBe(false);

    const root = document.createElement("div");
    root.id = "admin-root";
    document.body.appendChild(root);
    const withRoot = await runLoader();
    expect(withRoot.some((s) => s.includes("admin/dashboard.js"))).toBe(true);
    root.remove();
  });
});
