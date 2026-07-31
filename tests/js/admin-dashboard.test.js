import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { loadComponent, cleanup } from "./helpers.js";
import { readFileSync } from "fs";
import { resolve } from "path";

const PAYLOAD = {
  range: "28d",
  generatedAt: "2026-07-24T12:00:00.000Z",
  stale: false,
  ageSeconds: 0,
  ga4: {
    population: "all visitors",
    activeUsers: 1234,
    sessions: 2000,
    topPages: [{ path: "/Git/git-basics/", views: 500 }],
    events: { quiz_answer: 42 },
  },
  progress: {
    population: "signed-in users only",
    registeredUsers: 7,
    pages: [{
      pageKey: "/Git/git-basics/",
      usersWithProgress: 5,
      sectionsRead: 20,
      quizzesAttempted: 4,
      quizzesPassed: 3,
      exercisesCompleted: 2,
    }],
  },
};

describe("admin dashboard renderer", () => {
  let root;

  beforeEach(async () => {
    root = document.createElement("div");
    document.body.appendChild(root);
    await loadComponent("admin/dashboard");
  });

  afterEach(() => cleanup());

  it("renders every metric as text, not only in a chart", () => {
    window.RunbookAdminDashboard.renderPayload(root, PAYLOAD);
    const text = root.textContent;
    expect(text).toContain("1234");
    expect(text).toContain("2000");
    expect(text).toContain("7");
    expect(text).toContain("42");
  });

  it("labels each section with its population", () => {
    window.RunbookAdminDashboard.renderPayload(root, PAYLOAD);
    expect(root.textContent).toContain("all visitors");
    expect(root.textContent).toContain("signed-in users only");
  });

  it("gives every table a caption and scoped headers", () => {
    window.RunbookAdminDashboard.renderPayload(root, PAYLOAD);
    const tables = root.querySelectorAll("table");
    expect(tables.length).toBeGreaterThan(0);
    tables.forEach((t) => {
      expect(t.querySelector("caption")).not.toBeNull();
      t.querySelectorAll("th").forEach((th) => {
        expect(th.getAttribute("scope")).toBeTruthy();
      });
    });
  });

  it("states staleness in words when serving cached data", () => {
    window.RunbookAdminDashboard.renderPayload(root, {
      ...PAYLOAD, stale: true, ageSeconds: 3600,
    });
    expect(root.textContent.toLowerCase()).toContain("cached");
  });

  it("renders the progress half when GA4 is unavailable", () => {
    window.RunbookAdminDashboard.renderPayload(root, {
      ...PAYLOAD, ga4: { population: "all visitors", error: "unavailable" },
    });
    expect(root.textContent).toContain("unavailable");
    expect(root.textContent).toContain("7");
  });
});

describe("admin dashboard auth states", () => {
  let status;

  function mountAdminRoot() {
    const el = document.createElement("div");
    el.id = "admin-root";
    // Mirrors the shipped markup in admin.md, including the persistent live
    // region. A test that mounts a root without it would exercise the
    // create-it-on-demand fallback rather than the path readers get.
    const live = document.createElement("p");
    live.id = "admin-dashboard-status";
    live.className = "sr-only";
    live.setAttribute("role", "status");
    el.appendChild(live);
    status = document.createElement("p");
    status.id = "admin-status";
    status.setAttribute("role", "status");
    status.textContent = "Checking authorization...";
    el.appendChild(status);
    document.body.appendChild(el);
    return el;
  }

  function sessionClient(accessToken) {
    return {
      auth: {
        getSession: async () => ({
          data: { session: accessToken ? { access_token: accessToken } : null },
        }),
      },
    };
  }

  beforeEach(async () => {
    mountAdminRoot();
    await loadComponent("admin/dashboard");
  });

  afterEach(() => {
    delete window.RunbookAuth;
    cleanup();
  });

  it("tells a signed-out reader to sign in rather than reporting a failure", async () => {
    window.RunbookAuth = { getClient: () => sessionClient(null) };
    await window.RunbookAdminDashboard.init();
    expect(status.textContent).toBe("Sign in to view this page.");
  });

  it("distinguishes a broken auth chain from being signed out", async () => {
    // RunbookAuth absent entirely: the chain failed to load.
    await window.RunbookAdminDashboard.init();
    expect(status.textContent).toContain("unavailable");
    expect(status.textContent).not.toBe("Sign in to view this page.");
  });

  it("treats a present RunbookAuth with no client as a broken chain", async () => {
    window.RunbookAuth = { getClient: () => null };
    await window.RunbookAdminDashboard.init();
    expect(status.textContent).toContain("unavailable");
  });

  it("reports unauthorized when the edge function rejects an admin check", async () => {
    window.RunbookAuth = { getClient: () => sessionClient("jwt") };
    const calls = [];
    global.fetch = async (url) => {
      calls.push(url);
      return { ok: false };
    };
    await window.RunbookAdminDashboard.init();
    expect(calls[0]).toContain("/health");
    expect(status.textContent).toBe("Not authorized.");
    delete global.fetch;
  });
});

