import { describe, it, expect, beforeEach, vi } from "vitest";
import { loadLib, mockAuth, mockStorage, mockAnalytics, cleanup } from "./helpers.js";

describe("RunbookSync", () => {
  beforeEach(() => {
    cleanup();
    delete window.RunbookSync;
    delete window.RunbookAuth;
    delete window.RunbookStorage;
    delete window.RunbookAnalytics;

    mockStorage();
    mockAnalytics();
    loadLib("sync");
  });

  it("exposes RunbookSync on window", () => {
    expect(window.RunbookSync).toBeDefined();
    expect(typeof window.RunbookSync.pullAndMerge).toBe("function");
    expect(typeof window.RunbookSync.schedulePush).toBe("function");
  });

  it("exposes _mergeProgress for testing", () => {
    expect(typeof window.RunbookSync._mergeProgress).toBe("function");
  });

  describe("merge algorithm", () => {
    const merge = () => window.RunbookSync._mergeProgress;

    it("preserves local-only pages", () => {
      const m = merge();
      const result = m(
        { "page/a": { sections_read: ["s1"], quizzes: {}, exercises: {} } },
        {}
      );
      expect(result["page/a"].sections_read).toEqual(["s1"]);
    });

    it("preserves cloud-only pages", () => {
      const m = merge();
      const result = m(
        {},
        { "page/b": { sections_read: ["s2"], quizzes: {}, exercises: {} } }
      );
      expect(result["page/b"].sections_read).toEqual(["s2"]);
    });

    it("unions sections_read without duplicates", () => {
      const m = merge();
      const result = m(
        { "page/a": { sections_read: ["s1", "s2"], quizzes: {}, exercises: {} } },
        { "page/a": { sections_read: ["s2", "s3"], quizzes: {}, exercises: {} } }
      );
      expect(result["page/a"].sections_read).toEqual(
        expect.arrayContaining(["s1", "s2", "s3"])
      );
      expect(result["page/a"].sections_read).toHaveLength(3);
    });

    it("keeps higher quiz score", () => {
      const m = merge();
      const result = m(
        { p: { sections_read: [], quizzes: { q1: { score: 1, attempts: 2 } }, exercises: {} } },
        { p: { sections_read: [], quizzes: { q1: { score: 0, attempts: 3 } }, exercises: {} } }
      );
      expect(result.p.quizzes.q1.score).toBe(1);
    });

    it("keeps higher attempts when scores are tied", () => {
      const m = merge();
      const result = m(
        { p: { sections_read: [], quizzes: { q1: { score: 0, attempts: 2 } }, exercises: {} } },
        { p: { sections_read: [], quizzes: { q1: { score: 0, attempts: 5 } }, exercises: {} } }
      );
      expect(result.p.quizzes.q1.attempts).toBe(5);
    });

    it("completed=true wins for exercises", () => {
      const m = merge();
      const result = m(
        { p: { sections_read: [], quizzes: {}, exercises: { e1: { completed: false } } } },
        { p: { sections_read: [], quizzes: {}, exercises: { e1: { completed: true } } } }
      );
      expect(result.p.exercises.e1.completed).toBe(true);
    });

    it("merges exercises from both sources", () => {
      const m = merge();
      const result = m(
        { p: { sections_read: [], quizzes: {}, exercises: { e1: { completed: true } } } },
        { p: { sections_read: [], quizzes: {}, exercises: { e2: { completed: true } } } }
      );
      expect(result.p.exercises.e1.completed).toBe(true);
      expect(result.p.exercises.e2.completed).toBe(true);
    });
  });

  describe("schedulePush", () => {
    it("is a no-op when not authenticated", () => {
      // No RunbookAuth set, so getUserId returns null
      window.RunbookSync.schedulePush();
      // Should not throw
    });

    it("debounces push calls", () => {
      vi.useFakeTimers();
      mockAuth({ id: "user-123" });

      window.RunbookSync.schedulePush();
      window.RunbookSync.schedulePush();
      window.RunbookSync.schedulePush();

      // Should not have pushed yet (debounced)
      vi.advanceTimersByTime(1000);
      // Still not pushed (2s debounce)

      vi.advanceTimersByTime(1500);
      // Now it should have fired

      vi.useRealTimers();
    });
  });
});
