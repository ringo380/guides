/* SPDX-License-Identifier: MIT */
/* Copyright (c) 2025-2026 Robworks Software LLC */

/**
 * Progress Tracking Component
 *
 * - In-guide progress bar showing sections read
 * - IntersectionObserver for section-read tracking
 * - Quiz/exercise event integration
 * - Landing page topic progress bars
 * - Reset functionality
 */

(function () {
  "use strict";

  // Known topic paths and their guide counts for landing page progress
  const TOPICS = {
    "Linux Essentials": {
      prefix: "Linux Essentials/",
      guides: [
        "shell-basics",
        "streams-and-redirection",
        "text-processing",
        "finding-files",
        "file-permissions",
        "job-control",
        "scripting-fundamentals",
        "disk-and-filesystem",
        "networking",
        "system-information",
        "archiving-and-compression",
        "best-practices",
      ],
    },
    "DNS Administration": {
      prefix: "DNS Administration/",
      guides: [
        "dns-fundamentals",
        "zone-files-and-records",
        "dns-tools",
        "bind",
        "nsd-and-unbound",
        "powerdns",
        "dnssec",
        "dns-architecture",
      ],
    },
    "Dev Zero/Perl": {
      prefix: "Dev Zero/Perl/",
      guides: [
        "perl_dev0_introduction",
        "scalars-strings-numbers",
        "arrays-hashes-lists",
        "control-flow",
        "regular-expressions",
        "subroutines-references",
        "file-io-and-system",
        "modules-and-cpan",
        "object-oriented-perl",
        "error-handling-debugging",
        "testing",
        "text-processing-oneliners",
        "networking-daemons",
        "web-frameworks-apis",
        "perl_developer_roadmap",
      ],
    },
    Git: {
      prefix: "Git/",
      guides: [
        "introduction",
        "three-trees",
        "commits-and-history",
        "branches-and-merging",
        "remote-repositories",
        "rewriting-history",
        "stashing-and-worktree",
        "configuring-git",
        "object-model",
        "refs-reflog-dag",
        "transfer-protocols",
        "collaboration-workflows",
        "platforms",
        "hooks-and-automation",
        "security",
        "monorepos-and-scaling",
        "troubleshooting-and-recovery",
      ],
    },
  };

  function init() {
    const storage = window.RunbookStorage;
    if (!storage) return;

    setupSectionTracking(storage);
    setupProgressBar(storage);
    setupEventListeners(storage);
    setupLandingPageProgress(storage);
  }

  function setupSectionTracking(storage) {
    // Find all h2 headings (major sections) in the content area
    const content = document.querySelector(".md-content");
    if (!content) return;

    const headings = content.querySelectorAll("h2[id]");
    if (headings.length === 0) return;

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            const sectionId = entry.target.id;
            storage.markSectionRead(sectionId);
            updateProgressBar(storage, headings.length);
          }
        });
      },
      {
        rootMargin: "0px 0px -30% 0px",
        threshold: 0.1,
      }
    );

    headings.forEach((heading) => observer.observe(heading));
  }

  function setupProgressBar(storage) {
    const content = document.querySelector(".md-content__inner");
    if (!content) return;

    // Don't add progress bars to the landing page
    const isLanding = document.querySelector(".tx-container");
    if (isLanding) return;

    const headings = document.querySelectorAll(".md-content h2[id]");
    if (headings.length === 0) return;

    const progressContainer = document.createElement("div");
    progressContainer.className = "runbook-progress-bar";
    progressContainer.id = "runbook-page-progress";

    const fill = document.createElement("div");
    fill.className = "progress-fill";

    const label = document.createElement("span");
    label.className = "progress-label";

    progressContainer.appendChild(fill);
    progressContainer.appendChild(label);

    // Insert before first heading or first child
    const firstH1 = content.querySelector("h1");
    if (firstH1 && firstH1.nextSibling) {
      content.insertBefore(progressContainer, firstH1.nextSibling);
    } else {
      content.prepend(progressContainer);
    }

    updateProgressBar(storage, headings.length);
  }

  function updateProgressBar(storage, totalSections) {
    const bar = document.getElementById("runbook-page-progress");
    if (!bar) return;

    const sectionsRead = storage.getSectionsRead().length;
    const pct = totalSections > 0 ? Math.min(100, Math.round((sectionsRead / totalSections) * 100)) : 0;

    const fill = bar.querySelector(".progress-fill");
    const label = bar.querySelector(".progress-label");

    if (fill) fill.style.width = pct + "%";
    if (label) label.textContent = `${sectionsRead}/${totalSections} sections`;
  }

  function setupEventListeners(storage) {
    // Listen for quiz and exercise completion events
    document.addEventListener("quiz-answered", (e) => {
      if (e.detail && e.detail.correct) {
        const headings = document.querySelectorAll(".md-content h2[id]");
        updateProgressBar(storage, headings.length);
      }
    });

    document.addEventListener("exercise-completed", () => {
      const headings = document.querySelectorAll(".md-content h2[id]");
      updateProgressBar(storage, headings.length);
    });
  }

  function setupLandingPageProgress(storage) {
    // Only run on landing page
    const topicCards = document.querySelectorAll(".tx-topics a");
    if (topicCards.length === 0) return;

    const allProgress = storage.getAllProgress();

    topicCards.forEach((card) => {
      const href = card.getAttribute("href") || "";

      // Find which topic this card belongs to
      let topicKey = null;
      for (const [name, info] of Object.entries(TOPICS)) {
        if (href.includes(info.prefix) || href.includes(name.replace(/ /g, "%20"))) {
          topicKey = name;
          break;
        }
      }

      if (!topicKey) return;
      const topicInfo = TOPICS[topicKey];

      // Count guides with any progress
      let guidesWithProgress = 0;
      for (const guide of topicInfo.guides) {
        // Check all progress keys for this guide
        for (const key of Object.keys(allProgress)) {
          if (key.includes(topicInfo.prefix + guide)) {
            const pageData = allProgress[key];
            const hasActivity =
              (pageData.sections_read && pageData.sections_read.length > 0) ||
              (pageData.quizzes && Object.keys(pageData.quizzes).length > 0) ||
              (pageData.exercises && Object.keys(pageData.exercises).length > 0);
            if (hasActivity) {
              guidesWithProgress++;
              break;
            }
          }
        }
      }

      if (guidesWithProgress === 0) return;

      // Add progress bar to card
      const progressDiv = document.createElement("span");
      progressDiv.className = "topic-progress";

      const pct = Math.round((guidesWithProgress / topicInfo.guides.length) * 100);

      progressDiv.innerHTML =
        '<span class="topic-progress-bar"><span class="topic-progress-fill" style="width:' +
        pct +
        '%"></span></span>' +
        '<span class="topic-progress-text">' +
        guidesWithProgress +
        "/" +
        topicInfo.guides.length +
        " guides started</span>";

      card.appendChild(progressDiv);
    });
  }

  // Register as a component that auto-initializes
  window.RunbookComponents.progress = function () {
    // no-op: progress initializes itself
  };

  // Initialize when DOM is ready
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    // Small delay to ensure storage.js is loaded
    setTimeout(init, 100);
  }

  // Re-initialize on instant navigation
  const content = document.querySelector('[data-md-component="content"]');
  if (content) {
    const observer = new MutationObserver(() => setTimeout(init, 150));
    observer.observe(content, { childList: true, subtree: false });
  }
})();