describe("admin dashboard announcements", () => {
  let root;

  function mountShell() {
    const el = document.createElement("div");
    el.id = "admin-root";
    el.setAttribute("role", "region");
    const live = document.createElement("p");
    live.id = "admin-dashboard-status";
    live.className = "sr-only";
    live.setAttribute("role", "status");
    el.appendChild(live);
    const status = document.createElement("p");
    status.id = "admin-status";
    status.setAttribute("role", "status");
    status.textContent = "Checking authorization...";
    el.appendChild(status);
    document.body.appendChild(el);
    return el;
  }

  const live = () => document.getElementById("admin-dashboard-status");

  function scriptedFetch(payload, traffic) {
    global.fetch = async (url) => {
      if (String(url).includes("/health")) return { ok: true, json: async () => ({ admin: true }) };
      if (String(url).includes("/overview")) return { ok: true, json: async () => payload };
      if (String(url).includes("/traffic")) {
        if (traffic === undefined) return { ok: false };
        return { ok: true, json: async () => traffic };
      }
      return { ok: false };
    };
  }

  beforeEach(async () => {
    root = mountShell();
    await loadComponent("admin/dashboard");
    window.RunbookAuth = {
      getClient: () => ({
        auth: { getSession: async () => ({ data: { session: { access_token: "jwt" } } }) },
      }),
    };
  });

  afterEach(() => {
    delete window.RunbookAuth;
    delete global.fetch;
    cleanup();
  });

  it("keeps the live region out of the rebuilt subtree", async () => {
    // The defect this fixes: renderPayload cleared #admin-root, which contained
    // the region, so nothing could survive a refresh to announce through.
    scriptedFetch(PAYLOAD, TRAFFIC);
    await window.RunbookAdminDashboard.init();

    expect(live()).toBeTruthy();
    expect(live().isConnected).toBe(true);
    // And the figures still rendered, so this is not passing by rendering
    // nothing at all.
    expect(root.textContent).toContain("1234");
  });

  it("announces one sentence for a refresh, not the whole dashboard", async () => {
    scriptedFetch(PAYLOAD, TRAFFIC);
    await window.RunbookAdminDashboard.init();

    const spoken = live().textContent;
    expect(spoken).toBe("Dashboard updated with live data.");
    // The numbers are on the page but must not be inside the announcement:
    // that is precisely what a blanket aria-live on the root produced.
    expect(spoken).not.toContain("1234");
    expect(spoken).not.toContain("Per-guide progress");
  });

  it("says in the announcement when the figures are cached", async () => {
    // Staleness changes whether the reader should trust what follows, so it is
    // the one detail worth spending the sentence on.
    scriptedFetch({ ...PAYLOAD, stale: true, ageSeconds: 900 }, TRAFFIC);
    await window.RunbookAdminDashboard.init();

    expect(live().textContent).toContain("cached data");
    expect(live().textContent).toContain("15 minutes old");
  });

  it("names each missing half in the announcement", async () => {
    // A reader who cannot see the page has no other way to tell a section that
    // is empty from one that failed.
    scriptedFetch({ ...PAYLOAD, ga4: { ...PAYLOAD.ga4, error: "unavailable" } }, undefined);
    await window.RunbookAdminDashboard.init();

    expect(live().textContent).toContain("Google Analytics data is unavailable");
    expect(live().textContent).toContain("First-party traffic is unavailable");
  });

  it("announces a repeated refresh that produced the same sentence", async () => {
    // Assistive tech fires on a CHANGE, so writing identical text announces
    // nothing - and an unchanged dashboard is the common case on a refresh.
    scriptedFetch(PAYLOAD, TRAFFIC);
    await window.RunbookAdminDashboard.init();
    expect(live().textContent).toBe("Dashboard updated with live data.");

    // Deliberately NOT cleared by the test. Clearing it here would put the
    // region in a state where a plain write is already a change, so the
    // deferred re-set would never run and this test would pass against code
    // that dropped it entirely - which is exactly what it did until a mutation
    // row came back with zero failures.
    await window.RunbookAdminDashboard.init();
    expect(live().textContent).toBe("");

    await new Promise((r) => setTimeout(r, 0));
    expect(live().textContent).toBe("Dashboard updated with live data.");
  });

  it("removes the authorization line once the figures are up", async () => {
    // "Checking authorization..." above live numbers is a stale claim, and it
    // is a role="status" node, so leaving it gives the page two announcers.
    scriptedFetch(PAYLOAD, TRAFFIC);
    await window.RunbookAdminDashboard.init();

    expect(document.getElementById("admin-status")).toBe(null);
  });

  it("still reports a later failure after the status line is gone", async () => {
    // init() re-runs on runbook:auth-changed, so a sign-out after a successful
    // render has no status line left to write to.
    scriptedFetch(PAYLOAD, TRAFFIC);
    await window.RunbookAdminDashboard.init();
    expect(document.getElementById("admin-status")).toBe(null);

    window.RunbookAuth = {
      getClient: () => ({
        auth: { getSession: async () => ({ data: { session: null } }) },
      }),
    };
    await window.RunbookAdminDashboard.init();

    expect(root.textContent).toContain("Sign in to view this page.");
    expect(live().textContent).toContain("Sign in to view this page.");
    // The stale figures go with it: leaving them under a sign-in message reads
    // as though they are still current.
    expect(root.textContent).not.toContain("1234");
  });

  it("does not announce on a load that rendered nothing", async () => {
    // init() runs on every page load, including for a reader who is not an
    // admin. An announcement there would be noise about a page with no content.
    global.fetch = async () => ({ ok: false });
    await window.RunbookAdminDashboard.init();

    expect(live().textContent).toBe("");
  });
});

