/* SPDX-License-Identifier: MIT */
/* Copyright (c) 2025-2026 Robworks Software LLC */

/**
 * Exercise Component
 *
 * Scenario-based exercises with difficulty badges, progressive hints,
 * collapsible solutions, and completion tracking.
 *
 * Config schema:
 * {
 *   title: string,
 *   difficulty: "beginner" | "intermediate" | "advanced",
 *   scenario: string,
 *   hints: [string],
 *   solution: string
 * }
 */

(function () {
  "use strict";

  function generateId(config) {
    let hash = 0;
    const str = (config.title || "") + (config.scenario || "");
    for (let i = 0; i < str.length; i++) {
      hash = ((hash << 5) - hash + str.charCodeAt(i)) | 0;
    }
    return "e" + Math.abs(hash).toString(36);
  }

  function renderMarkdownBasic(text) {
    // Minimal Markdown: inline code, bold, line breaks, code blocks
    if (!text) return "";
    let html = text
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;");

    // Fenced code blocks: ```lang\n...\n```
    html = html.replace(/```(\w*)\n([\s\S]*?)```/g, function (_, lang, code) {
      return '<pre><code class="language-' + (lang || "text") + '">' + code.trim() + "</code></pre>";
    });

    // Inline code
    html = html.replace(/`([^`]+)`/g, "<code>$1</code>");
    // Bold
    html = html.replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>");
    // Line breaks (double newline = paragraph)
    html = html.replace(/\n\n/g, "</p><p>");
    html = "<p>" + html + "</p>";
    // Single newlines within paragraphs
    html = html.replace(/\n/g, "<br>");

    return html;
  }

  function initExercise(container, config) {
    const exerciseId = generateId(config);
    const hints = config.hints || [];
    let hintsRevealed = 0;
    let completed = false;
    let started = false;
    var exerciseTimer = null;

    function markStarted() {
      if (started) return;
      started = true;
      if (window.RunbookAnalytics) {
        exerciseTimer = window.RunbookAnalytics.Timer();
        window.RunbookAnalytics.track("exercise_start", {
          exercise_id: exerciseId,
          difficulty: config.difficulty || "unknown",
        }, { once: true });
      }
    }

    const storage = window.RunbookStorage;
    if (storage && storage.isExerciseComplete(exerciseId)) {
      completed = true;
    }

    // Header
    const header = document.createElement("div");
    header.className = "interactive-header";
    header.innerHTML = '<span class="icon">&#9998;</span> Exercise';

    // Body
    const body = document.createElement("div");
    body.className = "interactive-body";

    // Meta: title + difficulty
    const meta = document.createElement("div");
    meta.className = "exercise-meta";

    if (config.title) {
      const title = document.createElement("strong");
      title.textContent = config.title;
      meta.appendChild(title);
    }

    if (config.difficulty) {
      const badge = document.createElement("span");
      badge.className = "exercise-difficulty " + config.difficulty;
      badge.textContent = config.difficulty;
      meta.appendChild(badge);
    }

    body.appendChild(meta);

    // Scenario
    if (config.scenario) {
      const scenario = document.createElement("div");
      scenario.className = "exercise-scenario";
      scenario.innerHTML = renderMarkdownBasic(config.scenario);
      body.appendChild(scenario);
    }

    // Hints container
    const hintsContainer = document.createElement("div");
    hintsContainer.className = "exercise-hints";

    const hintElements = hints.map((hintText) => {
      const hint = document.createElement("div");
      hint.className = "exercise-hint";
      hint.innerHTML = renderMarkdownBasic(hintText);
      hintsContainer.appendChild(hint);
      return hint;
    });

    body.appendChild(hintsContainer);

    // Actions
    const actions = document.createElement("div");
    actions.className = "exercise-actions";

    // Show Hint button
    let hintBtn = null;
    if (hints.length > 0) {
      hintBtn = document.createElement("button");
      hintBtn.className = "exercise-btn";
      hintBtn.type = "button";
      hintBtn.textContent = `Show Hint (1/${hints.length})`;
      hintBtn.addEventListener("click", () => {
        if (hintsRevealed < hints.length) {
          markStarted();
          hintElements[hintsRevealed].classList.add("visible");
          hintsRevealed++;

          if (window.RunbookAnalytics) {
            window.RunbookAnalytics.track("exercise_hint", {
              exercise_id: exerciseId,
              hint_number: hintsRevealed,
              hints_total: hints.length,
            });
          }

          if (hintsRevealed >= hints.length) {
            hintBtn.style.display = "none";
          } else {
            hintBtn.textContent = `Show Hint (${hintsRevealed + 1}/${hints.length})`;
          }
        }
      });
      actions.appendChild(hintBtn);
    }

    // Show Solution button
    const solutionContainer = document.createElement("div");
    solutionContainer.className = "exercise-solution";

    if (config.solution) {
      const solutionBtn = document.createElement("button");
      solutionBtn.className = "exercise-btn";
      solutionBtn.type = "button";
      solutionBtn.textContent = "Show Solution";

      const solutionContent = document.createElement("div");
      solutionContent.className = "exercise-solution-content";
      solutionContent.innerHTML = renderMarkdownBasic(config.solution);
      solutionContainer.appendChild(solutionContent);

      solutionBtn.addEventListener("click", () => {
        markStarted();
        const isVisible = solutionContainer.classList.contains("visible");
        if (isVisible) {
          solutionContainer.classList.remove("visible");
          solutionBtn.textContent = "Show Solution";
        } else {
          solutionContainer.classList.add("visible");
          solutionBtn.textContent = "Hide Solution";

          if (window.RunbookAnalytics) {
            window.RunbookAnalytics.track("exercise_solution_view", {
              exercise_id: exerciseId,
              difficulty: config.difficulty || "unknown",
            }, { once: true });
          }
        }
      });

      actions.appendChild(solutionBtn);
    }

    // Mark Complete button
    const completeBtn = document.createElement("button");
    completeBtn.className = "exercise-btn";
    completeBtn.type = "button";
    completeBtn.textContent = completed ? "Completed" : "Mark Complete";
    if (completed) completeBtn.disabled = true;

    completeBtn.addEventListener("click", () => {
      completed = true;
      completeBtn.textContent = "Completed";
      completeBtn.disabled = true;

      if (window.RunbookAnalytics && exerciseTimer) {
        window.RunbookAnalytics.trackTimed("exercise_duration", exerciseTimer.elapsed(), {
          exercise_id: exerciseId,
          difficulty: config.difficulty || "unknown",
        });
      }

      if (storage) {
        storage.markExerciseComplete(exerciseId);
      }

      // Show completion indicator
      const completeIndicator = document.createElement("div");
      completeIndicator.className = "exercise-complete";
      completeIndicator.textContent = "Exercise completed";
      body.appendChild(completeIndicator);

      container.dispatchEvent(
        new CustomEvent("exercise-completed", {
          bubbles: true,
          detail: { exerciseId },
        })
      );

      if (window.RunbookAnalytics) {
        window.RunbookAnalytics.track("exercise_complete", {
          exercise_id: exerciseId,
          difficulty: config.difficulty || "unknown",
        }, { once: true });
      }
    });

    actions.appendChild(completeBtn);
    body.appendChild(actions);
    body.appendChild(solutionContainer);

    // Assemble
    container.innerHTML = "";
    container.appendChild(header);
    container.appendChild(body);

    // Show completion state if previously completed
    if (completed) {
      const completeIndicator = document.createElement("div");
      completeIndicator.className = "exercise-complete";
      completeIndicator.textContent = "Exercise completed";
      body.appendChild(completeIndicator);
    }
  }

  window.RunbookComponents.exercise = initExercise;
})();
