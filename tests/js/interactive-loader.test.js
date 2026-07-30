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
async function runLoader(blocked = [], { doubleInit = false, loadDelay = 0 } = {}) {
  const attempted = [];
  const realAppend = document.head.appendChild.bind(document.head);

  vi.spyOn(document.head, "appendChild").mockImplementation((node) => {
    if (node.tagName !== "SCRIPT" || !node.src) return realAppend(node);
    attempted.push(node.src);
    const isBlocked = blocked.some((b) => node.src.includes(b));
    // Async, like a real network response. loadDelay matters: interactive.js
    // defers the document$ re-init by 50ms, so with instant loads the first
    // chain finishes before the second run starts and the two never overlap.
    // A race test against non-overlapping runs passes no matter what the code
    // does - it must outlast that 50ms to reproduce anything.
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
    }, loadDelay);
    return node;
  });

  if (doubleInit) {
    // Reproduce the real mechanism rather than approximating it. Material's
    // document$ is a replaying observable: subscribing emits the CURRENT
    // document straight away. interactive.js has already run initComponents
    // from the readyState check by then, so the subscribe callback is a second
    // concurrent run inside the SAME evaluation - sharing one loadedScripts
    // map. Evaluating the file twice instead would give each run its own map
    // and could not reproduce this at all.
    window.document$ = { subscribe: (cb) => cb() };
  }

  // eslint-disable-next-line no-new-func
  new Function(SOURCE)();

  // Let the promise chain drain. The document$ callback is deferred by 50ms,
  // so this must outlast that or the second run would simply never happen and
  // the test would pass for the wrong reason.
  for (let i = 0; i < 40; i++) {
    await new Promise((r) => setTimeout(r, 0));
  }
  // Outlast the 50ms re-init plus a full chain of delayed loads.
  for (let i = 0; i < 16; i++) {
    await new Promise((r) => setTimeout(r, loadDelay + 20));
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
    delete window.document$;
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

  it("injects each script once when the loader runs twice concurrently", async () => {
    // The production defect. initComponents() runs twice on a first load - once
    // from DOMContentLoaded and once because Material's document$ emits the
    // current document immediately on subscribe. The old guard registered a src
    // only after its load RESOLVED, so both runs passed the check before either
    // finished and both injected a tag.
    //
    // Live consequences: storage.js loaded twice and the second copy threw
    // "Identifier 'STORAGE_KEY' has already been declared", and collect.js
    // loaded twice into separate module scopes, so every page view was counted
    // twice.
    const attempted = await runLoader([], { doubleInit: true, loadDelay: 60 });
    const counts = attempted.reduce((acc, src) => {
      acc[src] = (acc[src] || 0) + 1;
      return acc;
    }, {});
    const duplicated = Object.keys(counts).filter((s) => counts[s] > 1);
    expect(duplicated).toEqual([]);
  });

  it("injects storage.js exactly once across concurrent runs", async () => {
    // Named separately because this one is not merely a duplicate request: the
    // second copy is a hard SyntaxError on a top-level const redeclaration.
    const attempted = await runLoader([], { doubleInit: true, loadDelay: 60 });
    expect(attempted.filter((s) => s.includes("lib/storage.js"))).toHaveLength(1);
  });

  it("injects the beacon exactly once across concurrent runs", async () => {
    const attempted = await runLoader([], { doubleInit: true, loadDelay: 60 });
    expect(attempted.filter((s) => s.includes("lib/collect.js"))).toHaveLength(1);
  });

  it("allows a retry after a script genuinely failed to load", async () => {
    // A failure must not be cached as though it were a completed load, or a
    // script blocked once could never be loaded again in that page session.
    //
    // loadDelay 0 on purpose: this is about a SEQUENTIAL retry after the first
    // attempt failed. With overlapping runs the second caller correctly shares
    // the first's in-flight promise and no retry is expected at all.
    const attempted = await runLoader(["lib/topics.js"], { doubleInit: true, loadDelay: 0 });
    expect(attempted.filter((s) => s.includes("lib/topics.js")).length).toBeGreaterThan(1);
  });
});
