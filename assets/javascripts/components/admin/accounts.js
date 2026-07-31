/* SPDX-License-Identifier: MIT */
/* Copyright (c) 2025-2026 Robworks Software LLC */

/**
 * Admin account management.
 *
 * renderUser() and renderRoster() are pure DOM work with no fetch, so they are
 * testable in jsdom. Every field is table text, never a chart, because a screen
 * reader cannot voice a canvas.
 */
(function () {
  "use strict";

  if (window.RunbookAdminAccounts) return;

  var API = "https://smulobzymizulakvaito.supabase.co/functions/v1/admin-api";

  function el(tag, attrs, text) {
    var node = document.createElement(tag);
    Object.keys(attrs || {}).forEach(function (k) {
      node.setAttribute(k, attrs[k]);
    });
    if (text !== undefined) node.textContent = String(text);
    return node;
  }

  function table(caption, headers, rows) {
    var t = el("table", { class: "admin-table" });
    t.appendChild(el("caption", {}, caption));
    var thead = el("thead");
    var hrow = el("tr");
    headers.forEach(function (h) { hrow.appendChild(el("th", { scope: "col" }, h)); });
    thead.appendChild(hrow);
    t.appendChild(thead);
    var tbody = el("tbody");
    rows.forEach(function (r) {
      var tr = el("tr");
      r.forEach(function (cell, i) {
        tr.appendChild(i === 0 ? el("th", { scope: "row" }, cell) : el("td", {}, cell));
      });
      tbody.appendChild(tr);
    });
    t.appendChild(tbody);
    return t;
  }

  // One live region for the whole page, present in the page shell from first
  // render and never removed or rebuilt. A region that is created already
  // holding its text may never be announced at all: assistive tech watches a
  // region it already knows about for changes, so the region has to be in the
  // DOM before the text lands in it. Every outcome of a submit therefore writes
  // its sentence here instead of shipping a fresh role="status" node.
  var LIVE_ID = "admin-lookup-status";

  function liveRegion(root) {
    var region = document.getElementById(LIVE_ID);
    if (region) return region;
    // Only reached if the shell markup lost the element. Created empty and
    // never populated in the same step, for the reason above.
    region = el("p", { id: LIVE_ID, class: "sr-only", role: "status" });
    root.insertBefore(region, root.firstChild);
    return region;
  }

  /**
   * Announce one sentence for one user action. Exactly one write per action:
   * writing the same text into a second role="status" node reads it twice.
   */
  function announce(message) {
    var region = document.getElementById(LIVE_ID);
    if (region) region.textContent = message;
  }

  /**
   * Send focus to the answer a submit produced, so a keyboard or screen-reader
   * user lands on it instead of hunting for it below the roster table. Only
   * ever called in response to a submit, never on load.
   */
  function focusResult(root, id) {
    var s = root.querySelector("#" + id);
    if (!s || typeof s.focus !== "function") return;
    s.setAttribute("tabindex", "-1");
    s.focus();
  }

  function section(root, id) {
    var existing = root.querySelector("#" + id);
    if (existing) existing.remove();
    var s = el("section", { id: id });
    root.appendChild(s);
    return s;
  }

  function renderUser(root, payload) {
    var s = section(root, "admin-user-result");
    if (!payload || !payload.user) {
      s.appendChild(el("p", { class: "admin-error" },
        "No matching account. The address must match exactly - partial " +
        "addresses and wildcards are rejected rather than guessed at."));
      return;
    }

    var u = payload.user;
    s.appendChild(el("h3", {}, "Account"));
    s.appendChild(table("Account", ["Field", "Value"], [
      ["Email", u.email || "(none)"],
      ["User id", u.id],
      ["Created", u.createdAt || "(unknown)"],
      ["Last sign-in", u.lastSignInAt || "(never)"],
    ]));

    if (!payload.progress) {
      s.appendChild(el("p", {}, "No progress recorded for this account."));
    } else {
      s.appendChild(table("Progress", ["Field", "Value"], [
        ["Pages with progress", payload.progress.pageCount],
        ["Last updated", payload.progress.updatedAt],
      ]));
    }

    var warnId = "admin-reset-warning";
    s.appendChild(el("p", { id: warnId, class: "admin-note" },
      "Resetting deletes this account's progress permanently. There is no " +
      "undo: the site keeps no snapshots. The account itself is not deleted."));

    // Inline confirmation rather than window.prompt(). A native prompt cannot
    // carry aria-describedby, cannot be styled, is invisible to the jsdom
    // tests, and blocks any headless check of this path.
    var confirmId = "admin-reset-confirm";
    var form = el("form", { class: "admin-reset-form" });
    form.appendChild(el("label", { for: confirmId },
      "Type this account's email address to confirm"));
    var input = el("input", {
      id: confirmId,
      type: "text",
      autocomplete: "off",
      "aria-describedby": warnId,
    });
    form.appendChild(input);
    form.appendChild(el("button", {
      type: "submit",
      class: "admin-destructive",
      "data-action": "reset-progress",
      "data-user-id": u.id,
      "aria-describedby": warnId,
    }, "Reset this account's progress"));
    s.appendChild(form);
  }

  function renderRoster(root, payload) {
    var s = section(root, "admin-roster");
    s.appendChild(el("h3", {}, "Admins"));

    var admins = (payload && payload.admins) || [];
    if (!admins.length) {
      // The last-admin trigger makes this impossible. If it renders, the guard
      // is not doing its job, and an empty table would read as "loading".
      s.appendChild(el("p", { class: "admin-error" },
        "The roster reports no admins. That should be impossible while the " +
        "last-admin guard is in place - check the trigger before granting."));
      return;
    }

    s.appendChild(table("Current admins",
      ["Email", "User id", "Note", "Granted"],
      admins.map(function (a) {
        return [a.email || "(unknown)", a.userId, a.note || "", a.createdAt];
      })));
  }

  async function authedFetch(path, options) {
    var client = window.RunbookAuth && window.RunbookAuth.getClient();
    if (!client) throw new Error("auth unavailable");
    var session = await client.auth.getSession();
    var token = session.data.session && session.data.session.access_token;
    if (!token) throw new Error("signed out");
    var opts = options || {};
    opts.headers = Object.assign({
      Authorization: "Bearer " + token,
      "Content-Type": "application/json",
    }, opts.headers || {});
    return fetch(API + path, opts);
  }

  var inFlight = false;

  // renderLookupForm() runs on every init(), and init() re-runs on every
  // runbook:auth-changed event (a sign-out followed by a sign-in needs no
  // navigation). The reset handler is bound to root, which survives across
  // calls, so without this the listener count grows by one each time and a
  // single submit fires the reset request - and its audit write - once per
  // accumulated listener. Store the reference and remove it before re-adding.
  var resetSubmitHandler = null;

  async function init() {
    var root = document.getElementById("admin-accounts-root");
    if (!root) return;
    if (inFlight) return;
    // Established before anything can have an outcome, and idempotent, so the
    // re-init that follows every runbook:auth-changed neither duplicates the
    // region nor makes it announce on its own.
    liveRegion(root);
    var status = document.getElementById("admin-accounts-status");

    var client = window.RunbookAuth && window.RunbookAuth.getClient();
    if (!client) {
      if (status) {
        status.textContent =
          "Sign-in is unavailable right now. Reload the page to try again.";
      }
      return;
    }

    inFlight = true;
    try {
      // Checked before the fetch, and separately from a failed request: an
      // expired session and an unreachable API are different problems, and
      // "signed out" is the one the reader can act on. Same wording as the
      // dashboard page, which handles this already.
      var session = await client.auth.getSession();
      var token = session.data.session && session.data.session.access_token;
      if (!token) {
        if (status) status.textContent = "Sign in to view this page.";
        return;
      }

      var health = await authedFetch("/health", { method: "GET" });
      if (!health.ok) {
        if (status) status.textContent = "Not authorized.";
        return;
      }
      if (status) status.remove();
      renderLookupForm(root);

      // Roster failure is confined to its own section: it must not blank a
      // lookup the admin is in the middle of reading.
      try {
        var res = await authedFetch("/admins", { method: "GET" });
        renderRoster(root, res.ok ? await res.json() : { admins: [] });
      } catch (e) {
        renderRoster(root, { admins: [] });
      }
    } catch (e) {
      // Without this the rejection escapes as an unhandled promise rejection
      // and the page sits on "Checking authorization..." forever, which gives
      // a screen reader nothing to act on.
      fail(root, status,
        "Could not reach the admin service. Check your connection and " +
        "reload the page.");
    } finally {
      inFlight = false;
    }
  }

  /**
   * Report a page-level failure. Uses the status line while it is still on the
   * page; once it has been removed the message goes into its own section, so
   * the text always lands somewhere a reader can reach it.
   *
   * The status line is itself a live region in the page shell, so writing to it
   * announces. Once it is gone the announcement goes through the persistent
   * region instead - never both, or the message is read twice.
   */
  function fail(root, status, message) {
    if (status && status.isConnected) {
      status.textContent = message;
      return;
    }
    var s = section(root, "admin-accounts-error");
    s.appendChild(el("p", { class: "admin-error" }, message));
    announce(message);
  }

  /**
   * The server's own explanation for a refused request, or a fallback naming
   * the status. A 500 from the platform is plain text rather than JSON, so
   * json() rejecting is expected and must not lose the message entirely.
   */
  async function serverError(res, fallback) {
    var detail = "";
    try {
      var body = await res.json();
      if (body && typeof body.error === "string") detail = body.error;
    } catch (e) {
      detail = "";
    }
    return detail || fallback + " The server answered " + res.status + ".";
  }

  /**
   * Replace one section with a single message. The announcement is the caller's
   * job, through the persistent live region: a role="status" on this node would
   * be a second live region built already holding its text, which is both
   * unreliable and, when it does fire, a duplicate reading.
   */
  function sectionMessage(root, id, message) {
    var s = section(root, id);
    s.appendChild(el("p", { class: "admin-error" }, message));
  }

  function renderLookupForm(root) {
    var s = section(root, "admin-lookup");
    s.appendChild(el("h3", {}, "Find an account"));

    var form = el("form", { id: "admin-lookup-form" });
    var label = el("label", { for: "admin-lookup-input" },
      "Full email address or user id");
    var input = el("input", {
      id: "admin-lookup-input",
      type: "text",
      autocomplete: "off",
      placeholder: "someone@example.com",
    });
    var submit = el("button", { type: "submit" }, "Look up");
    form.appendChild(label);
    form.appendChild(input);
    form.appendChild(submit);
    s.appendChild(form);

    form.addEventListener("submit", async function (ev) {
      ev.preventDefault();
      var v = input.value.trim();
      if (!v) return;
      var key = v.indexOf("@") === -1 ? "id" : "email";
      try {
        var res = await authedFetch(
          "/user?" + key + "=" + encodeURIComponent(v), { method: "GET" });
        if (res.ok) {
          var payload = await res.json();
          renderUser(root, payload);
          var u = (payload && payload.user) || {};
          announce("Account found for " + (u.email || u.id || "that query") + ".");
        } else if (res.status === 404) {
          // Only a 404 means the address was searched and matched nothing.
          renderUser(root, null);
          // The most common outcome of this page, and the one that used to be
          // announced to nobody.
          announce("No matching account. The address must match exactly.");
        } else {
          // Every other status has its own reason, and the server states it.
          // Collapsing them all into "no matching account" reintroduces, in the
          // UI, the false negative the server was fixed not to produce: a 409
          // means the address could not be resolved safely, not that it is
          // absent.
          var refused = await serverError(res, "The lookup was not completed.");
          sectionMessage(root, "admin-user-result", refused);
          announce(refused);
        }
      } catch (e) {
        // "No matching account" and "the request never left the browser" are
        // different answers. Saying the first when the second happened invites
        // a retry of whatever comes next, including the destructive part.
        var unsent = "The lookup request could not be sent. Nothing was " +
          "searched - check your connection and try again.";
        sectionMessage(root, "admin-user-result", unsent);
        announce(unsent);
      }
      // Every path above leaves a result section behind, including the ones
      // that failed. Landing on it is the difference between reading the answer
      // and hunting for it below the roster table.
      focusResult(root, "admin-user-result");
    });

    if (resetSubmitHandler) root.removeEventListener("submit", resetSubmitHandler);
    resetSubmitHandler = async function (ev) {
      var btn = ev.target.querySelector
        && ev.target.querySelector("[data-action='reset-progress']");
      if (!btn) return;
      ev.preventDefault();
      var id = btn.getAttribute("data-user-id");
      var field = ev.target.querySelector("input");
      var typed = (field && field.value.trim()) || "";
      if (!typed) return;
      // The typed address IS the confirmation. The server independently
      // requires the id and the email to belong to the same account, so this
      // field is the input to that check, not a second check layered on top.
      try {
        var res = await authedFetch("/user/progress/reset", {
          method: "POST",
          body: JSON.stringify({ userId: id, confirmEmail: typed }),
        });
        // Same reason as the lookup: the server states why it refused, and
        // "the address must match" is only one of the reasons it might have.
        var message = res.ok ? "Progress reset." : "Reset refused: " +
          await serverError(res, "Nothing was deleted.");
        var out = section(root, "admin-reset-result");
        out.appendChild(el(
          "p",
          { class: res.ok ? "admin-note" : "admin-error" },
          message,
        ));
        announce(message);
      } catch (e) {
        // A silent failure on a destructive action is the worst case: the
        // admin cannot tell a refusal from a request that never left, and the
        // natural response to that ambiguity is to try the delete again.
        var unsent = "The reset request could not be sent. Nothing was " +
          "deleted - look the account up again before retrying.";
        sectionMessage(root, "admin-reset-result", unsent);
        announce(unsent);
      }
      focusResult(root, "admin-reset-result");
    };
    root.addEventListener("submit", resetSubmitHandler);
  }

  window.RunbookAdminAccounts = {
    renderUser: renderUser,
    renderRoster: renderRoster,
    init: init,
  };

  if (document.getElementById("admin-accounts-root")) {
    document.addEventListener("runbook:auth-changed", init);
    init();
  }
})();
