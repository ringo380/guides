/* SPDX-License-Identifier: MIT */
/* Copyright (c) 2025-2026 Robworks Software LLC */

/**
 * Auth UI component - renders sign-in button or user avatar in the site header.
 *
 * Self-initializes (like progress.js and topic-cards.js).
 * Listens for "runbook:auth-changed" to update state.
 * The header persists across instant navigation, so this only initializes once.
 */

(function () {
  "use strict";

  var initialized = false;
  var container = null;
  var dropdownOpen = false;
  var outsideClickHandler = null;
  var escapeHandler = null;

  var GITHUB_ICON =
    '<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.013 8.013 0 0016 8c0-4.42-3.58-8-8-8z"/></svg>';

  function track(event, params) {
    if (window.RunbookAnalytics) window.RunbookAnalytics.track(event, params);
  }

  function removeDocumentListeners() {
    if (outsideClickHandler) {
      document.removeEventListener("click", outsideClickHandler);
      outsideClickHandler = null;
    }
    if (escapeHandler) {
      document.removeEventListener("keydown", escapeHandler);
      escapeHandler = null;
    }
  }

  function render(user) {
    if (!container) return;

    // Remove any existing document listeners before re-rendering
    removeDocumentListeners();

    container.innerHTML = "";

    if (!user) {
      // Signed out: show sign-in button
      var btn = document.createElement("button");
      btn.className = "runbook-auth__sign-in";
      btn.setAttribute("aria-label", "Sign in with GitHub");
      btn.innerHTML = GITHUB_ICON + " Sign in";
      btn.addEventListener("click", function () {
        track("auth_sign_in_click", {});
        if (window.RunbookAuth) window.RunbookAuth.signIn();
      });
      container.appendChild(btn);
    } else {
      // Signed in: show avatar with dropdown
      var avatarBtn = document.createElement("button");
      avatarBtn.className = "runbook-auth__user";
      avatarBtn.setAttribute("aria-label", "Account menu");
      avatarBtn.setAttribute("aria-expanded", "false");
      avatarBtn.setAttribute("aria-haspopup", "true");

      var img = document.createElement("img");
      img.className = "runbook-auth__avatar";
      img.src = user.user_metadata && user.user_metadata.avatar_url
        ? user.user_metadata.avatar_url
        : "";
      img.alt = user.user_metadata && user.user_metadata.user_name
        ? user.user_metadata.user_name
        : "User";
      img.width = 26;
      img.height = 26;
      avatarBtn.appendChild(img);

      var dropdown = document.createElement("div");
      dropdown.className = "runbook-auth__dropdown";
      dropdown.setAttribute("role", "menu");
      dropdown.id = "runbook-auth-dropdown";
      avatarBtn.setAttribute("aria-controls", "runbook-auth-dropdown");

      var nameDiv = document.createElement("div");
      nameDiv.className = "runbook-auth__dropdown-name";
      nameDiv.textContent =
        (user.user_metadata && user.user_metadata.user_name) ||
        user.email ||
        "Signed in";
      dropdown.appendChild(nameDiv);

      var signOutBtn = document.createElement("button");
      signOutBtn.className = "runbook-auth__sign-out";
      signOutBtn.setAttribute("role", "menuitem");
      signOutBtn.textContent = "Sign out";
      signOutBtn.addEventListener("click", function (e) {
        e.stopPropagation();
        closeDropdown(avatarBtn, dropdown);
        track("auth_sign_out_click", {});
        if (window.RunbookAuth) window.RunbookAuth.signOut();
      });
      dropdown.appendChild(signOutBtn);

      avatarBtn.addEventListener("click", function () {
        if (dropdownOpen) {
          closeDropdown(avatarBtn, dropdown);
        } else {
          openDropdown(avatarBtn, dropdown);
          track("auth_dropdown_open", {});
        }
      });

      container.appendChild(avatarBtn);
      container.appendChild(dropdown);

      // Close dropdown on outside click (stored for removal on re-render)
      outsideClickHandler = function (e) {
        if (!container.contains(e.target)) {
          closeDropdown(avatarBtn, dropdown);
        }
      };
      document.addEventListener("click", outsideClickHandler);

      // Close on Escape (stored for removal on re-render)
      escapeHandler = function (e) {
        if (e.key === "Escape" && dropdownOpen) {
          closeDropdown(avatarBtn, dropdown);
          avatarBtn.focus();
        }
      };
      document.addEventListener("keydown", escapeHandler);
    }
  }

  function openDropdown(btn, dropdown) {
    dropdownOpen = true;
    btn.setAttribute("aria-expanded", "true");
    dropdown.classList.add("runbook-auth__dropdown--open");
  }

  function closeDropdown(btn, dropdown) {
    dropdownOpen = false;
    btn.setAttribute("aria-expanded", "false");
    dropdown.classList.remove("runbook-auth__dropdown--open");
  }

  function init() {
    if (initialized) return;
    initialized = true;

    // Find the Material header nav to inject into
    var headerNav = document.querySelector(".md-header__inner.md-grid");
    if (!headerNav) return;

    container = document.createElement("div");
    container.className = "runbook-auth";
    container.setAttribute("role", "region");
    container.setAttribute("aria-label", "User authentication");

    // Insert before the repo/source link area or at the end of the nav
    var sourceEl = headerNav.querySelector(".md-header__source");
    if (sourceEl) {
      headerNav.insertBefore(container, sourceEl);
    } else {
      headerNav.appendChild(container);
    }

    // Render initial state
    var user = window.RunbookAuth ? window.RunbookAuth.getUser() : null;
    render(user);

    // Listen for auth changes
    document.addEventListener("runbook:auth-changed", function (e) {
      render(e.detail ? e.detail.user : null);
    });
  }

  // Self-initialize when loaded
  init();
})();
