import { describe, it, expect, beforeEach } from "vitest";
import { mockAnalytics, loadComponent, cleanup } from "./helpers.js";

const TERMINAL_CONFIG = {
  title: "Git Basics",
  steps: [
    { command: "git init", output: "Initialized empty Git repository", narration: "Create a new repo" },
    { command: "git status", output: "On branch main", narration: "Check status" },
  ],
};

describe("Terminal Component", () => {
  let container;

  beforeEach(() => {
    cleanup();
    mockAnalytics();
    // Terminal doesn't use storage
    window.RunbookStorage = null;
    loadComponent("terminal");
    container = document.createElement("div");
    container.className = "interactive-terminal";
    document.body.appendChild(container);
  });

  it("renders header with terminal dots and title", () => {
    window.RunbookComponents.terminal(container, TERMINAL_CONFIG);
    const header = container.querySelector(".interactive-header");
    expect(header).toBeTruthy();
    expect(header.textContent).toContain("Git Basics");
  });

  it("renders terminal window with role=log", () => {
    window.RunbookComponents.terminal(container, TERMINAL_CONFIG);
    const win = container.querySelector(".terminal-window");
    expect(win).toBeTruthy();
    expect(win.getAttribute("role")).toBe("log");
  });

  it("renders navigation controls", () => {
    window.RunbookComponents.terminal(container, TERMINAL_CONFIG);
    expect(container.querySelector(".terminal-controls")).toBeTruthy();
    const buttons = container.querySelectorAll(".terminal-btn");
    expect(buttons.length).toBe(3); // prev, next, replay
  });

  it("renders narration area with aria-live", () => {
    window.RunbookComponents.terminal(container, TERMINAL_CONFIG);
    const narration = container.querySelector(".terminal-narration");
    expect(narration).toBeTruthy();
    expect(narration.getAttribute("aria-live")).toBe("assertive");
  });

  it("renders step indicator", () => {
    window.RunbookComponents.terminal(container, TERMINAL_CONFIG);
    const indicator = container.querySelector(".terminal-step-indicator");
    expect(indicator).toBeTruthy();
    expect(indicator.getAttribute("aria-live")).toBe("polite");
  });

  it("handles empty steps gracefully", () => {
    window.RunbookComponents.terminal(container, { title: "Empty", steps: [] });
    expect(container.querySelector(".terminal-window")).toBeTruthy();
  });

  it("uses default title when none provided", () => {
    window.RunbookComponents.terminal(container, { steps: [] });
    const header = container.querySelector(".interactive-header");
    expect(header.textContent).toContain("Terminal");
  });
});
