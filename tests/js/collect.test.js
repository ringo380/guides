/**
 * Tests for the first-party analytics beacon.
 *
 * The contract this file exists to hold: the beacon never throws into
 * component code, and a dead or blocked endpoint is survivable and silent.
 * Measurement is not worth breaking a page over.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { readFileSync } from "fs";
import { resolve } from "path";

const SOURCE = readFileSync(
  resolve(__dirname, "../../assets/javascripts/lib/collect.js"),
  "utf8"
);

/** Run collect.js fresh and return the payloads it sent. */
function load({ beacon = true, beaconReturns = true, beaconThrows = false } = {}) {
  const sent = [];
  const record = (body) => {
    try {
      sent.push(JSON.parse(body));
    } catch {
      sent.push({ unparseable: body });
    }
  };

  if (beacon) {
    navigator.sendBeacon = vi.fn((_url, blob) => {
      if (beaconThrows) throw new Error("blocked");
      // jsdom Blobs expose text() as a promise; the payload is captured from
      // the constructor argument instead, which the stub receives directly.
      record(blob.__text);
      return beaconReturns;
    });
  } else {
    delete navigator.sendBeacon;
  }

  // eslint-disable-next-line no-new-func
  new Function(SOURCE)();
  return { sent, fetchMock: global.fetch };
}

let originalBlob;

beforeEach(() => {
  originalBlob = global.Blob;
  // Capture the text a Blob was built from, so the stub can read it back
  // synchronously.
  global.Blob = class {
    constructor(parts, opts) {
      this.__text = parts.join("");
      this.type = (opts && opts.type) || "";
    }
  };
  global.fetch = vi.fn(() => Promise.resolve({ ok: true }));
  window.history.pushState({}, "", "/Git/git-basics/");
  delete window.RunbookCollect;
  delete window.RunbookAnalytics;
});

afterEach(() => {
  global.Blob = originalBlob;
  vi.restoreAllMocks();
  delete window.RunbookCollect;
  delete window.RunbookAnalytics;
});

