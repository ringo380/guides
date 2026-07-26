/* SPDX-License-Identifier: MIT */
/* Copyright (c) 2025-2026 Robworks Software LLC */

/**
 * Supabase configuration for The Runbook.
 *
 * The public anon key is safe to expose client-side.
 * Row Level Security (RLS) on the database enforces access control.
 */

window.RunbookSupabaseConfig = {
  url: "https://smulobzymizulakvaito.supabase.co",
  anonKey:
    "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNtdWxvYnp5bWl6dWxha3ZhaXRvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzY3MzU0MTgsImV4cCI6MjA5MjMxMTQxOH0.vpPyS_Zh6otHfg-AFWx4QVIiQ57GjnabD3lhLEsu4Hs",
  cdnUrl:
    "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/dist/umd/supabase.min.js",
};
