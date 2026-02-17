/**
 * Simulated Terminal Component
 *
 * Renders a terminal with typing animation, step-by-step command execution,
 * narration callouts, and replay. Always dark-themed.
 *
 * Config schema:
 * {
 *   title: string,
 *   prompt?: string,  // default: "user@linux:~$ "
 *   steps: [{
 *     command: string,
 *     output?: string,
 *     narration?: string
 *   }]
 * }
 */

(function () {
  "use strict";

  const DEFAULT_PROMPT = "user@linux:~$ ";
  const TYPING_SPEED = 40; // ms per character

  function sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  function initTerminal(container, config) {
    const steps = config.steps || [];
    const prompt = config.prompt || DEFAULT_PROMPT;
    let currentStep = -1;
    let isAnimating = false;

    // Header
    const header = document.createElement("div");
    header.className = "interactive-header";
    // Terminal dots
    header.innerHTML =
      '<span style="display:flex;gap:6px;margin-right:8px">' +
      '<span style="width:10px;height:10px;border-radius:50%;background:#ff5f56"></span>' +
      '<span style="width:10px;height:10px;border-radius:50%;background:#ffbd2e"></span>' +
      '<span style="width:10px;height:10px;border-radius:50%;background:#27c93f"></span>' +
      "</span>" +
      (config.title || "Terminal");

    // Terminal window
    const terminalWindow = document.createElement("div");
    terminalWindow.className = "terminal-window";

    // Narration area
    const narration = document.createElement("div");
    narration.className = "terminal-narration";
    narration.style.display = "none";

    // Controls
    const controls = document.createElement("div");
    controls.className = "terminal-controls";

    const prevBtn = document.createElement("button");
    prevBtn.className = "terminal-btn";
    prevBtn.type = "button";
    prevBtn.textContent = "Previous";

    const nextBtn = document.createElement("button");
    nextBtn.className = "terminal-btn";
    nextBtn.type = "button";
    nextBtn.textContent = "Next";

    const replayBtn = document.createElement("button");
    replayBtn.className = "terminal-btn";
    replayBtn.type = "button";
    replayBtn.textContent = "Replay";

    const stepIndicator = document.createElement("span");
    stepIndicator.className = "terminal-step-indicator";

    controls.appendChild(prevBtn);
    controls.appendChild(nextBtn);
    controls.appendChild(replayBtn);
    controls.appendChild(stepIndicator);

    function updateControls() {
      prevBtn.disabled = currentStep <= 0 || isAnimating;
      nextBtn.disabled = currentStep >= steps.length - 1 || isAnimating;
      replayBtn.disabled = isAnimating;
      stepIndicator.textContent =
        steps.length > 0 ? `Step ${currentStep + 1} of ${steps.length}` : "";
    }

    function renderPreviousSteps() {
      // Render all steps up to (but not including) current step as static text
      terminalWindow.innerHTML = "";
      for (let i = 0; i < currentStep; i++) {
        const step = steps[i];
        appendStaticStep(step);
      }
    }

    function appendStaticStep(step) {
      // Prompt + command
      const cmdLine = document.createElement("div");
      cmdLine.className = "terminal-line";
      cmdLine.innerHTML =
        '<span class="terminal-prompt">' +
        escapeHtml(prompt) +
        '</span><span class="terminal-command">' +
        escapeHtml(step.command) +
        "</span>";
      terminalWindow.appendChild(cmdLine);

      // Output
      if (step.output) {
        const outputLines = step.output.split("\n");
        outputLines.forEach((line) => {
          const outputEl = document.createElement("div");
          outputEl.className = "terminal-line terminal-output";
          outputEl.textContent = line;
          terminalWindow.appendChild(outputEl);
        });
      }
    }

    async function animateStep(stepIndex) {
      if (isAnimating) return;
      isAnimating = true;
      currentStep = stepIndex;
      updateControls();

      renderPreviousSteps();

      const step = steps[stepIndex];

      // Create the command line with cursor
      const cmdLine = document.createElement("div");
      cmdLine.className = "terminal-line";
      const promptSpan = document.createElement("span");
      promptSpan.className = "terminal-prompt";
      promptSpan.textContent = prompt;
      const cmdSpan = document.createElement("span");
      cmdSpan.className = "terminal-command";
      const cursor = document.createElement("span");
      cursor.className = "terminal-cursor";

      cmdLine.appendChild(promptSpan);
      cmdLine.appendChild(cmdSpan);
      cmdLine.appendChild(cursor);
      terminalWindow.appendChild(cmdLine);
      terminalWindow.scrollTop = terminalWindow.scrollHeight;

      // Type the command character by character
      for (let i = 0; i < step.command.length; i++) {
        cmdSpan.textContent = step.command.substring(0, i + 1);
        terminalWindow.scrollTop = terminalWindow.scrollHeight;
        await sleep(TYPING_SPEED);
      }

      // Remove cursor, "execute" command
      cursor.remove();
      await sleep(300);

      // Show output
      if (step.output) {
        const outputLines = step.output.split("\n");
        for (const line of outputLines) {
          const outputEl = document.createElement("div");
          outputEl.className = "terminal-line terminal-output";
          outputEl.textContent = line;
          terminalWindow.appendChild(outputEl);
          terminalWindow.scrollTop = terminalWindow.scrollHeight;
          await sleep(30);
        }
      }

      // Show narration
      if (step.narration) {
        narration.textContent = step.narration;
        narration.style.display = "block";
      } else {
        narration.style.display = "none";
      }

      isAnimating = false;
      updateControls();
    }

    nextBtn.addEventListener("click", () => {
      if (currentStep < steps.length - 1 && !isAnimating) {
        animateStep(currentStep + 1);
      }
    });

    prevBtn.addEventListener("click", () => {
      if (currentStep > 0 && !isAnimating) {
        animateStep(currentStep - 1);
      }
    });

    replayBtn.addEventListener("click", () => {
      if (!isAnimating) {
        currentStep = -1;
        terminalWindow.innerHTML = "";
        narration.style.display = "none";
        if (steps.length > 0) {
          animateStep(0);
        }
      }
    });

    // Assemble
    container.innerHTML = "";
    container.appendChild(header);
    container.appendChild(terminalWindow);
    container.appendChild(narration);
    container.appendChild(controls);

    // Auto-start first step
    if (steps.length > 0) {
      animateStep(0);
    }

    updateControls();
  }

  function escapeHtml(str) {
    return str.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  }

  window.RunbookComponents.terminal = initTerminal;
})();
