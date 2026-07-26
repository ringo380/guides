#!/bin/bash
# SPDX-License-Identifier: MIT
# Copyright (c) 2025-2026 Robworks Software LLC
#
# Breaks each guard in turn and records which tests fail.
# A zero-failure row means the guard is untested OR dead code - inspect it.
# Rows are classified on exit code too, so a mutation that crashes the harness
# is not misread as untested.

set -uo pipefail
export PATH="/opt/homebrew/bin:/usr/bin:/bin:/usr/sbin:/sbin:$PATH"

REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$REPO_ROOT"

FN="supabase/functions/admin-api"

run_suite() {
  local out; out="$(deno test --allow-read "$FN/tests/" 2>&1; echo "RC=$?")"
  local rc="${out##*RC=}"
  local fails; fails="$(printf '%s' "$out" | /usr/bin/grep -c "FAILED" || true)"
  if [ "$rc" -ne 0 ] && [ "$fails" -eq 0 ]; then
    echo "CRASHED"
  elif [ "$fails" -gt 0 ]; then
    echo "GUARDED ($fails failing)"
  else
    echo "UNGUARDED"
  fi
}

mutate() {
  local label="$1" file="$2" from="$3" to="$4"
  if [ ! -f "$file" ]; then
    echo "$label: PENDING ($file not present yet)"
    return
  fi
  local count; count="$(/usr/bin/grep -c -F "$from" "$file" || true)"
  if [ "$count" -ne 1 ]; then
    echo "$label: ANCHOR-AMBIGUOUS (matched $count sites) - fix the anchor, this row proves nothing"
    return
  fi
  cp "$file" "$file.bak"
  # Pass the strings through the environment, not shell interpolation, so a $ or
  # backtick in the anchor cannot be re-interpolated by perl. FROM is matched as
  # a literal; a substitution that changes nothing is a false test, not a pass.
  FROM="$from" TO="$to" perl -pi -e 's/\Q$ENV{FROM}\E/$ENV{TO}/g' "$file"
  if diff -q "$file.bak" "$file" >/dev/null 2>&1; then
    echo "$label: MUTATION-NOOP (substitution changed nothing - anchor is stale)"
    mv "$file.bak" "$file"
    return
  fi
  echo "$label: $(run_suite)"
  mv "$file.bak" "$file"
}

echo "=== Mutation matrix ==="
mutate "1. cache TTL expiry"      "$FN/lib/cache.ts" "return age < ttlMs;" "return true;"
mutate "2. stale-on-error"        "$FN/lib/cache.ts" "stale: true, ageSeconds" "stale: false, ageSeconds"
mutate "3. CORS allowlist"        "$FN/lib/cors.ts"  "return ALLOWED.has(requestOrigin) ? requestOrigin : null;" "return requestOrigin;"
mutate "4. range allowlist"       "$FN/lib/range.ts" "throw new RangeError(" "return { key: \"28d\", days: 28 }; // "
mutate "5. population labelling"  "$FN/lib/merge.ts" "population: \"signed-in users only\"," "population: \"everyone\","

echo
echo "Any UNGUARDED row is dead code or an unguarded rule. Confirm the mutation"
echo "is a real semantic change before concluding either."