describe("admin dashboard page shell", () => {
  it("ships the live region in the markup and no blanket aria-live", () => {
    // A region created by the script at the moment it is first needed may never
    // be announced, so this asserts the shipped markup rather than what the
    // component can patch up. The blanket aria-live is the defect itself: a
    // live region wrapping a rebuilt subtree announces every table in it.
    const shell = readFileSync(resolve(__dirname, "../../admin.md"), "utf-8");
    expect(shell).toContain('id="admin-dashboard-status"');
    expect(shell).toContain('class="sr-only"');
    expect(shell).toContain('role="status"');
    expect(shell).not.toContain("aria-live");
  });
});

const TRAFFIC = {
  from: "2026-07-01",
  to: "2026-07-03",
  days: 3,
  daily: [
    { day: "2026-07-01", visitors: 4, pageviews: 11, signedIn: 1 },
    { day: "2026-07-02", visitors: 0, pageviews: 0, signedIn: 0 },
    { day: "2026-07-03", visitors: 6, pageviews: 19, signedIn: 2 },
  ],
  totals: {
    pageviews: 30,
    visitorsPerDay: { avg: 3.3, peak: 6 },
    daysWithTraffic: 2,
  },
  topPages: [{ path: "/Git/git-basics/", topic: "Git", views: 12 }],
  topReferrers: [{ host: "news.ycombinator.com", views: 9 }],
  topEntryPages: [{ path: "/Git/git-basics/", entries: 5 }],
};

