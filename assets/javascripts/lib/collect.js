/* SPDX-License-Identifier: MIT */
/* Copyright (c) 2025-2026 Robworks Software LLC */

/**
 * First-party analytics beacon.
 *
 * The filename matters. lib/analytics.js matches common ad-blocker filter
 * rules for "/analytics.js" and is blocked outright for a large share of
 * readers - that is what caused #161, and it is half the reason the GA4
 * property is empty. This file is deliberately not named analytics.js, does
 * not talk to any third-party host, and sends to the site's own Supabase
 * project.
 *
 * Contract: never throws into component code, never blocks rendering, and a
 * dead endpoint is survivable and silent. Measurement is not worth breaking a
 * page over.
 *
 * Nothing is written to the visitor's device. No cookie, no localStorage, no
 * identifier of any kind. The visitor hash is derived server-side from IP and
 * user agent under a salt that is discarded daily, so this needs no consent
 * gate - there is nothing stored to consent to.
 */
(function () {
  "use strict";

  var ENDPOINT =
    "https://smulobzymizulakvaito.supabase.co/functions/v1/collect";

  // Events this beacon will forward. Mirrors the ingest allowlist; anything
  // else is rejected server-side anyway, so sending it would be pure waste.
  var ALLOWED = {
    page_view: 1, topic_page_view: 1, section_read: 1,
    page_progress_milestone: 1, guide_navigation: 1,
    quiz_start: 1, quiz_answer: 1, quiz_retry: 1,
    exercise_start: 1, exercise_hint: 1, exercise_solution_view: 1,
    exercise_complete: 1,
    terminal_start: 1, terminal_step: 1, terminal_complete: 1,
    walkthrough_start: 1, walkthrough_step: 1, walkthrough_complete: 1,
    command_builder_reset: 1, command_copy: 1, code_copy: 1,
    search_query: 1, search_result_click: 1
  };

  var MAX_PROPS = 8;

  /**
   * Trim props to scalars. The server bounds these too, but sending less is
   * cheaper and keeps a component's internal object out of the request even
   * when it would have been discarded on arrival.
   */
  function cleanProps(props) {
    var out = {};
    if (!props || typeof props !== "object") return out;
    var keys = Object.keys(props).slice(0, MAX_PROPS);
    for (var i = 0; i < keys.length; i++) {
      var v = props[keys[i]];
      var t = typeof v;
      if (t === "string") out[keys[i]] = v.slice(0, 200);
      else if (t === "boolean") out[keys[i]] = v;
      else if (t === "number" && isFinite(v)) out[keys[i]] = v;
    }
    return out;
  }

  function post(payload) {
    var body = JSON.stringify(payload);
    try {
      // text/plain keeps this a CORS "simple request", so there is no
      // preflight. A preflight would double the requests per page view and
      // give a blocker a second thing to catch.
      if (navigator.sendBeacon) {
        var blob = new Blob([body], { type: "text/plain;charset=UTF-8" });
        if (navigator.sendBeacon(ENDPOINT, blob)) return;
      }
    } catch (e) {
      // sendBeacon throws in some hardened configurations. Fall through.
    }
    try {
      fetch(ENDPOINT, {
        method: "POST",
        body: body,
        headers: { "Content-Type": "text/plain;charset=UTF-8" },
        // The request must outlive a page that is being navigated away from.
        keepalive: true,
        mode: "cors",
        credentials: "omit"
      }).catch(function () {
        // Blocked, offline, or the function is down. Not the reader's problem.
      });
    } catch (e) {
      // Nothing left to try, and nothing worth surfacing.
    }
  }

  function send(eventName, props) {
    try {
      if (!ALLOWED[eventName]) return;
      post({
        event: eventName,
        path: location.pathname,
        referrer: document.referrer || "",
        props: cleanProps(props)
      });
    } catch (e) {
      // send() is called from inside component handlers. It must not be able
      // to break one.
    }
  }

  // Material's instant navigation fires the page-load hooks more than once for
  // a single navigation (a MutationObserver and document$ both land). Without
  // this, every page view would be counted two or three times - and an
  // inflated number is worse than no number, because it looks plausible.
  var lastPath = null;
  var lastAt = 0;
  var DEDUPE_MS = 1000;

  function pageView() {
    try {
      var path = location.pathname;
      var now = Date.now();
      if (path === lastPath && now - lastAt < DEDUPE_MS) return;
      lastPath = path;
      lastAt = now;
      send("page_view", {});
    } catch (e) {
      /* never throw from a navigation hook */
    }
  }

  /**
   * Mirror the events components already emit to RunbookAnalytics, so phase 1
   * collects engagement data without editing every component.
   *
   * If analytics.js was blocked there is nothing to wrap, and page views still
   * flow - which is the whole point of keeping these two files independent.
   */
  function mirrorAnalytics() {
    try {
      var ra = window.RunbookAnalytics;
      if (!ra || typeof ra.track !== "function" || ra.__collectWrapped) return;
      var original = ra.track.bind(ra);
      ra.track = function (name, params) {
        try {
          send(name, params);
        } catch (e) {
          /* mirroring must never break the original call */
        }
        return original(name, params);
      };
      ra.__collectWrapped = true;
    } catch (e) {
      /* leave analytics exactly as it was */
    }
  }

  window.RunbookCollect = {
    send: send,
    pageView: pageView,
    _cleanProps: cleanProps
  };

  mirrorAnalytics();
  pageView();

  if (typeof document$ !== "undefined" && document$ && document$.subscribe) {
    document$.subscribe(function () {
      mirrorAnalytics();
      pageView();
    });
  }
})();
