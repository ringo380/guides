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

  // One live region for the whole page, present in the page shell from first
  // render and never removed or rebuilt. It replaces the blanket aria-live that
  // used to sit on #admin-root: a live region wrapping a subtree that gets
  // cleared and rebuilt announces the ENTIRE dashboard on every refresh - every
  // table, every number - instead of the one thing that changed. Same shape the
  // accounts page uses.
  var LIVE_ID = "admin-dashboard-status";

  function liveRegion(root) {
    var region = document.getElementById(LIVE_ID);
    if (region) return region;
    // Only reached if the shell markup lost the element. Created empty and
    // never populated in the same step: assistive tech watches a region it
    // already knows about for changes, so a region created already holding its
    // text may never be announced at all.
    region = el("p", { id: LIVE_ID, class: "sr-only", role: "status" });
    root.insertBefore(region, root.firstChild);
    return region;
  }

  var pendingAnnounce = null;

  /**
   * Announce one sentence for one load. Exactly one write per load: a second
   * announcing node reads the same thing twice.
   *
   * Assistive tech fires on a CHANGE to the region, so repeating a sentence
   * verbatim announces nothing - and a refresh that produces the same summary
   * is the common case here. An identical message is therefore cleared and
   * re-set in a later task; done synchronously the two writes coalesce back
   * into "no change" before the accessibility tree is read.
   */
  function announce(message) {
    var region = document.getElementById(LIVE_ID);
    if (!region) return;
    if (pendingAnnounce) {
      clearTimeout(pendingAnnounce);
      pendingAnnounce = null;
    }
    if (region.textContent !== message) {
      region.textContent = message;
      return;
    }
    region.textContent = "";
    pendingAnnounce = setTimeout(function () {
      pendingAnnounce = null;
      region.textContent = message;
    }, 0);
  }

  /**
   * The rebuilt part of the page, kept separate from the live region and the
   * status line so clearing it cannot take either of them with it. Rendering
   * straight into the root is what made the region impossible to keep.
   */
  function content(root) {
    var c = root.querySelector("#admin-content");
    if (c) return c;
    c = el("div", { id: "admin-content" });
    root.appendChild(c);
    return c;
  }

  function renderPayload(root, payload) {
    // Only the content container is cleared. root.textContent = "" took the
    // live region and the status line with it, which is why neither could
    // survive a refresh.
    var out = content(root);
    out.textContent = "";

    var freshness = payload.stale
      ? "Showing cached data, " + Math.round(payload.ageSeconds / 60) +
        " minutes old, because the live fetch failed."
      : "Live data as of " + payload.generatedAt + ".";
    out.appendChild(el("p", { class: "admin-freshness" }, freshness));
    out.appendChild(el("p", {}, "Range: " + payload.range));

    var ga4 = payload.ga4 || {};
    out.appendChild(el("h2", {}, "Traffic (" + ga4.population + ")"));
    if (ga4.error) {
      out.appendChild(
        el("p", { class: "admin-error" },
          "Google Analytics data is " + ga4.error + ". The figures below cover signed-in users only.")
      );
    } else {
      out.appendChild(table("Traffic totals", ["Metric", "Value"], [
        ["Active users", ga4.activeUsers],
        ["Sessions", ga4.sessions],
      ]));
      out.appendChild(table("Top pages by views", ["Page", "Views"],
        (ga4.topPages || []).map(function (p) { return [p.path, p.views]; })));
      out.appendChild(table("Event counts", ["Event", "Count"],
        Object.keys(ga4.events || {}).map(function (k) { return [k, ga4.events[k]]; })));
    }

    var pr = payload.progress || {};
    out.appendChild(el("h2", {}, "Progress (" + pr.population + ")"));
    out.appendChild(table("Registered users", ["Metric", "Value"], [
      ["Registered users", pr.registeredUsers],
    ]));
    out.appendChild(table(
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
    // Appended to the same container renderPayload wrote, never cleared: this
    // section is added after the overview has already rendered.
    var out = content(root);
    out.appendChild(el("h2", {}, "Traffic (all readers, first-party)"));

    if (!traffic || traffic.error) {
      out.appendChild(el("p", { class: "admin-error" },
        "First-party traffic is unavailable. The Google Analytics section above " +
        "covers consenting, non-blocking readers only."));
      return;
    }

    out.appendChild(el("p", {}, traffic.from + " to " + traffic.to + "."));

    var totals = traffic.totals || {};
    var perDay = totals.visitorsPerDay || {};
    out.appendChild(table("Traffic totals", ["Metric", "Value"], [
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
    out.appendChild(el("p", { class: "admin-note" },
      "There is no total visitor count for the whole range. Visitors are " +
      "identified per day and that identifier is discarded nightly, so the " +
      "same person cannot be recognised across two days. Page views add up; " +
      "visitors do not."));

    out.appendChild(table("Daily traffic", ["Day", "Visitors", "Page views", "Signed in"],
      (traffic.daily || []).map(function (d) {
        return [d.day, d.visitors, d.pageviews, d.signedIn];
      })));

    out.appendChild(table("Top pages by views", ["Page", "Topic", "Views"],
      (traffic.topPages || []).map(function (p) {
        return [p.path, p.topic || "", p.views];
      })));

    out.appendChild(table("Entry pages", ["Page", "Entries"],
      (traffic.topEntryPages || []).map(function (p) {
        return [p.path, p.entries];
      })));

    var referrers = traffic.topReferrers || [];
    out.appendChild(referrers.length
      ? table("Referrers", ["Source", "Views"],
          referrers.map(function (r) { return [r.host, r.views]; }))
      // An empty referrer table reads as broken collection. It usually means
      // readers arrived directly or the referrer was stripped, which is a
      // finding rather than a fault.
      : el("p", {}, "No external referrers recorded in this range. Readers " +
          "arrived directly, or their browser sent no referrer."));
  }

  /**
   * Report a page-level outcome. Uses the status line while it is still on the
   * page; once a successful render has removed it the message goes into the
   * content container instead, so the text always lands somewhere a reader can
   * reach it.
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
    var out = content(root);
    out.textContent = "";
    out.appendChild(el("p", { class: "admin-error" }, message));
    announce(message);
  }

  var inFlight = false;

  async function init() {
    var root = document.getElementById("admin-root");
    if (!root) return;
    if (inFlight) return;
    // Established before anything can have an outcome, and idempotent, so the
    // re-init that follows every runbook:auth-changed neither duplicates the
    // region nor makes it announce on its own.
    liveRegion(root);
    var status = document.getElementById("admin-status");

    // No RunbookAuth, or no client behind it, means the auth chain itself
    // failed to load. That is distinct from being signed out, which is
    // something the reader can act on.
    var client = window.RunbookAuth && window.RunbookAuth.getClient();
    if (!client) {
      fail(root, status,
        "Sign-in is unavailable right now. Reload the page to try again.");
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
      fail(root, status, "Sign in to view this page.");
      return;
    }

    var headers = { Authorization: "Bearer " + token };
    var health = await fetch(API + "/health", { headers });
    if (!health.ok) {
      fail(root, status, "Not authorized.");
      return;
    }

    var res = await fetch(API + "/overview?range=28d", { headers });
    if (!res.ok) {
      fail(root, status, "Failed to load dashboard data.");
      return;
    }
    var payload = await res.json();
    // Removed before the render, not after: it says "Checking authorization..."
    // and authorization is settled. Leaving it would sit a stale sentence above
    // live figures, and it is a role="status" node, so a later write to it
    // would announce alongside the persistent region.
    if (status && status.isConnected) status.remove();
    renderPayload(root, payload);

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

    // One sentence, once, after both sections exist. Announced here rather than
    // per section, because two announcements for one refresh is the same defect
    // as announcing the whole page, just smaller: the reader has to sit through
    // the first to hear the second.
    announce(summarize(payload, traffic));
  }

  /**
   * The whole refresh in one sentence: whether the figures are live, and
   * whether either half is missing. A reader who hears this knows whether to
   * trust the numbers without being read the numbers.
   */
  function summarize(payload, traffic) {
    var parts = [payload.stale
      ? "Dashboard updated with cached data, " +
        Math.round(payload.ageSeconds / 60) + " minutes old."
      : "Dashboard updated with live data."];
    if ((payload.ga4 || {}).error) parts.push("Google Analytics data is unavailable.");
    if (!traffic || traffic.error) parts.push("First-party traffic is unavailable.");
    return parts.join(" ");
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
