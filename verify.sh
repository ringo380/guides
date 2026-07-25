#!/bin/bash
# SPDX-License-Identifier: MIT
# Copyright (c) 2025-2026 Robworks Software LLC
#
# Single local gate. CI calls this rather than duplicating steps in YAML.

set -euo pipefail

# Trust the caller's PATH first (CI's setup-python/setup-node put the right
# interpreters there; a local shell has brew Python with pytest). Only append
# fallback dirs so core tools resolve if PATH is minimal. Prepending /usr/bin
# here would shadow the CI Python with /usr/bin/python3, which has no pytest.
export PATH="$PATH:/opt/homebrew/bin:/usr/bin:/bin:/usr/sbin:/sbin"

REPO_ROOT="$(cd "$(dirname "$0")" && pwd)"
cd "$REPO_ROOT"

fail=0
run() {
  local name="$1"; shift
  echo "=== $name ==="
  if "$@"; then
    echo "--- $name PASS"
  else
    echo "--- $name FAIL"
    fail=1
  fi
}

run "python tests"  python3 -m pytest tests/ -q
run "js tests"      npx vitest run
run "deno tests"    deno test --allow-read supabase/functions/admin-api/tests/
run "docs symlinks" ./setup-docs.sh
run "mkdocs strict" mkdocs build --strict

echo
if [ "$fail" -ne 0 ]; then
  echo "VERIFY FAILED"
  exit 1
fi
echo "VERIFY PASSED"
