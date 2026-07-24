/* SPDX-License-Identifier: MIT */
/* Copyright (c) 2025-2026 Robworks Software LLC */

/**
 * Admin dashboard renderer.
 *
 * renderPayload() is pure DOM work with no fetch, so it is testable in jsdom.
 * Every metric is rendered as table text. Nothing exists only in a chart,
 * because a screen reader cannot voice a canvas.
 */
(function () {
  "use strict";

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
    headers.forEach(function (h) {
      hrow.appendChild(el("th", { scope: "col" }, h));
    });
    thead.appendChild(hrow);
    t.appendChild(thead);
    var tbody = el("tbody");
    rows.forEach(function (r) {
      var tr = el("tr");
      r.forEach(function (cell, i) {
        tr.appendChild(
          i === 0 ? el("th", { scope: "row" }, cell) : el("td", {}, cell)
        );
      });
      tbody.appendChild(tr);
    });
    t.appendChild(tbody);
    return t;
  }

  function renderPayload(root, payload) {
    root.textContent = "";

    var freshness = payload.stale
      ? "Showing cached data, " + Math.round(payload.ageSeconds / 60) +
        " minutes old, because the live fetch failed."
      : "Live data as of " + payload.generatedAt + ".";
    root.appendChild(el("p", { class: "admin-freshness" }, freshness));
    root.appendChild(el("p", {}, "Range: " + payload.range));

    var ga4 = payload.ga4 || {};
    root.appendChild(el("h2", {}, "Traffic (" + ga4.population + ")"));
    if (ga4.error) {
      root.appendChild(
        el("p", { class: "admin-error" },
          "Google Analytics data is " + ga4.error + ". The figures below cover signed-in users only.")
      );
    } else {
      root.appendChild(table("Traffic totals", ["Metric", "Value"], [
        ["Active users", ga4.activeUsers],
        ["Sessions", ga4.sessions],
      ]));
      root.appendChild(table("Top pages by views", ["Page", "Views"],
        (ga4.topPages || []).map(function (p) { return [p.path, p.views]; })));
      root.appendChild(table("Event counts", ["Event", "Count"],
        Object.keys(ga4.events || {}).map(function (k) { return [k, ga4.events[k]]; })));
    }

    var pr = payload.progress || {};
    root.appendChild(el("h2", {}, "Progress (" + pr.population + ")"));
    root.appendChild(table("Registered users", ["Metric", "Value"], [
      ["Registered users", pr.registeredUsers],
    ]));
    root.appendChild(table(
      "Per-guide progress",
      ["Guide", "Users", "Sections read", "Quizzes attempted", "Quizzes passed", "Exercises completed"],
      (pr.pages || []).map(function (p) {
        return [p.pageKey, p.usersWithProgress, p.sectionsRead,
                p.quizzesAttempted, p.quizzesPassed, p.exercisesCompleted];
      })
    ));
  }

  async function init() {
    var root = document.getElementById("admin-root");
    if (!root) return;
    var status = document.getElementById("admin-status");

    if (!window.RunbookAuth) {
      if (status) status.textContent = "Authentication unavailable.";
      return;
    }
    var session = await window.RunbookAuth.getClient().auth.getSession();
    var token = session.data.session && session.data.session.access_token;
    if (!token) {
      if (status) status.textContent = "Sign in to view this page.";
      return;
    }

    var headers = { Authorization: "Bearer " + token };
    var health = await fetch(API + "/health", { headers });
    if (!health.ok) {
      if (status) status.textContent = "Not authorized.";
      return;
    }

    var res = await fetch(API + "/overview?range=28d", { headers });
    if (!res.ok) {
      if (status) status.textContent = "Failed to load dashboard data.";
      return;
    }
    renderPayload(root, await res.json());
  }

  window.RunbookAdminDashboard = { renderPayload: renderPayload, init: init };

  if (document.getElementById("admin-root")) {
    document.addEventListener("runbook:auth-changed", init);
    init();
  }
})();
