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

# The sitemap is parsed as XML, once, into a list of URL paths. Grepping it for
# "<loc>" answered a different question than the one being asked: the count was
# of matching lines rather than of entries, and the per-page absence check
# matched a substring of a URL, so a page at /guides/admin/ would have satisfied
# "admin is absent from the sitemap" while being listed in it. Pretty-printing,
# a namespace change, or an entry split across lines defeat the grep silently -
# and silently, here, means passing.
SITEMAP_PATHS=$(python3 -c '
import sys, xml.etree.ElementTree as ET
from urllib.parse import urlparse
root = ET.parse(sys.argv[1] + "/sitemap.xml").getroot()
# Matched on local name: the sitemaps namespace arrives as part of the tag
# ({http://...}loc), and hardcoding the full name would make a namespace change
# read as "no entries" rather than as a parse failure.
for node in root.iter():
    if node.tag.split("}")[-1] == "loc" and (node.text or "").strip():
        print(urlparse(node.text.strip()).path)
' "$SITE" 2>/dev/null)

# Precondition: prove we are reading a real sitemap with real entries, so a
# passing "admin is absent" check cannot be an empty-file false negative. A
# sitemap that does not parse at all lands here as zero entries.
sitemap_entries() { [ "$(printf '%s\n' "$SITEMAP_PATHS" | grep -c .)" -gt 50 ]; }
check "sitemap.xml parses as XML and has >50 entries" sitemap_entries

# Precondition: prove we can actually parse search_index.json and that it has
# a plausible number of entries, so a passing "page is absent" check below
# cannot be a false negative against an empty or unparseable index.
search_index_entries() {
  python3 -c '
import json, sys
site = sys.argv[1]
try:
    with open(site + "/search/search_index.json") as f:
        data = json.load(f)
except Exception:
    sys.exit(1)
docs = data.get("docs", [])
sys.exit(0 if len(docs) > 1000 else 1)
' "$SITE"
}
check "search_index.json parses and has a plausible number of entries" search_index_entries

# The admin shells are noindex; listing one in the sitemap makes Search Console
# report "Submitted URL marked noindex".
#
# Iterated over every admin page rather than hardcoding one. A second admin page
# inherits none of these assertions automatically, and the accounts page resolves
# email addresses, so shipping it indexed is the failure worth preventing.
ADMIN_PAGES=("admin" "admin-accounts")

page_built() { [ -f "$SITE/$1/index.html" ]; }

# Whole-path comparison against the parsed sitemap, not a substring of the raw
# file.
page_not_in_sitemap() { ! printf '%s\n' "$SITEMAP_PATHS" | grep -qx "/$1/"; }

# The robots meta is parsed out of the HTML and its content split into
# directives. The grep it replaces required one exact spelling - name before
# content, double quotes, noindex first - so reordering the attributes, which
# is a theme's business and not ours, would have reported the admin pages as
# indexable; and it matched anywhere in the file, so the word appearing in page
# text or in a code sample counted as a robots directive.
page_noindex() {
  python3 -c '
import sys
from html.parser import HTMLParser

class Robots(HTMLParser):
    def __init__(self):
        super().__init__()
        self.directives = []

    def handle_starttag(self, tag, attrs):
        if tag.lower() != "meta":
            return
        a = {k.lower(): (v or "") for k, v in attrs}
        if a.get("name", "").lower() == "robots":
            self.directives += [d.strip().lower() for d in a["content"].split(",")]

p = Robots()
with open(sys.argv[1], encoding="utf-8") as f:
    p.feed(f.read())
# Whole directive, not a substring: "noindexing" is not noindex.
sys.exit(0 if "noindex" in p.directives else 1)
' "$SITE/$1/index.html"
}

# mkdocs-material emits compact JSON with no space after the colon
# ("location":"admin/"), so a naive grep for "location": " never matches and
# silently passes regardless of what is in the index. Parse the JSON for real
# and compare the location field exactly, so a future formatting change in
# mkdocs output cannot defeat this check the same way again.
page_not_in_search() {
  python3 -c '
import json, sys
site, page = sys.argv[1], sys.argv[2]
with open(site + "/search/search_index.json") as f:
    data = json.load(f)
docs = data.get("docs", [])
target = page + "/"
sys.exit(1 if any(d.get("location") == target for d in docs) else 0)
' "$SITE" "$1"
}

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
