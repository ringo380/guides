import { describe, it, expect, beforeEach, vi } from "vitest";
import { loadComponent, mockAuth, mockAnalytics, cleanup } from "./helpers.js";

describe("AuthUI", () => {
  beforeEach(() => {
    cleanup();
    delete window.RunbookAuth;
    delete window.RunbookAnalytics;

    // Create a mock Material header
    const header = document.createElement("nav");
    header.className = "md-header__inner md-grid";
    const source = document.createElement("div");
    source.className = "md-header__source";
    header.appendChild(source);
    document.body.appendChild(header);

    mockAnalytics();
  });

  it("renders sign-in button when no user", () => {
    mockAuth(null);
    loadComponent("auth-ui");

    const btn = document.querySelector(".runbook-auth__sign-in");
    expect(btn).not.toBeNull();
    expect(btn.textContent).toContain("Sign in");
  });

  it("sign-in button has accessible label", () => {
    mockAuth(null);
    loadComponent("auth-ui");

    const btn = document.querySelector(".runbook-auth__sign-in");
    expect(btn.getAttribute("aria-label")).toBe("Sign in with GitHub");
  });

  it("sign-in button calls RunbookAuth.signIn()", () => {
    const auth = mockAuth(null);
    loadComponent("auth-ui");

    const btn = document.querySelector(".runbook-auth__sign-in");
    btn.click();
    expect(auth.signIn).toHaveBeenCalled();
  });

  it("renders avatar when user is authenticated", () => {
    mockAuth({
      id: "123",
      email: "test@example.com",
      user_metadata: {
        avatar_url: "https://example.com/avatar.png",
        user_name: "testuser",
      },
    });
    loadComponent("auth-ui");

    const avatar = document.querySelector(".runbook-auth__avatar");
    expect(avatar).not.toBeNull();
    expect(avatar.src).toBe("https://example.com/avatar.png");
    expect(avatar.alt).toBe("testuser");
  });

  it("avatar button has aria attributes", () => {
    mockAuth({
      id: "123",
      user_metadata: { avatar_url: "", user_name: "test" },
    });
    loadComponent("auth-ui");

    const btn = document.querySelector(".runbook-auth__user");
    expect(btn.getAttribute("aria-label")).toBe("Account menu");
    expect(btn.getAttribute("aria-expanded")).toBe("false");
    expect(btn.getAttribute("aria-haspopup")).toBe("true");
  });

  it("updates UI on runbook:auth-changed event", () => {
    mockAuth(null);
    loadComponent("auth-ui");

    // Initially shows sign-in button
    expect(document.querySelector(".runbook-auth__sign-in")).not.toBeNull();

    // Fire auth changed with a user
    document.dispatchEvent(
      new CustomEvent("runbook:auth-changed", {
        detail: {
          user: {
            id: "123",
            user_metadata: { avatar_url: "", user_name: "test" },
          },
        },
      })
    );

    // Now should show avatar
    expect(document.querySelector(".runbook-auth__sign-in")).toBeNull();
    expect(document.querySelector(".runbook-auth__avatar")).not.toBeNull();
  });

  it("container has accessible role and label", () => {
    mockAuth(null);
    loadComponent("auth-ui");

    const container = document.querySelector(".runbook-auth");
    expect(container.getAttribute("role")).toBe("region");
    expect(container.getAttribute("aria-label")).toBe("User authentication");
  });
});
