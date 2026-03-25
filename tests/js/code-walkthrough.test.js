import { describe, it, expect, beforeEach } from "vitest";
import { mockAnalytics, loadComponent, cleanup } from "./helpers.js";

const WALKTHROUGH_CONFIG = {
  title: "Hello World Script",
  language: "bash",
  code: "#!/bin/bash\necho 'hello'\nexit 0",
  annotations: [
    { line: 1, text: "The shebang line" },
    { line: 2, text: "Print a greeting" },
    { line: 3, text: "Exit successfully" },
  ],
};

describe("Code Walkthrough Component", () => {
  let container;

  beforeEach(() => {
    cleanup();
    mockAnalytics();
    window.RunbookStorage = null;
    loadComponent("code-walkthrough");
    container = document.createElement("div");
    container.className = "interactive-code-walkthrough";
    document.body.appendChild(container);
  });

  it("renders header with title", () => {
    window.RunbookComponents["code-walkthrough"](container, WALKTHROUGH_CONFIG);
    const header = container.querySelector(".interactive-header");
    expect(header).toBeTruthy();
    expect(header.textContent).toContain("Hello World Script");
  });

  it("renders code lines", () => {
    window.RunbookComponents["code-walkthrough"](container, WALKTHROUGH_CONFIG);
    const lines = container.querySelectorAll(".walkthrough-line");
    expect(lines.length).toBe(3);
  });

  it("renders line numbers", () => {
    window.RunbookComponents["code-walkthrough"](container, WALKTHROUGH_CONFIG);
    const numbers = container.querySelectorAll(".line-number");
    expect(numbers.length).toBe(3);
    expect(numbers[0].textContent).toBe("1");
    expect(numbers[2].textContent).toBe("3");
  });

  it("renders code content", () => {
    window.RunbookComponents["code-walkthrough"](container, WALKTHROUGH_CONFIG);
    const contents = container.querySelectorAll(".line-content");
    expect(contents[0].textContent).toBe("#!/bin/bash");
    expect(contents[1].textContent).toBe("echo 'hello'");
  });

  it("renders annotation area with aria-live", () => {
    window.RunbookComponents["code-walkthrough"](container, WALKTHROUGH_CONFIG);
    const annotation = container.querySelector(".walkthrough-annotation");
    expect(annotation).toBeTruthy();
    expect(annotation.getAttribute("aria-live")).toBe("polite");
  });

  it("renders navigation controls", () => {
    window.RunbookComponents["code-walkthrough"](container, WALKTHROUGH_CONFIG);
    const controls = container.querySelector(".walkthrough-controls");
    expect(controls).toBeTruthy();
    const buttons = controls.querySelectorAll("button");
    expect(buttons.length).toBeGreaterThanOrEqual(2); // prev, next, possibly show-all
  });

  it("renders step info", () => {
    window.RunbookComponents["code-walkthrough"](container, WALKTHROUGH_CONFIG);
    const info = container.querySelector(".walkthrough-step-info");
    expect(info).toBeTruthy();
  });

  it("handles empty annotations", () => {
    window.RunbookComponents["code-walkthrough"](container, {
      code: "echo hi",
      annotations: [],
    });
    expect(container.querySelector(".walkthrough-line")).toBeTruthy();
  });

  it("handles missing title", () => {
    window.RunbookComponents["code-walkthrough"](container, {
      code: "echo hi",
      annotations: [{ line: 1, text: "Print" }],
    });
    const header = container.querySelector(".interactive-header");
    expect(header).toBeTruthy();
  });
});
