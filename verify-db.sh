#!/bin/bash
# SPDX-License-Identifier: MIT
# Copyright (c) 2025-2026 Robworks Software LLC
#
# Database gate: applies every migration to a throwaway local Postgres and runs
# the pgTAP suite against it.
#
# Deliberately NOT part of verify.sh. It needs Docker, takes minutes on a cold
# start, and verify.sh has to stay runnable on a laptop with Docker closed.
# Run this before touching supabase/migrations, and before any db push.
#
# Usage: ./verify-db.sh [--keep]
#   --keep  leave the local stack running afterwards

set -uo pipefail

REPO_ROOT="$(cd "$(dirname "$0")" && pwd)"
cd "$REPO_ROOT"

KEEP=0
[ "${1:-}" = "--keep" ] && KEEP=1

if ! command -v supabase >/dev/null 2>&1; then
  echo "FAIL: the supabase CLI is not on PATH" >&2
  exit 1
fi

if ! docker info >/dev/null 2>&1; then
  echo "FAIL: Docker is not running - this gate cannot be skipped quietly." >&2
  echo "      Start Docker Desktop and run this again, or run it in CI." >&2
  exit 1
fi

echo "=== starting local Supabase (first run pulls images, this is slow) ==="
supabase start >/dev/null 2>&1
rc=$?
if [ "$rc" -ne 0 ]; then
  # Already-running is fine; anything else is not.
  if ! supabase status >/dev/null 2>&1; then
    echo "FAIL: could not start the local stack (exit $rc)" >&2
    supabase start
    exit 1
  fi
fi

cleanup() {
  if [ "$KEEP" -eq 0 ]; then
    echo
    echo "=== stopping local Supabase ==="
    supabase stop >/dev/null 2>&1
  else
    echo
    echo "=== leaving the local stack running (--keep) ==="
  fi
}
trap cleanup EXIT

echo "=== applying migrations to a clean database ==="
if ! supabase db reset --local; then
  echo "FAIL: migrations did not apply cleanly" >&2
  exit 1
fi
echo "--- migrations PASS"

# Precondition: a test run that found no test files would report success.
count=$(ls supabase/tests/*_test.sql 2>/dev/null | wc -l | tr -d ' ')
if [ "$count" -lt 1 ]; then
  echo "FAIL: no test files found in supabase/tests/ - the suite is not running" >&2
  exit 1
fi
echo "=== running $count pgTAP file(s) ==="

if ! supabase test db --local; then
  echo "FAIL: pgTAP suite failed" >&2
  exit 1
fi
echo "--- pgTAP PASS"

echo
echo "DB VERIFY PASSED"
