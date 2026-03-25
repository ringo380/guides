import { describe, it, expect, beforeEach } from "vitest";
import { mockAnalytics, loadComponent, cleanup } from "./helpers.js";

const BUILDER_CONFIG = {
  base: "git log",
  description: "Build a git log command",
  options: [
    {
      flag: "--oneline",
      type: "select",
      label: "Format",
      choices: [
        ["", "Default"],
        ["--oneline", "One line"],
      ],
    },
    {
      flag: "-n",
      type: "text",
      label: "Limit",
      placeholder: "number",
      explanation: "Number of commits to show",
    },
  ],
};

describe("Command Builder Component", () => {
  let container;

  beforeEach(() => {
    cleanup();
    mockAnalytics();
    window.RunbookStorage = null;
    loadComponent("command-builder");
    container = document.createElement("div");
    container.className = "interactive-command-builder";
    document.body.appendChild(container);
  });

  it("renders header", () => {
    window.RunbookComponents["command-builder"](container, BUILDER_CONFIG);
    const header = container.querySelector(".interactive-header");
    expect(header).toBeTruthy();
    expect(header.textContent).toContain("Command Builder");
  });

  it("renders description when provided", () => {
    window.RunbookComponents["command-builder"](container, BUILDER_CONFIG);
    const desc = container.querySelector(".builder-description");
    expect(desc).toBeTruthy();
    expect(desc.textContent).toBe("Build a git log command");
  });

  it("renders result display with base command", () => {
    window.RunbookComponents["command-builder"](container, BUILDER_CONFIG);
    const result = container.querySelector(".builder-result");
    expect(result).toBeTruthy();
    expect(result.textContent).toContain("git log");
  });

  it("renders copy button", () => {
    window.RunbookComponents["command-builder"](container, BUILDER_CONFIG);
    const copy = container.querySelector(".builder-copy");
    expect(copy).toBeTruthy();
    expect(copy.getAttribute("aria-label")).toBe("Copy command");
  });

  it("renders option inputs for each option", () => {
    window.RunbookComponents["command-builder"](container, BUILDER_CONFIG);
    const selects = container.querySelectorAll("select");
    const inputs = container.querySelectorAll('input[type="text"]');
    expect(selects.length).toBe(1);
    expect(inputs.length).toBe(1);
  });

  it("renders explanation text", () => {
    window.RunbookComponents["command-builder"](container, BUILDER_CONFIG);
    const body = container.querySelector(".interactive-body");
    expect(body.textContent).toContain("Number of commits to show");
  });

  it("sets ARIA region role", () => {
    window.RunbookComponents["command-builder"](container, BUILDER_CONFIG);
    expect(container.getAttribute("role")).toBe("region");
  });

  it("falls back to 'command' when base is empty", () => {
    window.RunbookComponents["command-builder"](container, {
      base: "",
      options: [],
    });
    const result = container.querySelector(".builder-result");
    expect(result.textContent).toContain("command");
  });

  it("omits description when not provided", () => {
    window.RunbookComponents["command-builder"](container, {
      base: "ls",
      options: [],
    });
    expect(container.querySelector(".builder-description")).toBeNull();
  });
});
