/* SPDX-License-Identifier: MIT */
/* Copyright (c) 2025-2026 Robworks Software LLC */

/**
 * Code Walkthrough Component
 *
 * Step-by-step code annotation with line highlighting,
 * forward/back navigation, and show-all toggle.
 *
 * Config schema:
 * {
 *   language?: string,
 *   title?: string,
 *   code: string,
 *   annotations: [{ line: number, text: string }]
 * }
 */

(function () {
  "use strict";

  function initCodeWalkthrough(container, config) {
    const code = config.code || "";
    const lines = code.split("\n");
    // Remove trailing empty line if present
    if (lines.length > 0 && lines[lines.length - 1].trim() === "") {
      lines.pop();
    }
    const annotations = (config.annotations || []).sort((a, b) => a.line - b.line);
    let currentStepIndex = -1;
    let showAll = false;

    // Header
    const header = document.createElement("div");
    header.className = "interactive-header";
    header.innerHTML =
      '<span class="icon">&#128270;</span> ' + (config.title || "Code Walkthrough");

    // Code area
    const codeArea = document.createElement("div");
    codeArea.className = "walkthrough-code";

    const pre = document.createElement("pre");
    const lineElements = [];

    lines.forEach((lineText, i) => {
      const lineEl = document.createElement("span");
      lineEl.className = "walkthrough-line";

      const lineNum = document.createElement("span");
      lineNum.className = "line-number";
      lineNum.textContent = i + 1;

      const lineContent = document.createElement("span");
      lineContent.className = "line-content";
      lineContent.textContent = lineText || " "; // preserve empty lines

      lineEl.appendChild(lineNum);
      lineEl.appendChild(lineContent);
      pre.appendChild(lineEl);
      lineElements.push(lineEl);
    });

    codeArea.appendChild(pre);

    // Annotation display
    const annotationEl = document.createElement("div");
    annotationEl.className = "walkthrough-annotation";
    annotationEl.textContent = annotations.length > 0 ? "Click 'Next' to begin the walkthrough" : "No annotations available";

    // Controls
    const controls = document.createElement("div");
    controls.className = "walkthrough-controls";

    const prevBtn = document.createElement("button");
    prevBtn.type = "button";
    prevBtn.textContent = "Previous";
    prevBtn.disabled = true;

    const nextBtn = document.createElement("button");
    nextBtn.type = "button";
    nextBtn.textContent = "Next";
    nextBtn.disabled = annotations.length === 0;

    const showAllBtn = document.createElement("button");
    showAllBtn.type = "button";
    showAllBtn.className = "show-all-toggle";
    showAllBtn.textContent = "Show All";

    const stepInfo = document.createElement("span");
    stepInfo.className = "walkthrough-step-info";

    controls.appendChild(prevBtn);
    controls.appendChild(nextBtn);
    controls.appendChild(showAllBtn);
    controls.appendChild(stepInfo);

    function highlightLine(lineNum) {
      lineElements.forEach((el) => el.classList.remove("active"));
      if (lineNum >= 1 && lineNum <= lineElements.length) {
        lineElements[lineNum - 1].classList.add("active");
        // Scroll line into view within the code area
        lineElements[lineNum - 1].scrollIntoView({ block: "nearest", behavior: "smooth" });
      }
    }

    function showStep(index) {
      if (showAll) return;
      currentStepIndex = index;

      if (index >= 0 && index < annotations.length) {
        const ann = annotations[index];
        highlightLine(ann.line);
        annotationEl.textContent = ann.text;
        stepInfo.textContent = `Step ${index + 1} of ${annotations.length}`;

        if (window.RunbookAnalytics) {
          window.RunbookAnalytics.track("walkthrough_step", {
            walkthrough_title: config.title || "",
            step_number: index + 1,
            steps_total: annotations.length,
          });
        }
      }

      prevBtn.disabled = index <= 0;
      nextBtn.disabled = index >= annotations.length - 1;
    }

    function showAllAnnotations() {
      showAll = true;
      showAllBtn.classList.add("active");
      showAllBtn.textContent = "Step Mode";
      prevBtn.disabled = true;
      nextBtn.disabled = true;
      stepInfo.textContent = `${annotations.length} annotations`;

      // Highlight all annotated lines
      lineElements.forEach((el) => el.classList.remove("active"));
      annotations.forEach((ann) => {
        if (ann.line >= 1 && ann.line <= lineElements.length) {
          lineElements[ann.line - 1].classList.add("active");
        }
      });

      // Show all annotations in the annotation area
      annotationEl.innerHTML = "";
      annotations.forEach((ann) => {
        const p = document.createElement("p");
        p.innerHTML =
          "<strong>Line " + ann.line + ":</strong> " + escapeHtml(ann.text);
        p.style.margin = "0.25rem 0";
        annotationEl.appendChild(p);
      });

      if (window.RunbookAnalytics) {
        window.RunbookAnalytics.track("walkthrough_show_all", {
          walkthrough_title: config.title || "",
        });
      }
    }

    function exitShowAll() {
      showAll = false;
      showAllBtn.classList.remove("active");
      showAllBtn.textContent = "Show All";

      if (currentStepIndex >= 0) {
        showStep(currentStepIndex);
      } else if (annotations.length > 0) {
        showStep(0);
      }
    }

    nextBtn.addEventListener("click", () => {
      if (currentStepIndex < annotations.length - 1) {
        showStep(currentStepIndex + 1);
      }
    });

    prevBtn.addEventListener("click", () => {
      if (currentStepIndex > 0) {
        showStep(currentStepIndex - 1);
      }
    });

    showAllBtn.addEventListener("click", () => {
      if (showAll) {
        exitShowAll();
      } else {
        showAllAnnotations();
      }
    });

    // Allow clicking on annotated lines
    lineElements.forEach((el, i) => {
      const lineNum = i + 1;
      const annIndex = annotations.findIndex((a) => a.line === lineNum);
      if (annIndex >= 0) {
        el.style.cursor = "pointer";
        el.addEventListener("click", () => {
          if (showAll) exitShowAll();
          showStep(annIndex);
        });
      }
    });

    // Assemble
    container.innerHTML = "";
    container.appendChild(header);
    container.appendChild(codeArea);
    container.appendChild(annotationEl);
    container.appendChild(controls);
  }

  function escapeHtml(str) {
    return str.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  }

  window.RunbookComponents["code-walkthrough"] = initCodeWalkthrough;
})();
