import { describe, it, expect, beforeEach } from "vitest";
import {
  mockStorage,
  mockAnalytics,
  loadComponent,
  cleanup,
} from "./helpers.js";

const QUIZ_CONFIG = {
  question: "What is Git?",
  type: "multiple-choice",
  options: [
    { text: "A text editor", feedback: "Nope" },
    { text: "A version control system", correct: true, feedback: "Correct!" },
    { text: "A programming language", feedback: "No" },
  ],
};

describe("Quiz Component", () => {
  let container;

  beforeEach(() => {
    cleanup();
    mockStorage();
    mockAnalytics();
    loadComponent("quiz");
    container = document.createElement("div");
    container.className = "interactive-quiz";
    document.body.appendChild(container);
  });

  it("renders question and options", () => {
    window.RunbookComponents.quiz(container, QUIZ_CONFIG);
    expect(container.querySelector(".quiz-question").textContent).toBe(
      "What is Git?"
    );
    const options = container.querySelectorAll(".quiz-option");
    expect(options.length).toBe(3);
    expect(options[0].querySelector(".option-text").textContent).toBe(
      "A text editor"
    );
  });

  it("renders header with quiz icon", () => {
    window.RunbookComponents.quiz(container, QUIZ_CONFIG);
    const header = container.querySelector(".interactive-header");
    expect(header).toBeTruthy();
    expect(header.textContent).toContain("Quiz");
  });

  it("marks correct answer on click", () => {
    window.RunbookComponents.quiz(container, QUIZ_CONFIG);
    const options = container.querySelectorAll(".quiz-option");
    options[1].click(); // correct answer
    expect(options[1].classList.contains("correct")).toBe(true);
    expect(
      container.querySelector(".quiz-feedback").textContent
    ).toBe("Correct!");
  });

  it("marks incorrect answer and shows correct", () => {
    window.RunbookComponents.quiz(container, QUIZ_CONFIG);
    const options = container.querySelectorAll(".quiz-option");
    options[0].click(); // wrong answer
    expect(options[0].classList.contains("incorrect")).toBe(true);
    expect(options[1].classList.contains("correct")).toBe(true);
  });

  it("shows retry button on wrong answer", () => {
    window.RunbookComponents.quiz(container, QUIZ_CONFIG);
    const options = container.querySelectorAll(".quiz-option");
    options[0].click();
    const retryBtn = container.querySelector(".quiz-retry");
    expect(retryBtn.style.display).toBe("inline-block");
  });

  it("hides retry button on correct answer", () => {
    window.RunbookComponents.quiz(container, QUIZ_CONFIG);
    const options = container.querySelectorAll(".quiz-option");
    options[1].click();
    const retryBtn = container.querySelector(".quiz-retry");
    expect(retryBtn.style.display).toBe("none");
  });

  it("retry resets visual state", () => {
    window.RunbookComponents.quiz(container, QUIZ_CONFIG);
    const options = container.querySelectorAll(".quiz-option");
    options[0].click(); // wrong
    container.querySelector(".quiz-retry").click();
    expect(options[0].classList.contains("incorrect")).toBe(false);
    expect(options[0].getAttribute("aria-checked")).toBe("false");
  });

  it("saves score to storage", () => {
    window.RunbookComponents.quiz(container, QUIZ_CONFIG);
    container.querySelectorAll(".quiz-option")[1].click();
    expect(window.RunbookStorage.saveQuizScore).toHaveBeenCalled();
  });

  it("uses ARIA radiogroup for options", () => {
    window.RunbookComponents.quiz(container, QUIZ_CONFIG);
    const group = container.querySelector(".quiz-options");
    expect(group.getAttribute("role")).toBe("radiogroup");
    const option = container.querySelector(".quiz-option");
    expect(option.getAttribute("role")).toBe("radio");
  });

  it("dispatches quiz-answered event", () => {
    window.RunbookComponents.quiz(container, QUIZ_CONFIG);
    let eventFired = false;
    container.addEventListener("quiz-answered", (e) => {
      eventFired = true;
      expect(e.detail.correct).toBe(true);
    });
    container.querySelectorAll(".quiz-option")[1].click();
    expect(eventFired).toBe(true);
  });

  it("restores previously correct answer state", () => {
    window.RunbookStorage.getQuizScore.mockReturnValue({
      score: 1,
      attempts: 2,
    });
    window.RunbookComponents.quiz(container, QUIZ_CONFIG);
    const options = container.querySelectorAll(".quiz-option");
    expect(options[1].classList.contains("correct")).toBe(true);
    expect(options[1].getAttribute("aria-checked")).toBe("true");
  });
});
