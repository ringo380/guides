/* SPDX-License-Identifier: MIT */
/* Copyright (c) 2025-2026 Robworks Software LLC */

/**
 * Quiz Component
 *
 * Renders multiple-choice quizzes with per-option feedback,
 * correct/incorrect highlighting, retry, and score persistence.
 *
 * Config schema:
 * {
 *   question: string,
 *   type: "multiple-choice",
 *   options: [{ text: string, correct?: boolean, feedback?: string }]
 * }
 */

(function () {
  "use strict";

  function generateId(config) {
    // Deterministic ID from question text
    let hash = 0;
    const str = config.question || "";
    for (let i = 0; i < str.length; i++) {
      hash = ((hash << 5) - hash + str.charCodeAt(i)) | 0;
    }
    return "q" + Math.abs(hash).toString(36);
  }

  function initQuiz(container, config) {
    const quizId = generateId(config);
    const options = config.options || [];
    const correctIndex = options.findIndex((o) => o.correct);
    let attempts = 0;
    let answered = false;

    // Restore previous state
    const storage = window.RunbookStorage;
    const saved = storage ? storage.getQuizScore(quizId) : null;
    if (saved) {
      attempts = saved.attempts;
    }

    // Build DOM
    const header = document.createElement("div");
    header.className = "interactive-header";
    header.innerHTML = '<span class="icon">?</span> Quiz';

    const body = document.createElement("div");
    body.className = "interactive-body";

    const questionEl = document.createElement("div");
    questionEl.className = "quiz-question";
    questionEl.textContent = config.question || "Question";
    body.appendChild(questionEl);

    const optionsEl = document.createElement("div");
    optionsEl.className = "quiz-options";

    const feedbackEl = document.createElement("div");
    feedbackEl.className = "quiz-feedback";

    const letters = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";

    const optionButtons = options.map((opt, i) => {
      const btn = document.createElement("button");
      btn.className = "quiz-option";
      btn.type = "button";

      const marker = document.createElement("span");
      marker.className = "option-marker";
      marker.textContent = letters[i] || i + 1;

      const text = document.createElement("span");
      text.className = "option-text";
      text.textContent = opt.text;

      btn.appendChild(marker);
      btn.appendChild(text);

      btn.addEventListener("click", () => {
        if (answered) return;

        attempts++;
        const isCorrect = i === correctIndex;

        // Disable all options
        optionButtons.forEach((b) => b.classList.add("disabled"));

        // Highlight selected
        btn.classList.add(isCorrect ? "correct" : "incorrect");

        // If correct, also highlight the correct one (already done)
        // If wrong, show the correct answer too
        if (!isCorrect && correctIndex >= 0) {
          optionButtons[correctIndex].classList.add("correct");
        }

        // Show feedback
        const feedback = opt.feedback || (isCorrect ? "Correct!" : "Not quite.");
        feedbackEl.textContent = feedback;
        feedbackEl.className = "quiz-feedback visible " + (isCorrect ? "correct" : "incorrect");

        // Show score
        scoreEl.textContent = isCorrect
          ? `Correct on attempt ${attempts}`
          : `Incorrect - attempt ${attempts}`;
        scoreEl.style.display = "block";

        // Show retry if wrong
        if (!isCorrect) {
          retryBtn.style.display = "inline-block";
        } else {
          answered = true;
          retryBtn.style.display = "none";
        }

        // Save to storage
        if (storage) {
          storage.saveQuizScore(quizId, isCorrect ? 1 : 0, attempts);
        }

        // Dispatch event for progress tracking
        container.dispatchEvent(
          new CustomEvent("quiz-answered", {
            bubbles: true,
            detail: { quizId, correct: isCorrect, attempts },
          })
        );

        if (window.RunbookAnalytics) {
          window.RunbookAnalytics.track("quiz_answer", {
            quiz_id: quizId,
            correct: isCorrect,
            attempts: attempts,
            question: config.question || "",
          });
        }
      });

      optionsEl.appendChild(btn);
      return btn;
    });

    body.appendChild(optionsEl);
    body.appendChild(feedbackEl);

    // Actions row
    const actionsEl = document.createElement("div");
    actionsEl.className = "quiz-actions";

    const retryBtn = document.createElement("button");
    retryBtn.className = "quiz-retry";
    retryBtn.type = "button";
    retryBtn.textContent = "Try Again";
    retryBtn.style.display = "none";
    retryBtn.addEventListener("click", () => {
      // Reset visual state but keep attempt count
      optionButtons.forEach((b) => {
        b.classList.remove("correct", "incorrect", "disabled");
      });
      feedbackEl.className = "quiz-feedback";
      retryBtn.style.display = "none";
      scoreEl.style.display = "none";
    });

    const scoreEl = document.createElement("div");
    scoreEl.className = "quiz-score";
    scoreEl.style.display = "none";

    actionsEl.appendChild(retryBtn);
    actionsEl.appendChild(scoreEl);
    body.appendChild(actionsEl);

    // Assemble
    container.innerHTML = "";
    container.appendChild(header);
    container.appendChild(body);

    // If previously answered correctly, show that state
    if (saved && saved.score === 1 && correctIndex >= 0) {
      answered = true;
      optionButtons.forEach((b) => b.classList.add("disabled"));
      optionButtons[correctIndex].classList.add("correct");
      const correctOpt = options[correctIndex];
      feedbackEl.textContent = correctOpt.feedback || "Correct!";
      feedbackEl.className = "quiz-feedback visible correct";
      scoreEl.textContent = `Previously answered correctly (${saved.attempts} attempt${saved.attempts !== 1 ? "s" : ""})`;
      scoreEl.style.display = "block";
    }
  }

  window.RunbookComponents.quiz = initQuiz;
})();
