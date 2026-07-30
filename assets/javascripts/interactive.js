/* SPDX-License-Identifier: MIT */
/* Copyright (c) 2025-2026 Robworks Software LLC */

/**
 * Interactive Textbook - Entry Point
 *
 * Discovers interactive component divs in the page and initializes them.
 * Components are loaded as separate script files and register themselves
 * on window.RunbookComponents.
 *
 * Works with MkDocs Material's instant navigation by re-initializing
 * on each page load event.
 */

(function () {
  "use strict";

  // Registry for component initializers
  window.RunbookComponents = window.RunbookComponents || {};

  // Component type -> JS file mapping
  const COMPONENT_SCRIPTS = {
    quiz: "assets/javascripts/components/quiz.js",
    terminal: "assets/javascripts/components/terminal.js",
    "command-builder": "assets/javascripts/components/command-builder.js",
    exercise: "assets/javascripts/components/exercise.js",
    "code-walkthrough": "assets/javascripts/components/code-walkthrough.js",
    progress: "assets/javascripts/components/progress.js",
    "topic-cards": "assets/javascripts/components/topic-cards.js",
    "auth-ui": "assets/javascripts/components/auth-ui.js",
    "admin-dashboard": "assets/javascripts/components/admin/dashboard.js",
  };

  // Keyed by src, holding the in-flight promise rather than a "done" marker.
  //
  // This used to be a Set that a src was added to on LOAD, which meant two
  // concurrent callers both passed the guard before either finished and both
  // injected a tag. initComponents() runs twice on a first page load - once
  // from DOMContentLoaded and once because Material's document$ emits the
  // current document immediately on subscribe - so that race fired on every
  // visit, not in some rare interleaving.
  //
  // The consequences were live: storage.js loaded twice and the second copy
  // threw "Identifier 'STORAGE_KEY' has already been declared", and collect.js
  // loaded twice, giving each copy its own module scope so neither could see
  // that the other had already sent the page view. Every page view was counted
  // twice - an inflated number that looks entirely plausible.
  //
  // Registering the promise BEFORE the load settles is what closes it: the
  // second caller gets the first caller's promise instead of a second tag.
  const loadedScripts = new Map();

  function injectScript(key, href) {
    const existing = loadedScripts.get(key);
    if (existing) return existing;

    const pending = new Promise((resolve, reject) => {
      const script = document.createElement("script");
      script.src = href;
      script.onload = () => resolve();
      script.onerror = () => {
        // Do not cache a failure as though it were a completed load. A blocked
        // script that becomes available later should be retryable.
        loadedScripts.delete(key);
        reject(new Error(`Failed to load ${key}`));
      };
      document.head.appendChild(script);
    });

    loadedScripts.set(key, pending);
    return pending;
  }

  function loadScript(src) {
    // Resolve relative to site root (__md_scope is set by MkDocs Material per page)
    return injectScript(src, new URL(src, window.__md_scope || document.baseURI).href);
  }

  function loadExternalScript(url) {
    return injectScript(url, url);
  }

  // Analytics is optional and is a common ad-blocker target: lib/analytics.js
  // matches filter-list rules for "/analytics.js" and gets blocked outright.
  // Loading it inside the main .then() chain let one blocked file reject
  // everything downstream, which took auth down with it. Swallow the failure
  // here so an optional script can never break a required one. Every
  // RunbookAnalytics call site is already guarded on the global existing.
  function loadOptionalScript(src) {
    return loadScript(src).catch((err) => {
      console.warn("[Runbook] Optional script unavailable:", src, err.message || err);
    });
  }

  // Auth must not depend on analytics or storage having loaded, so it lives in
  // its own chain that both the normal and storage-failure paths call.
  function loadAuthChain() {
    return loadScript("assets/javascripts/lib/supabase-config.js")
      .then(() => {
        const cdnUrl = window.RunbookSupabaseConfig && window.RunbookSupabaseConfig.cdnUrl;
        return cdnUrl ? loadExternalScript(cdnUrl) : Promise.reject(new Error("No CDN URL"));
      })
      .then(() => loadScript("assets/javascripts/lib/auth.js"))
      .then(() => loadScript("assets/javascripts/lib/sync.js"))
      .then(() => {
        if (window.RunbookAuth) return window.RunbookAuth.init();
      })
      .catch((err) => {
        console.warn("[Runbook] Auth unavailable:", err.message || err);
      });
  }

  function initComponents() {
    // Load storage first - components depend on window.RunbookStorage
    loadScript("assets/javascripts/lib/storage.js")
      .then(() => loadOptionalScript("assets/javascripts/lib/analytics.js"))
      .then(() => loadOptionalScript("assets/javascripts/lib/analytics-observers.js"))
      .then(() => loadOptionalScript("assets/javascripts/lib/topics.js"))
      .then(() => loadOptionalScript("assets/javascripts/lib/analytics-journey.js"))
      // First-party beacon. Loaded after analytics.js so it can mirror the
      // events components already emit, but it does not depend on it: when
      // analytics.js is blocked there is simply nothing to mirror and page
      // views still flow.
      .then(() => loadOptionalScript("assets/javascripts/lib/collect.js"))
      .then(() => loadAuthChain())
      .then(() => {
        // Find all interactive divs on the page
        const types = Object.keys(COMPONENT_SCRIPTS);
        types.forEach((type) => {
          const divs = document.querySelectorAll(`.interactive-${type}`);
          if (divs.length === 0) return;

          const scriptSrc = COMPONENT_SCRIPTS[type];
          loadScript(scriptSrc)
            .then(() => {
              const init = window.RunbookComponents[type];
              if (typeof init === "function") {
                divs.forEach((div) => {
                  // Skip already-initialized divs
                  if (div.dataset.initialized) return;
                  try {
                    const config = JSON.parse(div.dataset.config || "{}");
                    init(div, config);
                    div.dataset.initialized = "true";
                  } catch (e) {
                    console.error(`[Runbook] Error initializing ${type}:`, e);
                    if (window.RunbookAnalytics) window.RunbookAnalytics.trackError("component_init:" + type, e);
                  }
                });
              }
            })
            .catch((err) => {
              console.error(`[Runbook]`, err);
              if (window.RunbookAnalytics) window.RunbookAnalytics.trackError("script_load", err);
            });
        });

        // Always load progress tracker
        loadScript(COMPONENT_SCRIPTS.progress).catch(() => {});
        // Always load topic cards (self-initializes on topic README pages)
        loadScript(COMPONENT_SCRIPTS["topic-cards"]).catch(() => {});
        // Always load auth UI (self-initializes in header)
        loadScript(COMPONENT_SCRIPTS["auth-ui"]).catch(() => {});
        // Admin dashboard, only on the admin page. Loaded here rather than
        // from a script tag in admin.md so it runs after the auth chain has
        // resolved and window.RunbookAuth exists.
        if (document.getElementById("admin-root")) {
          loadScript(COMPONENT_SCRIPTS["admin-dashboard"]).catch(() => {});
        }
      })
      .catch(() => {
        // Only reachable when storage.js itself failed: every optional step
        // above swallows its own error now.
        console.warn("[Runbook] Storage unavailable, progress will not persist");
        loadOptionalScript("assets/javascripts/lib/analytics.js")
          .then(() => loadOptionalScript("assets/javascripts/lib/analytics-observers.js"))
          .then(() => loadOptionalScript("assets/javascripts/lib/topics.js"))
          .then(() => loadOptionalScript("assets/javascripts/lib/analytics-journey.js"))
          .then(() => loadOptionalScript("assets/javascripts/lib/collect.js"));
        // Sign-in does not need storage, so still bring up auth here.
        loadAuthChain().then(() => {
          loadScript(COMPONENT_SCRIPTS["auth-ui"]).catch(() => {});
          if (document.getElementById("admin-root")) {
            loadScript(COMPONENT_SCRIPTS["admin-dashboard"]).catch(() => {});
          }
        });
        const types = Object.keys(COMPONENT_SCRIPTS);
        types.forEach((type) => {
          const divs = document.querySelectorAll(`.interactive-${type}`);
          if (divs.length === 0) return;
          loadScript(COMPONENT_SCRIPTS[type])
            .then(() => {
              const init = window.RunbookComponents[type];
              if (typeof init === "function") {
                divs.forEach((div) => {
                  if (div.dataset.initialized) return;
                  try {
                    const config = JSON.parse(div.dataset.config || "{}");
                    init(div, config);
                    div.dataset.initialized = "true";
                  } catch (e) {
                    console.error(`[Runbook] Error initializing ${type}:`, e);
                    if (window.RunbookAnalytics) window.RunbookAnalytics.trackError("component_init_fallback:" + type, e);
                  }
                });
              }
            })
            .catch((err) => {
              console.error(`[Runbook]`, err);
              if (window.RunbookAnalytics) window.RunbookAnalytics.trackError("script_load_fallback", err);
            });
        });
      });
  }

  // Initialize on DOMContentLoaded (first page load)
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initComponents);
  } else {
    initComponents();
  }

  // Re-initialize on MkDocs Material instant navigation
  // Material dispatches a custom "DOMContentSwitch" or uses location$.subscribe
  // We use the MutationObserver approach for reliability
  const contentEl = document.querySelector('[data-md-component="content"]');
  if (contentEl) {
    const observer = new MutationObserver(() => {
      // Small delay to let Material finish rendering
      setTimeout(initComponents, 50);
    });
    observer.observe(contentEl, { childList: true, subtree: false });
  }

  // Also hook into Material's navigation events if available
  if (typeof document$ !== "undefined") {
    document$.subscribe(() => setTimeout(initComponents, 50));
  }
})();
