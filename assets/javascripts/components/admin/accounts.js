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
   */
  function fail(root, status, message) {
    if (status && status.isConnected) {
      status.textContent = message;
      return;
    }
    var s = section(root, "admin-accounts-error");
    s.appendChild(el("p", { class: "admin-error", role: "status" }, message));
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

  /** Replace one section with a single announced message. */
  function sectionMessage(root, id, message) {
    var s = section(root, id);
    s.appendChild(el("p", { class: "admin-error", role: "status" }, message));
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
          renderUser(root, await res.json());
        } else if (res.status === 404) {
          // Only a 404 means the address was searched and matched nothing.
          renderUser(root, null);
        } else {
          // Every other status has its own reason, and the server states it.
          // Collapsing them all into "no matching account" reintroduces, in the
          // UI, the false negative the server was fixed not to produce: a 409
          // means the address could not be resolved safely, not that it is
          // absent.
          sectionMessage(root, "admin-user-result",
            await serverError(res, "The lookup was not completed."));
        }
      } catch (e) {
        // "No matching account" and "the request never left the browser" are
        // different answers. Saying the first when the second happened invites
        // a retry of whatever comes next, including the destructive part.
        sectionMessage(root, "admin-user-result",
          "The lookup request could not be sent. Nothing was searched - " +
          "check your connection and try again.");
      }
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
          { class: res.ok ? "admin-note" : "admin-error", role: "status" },
          message,
        ));
      } catch (e) {
        // A silent failure on a destructive action is the worst case: the
        // admin cannot tell a refusal from a request that never left, and the
        // natural response to that ambiguity is to try the delete again.
        sectionMessage(root, "admin-reset-result",
          "The reset request could not be sent. Nothing was deleted - look " +
          "the account up again before retrying.");
      }
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
