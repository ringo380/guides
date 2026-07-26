// tests/js/topic-cards.test.js
import { describe, it, expect, beforeEach } from "vitest";
import {
  mockStorage,
  mockAnalytics,
  loadComponent,
  cleanup,
} from "./helpers.js";

describe("TopicCards Component", () => {
  let storage;

  beforeEach(() => {
    cleanup();
    storage = mockStorage();
    mockAnalytics();

    // Mock RunbookTopics
    window.RunbookTopics = {
      "Linux Essentials": {
        prefix: "Linux Essentials/",
        guides: ["shell-basics", "streams-and-redirection"],
      },
    };

    loadComponent("topic-cards");
  });

  function createCards() {
    const container = document.createElement("div");
    container.className = "topic-progression";
    container.innerHTML =
      '<a class="topic-card" href="shell-basics.md" data-guide="shell-basics" data-topic="Linux Essentials">' +
      '<span class="topic-card__number">1</span>' +
      '<div class="topic-card__body"><div class="topic-card__title">Shell Basics</div></div>' +
      '<span class="topic-card__check" aria-hidden="true">&#10003;</span></a>' +
      '<a class="topic-card" href="streams-and-redirection.md" data-guide="streams-and-redirection" data-topic="Linux Essentials">' +
      '<span class="topic-card__number">2</span>' +
      '<div class="topic-card__body"><div class="topic-card__title">Streams and Redirection</div></div>' +
      '<span class="topic-card__check" aria-hidden="true">&#10003;</span></a>';
    document.body.appendChild(container);
    return container;
  }

  it("adds completed class to cards with progress", () => {
    storage.getAllProgress.mockReturnValue({
      "Linux Essentials/shell-basics": {
        sections_read: ["overview"],
        quizzes: {},
        exercises: {},
      },
    });

    createCards();
    window.RunbookComponents["topic-cards"]();

    const cards = document.querySelectorAll(".topic-card");
    expect(cards[0].classList.contains("topic-card--completed")).toBe(true);
    expect(cards[1].classList.contains("topic-card--completed")).toBe(false);
  });

  it("does nothing when no topic cards exist", () => {
    expect(() => window.RunbookComponents["topic-cards"]()).not.toThrow();
  });

  it("does not add completed class when no progress exists", () => {
    storage.getAllProgress.mockReturnValue({});
    createCards();

    const cards = document.querySelectorAll(".topic-card");
    expect(cards[0].classList.contains("topic-card--completed")).toBe(false);
    expect(cards[1].classList.contains("topic-card--completed")).toBe(false);
  });
});
