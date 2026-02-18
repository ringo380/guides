/* SPDX-License-Identifier: MIT */
/* Copyright (c) 2025-2026 Robworks Software LLC */

/**
 * Analytics wrapper for GA4 event tracking.
 *
 * Provides RunbookAnalytics.track(eventName, params, options) which:
 * - Guards against missing gtag (ad blockers, local dev)
 * - Auto-attaches page_path to all events
 * - Truncates string params to 100 chars (GA4 limit)
 * - Supports { once: true } for per-session deduplication
 * - Provides debounced tracking for high-frequency events
 */

(function () {
  "use strict";

  const fired = new Set();

  function isAvailable() {
    return typeof gtag === "function";
  }

  function pagePath() {
    return window.location.pathname;
  }

  function truncate(val, max) {
    if (typeof val === "string" && val.length > max) {
      return val.substring(0, max);
    }
    return val;
  }

  function sanitizeParams(params) {
    const clean = {};
    for (const [key, val] of Object.entries(params)) {
      clean[key] = truncate(val, 100);
    }
    return clean;
  }

  const RunbookAnalytics = {
    track(eventName, params, options) {
      if (!isAvailable()) return;

      const opts = options || {};
      const sanitized = sanitizeParams(params || {});
      sanitized.page_path = pagePath();

      if (opts.once) {
        const key = eventName + JSON.stringify(sanitized);
        if (fired.has(key)) return;
        fired.add(key);
      }

      gtag("event", eventName, sanitized);
    },

    /** Returns a debounced version of track(). */
    debounce(eventName, delay) {
      let timer = null;
      return function (params, options) {
        clearTimeout(timer);
        timer = setTimeout(() => {
          RunbookAnalytics.track(eventName, params, options);
        }, delay);
      };
    },
  };

  // --- Code block copy tracking ---
  // Material adds .md-clipboard buttons; listen via delegation.
  document.addEventListener("click", function (e) {
    const btn = e.target.closest(".md-clipboard");
    if (!btn) return;

    const codeBlock = btn.closest(".highlight");
    if (!codeBlock) return;

    // Detect language from the code element's class (e.g., "language-python")
    const codeEl = codeBlock.querySelector("code[class*='language-']");
    let language = "unknown";
    if (codeEl) {
      const match = codeEl.className.match(/language-(\S+)/);
      if (match) language = match[1];
    }

    RunbookAnalytics.track("code_copy", { code_language: language });
  });

  window.RunbookAnalytics = RunbookAnalytics;
})();
