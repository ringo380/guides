/* SPDX-License-Identifier: MIT */
/* Copyright (c) 2025-2026 Robworks Software LLC */

/**
 * Analytics Journey Tracking
 *
 * Records page visits, tracks guide sequence position within topics,
 * detects topic completion, and maintains a capped navigation path.
 *
 * Uses window.RunbookTopics from topics.js and RunbookAnalytics from
 * analytics.js. Data is stored under the `runbook_journey` localStorage
 * key (separate from `runbook_progress`).
 *
 * Loaded after topics.js in the interactive.js chain.
 */

(function () {
  "use strict";

  var analytics = window.RunbookAnalytics;
  var TOPICS = window.RunbookTopics;
  if (!analytics || !TOPICS) return;

  var STORAGE_KEY = "runbook_journey";
  var MAX_PATH_ENTRIES = 20;

  // -------------------------------------------------------------------
  // localStorage helpers
  // -------------------------------------------------------------------
  function loadJourney() {
    try {
      var raw = localStorage.getItem(STORAGE_KEY);
      if (raw) return JSON.parse(raw);
    } catch (_) {
      // Corrupted or unavailable – start fresh
    }
    return { visited: {}, path: [], completed_topics: [] };
  }

  function saveJourney(data) {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    } catch (_) {
      // Storage full or unavailable – silent fail
    }
  }

  // -------------------------------------------------------------------
  // Identify current guide from the URL path
  // -------------------------------------------------------------------
  function identifyGuide() {
    var path = window.location.pathname;

    for (var topicName in TOPICS) {
      if (!TOPICS.hasOwnProperty(topicName)) continue;
      var info = TOPICS[topicName];
      var guides = info.guides;

      for (var i = 0; i < guides.length; i++) {
        // Match /TopicPrefix/guide-slug/ in the URL
        if (path.indexOf(info.prefix + guides[i]) !== -1) {
          return {
            topic: topicName,
            slug: guides[i],
            index: i,
            total: guides.length,
          };
        }
      }
    }
    return null;
  }

  // -------------------------------------------------------------------
  // Core tracking logic
  // -------------------------------------------------------------------
  function trackPage() {
    var journey = loadJourney();
    var pagePath = window.location.pathname;
    var guide = identifyGuide();

    // 1. Record navigation path (capped at MAX_PATH_ENTRIES)
    journey.path.push({ path: pagePath, ts: Date.now() });
    if (journey.path.length > MAX_PATH_ENTRIES) {
      journey.path = journey.path.slice(-MAX_PATH_ENTRIES);
    }

    if (!guide) {
      saveJourney(journey);
      return;
    }

    var visitKey = guide.topic + "/" + guide.slug;

    // 2. Track guide sequence position (first visit only)
    if (!journey.visited[visitKey]) {
      journey.visited[visitKey] = Date.now();

      analytics.track(
        "guide_sequence",
        {
          topic: guide.topic,
          guide_slug: guide.slug,
          guide_index: guide.index + 1,
          guides_total: guide.total,
        },
        { once: true }
      );
    }

    // 3. Check topic completion
    if (journey.completed_topics.indexOf(guide.topic) === -1) {
      var topicGuides = TOPICS[guide.topic].guides;
      var allVisited = true;
      for (var j = 0; j < topicGuides.length; j++) {
        var key = guide.topic + "/" + topicGuides[j];
        if (!journey.visited[key]) {
          allVisited = false;
          break;
        }
      }

      if (allVisited) {
        journey.completed_topics.push(guide.topic);
        analytics.track(
          "topic_complete",
          {
            topic: guide.topic,
            guides_total: guide.total,
          },
          { once: true }
        );
      }
    }

    saveJourney(journey);
  }

  // -------------------------------------------------------------------
  // Initialize and re-initialize on instant navigation
  // -------------------------------------------------------------------
  trackPage();

  var contentEl = document.querySelector('[data-md-component="content"]');
  if (contentEl) {
    var observer = new MutationObserver(function () {
      setTimeout(trackPage, 100);
    });
    observer.observe(contentEl, { childList: true, subtree: false });
  }
})();
