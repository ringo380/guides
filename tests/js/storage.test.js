import { describe, it, expect, beforeEach } from "vitest";
import { loadLib, cleanup } from "./helpers.js";

describe("RunbookStorage", () => {
  beforeEach(() => {
    cleanup();
    localStorage.clear();
    delete window.RunbookStorage;
    // Set a predictable pathname
    Object.defineProperty(window, "location", {
      value: { pathname: "/guides/linux-essentials/shell-basics/" },
      writable: true,
    });
    loadLib("storage");
  });

  it("exposes RunbookStorage on window", () => {
    expect(window.RunbookStorage).toBeDefined();
  });

  it("saves and retrieves quiz scores", () => {
    const s = window.RunbookStorage;
    expect(s.getQuizScore("q1")).toBeNull();
    s.saveQuizScore("q1", 1, 2);
    expect(s.getQuizScore("q1")).toEqual({ score: 1, attempts: 2 });
  });

  it("marks and checks exercise completion", () => {
    const s = window.RunbookStorage;
    expect(s.isExerciseComplete("e1")).toBe(false);
    s.markExerciseComplete("e1");
    expect(s.isExerciseComplete("e1")).toBe(true);
  });

  it("tracks sections read without duplicates", () => {
    const s = window.RunbookStorage;
    s.markSectionRead("sec1");
    s.markSectionRead("sec1");
    s.markSectionRead("sec2");
    expect(s.getSectionsRead()).toEqual(["sec1", "sec2"]);
  });

  it("resets page data", () => {
    const s = window.RunbookStorage;
    s.saveQuizScore("q1", 1, 1);
    s.resetPage();
    expect(s.getQuizScore("q1")).toBeNull();
  });

  it("resets all data", () => {
    const s = window.RunbookStorage;
    s.saveQuizScore("q1", 1, 1);
    s.resetAll();
    expect(s.getAllProgress()).toEqual({});
  });

  it("handles localStorage errors gracefully", () => {
    // Make localStorage throw
    const orig = localStorage.getItem;
    localStorage.getItem = () => {
      throw new Error("quota exceeded");
    };
    const s = window.RunbookStorage;
    expect(s.getQuizScore("q1")).toBeNull();
    localStorage.getItem = orig;
  });
});
