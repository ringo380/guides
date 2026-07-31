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
