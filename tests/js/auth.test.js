import { describe, it, expect, beforeEach, vi } from "vitest";
import { loadLib, mockSupabase, mockAnalytics, cleanup } from "./helpers.js";

describe("RunbookAuth", () => {
  let sbMock;

  beforeEach(() => {
    cleanup();
    delete window.RunbookAuth;
    delete window.RunbookSupabaseConfig;
    delete window.supabase;
    delete window.RunbookAnalytics;

    // Set up config
    window.RunbookSupabaseConfig = {
      url: "https://test.supabase.co",
      anonKey: "test-anon-key",
      cdnUrl: "https://cdn.example.com/supabase.js",
    };

    sbMock = mockSupabase();
    mockAnalytics();

    // Reset sessionStorage
    sessionStorage.clear();

    loadLib("auth");
  });

  it("exposes RunbookAuth on window", () => {
    expect(window.RunbookAuth).toBeDefined();
    expect(typeof window.RunbookAuth.signIn).toBe("function");
    expect(typeof window.RunbookAuth.signOut).toBe("function");
    expect(typeof window.RunbookAuth.getUser).toBe("function");
  });

  it("returns null user when not authenticated", () => {
    expect(window.RunbookAuth.getUser()).toBeNull();
  });

  it("creates supabase client on init", async () => {
    await window.RunbookAuth.init();
    expect(window.supabase.createClient).toHaveBeenCalledWith(
      "https://test.supabase.co",
      "test-anon-key"
    );
  });

  it("checks existing session on init", async () => {
    await window.RunbookAuth.init();
    expect(sbMock.client.auth.getSession).toHaveBeenCalled();
  });

  it("registers auth state change listener on init", async () => {
    await window.RunbookAuth.init();
    expect(sbMock.client.auth.onAuthStateChange).toHaveBeenCalled();
  });

  it("fires runbook:auth-changed event on sign-in", async () => {
    await window.RunbookAuth.init();

    const handler = vi.fn();
    document.addEventListener("runbook:auth-changed", handler);

    const mockUser = { id: "123", email: "test@example.com" };
    sbMock.triggerAuthChange("SIGNED_IN", { user: mockUser });

    expect(handler).toHaveBeenCalled();
    expect(handler.mock.calls[0][0].detail.user).toEqual(mockUser);

    document.removeEventListener("runbook:auth-changed", handler);
  });

  it("calls signInWithOAuth on signIn()", async () => {
    await window.RunbookAuth.init();
    await window.RunbookAuth.signIn();
    expect(sbMock.client.auth.signInWithOAuth).toHaveBeenCalledWith(
      expect.objectContaining({ provider: "github" })
    );
  });

  it("stores return URL in sessionStorage before sign-in", async () => {
    await window.RunbookAuth.init();
    await window.RunbookAuth.signIn();
    expect(sessionStorage.getItem("runbook_auth_return")).toBeTruthy();
  });

  it("calls signOut on signOut()", async () => {
    await window.RunbookAuth.init();
    await window.RunbookAuth.signOut();
    expect(sbMock.client.auth.signOut).toHaveBeenCalled();
  });

  it("does not initialize without config", () => {
    delete window.RunbookAuth;
    delete window.RunbookSupabaseConfig;
    loadLib("auth");
    // Auth should still be defined but init should be a no-op
    // Since the IIFE returns early when no config, RunbookAuth won't be set
    expect(window.RunbookAuth).toBeUndefined();
  });
});
