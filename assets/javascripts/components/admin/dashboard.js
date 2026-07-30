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

  /**
   * First-party traffic. Rendered as its own section, never merged into the
   * GA4 tables above.
   *
   * The two measure different populations - GA4 sees only readers who accepted
   * consent and are not blocking it, this sees everyone - so the numbers will
   * disagree, sometimes by a lot. A single combined table would imply they are
   * the same quantity measured twice, which is a worse error than showing two
   * sections and saying what each one covers.
   */
  function renderTraffic(root, traffic) {
    root.appendChild(el("h2", {}, "Traffic (all readers, first-party)"));

    if (!traffic || traffic.error) {
      root.appendChild(el("p", { class: "admin-error" },
        "First-party traffic is unavailable. The Google Analytics section above " +
        "covers consenting, non-blocking readers only."));
      return;
    }

    root.appendChild(el("p", {}, traffic.from + " to " + traffic.to + "."));

    var totals = traffic.totals || {};
    var perDay = totals.visitorsPerDay || {};
    root.appendChild(table("Traffic totals", ["Metric", "Value"], [
      ["Page views", totals.pageviews],
      ["Visitors per day (average)", perDay.avg],
      ["Visitors per day (busiest day)", perDay.peak],
      ["Days with any traffic", totals.daysWithTraffic],
    ]));

    // There is deliberately no "unique visitors this month" row. Visitor
    // identity is salted per day and the salt is discarded, so no such number
    // exists to report - summing the daily column would count one person once
    // per day they visited. Saying so beats leaving a reader to assume the
    // omission is an oversight.
    root.appendChild(el("p", { class: "admin-note" },
      "There is no total visitor count for the whole range. Visitors are " +
      "identified per day and that identifier is discarded nightly, so the " +
      "same person cannot be recognised across two days. Page views add up; " +
      "visitors do not."));

    root.appendChild(table("Daily traffic", ["Day", "Visitors", "Page views", "Signed in"],
      (traffic.daily || []).map(function (d) {
        return [d.day, d.visitors, d.pageviews, d.signedIn];
      })));

    root.appendChild(table("Top pages by views", ["Page", "Topic", "Views"],
      (traffic.topPages || []).map(function (p) {
        return [p.path, p.topic || "", p.views];
      })));

    root.appendChild(table("Entry pages", ["Page", "Entries"],
      (traffic.topEntryPages || []).map(function (p) {
        return [p.path, p.entries];
      })));

    var referrers = traffic.topReferrers || [];
    root.appendChild(referrers.length
      ? table("Referrers", ["Source", "Views"],
          referrers.map(function (r) { return [r.host, r.views]; }))
      // An empty referrer table reads as broken collection. It usually means
      // readers arrived directly or the referrer was stripped, which is a
      // finding rather than a fault.
      : el("p", {}, "No external referrers recorded in this range. Readers " +
          "arrived directly, or their browser sent no referrer."));
  }

  var inFlight = false;

  async function init() {
    var root = document.getElementById("admin-root");
    if (!root) return;
    if (inFlight) return;
    var status = document.getElementById("admin-status");

    // No RunbookAuth, or no client behind it, means the auth chain itself
    // failed to load. That is distinct from being signed out, which is
    // something the reader can act on.
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
      await load(root, status, client);
    } finally {
      inFlight = false;
    }
  }

  async function load(root, status, client) {
    var session = await client.auth.getSession();
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

    // Fetched after the overview has already rendered, and failure is confined
    // to its own section: first-party traffic is the newest and least proven
    // part of this page, and it must not be able to blank the metrics that
    // were already working.
    var traffic = null;
    try {
      var tres = await fetch(API + "/traffic?range=28d", { headers });
      if (tres.ok) traffic = await tres.json();
    } catch (e) {
      traffic = null;
    }
    renderTraffic(root, traffic);
  }

  window.RunbookAdminDashboard = {
    renderPayload: renderPayload,
    renderTraffic: renderTraffic,
    init: init,
  };

  if (document.getElementById("admin-root")) {
    document.addEventListener("runbook:auth-changed", init);
    init();
  }
})();