describe("collect beacon", () => {
  it("sends a page view for the current path on load", () => {
    const { sent } = load();
    expect(sent).toHaveLength(1);
    expect(sent[0].event).toBe("page_view");
    expect(sent[0].path).toBe("/Git/git-basics/");
  });

  it("does not count the same page view twice in a row", () => {
    // Material's instant navigation fires the load hooks more than once per
    // navigation. Counting each would inflate every number plausibly.
    const { sent } = load();
    window.RunbookCollect.pageView();
    window.RunbookCollect.pageView();
    expect(sent).toHaveLength(1);
  });

  it("counts a genuine navigation to a different path", () => {
    const { sent } = load();
    window.history.pushState({}, "", "/Docker/containers/");
    window.RunbookCollect.pageView();
    expect(sent).toHaveLength(2);
    expect(sent[1].path).toBe("/Docker/containers/");
  });

  it("drops events that are not on the allowlist", () => {
    const { sent } = load();
    window.RunbookCollect.send("something_invented", {});
    window.RunbookCollect.send("", {});
    expect(sent).toHaveLength(1);
  });

  it("sends allowlisted engagement events", () => {
    const { sent } = load();
    window.RunbookCollect.send("quiz_answer", { correct: true });
    expect(sent).toHaveLength(2);
    expect(sent[1].event).toBe("quiz_answer");
    expect(sent[1].props).toEqual({ correct: true });
  });

  it("reduces props to bounded scalars", () => {
    load();
    const cleaned = window.RunbookCollect._cleanProps({
      s: "x".repeat(500),
      n: 3,
      b: false,
      bad: { nested: 1 },
      arr: [1],
      nan: NaN,
    });
    expect(cleaned.s.length).toBe(200);
    expect(cleaned.n).toBe(3);
    expect(cleaned.b).toBe(false);
    expect(cleaned).not.toHaveProperty("bad");
    expect(cleaned).not.toHaveProperty("arr");
    expect(cleaned).not.toHaveProperty("nan");
  });

  it("caps the number of props", () => {
    load();
    const many = {};
    for (let i = 0; i < 30; i++) many["k" + i] = i;
    expect(Object.keys(window.RunbookCollect._cleanProps(many))).toHaveLength(8);
  });

  it("falls back to fetch when sendBeacon is unavailable", () => {
    load({ beacon: false });
    expect(global.fetch).toHaveBeenCalledTimes(1);
    const [url, init] = global.fetch.mock.calls[0];
    expect(url).toContain("/functions/v1/collect");
    expect(init.keepalive).toBe(true);
    expect(JSON.parse(init.body).event).toBe("page_view");
  });

  it("falls back to fetch when sendBeacon refuses the payload", () => {
    // sendBeacon returns false when the queue is full. Returning false is not
    // an exception, so an unchecked call would silently drop the event.
    load({ beaconReturns: false });
    expect(global.fetch).toHaveBeenCalledTimes(1);
  });

  it("falls back to fetch when sendBeacon throws", () => {
    load({ beaconThrows: true });
    expect(global.fetch).toHaveBeenCalledTimes(1);
  });

  it("survives a rejected fetch without an unhandled rejection", async () => {
    global.fetch = vi.fn(() => Promise.reject(new Error("blocked")));
    expect(() => load({ beacon: false })).not.toThrow();
    await new Promise((r) => setTimeout(r, 0));
  });

  it("survives fetch being absent entirely", () => {
    delete global.fetch;
    expect(() => load({ beacon: false })).not.toThrow();
  });

  it("mirrors RunbookAnalytics events and still calls the original", () => {
    const original = vi.fn();
    window.RunbookAnalytics = { track: original };
    const { sent } = load();

    window.RunbookAnalytics.track("quiz_answer", { correct: false });
    expect(original).toHaveBeenCalledWith("quiz_answer", { correct: false });
    expect(sent.some((s) => s.event === "quiz_answer")).toBe(true);
  });

  it("does not wrap RunbookAnalytics twice", () => {
    const original = vi.fn();
    window.RunbookAnalytics = { track: original };
    const { sent } = load();
    const wrappedOnce = window.RunbookAnalytics.track;

    // A second navigation re-runs the mirror.
    window.history.pushState({}, "", "/Nginx/");
    window.RunbookCollect.pageView();
    expect(window.RunbookAnalytics.track).toBe(wrappedOnce);

    const before = sent.length;
    window.RunbookAnalytics.track("code_copy", {});
    expect(sent.length - before).toBe(1);
  });

  it("keeps working when analytics.js was blocked entirely", () => {
    // The #161 shape: the optional file never loaded. Page views must still
    // flow, which is the whole reason these two files are independent.
    delete window.RunbookAnalytics;
    const { sent } = load();
    expect(sent).toHaveLength(1);
    expect(sent[0].event).toBe("page_view");
  });

  it("never throws out of send, whatever it is handed", () => {
    load();
    const circular = {};
    circular.self = circular;
    expect(() => window.RunbookCollect.send("quiz_answer", circular)).not.toThrow();
    expect(() => window.RunbookCollect.send(null, null)).not.toThrow();
    expect(() => window.RunbookCollect.send("page_view", undefined)).not.toThrow();
  });

  it("does not send a second page view when the file is evaluated twice", () => {
    // A loader race double-injected this script in production, giving each
    // copy its own module scope, so the 1s dedupe below could not see the
    // other copy and every page view was counted twice. The loader is fixed;
    // this asserts the beacon is independently safe, because a count that
    // silently doubles looks perfectly plausible.
    const { sent } = load();
    expect(sent).toHaveLength(1);

    // eslint-disable-next-line no-new-func
    new Function(SOURCE)();
    expect(sent).toHaveLength(1);
  });

  it("leaves the already-installed API in place on a second evaluation", () => {
    load();
    const first = window.RunbookCollect;
    // eslint-disable-next-line no-new-func
    new Function(SOURCE)();
    expect(window.RunbookCollect).toBe(first);
  });
});
