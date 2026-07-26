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
