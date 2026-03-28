/* SPDX-License-Identifier: MIT */
/* Copyright (c) 2025-2026 Robworks Software LLC */

/**
 * Progress sync module for The Runbook.
 *
 * Syncs localStorage progress with Supabase when the user is authenticated.
 * Uses an additive merge strategy - progress can only increase, never decrease.
 *
 * Listens for "runbook:auth-changed" to trigger initial sync on sign-in.
 * Exports window.RunbookSync.schedulePush() for storage.js to call on writes.
 */

(function () {
  "use strict";

  var SYNC_DEBOUNCE_MS = 2000;
  var TABLE = "runbook_progress";
  var pushTimer = null;
  var syncing = false;

  // --- Merge helpers ---

  function mergeProgress(local, cloud) {
    var merged = {};
    var allKeys = new Set(
      Object.keys(local || {}).concat(Object.keys(cloud || {}))
    );
    allKeys.forEach(function (pageKey) {
      var l = local[pageKey] || { sections_read: [], quizzes: {}, exercises: {} };
      var c = cloud[pageKey] || { sections_read: [], quizzes: {}, exercises: {} };
      merged[pageKey] = {
        sections_read: mergeSectionsRead(
          l.sections_read || [],
          c.sections_read || []
        ),
        quizzes: mergeQuizzes(l.quizzes || {}, c.quizzes || {}),
        exercises: mergeExercises(l.exercises || {}, c.exercises || {}),
      };
    });
    return merged;
  }

  function mergeSectionsRead(local, cloud) {
    return Array.from(new Set(local.concat(cloud)));
  }

  function mergeQuizzes(local, cloud) {
    var merged = {};
    var allIds = new Set(Object.keys(local).concat(Object.keys(cloud)));
    allIds.forEach(function (id) {
      var l = local[id];
      var c = cloud[id];
      if (!l) {
        merged[id] = c;
      } else if (!c) {
        merged[id] = l;
      } else {
        // Keep higher score; if tied, keep higher attempts
        if (l.score > c.score) {
          merged[id] = l;
        } else if (c.score > l.score) {
          merged[id] = c;
        } else {
          merged[id] = l.attempts >= c.attempts ? l : c;
        }
      }
    });
    return merged;
  }

  function mergeExercises(local, cloud) {
    var merged = {};
    var allIds = new Set(Object.keys(local).concat(Object.keys(cloud)));
    allIds.forEach(function (id) {
      var l = local[id];
      var c = cloud[id];
      if (!l) {
        merged[id] = c;
      } else if (!c) {
        merged[id] = l;
      } else {
        // completed=true wins
        merged[id] = { completed: l.completed || c.completed };
      }
    });
    return merged;
  }

  // --- Supabase operations ---

  function getClient() {
    return window.RunbookAuth ? window.RunbookAuth.getClient() : null;
  }

  function getUserId() {
    var user = window.RunbookAuth ? window.RunbookAuth.getUser() : null;
    return user ? user.id : null;
  }

  async function fetchCloudProgress() {
    var sb = getClient();
    var userId = getUserId();
    if (!sb || !userId) return null;

    try {
      var result = await sb
        .from(TABLE)
        .select("progress")
        .eq("user_id", userId)
        .single();

      if (result.error) {
        // PGRST116 = no rows found (first time user)
        if (result.error.code === "PGRST116") return {};
        throw result.error;
      }
      return result.data.progress || {};
    } catch (e) {
      console.warn("[Runbook] Failed to fetch cloud progress:", e);
      if (window.RunbookAnalytics) {
        window.RunbookAnalytics.trackError("sync_fetch", e);
      }
      return null;
    }
  }

  async function pushToCloud(progress) {
    var sb = getClient();
    var userId = getUserId();
    if (!sb || !userId) return false;

    try {
      var result = await sb.from(TABLE).upsert(
        {
          user_id: userId,
          progress: progress,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "user_id" }
      );

      if (result.error) throw result.error;
      return true;
    } catch (e) {
      console.warn("[Runbook] Failed to push progress to cloud:", e);
      if (window.RunbookAnalytics) {
        window.RunbookAnalytics.trackError("sync_push", e);
      }
      return false;
    }
  }

  // --- Sync orchestration ---

  var RunbookSync = {
    async pullAndMerge() {
      if (syncing) return;
      syncing = true;

      try {
        var cloudProgress = await fetchCloudProgress();
        if (cloudProgress === null) {
          // Fetch failed, skip merge
          return;
        }

        var storage = window.RunbookStorage;
        if (!storage) return;

        var localProgress = storage.getAllProgress();
        var merged = mergeProgress(localProgress, cloudProgress);

        // Write merged result to localStorage (bypass sync hook to avoid loop)
        try {
          localStorage.setItem("runbook_progress", JSON.stringify(merged));
        } catch (e) {
          // localStorage full or unavailable
        }

        // Push merged result to cloud
        await pushToCloud(merged);

        // Track sync event
        if (window.RunbookAnalytics) {
          window.RunbookAnalytics.track("progress_sync", {
            direction: "pull_and_merge",
            pages_synced: Object.keys(merged).length,
          });
        }
      } finally {
        syncing = false;
      }
    },

    schedulePush() {
      if (!getUserId()) return;
      if (syncing) return;

      if (pushTimer) clearTimeout(pushTimer);
      pushTimer = setTimeout(async function () {
        pushTimer = null;
        var storage = window.RunbookStorage;
        if (!storage) return;
        await pushToCloud(storage.getAllProgress());
      }, SYNC_DEBOUNCE_MS);
    },

    // Exposed for testing
    _mergeProgress: mergeProgress,
  };

  // Listen for auth changes
  document.addEventListener("runbook:auth-changed", function (e) {
    if (e.detail && e.detail.user) {
      RunbookSync.pullAndMerge();
    }
  });

  window.RunbookSync = RunbookSync;
})();
