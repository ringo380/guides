#!/bin/bash
# SPDX-License-Identifier: MIT
# Copyright (c) 2025-2026 Robworks Software LLC
#
# Post-build invariants for the generated site/ directory.
# Runs after `mkdocs build --strict`, which cannot express these itself.

set -uo pipefail

REPO_ROOT="$(cd "$(dirname "$0")" && pwd)"
cd "$REPO_ROOT"

SITE="${1:-site}"
fail=0

check() {
  local name="$1"; shift
  if "$@"; then
    echo "  ok   $name"
  else
    echo "  FAIL $name"
    fail=1
  fi
}

if [ ! -d "$SITE" ]; then
  echo "  FAIL site directory '$SITE' not found - run mkdocs build first"
  exit 1
fi

# Precondition: prove we are reading a real sitemap with real entries, so a
# passing "admin is absent" check cannot be an empty-file false negative.
sitemap_entries() { [ "$(grep -c '<loc>' "$SITE/sitemap.xml" 2>/dev/null || echo 0)" -gt 50 ]; }
check "sitemap.xml exists and has >50 entries" sitemap_entries

# The admin shells are noindex; listing one in the sitemap makes Search Console
# report "Submitted URL marked noindex".
#
# Iterated over every admin page rather than hardcoding one. A second admin page
# inherits none of these assertions automatically, and the accounts page resolves
# email addresses, so shipping it indexed is the failure worth preventing.
ADMIN_PAGES=("admin" "admin-accounts")

page_built() { [ -f "$SITE/$1/index.html" ]; }
page_not_in_sitemap() { ! grep -q "<loc>[^<]*/$1/</loc>" "$SITE/sitemap.xml"; }
page_noindex() { grep -qi 'name="robots" content="noindex' "$SITE/$1/index.html"; }
page_not_in_search() { ! grep -q "\"location\": \"$1/\"" "$SITE/search/search_index.json"; }

for page in "${ADMIN_PAGES[@]}"; do
  # Precondition: the page must actually be built, or the three checks below
  # pass vacuously against a file that does not exist.
  check "$page page was built" page_built "$page"

  check "$page page absent from sitemap.xml" page_not_in_sitemap "$page"
  check "$page page carries a noindex robots meta" page_noindex "$page"
  check "$page page absent from the search index" page_not_in_search "$page"
done

robots_exists() { [ -f "$SITE/robots.txt" ]; }
check "robots.txt is published" robots_exists

robots_points_at_sitemap() { grep -qi '^Sitemap: https://runbook.fyi/sitemap.xml' "$SITE/robots.txt"; }
check "robots.txt references the sitemap" robots_points_at_sitemap

# Every page needs a meta description; without one, search engines invent a
# snippet from whatever text happens to be near the top of the page.
pages_have_descriptions() {
  local total missing
  total=$(find "$SITE" -name index.html | wc -l | tr -d ' ')
  [ "$total" -gt 50 ] || return 1
  missing=$(find "$SITE" -name index.html -print0 \
    | xargs -0 grep -L '<meta name="description" content="[^"]' \
    | wc -l | tr -d ' ')
  [ "$missing" -eq 0 ]
}
check "every built page has a non-empty meta description" pages_have_descriptions

# CNAME must survive every build or Pages drops the custom domain.
cname_ok() { [ -f "$SITE/CNAME" ] && grep -q 'runbook.fyi' "$SITE/CNAME"; }
check "CNAME published with runbook.fyi" cname_ok

exit "$fail"
