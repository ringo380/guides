/**
 * localStorage wrapper for progress tracking.
 *
 * Schema:
 * {
 *   "runbook_progress": {
 *     "<page-path>": {
 *       "sections_read": ["section-id", ...],
 *       "quizzes": { "<id>": { "score": N, "attempts": N } },
 *       "exercises": { "<id>": { "completed": bool } }
 *     }
 *   }
 * }
 */

const STORAGE_KEY = "runbook_progress";

const RunbookStorage = {
  _read() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      return raw ? JSON.parse(raw) : {};
    } catch {
      return {};
    }
  },

  _write(data) {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    } catch {
      // localStorage full or unavailable - silently ignore
    }
  },

  _pagePath() {
    // Derive a stable key from the current URL path
    return window.location.pathname.replace(/\/$/, "").replace(/^\/guides\//, "");
  },

  _getPage(path) {
    const data = this._read();
    const key = path || this._pagePath();
    if (!data[key]) {
      data[key] = { sections_read: [], quizzes: {}, exercises: {} };
      this._write(data);
    }
    return { data, key, page: data[key] };
  },

  // --- Sections ---

  markSectionRead(sectionId) {
    const { data, page } = this._getPage();
    if (!page.sections_read.includes(sectionId)) {
      page.sections_read.push(sectionId);
      this._write(data);
    }
  },

  getSectionsRead(path) {
    const { page } = this._getPage(path);
    return page.sections_read;
  },

  // --- Quizzes ---

  saveQuizScore(quizId, score, attempts) {
    const { data, page } = this._getPage();
    page.quizzes[quizId] = { score, attempts };
    this._write(data);
  },

  getQuizScore(quizId) {
    const { page } = this._getPage();
    return page.quizzes[quizId] || null;
  },

  // --- Exercises ---

  markExerciseComplete(exerciseId) {
    const { data, page } = this._getPage();
    page.exercises[exerciseId] = { completed: true };
    this._write(data);
  },

  isExerciseComplete(exerciseId) {
    const { page } = this._getPage();
    return page.exercises[exerciseId]?.completed || false;
  },

  // --- Aggregate ---

  getPageProgress(path) {
    const { page } = this._getPage(path);
    return page;
  },

  getAllProgress() {
    return this._read();
  },

  resetPage(path) {
    const data = this._read();
    const key = path || this._pagePath();
    delete data[key];
    this._write(data);
  },

  resetAll() {
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch {
      // ignore
    }
  },
};

window.RunbookStorage = RunbookStorage;
