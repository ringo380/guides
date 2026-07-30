/**
 * Tests for the Consent Mode v2 partial.
 *
 * overrides/partials/integrations/analytics/google.html read consent from
 * localStorage["__consent"], but Material writes the key scoped by site path
 * ("/.__consent" on runbook.fyi). The read always returned null, so the
 * "granted" consent update was never sent and GA4 recorded only cookieless
 * pings even for visitors who had explicitly accepted analytics.
 *
 * These run the partial's real script, extracted from the template, rather
 * than a copy of its logic.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { readFileSync } from "fs";
import { resolve } from "path";

const PARTIAL = readFileSync(
  resolve(
    __dirname,
    "../../overrides/partials/integrations/analytics/google.html"
  ),
  "utf8"
);

// The consent block is the first inline <script> in the partial.
const match = PARTIAL.match(/<script>([\s\S]*?)<\/script>/);
if (!match) throw new Error("Could not extract the consent script");
const SOURCE = match[1].replace(
  /\{\{\s*config\.extra\.analytics\.property\s*\}\}/g,
  "G-TEST"
);

/** Run the partial's script and return every gtag() call it made. */
function run() {
  const calls = [];
  window.dataLayer = undefined;
  window.gtag = undefined;
  // eslint-disable-next-line no-new-func
  new Function(SOURCE)();
  // dataLayer.push receives the arguments object from each gtag() call.
  for (const entry of window.dataLayer || []) {
    calls.push(Array.from(entry));
  }
  return calls;
}

function granted(calls) {
  return calls.some(
    (c) =>
      c[0] === "consent" &&
      c[1] === "update" &&
      c[2] &&
      c[2].analytics_storage === "granted"
  );
}

describe("consent mode partial", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
    delete window.dataLayer;
    delete window.gtag;
  });

  it("always defaults analytics_storage to denied", () => {
    const calls = run();
    const dflt = calls.find((c) => c[0] === "consent" && c[1] === "default");
    expect(dflt).toBeDefined();
    expect(dflt[2].analytics_storage).toBe("denied");
  });

  it("grants when consent is stored under the path-scoped key", () => {
    // The real-world case: this is the ONLY key Material writes. If the
    // partial reads the unscoped name, this test fails.
    localStorage.setItem(
      "/.__consent",
      JSON.stringify({ github: true, analytics: true })
    );
    expect(granted(run())).toBe(true);
  });

  it("grants when consent is stored under a bare key", () => {
    localStorage.setItem("__consent", JSON.stringify({ analytics: true }));
    expect(granted(run())).toBe(true);
  });

  it("grants when the site is served from a subpath", () => {
    localStorage.setItem(
      "/guides/.__consent",
      JSON.stringify({ analytics: true })
    );
    expect(granted(run())).toBe(true);
  });

  it("does not grant when nothing is stored", () => {
    expect(granted(run())).toBe(false);
  });

  it("does not grant when analytics was declined", () => {
    localStorage.setItem(
      "/.__consent",
      JSON.stringify({ github: true, analytics: false })
    );
    expect(granted(run())).toBe(false);
  });

  it("only reads consent keys, not every scoped key", () => {
    // Deliberately consent-shaped, under a key that is not consent. A scan
    // that matched any scoped key rather than the ".__consent" suffix would
    // grant here. Material really does write "/.__palette" alongside consent.
    localStorage.setItem("/.__palette", JSON.stringify({ analytics: true }));
    expect(granted(run())).toBe(false);
  });

  it("is not blinded by a malformed value under another key", () => {
    localStorage.setItem("__consent", "not json");
    localStorage.setItem("/.__consent", JSON.stringify({ analytics: true }));
    expect(granted(run())).toBe(true);
  });

  it("catches a same-tab accept without a reload", () => {
    const before = run();
    expect(granted(before)).toBe(false);

    localStorage.setItem("/.__consent", JSON.stringify({ analytics: true }));
    vi.advanceTimersByTime(2000);

    const after = Array.from(window.dataLayer).map((e) => Array.from(e));
    expect(granted(after)).toBe(true);
  });

  it("stops polling once consent is granted", () => {
    localStorage.setItem("/.__consent", JSON.stringify({ analytics: true }));
    const clear = vi.spyOn(globalThis, "clearInterval");
    run();
    vi.advanceTimersByTime(5000);
    const updates = Array.from(window.dataLayer)
      .map((e) => Array.from(e))
      .filter((c) => c[0] === "consent" && c[1] === "update");
    // Granted synchronously, so it never starts an interval, and it never
    // sends the update twice.
    expect(updates).toHaveLength(1);
    clear.mockRestore();
  });

  it("stops polling for a visitor who never decides", () => {
    run();
    const clear = vi.spyOn(globalThis, "clearInterval");
    // Well past the two-minute bound.
    vi.advanceTimersByTime(200 * 1000);
    expect(clear).toHaveBeenCalled();
    expect(vi.getTimerCount()).toBe(0);
    clear.mockRestore();
  });
});
