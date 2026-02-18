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
  };

  const loadedScripts = new Set();

  function loadScript(src) {
    if (loadedScripts.has(src)) {
      return Promise.resolve();
    }
    return new Promise((resolve, reject) => {
      const script = document.createElement("script");
      // Resolve relative to site root
      script.src = new URL(src, window.location.origin + "/guides/").href;
      script.onload = () => {
        loadedScripts.add(src);
        resolve();
      };
      script.onerror = () => reject(new Error(`Failed to load ${src}`));
      document.head.appendChild(script);
    });
  }

  function initComponents() {
    // Load storage first - components depend on window.RunbookStorage
    loadScript("assets/javascripts/lib/storage.js")
      .then(() => loadScript("assets/javascripts/lib/analytics.js"))
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
                  }
                });
              }
            })
            .catch((err) => console.error(`[Runbook]`, err));
        });

        // Always load progress tracker
        loadScript(COMPONENT_SCRIPTS.progress).catch(() => {});
      })
      .catch(() => {
        // Storage failed to load - initialize components without it
        console.warn("[Runbook] Storage unavailable, progress will not persist");
        loadScript("assets/javascripts/lib/analytics.js").catch(() => {});
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
                  }
                });
              }
            })
            .catch((err) => console.error(`[Runbook]`, err));
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
