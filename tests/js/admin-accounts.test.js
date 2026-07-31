import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { loadComponent, cleanup } from "./helpers.js";
import { readFileSync } from "fs";
import { resolve } from "path";

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

  it("does not claim the roster is empty when it could not be read", () => {
    // null is "no answer", which is not the same fact as "no rows". Saying the
    // trigger is broken on a 500 makes a confident claim about database state
    // this code has no evidence for.
    window.RunbookAdminAccounts.renderRoster(root, null);
    expect(root.textContent).toContain("Could not load the admin roster");
    expect(root.textContent).not.toContain("no admins");
    expect(root.textContent).not.toContain("trigger");
  });

  it("separates an unreadable address from an account with none on file", () => {
    // Both rows carry email null. One is a property of the account, the other
    // is a failed lookup worth retrying, and a shared placeholder tells the
    // admin the wrong one half the time.
    window.RunbookAdminAccounts.renderRoster(root, {
      admins: [
        {
          userId: "absent",
          email: null,
          emailUnavailable: false,
          note: "",
          createdAt: "2026-01-01T00:00:00Z",
        },
        {
          userId: "failed",
          email: null,
          emailUnavailable: true,
          note: "",
          createdAt: "2026-01-02T00:00:00Z",
        },
      ],
    });
    const cells = [...root.querySelectorAll("tbody tr")].map(
      (tr) => tr.firstElementChild.textContent
    );
    expect(cells).toEqual(["(no address on file)", "(could not be read)"]);
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

  // Mirrors the shell in admin-accounts.md, live region included. A mount that
  // omits it would test an announcement path the real page does not have.
  function mountAdminAccountsRoot() {
    const el = document.createElement("div");
    el.id = "admin-accounts-root";
    el.setAttribute("role", "region");
    el.setAttribute("aria-label", "Account management");
    const live = document.createElement("p");
    live.id = "admin-lookup-status";
    live.className = "sr-only";
    live.setAttribute("role", "status");
    el.appendChild(live);
    const status = document.createElement("p");
    status.id = "admin-accounts-status";
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
  async function initPastHealth(response) {
    global.fetch = async (url) => {
      if (String(url).includes("/health")) return { ok: true, json: async () => ({ admin: true }) };
      if (String(url).includes("/admins")) return { ok: true, json: async () => ({ admins: [] }) };
      return response;
    };
    await window.RunbookAdminAccounts.init();
    return root.querySelector("#admin-lookup-form");
  }

  async function submitLookup(form) {
    form.querySelector("input").value = "someone@example.com";
    form.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
    await new Promise((resolve) => setTimeout(resolve, 0));
    await new Promise((resolve) => setTimeout(resolve, 0));
  }

  async function lookupWith(response) {
    await submitLookup(await initPastHealth(response));
  }

  const liveRegion = () => document.getElementById("admin-lookup-status");

  // One table rather than three tests. Asserting the 404 alone is vacuous:
  // collapsing every status into the not-found branch - the behavior this
  // guards against - still leaves the 404 looking correct, so the row that
  // catches the collapse has to live in the same test as the row that would
  // otherwise pass it.
  const LOOKUP_OUTCOMES = [
    {
      status: 404,
      // Past LOOKUP_PAGE_SIZE accounts the server answers 409 for an address it
      // could not resolve safely, and a platform 500 is plain text that json()
      // rejects on. Neither is "no such account", and the server's raw body is
      // not the page's copy either.
      body: async () => ({ error: "no such user" }),
      shows: "No matching account. The address must match exactly",
      hides: ["no such user", "The server answered"],
    },
    {
      status: 409,
      body: async () => ({
        error: "too many candidate accounts for that address to resolve it safely",
      }),
      shows: "too many candidate accounts",
      hides: ["No matching account"],
    },
    {
      status: 500,
      body: async () => { throw new SyntaxError("Unexpected token I"); },
      shows: "500",
      hides: ["No matching account"],
    },
  ];

  it("gives each lookup status its own message, never a collapsed one", async () => {
    for (const outcome of LOOKUP_OUTCOMES) {
      cleanup();
      root = mountAdminAccountsRoot();
      await lookupWith({ ok: false, status: outcome.status, json: outcome.body });

      const text = root.textContent;
      expect(text, `status ${outcome.status}`).toContain(outcome.shows);
      for (const forbidden of outcome.hides) {
        expect(text, `status ${outcome.status}`).not.toContain(forbidden);
      }
    }
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

  it("does not narrate a failed roster request as an empty roster", async () => {
    // The wiring half of the renderer test above: init() must pass the failure
    // through as a failure. Passing { admins: [] } here - what it used to do -
    // put the trigger claim on the page for a plain 500.
    global.fetch = async (url) => {
      if (String(url).includes("/health")) return { ok: true, json: async () => ({ admin: true }) };
      if (String(url).includes("/admins")) {
        return { ok: false, status: 500, json: async () => ({ error: "boom" }) };
      }
      return { ok: false };
    };

    await window.RunbookAdminAccounts.init();

    const roster = root.querySelector("#admin-roster");
    expect(roster.textContent).toContain("Could not load the admin roster");
    expect(roster.textContent).not.toContain("check the trigger");
  });

  it("still names an empty roster as the impossibility it is", async () => {
    // The other side of the same branch. Without this row, collapsing both
    // outcomes back into one message would pass the test above.
    global.fetch = async (url) => {
      if (String(url).includes("/health")) return { ok: true, json: async () => ({ admin: true }) };
      if (String(url).includes("/admins")) return { ok: true, json: async () => ({ admins: [] }) };
      return { ok: false };
    };

    await window.RunbookAdminAccounts.init();

    const roster = root.querySelector("#admin-roster");
    expect(roster.textContent).toContain("check the trigger");
    expect(roster.textContent).not.toContain("Could not load");
  });

  it("sends one reset per intent, not one per click", async () => {
    // The delete is idempotent, so a double-click loses no extra data - but the
    // audit insert is not, and two rows for one intent misreport how many
    // resets were performed.
    const calls = [];
    let release;
    const held = new Promise((resolve) => { release = resolve; });
    global.fetch = async (url) => {
      if (String(url).includes("/health")) return { ok: true, json: async () => ({ admin: true }) };
      if (String(url).includes("/admins")) return { ok: true, json: async () => ({ admins: [] }) };
      if (String(url).includes("/user/progress/reset")) {
        calls.push(url);
        await held;
        return { ok: true, json: async () => ({}) };
      }
      return { ok: false };
    };

    await window.RunbookAdminAccounts.init();
    window.RunbookAdminAccounts.renderUser(root, USER);
    const form = root.querySelector(".admin-reset-form");
    const btn = form.querySelector("[data-action='reset-progress']");
    form.querySelector("input").value = USER.user.email;

    const submit = () =>
      form.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
    try {
      submit();
      await new Promise((resolve) => setTimeout(resolve, 0));

      // The request is still in flight here, which is the only window in which
      // the second click can do damage.
      expect(calls.length).toBe(1);
      expect(btn.disabled).toBe(true);
      // Both, in step: assistive tech reads the attribute, and a control that
      // announces itself as available while refusing every activation is worse
      // than one that says it is busy.
      expect(btn.getAttribute("aria-disabled")).toBe("true");

      submit();
      await new Promise((resolve) => setTimeout(resolve, 0));
      expect(calls.length).toBe(1);
    } finally {
      // In a finally, because the component instance outlives this test: the
      // IIFE returns early once window.RunbookAdminAccounts exists, so its
      // in-flight flag is shared with every later test in the file. A failed
      // assertion here would otherwise leave that flag stuck and fail four
      // unrelated tests with it.
      release();
    }
    await new Promise((resolve) => setTimeout(resolve, 0));
    await new Promise((resolve) => setTimeout(resolve, 0));

    // Released afterwards, or one reset costs the admin the button for the
    // rest of the session.
    expect(btn.disabled).toBe(false);
    expect(btn.getAttribute("aria-disabled")).toBe(null);
    expect(root.querySelector("#admin-reset-result").textContent)
      .toContain("Progress reset");
  });

  it("leaves the reset button usable after a submit it refused to send", async () => {
    // The empty-confirmation branch returns before any request goes out. If it
    // took the in-flight lock on the way past, the admin would have to reload
    // the page to be able to retry at all.
    global.fetch = async (url) => {
      if (String(url).includes("/health")) return { ok: true, json: async () => ({ admin: true }) };
      if (String(url).includes("/admins")) return { ok: true, json: async () => ({ admins: [] }) };
      return { ok: true, json: async () => ({}) };
    };

    await window.RunbookAdminAccounts.init();
    window.RunbookAdminAccounts.renderUser(root, USER);
    const form = root.querySelector(".admin-reset-form");
    const btn = form.querySelector("[data-action='reset-progress']");
    form.querySelector("input").value = "";
    form.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(btn.disabled).toBe(false);
    expect(btn.getAttribute("aria-disabled")).toBe(null);
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

  // The maintainer of this page cannot check an announcement by eye, so the
  // announcement path is asserted structurally: the region exists before the
  // submit, its text changes for every outcome, and it is written once.

  it("keeps one empty live region in place across re-inits", async () => {
    global.fetch = async (url) => {
      if (String(url).includes("/health")) return { ok: true, json: async () => ({ admin: true }) };
      return { ok: true, json: async () => ({ admins: [] }) };
    };
    await window.RunbookAdminAccounts.init();
    await window.RunbookAdminAccounts.init();

    const regions = document.querySelectorAll("#admin-lookup-status");
    expect(regions.length).toBe(1);
    expect(regions[0].getAttribute("role")).toBe("status");
    // role="status" already implies aria-live="polite"; both would be a
    // duplicate announcement in some screen readers.
    expect(regions[0].hasAttribute("aria-live")).toBe(false);
    // Present but silent until the reader asks for something.
    expect(regions[0].textContent).toBe("");
    // The old blanket live region on the root announced every rendered table.
    expect(root.hasAttribute("aria-live")).toBe(false);
  });

  const OUTCOMES = [
    {
      name: "a match",
      response: { ok: true, status: 200, json: async () => USER },
      announced: "Account found for someone@example.com",
    },
    {
      name: "a genuine 404",
      response: { ok: false, status: 404, json: async () => ({ error: "no such user" }) },
      announced: "No matching account",
    },
    {
      name: "a refusal the server explained",
      response: {
        ok: false,
        status: 409,
        json: async () => ({ error: "too many candidate accounts" }),
      },
      announced: "too many candidate accounts",
    },
    {
      name: "an unreadable server error",
      response: {
        ok: false,
        status: 500,
        json: async () => { throw new SyntaxError("Unexpected token I"); },
      },
      announced: "500",
    },
  ];

  OUTCOMES.forEach(({ name, response, announced }) => {
    it(`announces ${name} through the live region`, async () => {
      const form = await initPastHealth(response);
      // The precondition that makes the assertion below mean anything: the
      // region was already in the DOM, and empty, before the submit.
      expect(liveRegion()).toBeTruthy();
      expect(liveRegion().textContent).toBe("");

      await submitLookup(form);

      expect(liveRegion().textContent).toContain(announced);
    });
  });

  it("announces a lookup that never left the browser", async () => {
    global.fetch = async (url) => {
      if (String(url).includes("/health")) return { ok: true, json: async () => ({ admin: true }) };
      if (String(url).includes("/admins")) return { ok: true, json: async () => ({ admins: [] }) };
      throw new TypeError("Failed to fetch");
    };
    await window.RunbookAdminAccounts.init();
    expect(liveRegion().textContent).toBe("");

    await submitLookup(root.querySelector("#admin-lookup-form"));

    expect(liveRegion().textContent).toContain("could not be sent");
  });

  it("writes the live region exactly once per lookup", async () => {
    const form = await initPastHealth({
      ok: false,
      status: 404,
      json: async () => ({ error: "no such user" }),
    });

    const records = [];
    const observer = new MutationObserver((list) => records.push(...list));
    observer.observe(liveRegion(), { childList: true, characterData: true, subtree: true });

    await submitLookup(form);
    observer.takeRecords().forEach((r) => records.push(r));
    observer.disconnect();

    // Two writes per action is the duplicate-announcement bug the repo's
    // conventions call out, and it is invisible on screen.
    expect(records.length).toBe(1);
  });

  it("leaves no second live region holding the same message", async () => {
    await lookupWith({
      ok: false,
      status: 409,
      json: async () => ({ error: "too many candidate accounts" }),
    });

    // init() removes the shell status line once authorization succeeds, so the
    // persistent region is the only announcing node left.
    const announcing = root.querySelectorAll('[role="status"], [aria-live]');
    expect(announcing.length).toBe(1);
    expect(announcing[0].id).toBe("admin-lookup-status");
  });

  it("moves focus onto the result of a submit, but not on load", async () => {
    const form = await initPastHealth({
      ok: false,
      status: 404,
      json: async () => ({ error: "no such user" }),
    });
    // Loading the page must not yank focus away from whatever the reader was
    // doing; only a submit they initiated may.
    expect(document.activeElement).not.toBe(root.querySelector("#admin-user-result"));

    await submitLookup(form);

    const result = root.querySelector("#admin-user-result");
    expect(result.getAttribute("tabindex")).toBe("-1");
    expect(document.activeElement).toBe(result);
  });

  it("announces an empty lookup submit instead of returning in silence", async () => {
    // The early return rendered nothing and announced nothing, so a screen
    // reader user could not tell a rejected submit from a page that had
    // stopped responding. No request may be sent either.
    let requested = false;
    global.fetch = async (url) => {
      if (String(url).includes("/health")) return { ok: true, json: async () => ({ admin: true }) };
      if (String(url).includes("/admins")) return { ok: true, json: async () => ({ admins: [] }) };
      requested = true;
      return { ok: true, json: async () => ({}) };
    };
    await window.RunbookAdminAccounts.init();
    expect(liveRegion().textContent).toBe("");

    const form = root.querySelector("#admin-lookup-form");
    const input = form.querySelector("input");
    input.value = "   ";
    form.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
    await new Promise((resolve) => setTimeout(resolve, 0));

    // Pinned to the sentence, not merely to "something": announcing the reset
    // form's instruction here would be wrong and would pass a not-empty check.
    expect(liveRegion().textContent).toContain("address or user id");
    // Visible too. The empty path is the only outcome that renders nothing, so
    // a sighted admin submitting whitespace would otherwise see no change.
    expect(form.querySelector(".admin-form-hint").textContent)
      .toContain("address or user id");
    expect(requested).toBe(false);
    expect(document.activeElement).toBe(input);
  });

  it("clears the visible hint once a real lookup goes out", async () => {
    const form = await initPastHealth({
      ok: false,
      status: 404,
      json: async () => ({ error: "no such user" }),
    });
    form.querySelector("input").value = "";
    form.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(form.querySelector(".admin-form-hint").textContent).not.toBe("");

    await submitLookup(form);

    // A stale "type an address first" sitting under a real result contradicts
    // the result.
    expect(form.querySelector(".admin-form-hint").textContent).toBe("");
  });

  it("re-announces the same sentence when the empty submit is repeated", async () => {
    // Assistive tech fires on a change, so writing an identical string is
    // silent - and repeating the submit is exactly what an admin does after
    // not hearing the first one.
    global.fetch = async (url) => {
      if (String(url).includes("/health")) return { ok: true, json: async () => ({ admin: true }) };
      return { ok: true, json: async () => ({ admins: [] }) };
    };
    await window.RunbookAdminAccounts.init();
    const form = root.querySelector("#admin-lookup-form");
    form.querySelector("input").value = "";

    const submitEmpty = async () => {
      form.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
      await new Promise((resolve) => setTimeout(resolve, 0));
    };

    await submitEmpty();
    const first = liveRegion().textContent;
    expect(first).toContain("address or user id");

    const changes = [];
    const observer = new MutationObserver(() => changes.push(liveRegion().textContent));
    observer.observe(liveRegion(), { childList: true, characterData: true, subtree: true });
    await submitEmpty();
    await new Promise((resolve) => setTimeout(resolve, 0));
    observer.takeRecords();
    observer.disconnect();

    // The region must have gone empty and back, so the repeat is a real change
    // rather than a write the accessibility tree cannot distinguish.
    expect(changes).toContain("");
    expect(liveRegion().textContent).toContain("address or user id");
  });

  it("announces an empty reset confirmation instead of returning in silence", async () => {
    // Worse here than on the lookup: an unexplained non-response to a
    // destructive form reads as "it may or may not have gone through".
    let requested = false;
    global.fetch = async (url) => {
      if (String(url).includes("/health")) return { ok: true, json: async () => ({ admin: true }) };
      if (String(url).includes("/admins")) return { ok: true, json: async () => ({ admins: [] }) };
      requested = true;
      return { ok: true, json: async () => ({ reset: true }) };
    };
    await window.RunbookAdminAccounts.init();
    window.RunbookAdminAccounts.renderUser(root, USER);
    expect(liveRegion().textContent).toBe("");

    const form = root.querySelector(".admin-reset-form");
    const input = form.querySelector("input");
    input.value = "";
    form.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(liveRegion().textContent).toContain("confirm the reset");
    expect(form.querySelector(".admin-form-hint").textContent)
      .toContain("confirm the reset");
    expect(requested).toBe(false);
    expect(document.activeElement).toBe(input);
  });

  it("focuses the reset field before announcing, not after", async () => {
    // Focusing this input also reads the deletion warning it is described by.
    // Announcing first lets that warning talk over the instruction, and a
    // polite region preempted by a focus announcement can be dropped entirely.
    global.fetch = async (url) => {
      if (String(url).includes("/health")) return { ok: true, json: async () => ({ admin: true }) };
      return { ok: true, json: async () => ({ admins: [] }) };
    };
    await window.RunbookAdminAccounts.init();
    window.RunbookAdminAccounts.renderUser(root, USER);

    const order = [];
    const form = root.querySelector(".admin-reset-form");
    const input = form.querySelector("input");
    input.addEventListener("focus", () => order.push("focus"));

    // The write is spied synchronously, through the property itself. A
    // MutationObserver cannot answer this question: its callback is a
    // microtask, so it always records after the focus listener no matter which
    // order the code used, and the test passes against either.
    const region = liveRegion();
    const textContent = Object.getOwnPropertyDescriptor(Node.prototype, "textContent");
    Object.defineProperty(region, "textContent", {
      configurable: true,
      get() { return textContent.get.call(this); },
      set(value) {
        order.push("announce");
        textContent.set.call(this, value);
      },
    });

    try {
      input.value = "";
      form.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
      await new Promise((resolve) => setTimeout(resolve, 0));
    } finally {
      delete region.textContent;
    }

    expect(order).toEqual(["focus", "announce"]);
  });

  it("still writes the live region exactly once for a refused empty submit", async () => {
    // The empty path must not announce through two nodes any more than the
    // outcome paths do.
    global.fetch = async (url) => {
      if (String(url).includes("/health")) return { ok: true, json: async () => ({ admin: true }) };
      return { ok: true, json: async () => ({ admins: [] }) };
    };
    await window.RunbookAdminAccounts.init();

    const records = [];
    const observer = new MutationObserver((list) => records.push(...list));
    observer.observe(liveRegion(), { childList: true, characterData: true, subtree: true });

    const form = root.querySelector("#admin-lookup-form");
    form.querySelector("input").value = "";
    form.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
    await new Promise((resolve) => setTimeout(resolve, 0));
    observer.takeRecords().forEach((r) => records.push(r));
    observer.disconnect();

    expect(records.length).toBe(1);
    expect(root.querySelectorAll('[role="status"], [aria-live]').length).toBe(1);
  });

  it("announces a reset outcome and lands focus on it", async () => {
    global.fetch = async (url) => {
      if (String(url).includes("/health")) return { ok: true, json: async () => ({ admin: true }) };
      if (String(url).includes("/admins")) return { ok: true, json: async () => ({ admins: [] }) };
      return { ok: false, status: 403, json: async () => ({ error: "confirmation email does not match that user id" }) };
    };
    await window.RunbookAdminAccounts.init();
    window.RunbookAdminAccounts.renderUser(root, USER);
    expect(liveRegion().textContent).toBe("");

    const form = root.querySelector(".admin-reset-form");
    form.querySelector("input").value = USER.user.email;
    form.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
    await new Promise((resolve) => setTimeout(resolve, 0));
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(liveRegion().textContent).toContain("does not match");
    expect(document.activeElement).toBe(root.querySelector("#admin-reset-result"));
  });
});

describe("admin accounts page shell", () => {
  it("ships the live region in the markup, not only in the script", () => {
    // A region created by the script at the moment it is first needed may never
    // be announced. It has to be in the page from first render, so this asserts
    // the shipped markup rather than what the component can patch up.
    const shell = readFileSync(resolve(__dirname, "../../admin-accounts.md"), "utf-8");
    expect(shell).toContain('id="admin-lookup-status"');
    expect(shell).toContain('role="status"');
    expect(shell).toContain('class="sr-only"');
    // A blanket live region on the container announces every re-rendered table.
    expect(shell).not.toContain("aria-live");
  });
});
