/**
 * Shared test helpers for interactive component tests.
 */

import { vi } from "vitest";
import { readFileSync } from "fs";
import { resolve } from "path";

const ASSETS = resolve(__dirname, "../../assets/javascripts");

/**
 * Set up mock RunbookStorage on window.
 */
export function mockStorage() {
  const store = {};
  const mock = {
    getQuizScore: vi.fn((id) => store[`quiz:${id}`] || null),
    saveQuizScore: vi.fn((id, score, attempts) => {
      store[`quiz:${id}`] = { score, attempts };
    }),
    isExerciseComplete: vi.fn((id) => store[`ex:${id}`] || false),
    markExerciseComplete: vi.fn((id) => {
      store[`ex:${id}`] = true;
    }),
    markSectionRead: vi.fn(),
    getSectionsRead: vi.fn(() => []),
    getPageProgress: vi.fn(() => ({
      sections_read: [],
      quizzes: {},
      exercises: {},
    })),
    getAllProgress: vi.fn(() => ({})),
    resetPage: vi.fn(),
    resetAll: vi.fn(),
  };
  window.RunbookStorage = mock;
  return mock;
}

/**
 * Set up mock RunbookAnalytics on window.
 */
export function mockAnalytics() {
  const mock = {
    track: vi.fn(),
    trackTimed: vi.fn(),
    trackError: vi.fn(),
    debounce: vi.fn(() => vi.fn()),
    Timer: vi.fn(() => ({ elapsed: () => 1.5 })),
  };
  window.RunbookAnalytics = mock;
  return mock;
}

/**
 * Ensure window.RunbookComponents exists.
 */
export function ensureComponents() {
  if (!window.RunbookComponents) {
    window.RunbookComponents = {};
  }
}

/**
 * Load a component script by evaluating its source.
 * Components are IIFEs that register on window.RunbookComponents.
 */
export function loadComponent(name) {
  ensureComponents();
  const path = resolve(ASSETS, "components", `${name}.js`);
  const src = readFileSync(path, "utf-8");
  // eslint-disable-next-line no-eval
  const fn = new Function(src);
  fn();
}

/**
 * Load a lib script.
 */
export function loadLib(name) {
  const path = resolve(ASSETS, "lib", `${name}.js`);
  const src = readFileSync(path, "utf-8");
  const fn = new Function(src);
  fn();
}

/**
 * Create a container div mimicking what interactive.py generates.
 */
export function createContainer(type, config) {
  const div = document.createElement("div");
  div.className = `interactive-${type}`;
  div.setAttribute(
    "data-config",
    JSON.stringify(config)
      .replace(/&/g, "&amp;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;")
  );
  document.body.appendChild(div);
  return div;
}

/**
 * Clean up DOM between tests.
 */
export function cleanup() {
  document.body.innerHTML = "";
}
