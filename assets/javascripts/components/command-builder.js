/* SPDX-License-Identifier: MIT */
/* Copyright (c) 2025-2026 Robworks Software LLC */

/**
 * Command Builder Component
 *
 * Interactive command assembly from selectable options with
 * real-time preview, copy button, per-flag explanations, and reset.
 *
 * Config schema:
 * {
 *   base: string,
 *   description?: string,
 *   options: [{
 *     flag: string,
 *     type: "text" | "select",
 *     label: string,
 *     placeholder?: string,
 *     explanation?: string,
 *     choices?: [[value, label], ...]   // for select type
 *   }]
 * }
 */

(function () {
  "use strict";

  function initCommandBuilder(container, config) {
    const base = config.base || "command";
    const options = config.options || [];

    const trackOptionChange = window.RunbookAnalytics
      ? window.RunbookAnalytics.debounce("command_option_change", 1000)
      : function () {};

    // Header
    const header = document.createElement("div");
    header.className = "interactive-header";
    header.innerHTML = '<span class="icon">&#9881;</span> Command Builder';

    // Body
    const body = document.createElement("div");
    body.className = "interactive-body";

    // Description
    if (config.description) {
      const desc = document.createElement("div");
      desc.className = "builder-description";
      desc.textContent = config.description;
      body.appendChild(desc);
    }

    // Result display (at top, updates live)
    const result = document.createElement("div");
    result.className = "builder-result";

    const copyBtn = document.createElement("button");
    copyBtn.className = "builder-copy";
    copyBtn.type = "button";
    copyBtn.textContent = "Copy";
    copyBtn.addEventListener("click", () => {
      const text = buildCommandString();
      navigator.clipboard.writeText(text).then(
        () => {
          copyBtn.textContent = "Copied!";

          if (window.RunbookAnalytics) {
            window.RunbookAnalytics.track("command_copy", {
              base_command: base,
            });
          }

          setTimeout(() => (copyBtn.textContent = "Copy"), 1500);
        },
        () => {
          // Fallback for older browsers
          const textarea = document.createElement("textarea");
          textarea.value = text;
          textarea.style.position = "fixed";
          textarea.style.opacity = "0";
          document.body.appendChild(textarea);
          textarea.select();
          document.execCommand("copy");
          document.body.removeChild(textarea);
          copyBtn.textContent = "Copied!";

          if (window.RunbookAnalytics) {
            window.RunbookAnalytics.track("command_copy", {
              base_command: base,
            });
          }

          setTimeout(() => (copyBtn.textContent = "Copy"), 1500);
        }
      );
    });
    result.appendChild(copyBtn);

    const resultCode = document.createElement("code");
    result.appendChild(resultCode);
    body.appendChild(result);

    // Options
    const optionsContainer = document.createElement("div");
    optionsContainer.className = "builder-options";

    const inputs = [];

    options.forEach((opt) => {
      const row = document.createElement("div");
      row.className = "builder-option";

      const label = document.createElement("label");
      label.textContent = opt.label || opt.flag;
      row.appendChild(label);

      let input;
      if (opt.type === "select") {
        input = document.createElement("select");
        // Add empty option
        const emptyOpt = document.createElement("option");
        emptyOpt.value = "";
        emptyOpt.textContent = "-- Select --";
        input.appendChild(emptyOpt);

        (opt.choices || []).forEach((choice) => {
          const optEl = document.createElement("option");
          // choices can be [value, label] arrays or plain strings
          if (Array.isArray(choice)) {
            optEl.value = choice[0];
            optEl.textContent = choice[1] || choice[0];
          } else {
            optEl.value = choice;
            optEl.textContent = choice;
          }
          input.appendChild(optEl);
        });
      } else {
        input = document.createElement("input");
        input.type = "text";
        input.placeholder = opt.placeholder || "";
      }

      input.addEventListener("input", () => {
        updateCommand();
        trackOptionChange({ base_command: base, flag: opt.flag });
      });
      input.addEventListener("change", () => {
        updateCommand();
        trackOptionChange({ base_command: base, flag: opt.flag });
      });
      row.appendChild(input);

      // Explanation
      if (opt.explanation) {
        const explanation = document.createElement("div");
        explanation.className = "option-explanation";
        explanation.textContent = opt.explanation;
        row.appendChild(explanation);
      }

      optionsContainer.appendChild(row);
      inputs.push({ input, opt });
    });

    body.appendChild(optionsContainer);

    // Explanations of active flags
    const explanations = document.createElement("dl");
    explanations.className = "builder-explanations";
    body.appendChild(explanations);

    // Actions
    const actions = document.createElement("div");
    actions.className = "builder-actions";

    const resetBtn = document.createElement("button");
    resetBtn.className = "builder-btn";
    resetBtn.type = "button";
    resetBtn.textContent = "Reset";
    resetBtn.addEventListener("click", () => {
      inputs.forEach(({ input }) => {
        if (input.tagName === "SELECT") {
          input.selectedIndex = 0;
        } else {
          input.value = "";
        }
      });
      updateCommand();
    });
    actions.appendChild(resetBtn);
    body.appendChild(actions);

    function buildCommandString() {
      let parts = [base];
      inputs.forEach(({ input, opt }) => {
        const val = input.value.trim();
        if (val) {
          parts.push(opt.flag);
          parts.push(val);
        }
      });
      return parts.join(" ");
    }

    function updateCommand() {
      // Update result display with syntax highlighting
      let html = '<span class="base-cmd">' + escapeHtml(base) + "</span>";
      const activeExplanations = [];

      inputs.forEach(({ input, opt }) => {
        const val = input.value.trim();
        if (val) {
          html += ' <span class="flag">' + escapeHtml(opt.flag) + "</span>";
          html += " " + escapeHtml(val);
          if (opt.explanation) {
            activeExplanations.push({ flag: opt.flag, text: opt.explanation });
          }
        }
      });

      resultCode.innerHTML = html;

      // Update explanations
      explanations.innerHTML = "";
      activeExplanations.forEach(({ flag, text }) => {
        const dt = document.createElement("dt");
        dt.textContent = flag;
        const dd = document.createElement("dd");
        dd.textContent = text;
        explanations.appendChild(dt);
        explanations.appendChild(dd);
      });

    }

    // Assemble
    container.innerHTML = "";
    container.appendChild(header);
    container.appendChild(body);

    // Initial render
    updateCommand();
  }

  function escapeHtml(str) {
    return str.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  }

  window.RunbookComponents["command-builder"] = initCommandBuilder;
})();
