/* SPDX-License-Identifier: MIT */
/* Copyright (c) 2025-2026 Robworks Software LLC */

/**
 * Lightbox Modal
 *
 * Auto-discovers images inside .diagram-container and .photo-frame,
 * adds click-to-enlarge behavior with a full-viewport modal overlay.
 *
 * Works with MkDocs Material's instant navigation by re-discovering
 * images on each page load via MutationObserver.
 */

(function () {
  "use strict";

  var overlay = null;
  var modalImg = null;
  var closeBtn = null;

  function createOverlay() {
    if (overlay) return;

    overlay = document.createElement("div");
    overlay.className = "lightbox-overlay";

    modalImg = document.createElement("img");
    modalImg.alt = "";

    closeBtn = document.createElement("button");
    closeBtn.className = "lightbox-close";
    closeBtn.setAttribute("aria-label", "Close lightbox");
    closeBtn.textContent = "\u00d7";

    overlay.appendChild(modalImg);
    overlay.appendChild(closeBtn);
    document.body.appendChild(overlay);

    // Close on backdrop click
    overlay.addEventListener("click", function (e) {
      if (e.target === overlay) {
        closeLightbox();
      }
    });

    // Close on button click
    closeBtn.addEventListener("click", function (e) {
      e.stopPropagation();
      closeLightbox();
    });

    // Close on Escape
    document.addEventListener("keydown", function (e) {
      if (e.key === "Escape" && overlay.classList.contains("active")) {
        closeLightbox();
      }
    });
  }

  function openLightbox(src, alt) {
    createOverlay();
    modalImg.src = src;
    modalImg.alt = alt || "";
    document.body.classList.add("lightbox-open");
    overlay.classList.add("active");
    closeBtn.focus();

    if (window.RunbookAnalytics) {
      window.RunbookAnalytics.track("lightbox_open", { image_src: src });
    }
  }

  function closeLightbox() {
    if (!overlay) return;
    overlay.classList.remove("active");
    document.body.classList.remove("lightbox-open");

    if (window.RunbookAnalytics) {
      window.RunbookAnalytics.track("lightbox_close", {
        image_src: modalImg.src,
      });
    }
  }

  /**
   * Resolves the currently-displayed source for an <img>,
   * accounting for <picture> elements with dark/light sources.
   */
  function resolvedSrc(img) {
    if (img.currentSrc) return img.currentSrc;
    return img.src;
  }

  function discoverImages() {
    var containers = document.querySelectorAll(
      ".diagram-container, .photo-frame"
    );

    containers.forEach(function (container) {
      var imgs = container.querySelectorAll("img");
      imgs.forEach(function (img) {
        if (img.dataset.lightbox === "true") return;
        img.dataset.lightbox = "true";
        img.classList.add("lightbox-ready");

        img.addEventListener("click", function (e) {
          e.preventDefault();
          e.stopPropagation();
          openLightbox(resolvedSrc(img), img.alt);
        });
      });
    });
  }

  // Initialize on first page load
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", discoverImages);
  } else {
    discoverImages();
  }

  // Re-discover on MkDocs Material instant navigation
  var contentEl = document.querySelector('[data-md-component="content"]');
  if (contentEl) {
    var observer = new MutationObserver(function () {
      setTimeout(discoverImages, 50);
    });
    observer.observe(contentEl, { childList: true, subtree: false });
  }

  // Also hook into Material's navigation events if available
  if (typeof document$ !== "undefined") {
    document$.subscribe(function () {
      setTimeout(discoverImages, 50);
    });
  }
})();
