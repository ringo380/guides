/* SPDX-License-Identifier: MIT */
/* Copyright (c) 2025-2026 Robworks Software LLC */

/**
 * Supabase configuration for The Runbook.
 *
 * The public anon key is safe to expose client-side.
 * Row Level Security (RLS) on the database enforces access control.
 */

window.RunbookSupabaseConfig = {
  url: "https://uhnymifvdauzlmaogjfj.supabase.co",
  anonKey:
    "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVobnltaWZ2ZGF1emxtYW9namZqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTkwMTc1NTEsImV4cCI6MjA3NDU5MzU1MX0.891Tkpu62WIf0nsfG9Jq-GyIldQJunjDLiABjadh3z0",
  cdnUrl:
    "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/dist/umd/supabase.min.js",
};
