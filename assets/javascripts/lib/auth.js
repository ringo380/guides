/* SPDX-License-Identifier: MIT */
/* Copyright (c) 2025-2026 Robworks Software LLC */

/**
 * Authentication module for The Runbook.
 *
 * Uses Supabase Auth with GitHub OAuth. Exposes window.RunbookAuth
 * for other modules to check auth state and trigger sign-in/out.
 *
 * Fires "runbook:auth-changed" CustomEvent on document when auth state changes.
 */

(function () {
  "use strict";

  const config = window.RunbookSupabaseConfig;
  if (!config) {
    console.warn("[Runbook] Supabase config not found, auth disabled");
    return;
  }

  let client = null;
  let currentUser = null;
  let initialized = false;

  function createClient() {
    if (client) return client;
    if (!window.supabase || !window.supabase.createClient) return null;
    client = window.supabase.createClient(config.url, config.anonKey);
    return client;
  }

  function fireAuthChanged(user, event) {
    document.dispatchEvent(
      new CustomEvent("runbook:auth-changed", {
        detail: { user: user, event: event || "INITIAL" },
      })
    );
  }

  const RunbookAuth = {
    async init() {
      if (initialized) return;
      initialized = true;

      const sb = createClient();
      if (!sb) {
        console.warn("[Runbook] Supabase client unavailable, auth disabled");
        return;
      }

      // Check for existing session
      try {
        const {
          data: { session },
        } = await sb.auth.getSession();
        if (session) {
          currentUser = session.user;
          fireAuthChanged(currentUser, "INITIAL_SESSION");
        }
      } catch (e) {
        console.warn("[Runbook] Failed to get auth session:", e);
      }

      // Listen for auth state changes (sign-in, sign-out, token refresh)
      sb.auth.onAuthStateChange(function (event, session) {
        var previousUser = currentUser;
        currentUser = session ? session.user : null;

        // Only fire if state actually changed
        var wasSignedIn = !!previousUser;
        var isSignedIn = !!currentUser;
        if (wasSignedIn !== isSignedIn || event === "SIGNED_IN") {
          fireAuthChanged(currentUser, event);
        }
      });

      // Restore page position after OAuth redirect
      var returnUrl = null;
      try {
        returnUrl = sessionStorage.getItem("runbook_auth_return");
      } catch (e) {
        // sessionStorage unavailable
      }
      if (returnUrl && currentUser) {
        try {
          sessionStorage.removeItem("runbook_auth_return");
        } catch (e) {
          // ignore
        }
        // Only redirect if we're not already on that page
        if (
          window.location.href !== returnUrl &&
          window.location.href.replace(/#.*$/, "") !==
            returnUrl.replace(/#.*$/, "")
        ) {
          window.location.replace(returnUrl);
        }
      }
    },

    async signIn() {
      var sb = createClient();
      if (!sb) return;

      // Save current page so we can return after OAuth
      try {
        sessionStorage.setItem("runbook_auth_return", window.location.href);
      } catch (e) {
        // sessionStorage unavailable
      }

      var siteRoot =
        window.__md_scope ||
        window.location.origin + "/guides/";

      try {
        await sb.auth.signInWithOAuth({
          provider: "github",
          options: { redirectTo: siteRoot },
        });
      } catch (e) {
        console.error("[Runbook] Sign-in failed:", e);
        if (window.RunbookAnalytics) {
          window.RunbookAnalytics.trackError("auth_sign_in", e);
        }
      }
    },

    async signOut() {
      var sb = createClient();
      if (!sb) return;

      try {
        await sb.auth.signOut();
      } catch (e) {
        console.error("[Runbook] Sign-out failed:", e);
        if (window.RunbookAnalytics) {
          window.RunbookAnalytics.trackError("auth_sign_out", e);
        }
      }
    },

    getUser() {
      return currentUser;
    },

    getClient() {
      return client;
    },
  };

  window.RunbookAuth = RunbookAuth;
})();
