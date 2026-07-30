import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { loadComponent, cleanup } from "./helpers.js";

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
    status = document.createElement("p");
    status.id = "admin-status";
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
