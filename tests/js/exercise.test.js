import { describe, it, expect, beforeEach } from "vitest";
import {
  mockStorage,
  mockAnalytics,
  loadComponent,
  cleanup,
} from "./helpers.js";

const EXERCISE_CONFIG = {
  title: "Write a Script",
  difficulty: "intermediate",
  scenario: "Write a bash script that prints hello world.",
  hints: ["Use echo command", "Don't forget the shebang"],
  solution: "```bash\n#!/bin/bash\necho 'hello world'\n```",
};

describe("Exercise Component", () => {
  let container;

  beforeEach(() => {
    cleanup();
    mockStorage();
    mockAnalytics();
    loadComponent("exercise");
    container = document.createElement("div");
    container.className = "interactive-exercise";
    document.body.appendChild(container);
  });

  it("renders meta section with title and difficulty", () => {
    window.RunbookComponents.exercise(container, EXERCISE_CONFIG);
    const meta = container.querySelector(".exercise-meta");
    expect(meta).toBeTruthy();
    expect(meta.textContent).toContain("Write a Script");
    expect(meta.textContent.toLowerCase()).toContain("intermediate");
  });

  it("renders scenario content", () => {
    window.RunbookComponents.exercise(container, EXERCISE_CONFIG);
    const scenario = container.querySelector(".exercise-scenario");
    expect(scenario).toBeTruthy();
    expect(scenario.textContent).toContain("hello world");
  });

  it("renders hint button with aria-expanded", () => {
    window.RunbookComponents.exercise(container, EXERCISE_CONFIG);
    // Hint button is an exercise-btn with aria-expanded
    const buttons = container.querySelectorAll(".exercise-btn");
    const hintBtn = Array.from(buttons).find((b) =>
      b.textContent.includes("Hint")
    );
    expect(hintBtn).toBeTruthy();
    expect(hintBtn.getAttribute("aria-expanded")).toBe("false");
  });

  it("reveals hints progressively on click", () => {
    window.RunbookComponents.exercise(container, EXERCISE_CONFIG);
    const buttons = container.querySelectorAll(".exercise-btn");
    const hintBtn = Array.from(buttons).find((b) =>
      b.textContent.includes("Hint")
    );
    hintBtn.click();
    const visibleHints = container.querySelectorAll(".exercise-hint.visible");
    expect(visibleHints.length).toBe(1);
    expect(hintBtn.getAttribute("aria-expanded")).toBe("true");
  });

  it("renders solution section", () => {
    window.RunbookComponents.exercise(container, EXERCISE_CONFIG);
    const solution = container.querySelector(".exercise-solution");
    expect(solution).toBeTruthy();
  });

  it("renders Mark Complete button", () => {
    window.RunbookComponents.exercise(container, EXERCISE_CONFIG);
    const buttons = container.querySelectorAll(".exercise-btn");
    const completeBtn = Array.from(buttons).find((b) =>
      b.textContent.includes("Mark Complete")
    );
    expect(completeBtn).toBeTruthy();
  });

  it("marks exercise complete on button click", () => {
    window.RunbookComponents.exercise(container, EXERCISE_CONFIG);
    const buttons = container.querySelectorAll(".exercise-btn");
    const completeBtn = Array.from(buttons).find((b) =>
      b.textContent.includes("Mark Complete")
    );
    completeBtn.click();
    expect(window.RunbookStorage.markExerciseComplete).toHaveBeenCalled();
    expect(completeBtn.textContent).toBe("Completed");
    expect(completeBtn.disabled).toBe(true);
  });

  it("restores completed state from storage", () => {
    window.RunbookStorage.isExerciseComplete.mockReturnValue(true);
    window.RunbookComponents.exercise(container, EXERCISE_CONFIG);
    const buttons = container.querySelectorAll(".exercise-btn");
    const completeBtn = Array.from(buttons).find(
      (b) => b.textContent === "Completed"
    );
    expect(completeBtn).toBeTruthy();
    expect(completeBtn.disabled).toBe(true);
  });

  it("handles missing hints gracefully", () => {
    const config = { ...EXERCISE_CONFIG, hints: undefined };
    window.RunbookComponents.exercise(container, config);
    expect(container.querySelector(".exercise-scenario")).toBeTruthy();
    // No hint button should exist
    const buttons = container.querySelectorAll(".exercise-btn");
    const hintBtn = Array.from(buttons).find((b) =>
      b.textContent.includes("Hint")
    );
    expect(hintBtn).toBeFalsy();
  });

  it("sets ARIA region role", () => {
    window.RunbookComponents.exercise(container, EXERCISE_CONFIG);
    expect(container.getAttribute("role")).toBe("region");
  });
});
