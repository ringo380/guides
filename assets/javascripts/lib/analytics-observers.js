/* SPDX-License-Identifier: MIT */
/* Copyright (c) 2025-2026 Robworks Software LLC */

/**
 * Analytics Observers
 *
 * Page-level analytics that don't belong to a specific interactive component:
 * - Page dwell time (navigation / unload)
 * - Page visibility (tab switch)
 * - Search query & result click tracking
 * - Navigation tab & guide footer tracking
 * - Global JS error / promise rejection handlers
 *
 * Loaded after analytics.js in the interactive.js chain.
 */

(function () {
  "use strict";

  var analytics = window.RunbookAnalytics;
  if (!analytics) return;

  function isAvailable() {
    return typeof gtag === "function";
  }

  // ---------------------------------------------------------------
  // Page dwell time
  // ---------------------------------------------------------------
  var pageLoadTime = performance.now();

  function fireDwell() {
    if (!isAvailable()) return;
    var seconds = (performance.now() - pageLoadTime) / 1000;
    if (seconds < 2) return;
    analytics.trackTimed("page_dwell_time", seconds, {});
  }

  // Fires on Material instant navigation (content swap) and unload
  window.addEventListener("beforeunload", fireDwell);

  // ---------------------------------------------------------------
  // Page visibility (tab switch), debounced 500ms
  // ---------------------------------------------------------------
  var visTimer = null;

  document.addEventListener("visibilitychange", function () {
    clearTimeout(visTimer);
    visTimer = setTimeout(function () {
      if (!isAvailable()) return;
      analytics.track("page_visibility", {
        state: document.visibilityState,
      });
    }, 500);
  });

  // ---------------------------------------------------------------
  // Search tracking
  // ---------------------------------------------------------------
  var searchDebounce = null;

  // Search query (debounced 1.5s)
  document.addEventListener("input", function (e) {
    if (!e.target.classList.contains("md-search__input")) return;
    clearTimeout(searchDebounce);
    searchDebounce = setTimeout(function () {
      var query = e.target.value.trim();
      if (!query) return;
      analytics.track("search_query", { query: query });
    }, 1500);
  });

  // Search result click (event delegation)
  document.addEventListener("click", function (e) {
    var link = e.target.closest(".md-search-result__link");
    if (!link) return;
    analytics.track("search_result_click", {
      result_url: link.getAttribute("href") || "",
    });
  });

  // Search open (once per session)
  document.addEventListener(
    "focusin",
    function (e) {
      if (!e.target.classList.contains("md-search__input")) return;
      analytics.track("search_open", {}, { once: true });
    }
  );

  // ---------------------------------------------------------------
  // Navigation tab clicks
  // ---------------------------------------------------------------
  document.addEventListener("click", function (e) {
    var tab = e.target.closest(".md-tabs__link");
    if (!tab) return;
    analytics.track("nav_tab_click", {
      tab_text: (tab.textContent || "").trim(),
      tab_href: tab.getAttribute("href") || "",
    });
  });

  // ---------------------------------------------------------------
  // Guide prev / next / index footer navigation
  // ---------------------------------------------------------------
  document.addEventListener("click", function (e) {
    var link = e.target.closest("a");
    if (!link) return;
    var text = (link.textContent || "").trim();
    var direction = null;
    if (/^Previous:/i.test(text) || /\u00AB/.test(text)) {
      direction = "previous";
    } else if (/^Next:/i.test(text) || /\u00BB/.test(text)) {
      direction = "next";
    } else if (/Back to Index/i.test(text)) {
      direction = "index";
    }
    if (!direction) return;
    analytics.track("guide_navigation", {
      direction: direction,
      target_href: link.getAttribute("href") || "",
    });
  });

  // ---------------------------------------------------------------
  // Global JS error handler (our scripts only, once)
  // ---------------------------------------------------------------
  window.addEventListener(
    "error",
    function (e) {
      if (!e.filename || e.filename.indexOf("/assets/javascripts/") === -1) return;
      analytics.track(
        "js_error",
        {
          error_message: (e.message || "").substring(0, 100),
          error_source: (e.filename || "").substring(0, 100),
          error_line: e.lineno || 0,
        },
        { once: true }
      );
    }
  );

  // ---------------------------------------------------------------
  // Unhandled promise rejection (once)
  // ---------------------------------------------------------------
  window.addEventListener(
    "unhandledrejection",
    function (e) {
      var msg = "";
      if (e.reason instanceof Error) {
        msg = e.reason.message;
      } else if (typeof e.reason === "string") {
        msg = e.reason;
      }
      analytics.track(
        "js_promise_rejection",
        { error_message: (msg || "unknown").substring(0, 100) },
        { once: true }
      );
    }
  );

  // ---------------------------------------------------------------
  // Re-initialize on instant navigation (content swap)
  // ---------------------------------------------------------------
  var contentEl = document.querySelector('[data-md-component="content"]');
  if (contentEl) {
    var observer = new MutationObserver(function () {
      // Fire dwell for previous page, then reset
      fireDwell();
      pageLoadTime = performance.now();
    });
    observer.observe(contentEl, { childList: true, subtree: false });
  }
})();