describe("admin dashboard first-party traffic", () => {
  let root;

  beforeEach(async () => {
    root = document.createElement("div");
    document.body.appendChild(root);
    await loadComponent("admin/dashboard");
  });

  afterEach(() => cleanup());

  it("renders every figure as table text, never only as a chart", () => {
    window.RunbookAdminDashboard.renderTraffic(root, TRAFFIC);
    const text = root.textContent;
    expect(text).toContain("30");
    expect(text).toContain("6");
    expect(text).toContain("news.ycombinator.com");
    expect(text).toContain("/Git/git-basics/");
    // A canvas cannot be voiced by a screen reader, so there must not be one.
    expect(root.querySelector("canvas")).toBeNull();
  });

  it("labels the section as covering all readers, not the GA4 population", () => {
    window.RunbookAdminDashboard.renderTraffic(root, TRAFFIC);
    expect(root.textContent).toContain("first-party");
    expect(root.textContent.toLowerCase()).toContain("all readers");
  });

  it("shows every day in the range, including days with no traffic", () => {
    window.RunbookAdminDashboard.renderTraffic(root, TRAFFIC);
    expect(root.textContent).toContain("2026-07-02");
  });

  it("reports no window-wide visitor total and explains the omission", () => {
    window.RunbookAdminDashboard.renderTraffic(root, TRAFFIC);
    const text = root.textContent.toLowerCase();
    // The absence is the point: a reader who sees per-day visitors but no
    // total will otherwise assume it was forgotten.
    expect(text).toContain("no total visitor count");
    expect(text).toContain("discarded");

    // Also assert the table cannot grow one. The prose alone would still read
    // correctly next to a row that quietly summed the daily column.
    const totals = Array.from(root.querySelectorAll("table"))
      .find((t) => t.querySelector("caption").textContent === "Traffic totals");
    const labels = Array.from(totals.querySelectorAll("tbody th"))
      .map((th) => th.textContent.toLowerCase());
    expect(labels).not.toContain("visitors");
    expect(labels.some((l) => l === "total visitors" || l === "unique visitors")).toBe(false);
    expect(labels.length).toBe(4);
  });

  it("gives every table a caption and scoped headers", () => {
    window.RunbookAdminDashboard.renderTraffic(root, TRAFFIC);
    const tables = root.querySelectorAll("table");
    expect(tables.length).toBeGreaterThan(0);
    tables.forEach((t) => {
      expect(t.querySelector("caption")).not.toBeNull();
      t.querySelectorAll("th").forEach((th) => {
        expect(th.getAttribute("scope")).toBeTruthy();
      });
    });
  });

  it("says so in words when there are no referrers, rather than showing an empty table", () => {
    window.RunbookAdminDashboard.renderTraffic(root, { ...TRAFFIC, topReferrers: [] });
    expect(root.textContent.toLowerCase()).toContain("no external referrers");
  });

  it("reports unavailable traffic without implying zero traffic", () => {
    window.RunbookAdminDashboard.renderTraffic(root, null);
    const text = root.textContent.toLowerCase();
    expect(text).toContain("unavailable");
    // "0 page views" would be a claim about the site; this is a claim about
    // the query. They must not look the same.
    expect(root.querySelector("table")).toBeNull();
  });

  it("leaves the GA4 section intact when first-party traffic fails", () => {
    window.RunbookAdminDashboard.renderPayload(root, PAYLOAD);
    window.RunbookAdminDashboard.renderTraffic(root, null);
    expect(root.textContent).toContain("1234");
    expect(root.textContent).toContain("all visitors");
  });

  it("keeps the two populations in separate sections", () => {
    window.RunbookAdminDashboard.renderPayload(root, PAYLOAD);
    window.RunbookAdminDashboard.renderTraffic(root, TRAFFIC);
    const headings = Array.from(root.querySelectorAll("h2")).map((h) => h.textContent);
    // Two distinct traffic headings, each naming its own population. One
    // merged table would imply the numbers are the same quantity.
    expect(headings.filter((h) => h.startsWith("Traffic")).length).toBe(2);
    expect(headings.some((h) => h.includes("all visitors"))).toBe(true);
    expect(headings.some((h) => h.includes("first-party"))).toBe(true);
  });
});
