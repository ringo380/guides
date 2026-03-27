/* SPDX-License-Identifier: MIT */
/* Copyright (c) 2025-2026 Robworks Software LLC */

/**
 * Topic Cards Component
 *
 * Enhances topic README progression cards with completion status
 * from RunbookStorage. Adds visual checkmarks to completed guides.
 */

(function () {
  "use strict";

  function initTopicCards() {
    var storage = window.RunbookStorage;
    if (!storage) return;

    var cards = document.querySelectorAll(".topic-card[data-guide]");
    if (cards.length === 0) return;

    var allProgress = storage.getAllProgress();

    cards.forEach(function (card) {
      var guide = card.dataset.guide;
      var topic = card.dataset.topic;
      if (!guide || !topic) return;

      var topicInfo = (window.RunbookTopics || {})[topic];
      if (!topicInfo) return;

      // Check if this guide has any progress
      var hasProgress = false;
      for (var key of Object.keys(allProgress)) {
        if (key.includes(topicInfo.prefix + guide)) {
          var pageData = allProgress[key];
          hasProgress =
            (pageData.sections_read && pageData.sections_read.length > 0) ||
            (pageData.quizzes && Object.keys(pageData.quizzes).length > 0) ||
            (pageData.exercises && Object.keys(pageData.exercises).length > 0);
          if (hasProgress) break;
        }
      }

      if (hasProgress) {
        card.classList.add("topic-card--completed");
      }
    });

    // Track analytics
    if (window.RunbookAnalytics) {
      var completed = document.querySelectorAll(".topic-card--completed").length;
      window.RunbookAnalytics.track("topic_page_view", {
        guides_total: cards.length,
        guides_completed: completed,
      }, { once: true });
    }
  }

  // Register as component (callable for re-initialization)
  window.RunbookComponents = window.RunbookComponents || {};
  window.RunbookComponents["topic-cards"] = initTopicCards;

  // Initialize
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initTopicCards);
  } else {
    setTimeout(initTopicCards, 100);
  }

  // Re-initialize on instant navigation
  var content = document.querySelector('[data-md-component="content"]');
  if (content) {
    var observer = new MutationObserver(function () {
      setTimeout(initTopicCards, 150);
    });
    observer.observe(content, { childList: true, subtree: false });
  }
})();
