import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { loadComponent, cleanup } from "./helpers.js";

const USER = {
  user: {
    id: "3f2504e0-4f89-11d3-9a0c-0305e82c3301",
    email: "someone@example.com",
    createdAt: "2026-01-01T00:00:00Z",
    lastSignInAt: "2026-07-01T00:00:00Z",
  },
  progress: { updatedAt: "2026-07-20T00:00:00Z", pageCount: 12 },
};

describe("admin accounts renderer", () => {
  let root;

  beforeEach(async () => {
    root = document.createElement("div");
    document.body.appendChild(root);
    await loadComponent("admin/accounts");
  });

  afterEach(() => cleanup());

  it("renders the account fields as table text", () => {
    window.RunbookAdminAccounts.renderUser(root, USER);
    const text = root.textContent;
    expect(text).toContain("someone@example.com");
    expect(text).toContain("3f2504e0-4f89-11d3-9a0c-0305e82c3301");
    expect(text).toContain("12");
  });

  it("says so plainly when the user has no progress row", () => {
    window.RunbookAdminAccounts.renderUser(root, { user: USER.user, progress: null });
    expect(root.textContent).toContain("No progress recorded");
  });

  it("renders a not-found state without throwing", () => {
    // The exact-match hint belongs to a genuine 404 and nothing else. The
    // lookup tests below are what pin which responses reach this renderer.
    window.RunbookAdminAccounts.renderUser(root, null);
    expect(root.textContent).toContain("No matching account");
  });

  it("renders the roster", () => {
    window.RunbookAdminAccounts.renderRoster(root, {
      admins: [{
        userId: "abc",
        email: "admin@example.com",
        note: "founder",
        createdAt: "2026-01-01T00:00:00Z",
      }],
    });
    expect(root.textContent).toContain("admin@example.com");
    expect(root.textContent).toContain("founder");
  });

  it("does not blank the roster when it is empty, which should be impossible", () => {
    // An empty roster means the trigger failed. Say so rather than render nothing.
    window.RunbookAdminAccounts.renderRoster(root, { admins: [] });
    expect(root.textContent).toContain("no admins");
  });

  it("marks the reset control as destructive for assistive tech", () => {
    window.RunbookAdminAccounts.renderUser(root, USER);
    const btn = root.querySelector("[data-action='reset-progress']");
    expect(btn).toBeTruthy();
    const describedBy = btn.getAttribute("aria-describedby");
    expect(describedBy).toBeTruthy();
    // The description must resolve to real text, not a dangling id. An
    // aria-describedby pointing at nothing announces nothing.
    expect(root.querySelector("#" + describedBy).textContent).toContain("undo");
  });

  it("confirms inline with a labelled field, not a native dialog", () => {
    window.RunbookAdminAccounts.renderUser(root, USER);
    const input = root.querySelector(".admin-reset-form input");
    expect(input).toBeTruthy();
    const label = root.querySelector(`label[for="${input.id}"]`);
    expect(label).toBeTruthy();
    expect(label.textContent).toContain("email");
  });
});

