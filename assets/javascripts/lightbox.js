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
  var lastTrigger = null;

  function createOverlay() {
    if (overlay) return;

    overlay = document.createElement("div");
    overlay.className = "lightbox-overlay";
    overlay.setAttribute("role", "dialog");
    overlay.setAttribute("aria-modal", "true");
    overlay.setAttribute("aria-label", "Enlarged image");

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

    // Keyboard handling: Escape to close, Tab focus trap
    document.addEventListener("keydown", function (e) {
      if (!overlay.classList.contains("active")) return;

      if (e.key === "Escape") {
        closeLightbox();
      } else if (e.key === "Tab") {
        // Focus trap: only focusable element is close button
        e.preventDefault();
        closeBtn.focus();
      }
    });
  }

  function openLightbox(src, alt, trigger) {
    createOverlay();
    lastTrigger = trigger || null;
    modalImg.src = src;
    modalImg.alt = alt || "";
    overlay.setAttribute("aria-label", alt ? "Enlarged image: " + alt : "Enlarged image");
    document.body.classList.add("lightbox-open");
    overlay.classList.add("active");
    closeBtn.focus();

    if (window.RunbookAnalytics) {
      var imagePath = src;
      try { imagePath = new URL(src, window.location.origin).pathname; } catch (e) {}
      window.RunbookAnalytics.track("lightbox_open", { image_src: imagePath });
    }
  }

  function closeLightbox() {
    if (!overlay) return;
    overlay.classList.remove("active");
    document.body.classList.remove("lightbox-open");

    if (window.RunbookAnalytics) {
      var closedPath = modalImg.src;
      try { closedPath = new URL(modalImg.src, window.location.origin).pathname; } catch (e) {}
      window.RunbookAnalytics.track("lightbox_close", { image_src: closedPath });
    }

    // Return focus to the element that opened the lightbox
    if (lastTrigger && lastTrigger.focus) {
      lastTrigger.focus();
      lastTrigger = null;
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
        if (img.dataset.noLightbox === "true") return;
        img.dataset.lightbox = "true";
        img.classList.add("lightbox-ready");
        img.setAttribute("tabindex", "0");
        img.setAttribute("role", "button");
        img.setAttribute("aria-label", (img.alt ? img.alt + " - " : "") + "Click to enlarge");

        img.addEventListener("click", function (e) {
          e.preventDefault();
          e.stopPropagation();
          openLightbox(resolvedSrc(img), img.alt, img);
        });

        img.addEventListener("keydown", function (e) {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            openLightbox(resolvedSrc(img), img.alt, img);
          }
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
