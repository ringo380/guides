#!/bin/bash
# SPDX-License-Identifier: MIT
# Copyright (c) 2025-2026 Robworks Software LLC
#
# External link checker for the built site.
#
# Deliberately NOT part of verify.sh: this needs network access and depends on
# third-party uptime, so a failure here does not mean the change under test is
# broken. It runs on a schedule instead.
#
# Usage: ./check-links.sh [site-dir]

set -uo pipefail

# Resolve the site argument against the caller's directory before moving to the
# repo root, or a relative path from anywhere else would silently resolve here.
SITE="${1:-site}"
case "$SITE" in
  /*) ;;
  *)  SITE="$PWD/$SITE" ;;
esac

REPO_ROOT="$(cd "$(dirname "$0")" && pwd)"
cd "$REPO_ROOT"
JOBS="${LINK_CHECK_JOBS:-8}"
UA="Mozilla/5.0 (compatible; RunbookLinkCheck/1.0; +https://runbook.fyi/)"
# Some hosts (gnu.org among them) reject a request with no Accept header
# regardless of the user agent. Sending one is enough to be served normally
# without pretending to be a browser.
ACCEPT_HDR="Accept: text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8"
export UA ACCEPT_HDR

if [ ! -d "$SITE" ]; then
  echo "FAIL: site directory '$SITE' not found - run ./setup-docs.sh && mkdocs build first" >&2
  exit 1
fi

# Hosts and patterns that are never real targets: local previews, RFC 2606
# documentation domains, and the placeholders used in contributor docs.
SKIP_RE='^https?://(localhost|127\.0\.0\.1|0\.0\.0\.0|(www\.)?example\.(com|org|net)|your-server|<)'
# Preconnect hints in the page head are origins, not documents; the bare origin
# legitimately answers 404.
SKIP_RE="$SKIP_RE|^https?://fonts\.gstatic\.com/?$"
# The site's own domain: at scan time the deployed copy may not yet contain
# pages added in the commit being checked, so self-links are not evidence.
SELF_RE='^https?://(runbook\.fyi|ringo380\.github\.io)'

urls=$(grep -rhoE 'href="https?://[^"#]+' "$SITE" --include='*.html' \
  | sed 's/^href="//' \
  | sort -u \
  | grep -Ev "$SKIP_RE" \
  | grep -Ev "$SELF_RE")

count=$(printf '%s\n' "$urls" | grep -c '^https\?://')

# Precondition: a scan that extracted nothing would report zero broken links,
# which is indistinguishable from a clean run. Refuse to pass on an empty set.
if [ "$count" -lt 50 ]; then
  echo "FAIL: only $count external URLs extracted from '$SITE' - extraction is broken" >&2
  exit 1
fi

echo "Checking $count unique external links with $JOBS workers"
echo

curl_reason() {
  # curl exit codes worth telling apart in the report: a domain that no longer
  # resolves is content rot, a TLS handshake failure usually is not.
  case "$1" in
    6)  echo "DNS: host does not resolve" ;;
    7)  echo "connection refused or timed out" ;;
    28) echo "request timed out" ;;
    35) echo "TLS handshake failed" ;;
    60) echo "TLS certificate did not validate" ;;
    *)  echo "curl exit $1" ;;
  esac
}
export -f curl_reason

check_url() {
  local url="$1" req code out rc
  # Material's "edit this page" links carry the source path verbatim, so any
  # directory with a space in its name ("Linux Essentials") produces a URL curl
  # cannot request. Encode before asking, report the original.
  req="${url// /%20}"

  # HEAD first: most servers answer it and it costs no body transfer.
  out=$(curl -s -L -o /dev/null -w '%{http_code} %{exitcode}' \
    --max-time 25 --connect-timeout 10 --retry 1 --retry-delay 2 \
    -A "$UA" -H "$ACCEPT_HDR" -g -I "$req" 2>/dev/null)
  code="${out%% *}"; rc="${out##* }"

  # Plenty of servers refuse HEAD outright. Retry those as a GET so a method
  # restriction is not reported as a dead link. A ranged GET would be cheaper
  # but some servers answer one with 415/416, trading one false signal for
  # another, so take the whole body and discard it.
  case "$code" in
    2*|3*|401|402|418|429|999) ;;
    *)
      out=$(curl -s -L -o /dev/null -w '%{http_code} %{exitcode}' \
        --max-time 25 --connect-timeout 10 --retry 1 --retry-delay 2 \
        -A "$UA" -H "$ACCEPT_HDR" -g "$req" 2>/dev/null)
      code="${out%% *}"; rc="${out##* }"
      ;;
  esac

  # curl writes nothing when it rejects the URL before making a request, and an
  # empty code would fall through the classification below without a visible
  # reason. Make that state explicit instead.
  code="${code:-000}"
  rc="${rc:-99}"

  # No HTTP response at all: report why, since the fix differs by cause.
  if [ "$code" = "000" ]; then
    printf 'BROKEN\t000\t%s\t%s\n' "$url" "$(curl_reason "$rc")"
    return
  fi

  case "$code" in
    2*|3*)       printf 'OK\t%s\t%s\n' "$code" "$url" ;;
    401|402|403|418|429|999)
      # Bot detection and rate limits, not broken content: freedesktop.org
      # answers 418 to anything that is not a browser, and metacpan.org answers
      # 402 to non-browser clients. Reported, not failed.
      printf 'BLOCKED\t%s\t%s\n' "$code" "$url" ;;
    *)           printf 'BROKEN\t%s\t%s\n' "$code" "$url" ;;
  esac
}
export -f check_url

results=$(mktemp)
retry_in=$(mktemp)
retry_out=$(mktemp)
trap 'rm -f "${results:?}" "${retry_in:?}" "${retry_out:?}"' EXIT

# NUL-separate: xargs still treats quotes as special without -0, so a single URL
# containing an apostrophe (ordinary in article slugs) aborts the whole run with
# "unterminated quote" and leaves the remaining links unchecked.
printf '%s\n' "$urls" | tr '\n' '\0' \
  | xargs -0 -P "$JOBS" -I{} bash -c 'check_url "$@"' _ {} \
  > "$results"

# Hosts that throttle by connection see the parallel pass as a burst and drop
# the extra sockets, which looks identical to a dead host (code 000). Recheck
# every failure serially before believing it.
grep '^BROKEN' "$results" | cut -f3 > "$retry_in"
if [ -s "$retry_in" ]; then
  echo "Rechecking $(wc -l < "$retry_in" | tr -d ' ') failures serially"
  echo
  while IFS= read -r url; do
    check_url "$url"
    sleep 1
  done < "$retry_in" > "$retry_out"
  grep -v '^BROKEN' "$results" > "$results.keep"
  cat "$results.keep" "$retry_out" > "$results"
  rm -f "$results.keep"
fi

blocked=$(grep -c '^BLOCKED' "$results")
broken=$(grep -c '^BROKEN' "$results")
ok=$(grep -c '^OK' "$results")

if [ "$blocked" -gt 0 ]; then
  echo "Blocked by the remote host (not treated as failures):"
  grep '^BLOCKED' "$results" | sort -k3 | awk -F'\t' '{printf "  %s  %s\n", $2, $3}'
  echo
fi

if [ "$broken" -gt 0 ]; then
  echo "Broken links:"
  grep '^BROKEN' "$results" | sort -k3 \
    | awk -F'\t' '{ printf "  %s  %s%s\n", $2, $3, ($4 == "" ? "" : "  (" $4 ")") }'
  echo
fi

echo "$ok ok, $blocked blocked, $broken broken (of $count checked)"

# Postcondition: every extracted URL must be accounted for. If the scan died
# partway, the counts above would still read like a clean run.
if [ "$((ok + blocked + broken))" -ne "$count" ]; then
  echo
  echo "FAIL: $((ok + blocked + broken)) results for $count URLs - the scan did not finish" >&2
  exit 1
fi

[ "$broken" -eq 0 ]