describe("admin accounts reset listener idempotency", () => {
  let root;

  function mountAdminAccountsRoot() {
    const el = document.createElement("div");
    el.id = "admin-accounts-root";
    const status = document.createElement("p");
    status.id = "admin-accounts-status";
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
    root = mountAdminAccountsRoot();
    await loadComponent("admin/accounts");
    window.RunbookAuth = { getClient: () => sessionClient("jwt") };
  });

  afterEach(() => {
    delete window.RunbookAuth;
    delete global.fetch;
    cleanup();
  });

  it("says to sign in rather than freezing when the session is gone", async () => {
    // authedFetch throws on a missing token. Uncaught, the page keeps saying
    // "Checking authorization..." forever and a screen reader gets nothing.
    window.RunbookAuth = { getClient: () => sessionClient(null) };
    global.fetch = async () => { throw new Error("should not be called"); };

    await window.RunbookAdminAccounts.init();

    expect(document.getElementById("admin-accounts-status").textContent)
      .toContain("Sign in");
  });

  it("reports an unreachable API instead of leaving the page checking", async () => {
    global.fetch = async () => { throw new TypeError("Failed to fetch"); };

    // The component auto-init()s as it loads, which already replaced this text
    // before the test body ran. Without putting it back, the "no longer
    // checking" half of this test is satisfied by the load, not by the call
    // under test, and would pass against a handler that does nothing at all.
    const status = document.getElementById("admin-accounts-status");
    status.textContent = "Checking authorization...";
    expect(root.textContent).toContain("Checking authorization");

    await window.RunbookAdminAccounts.init();

    const text = root.textContent;
    expect(text).not.toContain("Checking authorization");
    expect(text).toContain("Could not reach the admin service");
  });

  /** init() past the health check, with a scripted answer for the lookup. */
  async function lookupWith(response) {
    global.fetch = async (url) => {
      if (String(url).includes("/health")) return { ok: true, json: async () => ({ admin: true }) };
      if (String(url).includes("/admins")) return { ok: true, json: async () => ({ admins: [] }) };
      return response;
    };
    await window.RunbookAdminAccounts.init();
    const form = root.querySelector("#admin-lookup-form");
    form.querySelector("input").value = "someone@example.com";
    form.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
    await new Promise((resolve) => setTimeout(resolve, 0));
    await new Promise((resolve) => setTimeout(resolve, 0));
  }

  it("keeps the exact-match hint for a genuine 404", async () => {
    await lookupWith({ ok: false, status: 404, json: async () => ({ error: "no such user" }) });
    expect(root.textContent).toContain("No matching account");
  });

  it("surfaces the server's own message for a 409 rather than claiming no match", async () => {
    // Past LOOKUP_PAGE_SIZE accounts the server answers 409 for an address it
    // could not resolve safely. Reporting that as "no matching account" is the
    // same false negative the server-side fix removed, moved into the UI.
    await lookupWith({
      ok: false,
      status: 409,
      json: async () => ({
        error: "too many candidate accounts for that address to resolve it safely",
      }),
    });
    expect(root.textContent).toContain("too many candidate accounts");
    expect(root.textContent).not.toContain("No matching account");
  });

  it("says something readable when the error body is not usable", async () => {
    // A 500 from the platform is plain text, so json() rejects. The page still
    // must not say "no matching account", which it cannot support.
    await lookupWith({
      ok: false,
      status: 500,
      json: async () => { throw new SyntaxError("Unexpected token I"); },
    });
    expect(root.textContent).toContain("500");
    expect(root.textContent).not.toContain("No matching account");
  });

  it("tells the admin a failed lookup never left the browser", async () => {
    global.fetch = async (url) => {
      if (String(url).includes("/health")) return { ok: true, json: async () => ({ admin: true }) };
      if (String(url).includes("/admins")) return { ok: true, json: async () => ({ admins: [] }) };
      throw new TypeError("Failed to fetch");
    };

    await window.RunbookAdminAccounts.init();
    const form = root.querySelector("#admin-lookup-form");
    form.querySelector("input").value = "someone@example.com";
    form.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
    await new Promise((resolve) => setTimeout(resolve, 0));
    await new Promise((resolve) => setTimeout(resolve, 0));

    // "No matching account" here would be a claim the page cannot support.
    expect(root.textContent).toContain("could not be sent");
    expect(root.textContent).not.toContain("No matching account");
    // The rest of the page keeps working.
    expect(root.querySelector("#admin-lookup-form")).toBeTruthy();
  });

  it("tells the admin a failed reset deleted nothing", async () => {
    global.fetch = async (url) => {
      if (String(url).includes("/health")) return { ok: true, json: async () => ({ admin: true }) };
      if (String(url).includes("/admins")) return { ok: true, json: async () => ({ admins: [] }) };
      throw new TypeError("Failed to fetch");
    };

    await window.RunbookAdminAccounts.init();
    window.RunbookAdminAccounts.renderUser(root, USER);
    const form = root.querySelector(".admin-reset-form");
    form.querySelector("input").value = USER.user.email;
    form.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
    await new Promise((resolve) => setTimeout(resolve, 0));
    await new Promise((resolve) => setTimeout(resolve, 0));

    const out = root.querySelector("#admin-reset-result");
    expect(out).toBeTruthy();
    expect(out.textContent).toContain("Nothing was deleted");
  });

  it("gives the server's reason when a reset is refused", async () => {
    global.fetch = async (url) => {
      if (String(url).includes("/health")) return { ok: true, json: async () => ({ admin: true }) };
      if (String(url).includes("/admins")) return { ok: true, json: async () => ({ admins: [] }) };
      return { ok: false, status: 404, json: async () => ({ error: "no such user" }) };
    };

    await window.RunbookAdminAccounts.init();
    window.RunbookAdminAccounts.renderUser(root, USER);
    const form = root.querySelector(".admin-reset-form");
    form.querySelector("input").value = USER.user.email;
    form.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
    await new Promise((resolve) => setTimeout(resolve, 0));
    await new Promise((resolve) => setTimeout(resolve, 0));

    // A vanished account and a mistyped address are different refusals, and
    // only one of them is fixed by retyping the address.
    const out = root.querySelector("#admin-reset-result");
    expect(out.textContent).toContain("no such user");
  });

  it("fires the reset handler once even after init() has re-run", async () => {
    const calls = [];
    global.fetch = async (url) => {
      if (String(url).includes("/health")) return { ok: true, json: async () => ({ admin: true }) };
      if (String(url).includes("/admins")) return { ok: true, json: async () => ({ admins: [] }) };
      if (String(url).includes("/user/progress/reset")) {
        calls.push(url);
        return { ok: true, json: async () => ({}) };
      }
      return { ok: false };
    };

    // init() re-runs on every runbook:auth-changed event - a sign-out
    // followed by a sign-in needs no page navigation - so call it twice to
    // simulate that without waiting on a real auth round trip.
    await window.RunbookAdminAccounts.init();
    await window.RunbookAdminAccounts.init();

    // A lookup result is rendered independently of init(), so inject it
    // directly to get a reset form onto the page.
    window.RunbookAdminAccounts.renderUser(root, USER);
    const form = root.querySelector(".admin-reset-form");
    const input = form.querySelector("input");
    input.value = USER.user.email;

    form.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
    // Let the async submit handler(s) run to completion.
    await new Promise((resolve) => setTimeout(resolve, 0));
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(calls.length).toBe(1);
  });
});
