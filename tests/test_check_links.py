"""Tests for check-links.sh classification.

The weekly checker filed issue #166 listing sixteen links as broken. Every one
of them was live: gnu.org answers our requests with 200 from a normal client
and times out for GitHub's runners. A report that is mostly false positives is
worse than no report, because it trains the reader to close it unread.

These tests drive the real script with a stub `curl` on PATH, so the mapping
from curl's exit code to a verdict is exercised rather than described.
"""

import os
import shutil
import subprocess
import textwrap
from pathlib import Path

import pytest

REPO_ROOT = Path(__file__).resolve().parent.parent
SCRIPT = REPO_ROOT / "check-links.sh"

# The script refuses to run on a suspiciously small scan, so every fixture
# needs to clear that floor.
FILLER = 60


def write_site(tmp_path, urls):
    """Build a minimal site directory whose HTML links to `urls`."""
    site = tmp_path / "site"
    site.mkdir()
    hrefs = "\n".join(f'<a href="{u}">x</a>' for u in urls)
    (site / "index.html").write_text(f"<html><body>{hrefs}</body></html>")
    return site


FLAKY = "__flaky__"


def write_fake_curl(tmp_path, responses):
    """Install a stub curl that answers from `responses` (url -> "code rc").

    Anything not listed answers 200, so a test only has to describe the URLs
    it actually cares about. The special value FLAKY times out for the first
    two calls (the HEAD and GET of the parallel pass) and succeeds afterwards,
    which is what a host that throttles by connection looks like.
    """
    bindir = tmp_path / "bin"
    bindir.mkdir()
    counter = tmp_path / "calls"
    arms = []
    for url, value in responses.items():
        if value == FLAKY:
            arms.append(
                f'  "{url}")\n'
                f'    n=$(cat "{counter}" 2>/dev/null || echo 0); n=$((n+1));\n'
                f'    echo "$n" > "{counter}"\n'
                f'    if [ "$n" -le 2 ]; then echo "000 28"; else echo "200 0"; fi ;;'
            )
        else:
            arms.append(f'  "{url}") echo "{value}" ;;')
    (bindir / "curl").write_text(
        textwrap.dedent(
            """\
            #!/bin/bash
            # Stub curl: the URL is the last argument.
            url="${@: -1}"
            case "$url" in
            %s
              *) echo "200 0" ;;
            esac
            """
        )
        % "\n".join(arms)
    )
    (bindir / "curl").chmod(0o755)
    return bindir


def run_check(tmp_path, responses, extra_urls=()):
    urls = [f"https://example{i}.test/page" for i in range(FILLER)]
    urls.extend(responses)
    urls.extend(extra_urls)
    site = write_site(tmp_path, urls)
    bindir = write_fake_curl(tmp_path, responses)

    env = dict(os.environ)
    env["PATH"] = f"{bindir}:{env['PATH']}"
    env["LINK_CHECK_JOBS"] = "16"
    # The recheck's politeness delay is meaningless against a stub curl and
    # would otherwise dominate the suite's runtime.
    env["LINK_CHECK_RETRY_SLEEP"] = "0"
    proc = subprocess.run(
        [str(SCRIPT), str(site)],
        capture_output=True,
        text=True,
        env=env,
        timeout=180,
    )
    return proc


@pytest.fixture(autouse=True)
def require_bash():
    if not shutil.which("bash"):
        pytest.skip("bash not available")


def test_clean_run_passes(tmp_path):
    proc = run_check(tmp_path, {})
    assert proc.returncode == 0, proc.stdout + proc.stderr
    assert "0 broken" in proc.stdout


def test_not_found_is_broken(tmp_path):
    url = "https://dead.test/gone"
    proc = run_check(tmp_path, {url: "404 0"})
    assert proc.returncode == 1
    assert "Broken links:" in proc.stdout
    assert url in proc.stdout.split("Broken links:")[1]


def test_timeout_is_unreachable_not_broken(tmp_path):
    """The #166 case: curl exit 28, no HTTP response, host still resolves."""
    url = "https://www.gnu.org/software/bash/manual/"
    proc = run_check(tmp_path, {url: "000 28"})
    assert proc.returncode == 0, proc.stdout + proc.stderr
    assert "Broken links:" not in proc.stdout
    assert "Unreachable from this runner" in proc.stdout
    assert url in proc.stdout.split("Unreachable from this runner")[1]


def test_connection_refused_is_unreachable(tmp_path):
    proc = run_check(tmp_path, {"https://refused.test/x": "000 7"})
    assert proc.returncode == 0
    assert "Broken links:" not in proc.stdout


def test_empty_curl_output_is_unreachable(tmp_path):
    """curl exit 99 is the script's own sentinel for "curl said nothing"."""
    proc = run_check(tmp_path, {"https://silent.test/x": ""})
    assert proc.returncode == 0
    assert "Unreachable from this runner" in proc.stdout


def test_dns_failure_is_broken(tmp_path):
    """A name that no longer resolves is content rot, not a network path."""
    url = "https://vanished.test/x"
    proc = run_check(tmp_path, {url: "000 6"})
    assert proc.returncode == 1
    assert "Broken links:" in proc.stdout
    assert url in proc.stdout.split("Broken links:")[1]


def test_bad_certificate_is_broken(tmp_path):
    url = "https://expiredcert.test/x"
    proc = run_check(tmp_path, {url: "000 60"})
    assert proc.returncode == 1
    assert url in proc.stdout.split("Broken links:")[1]


def test_bot_block_is_reported_not_failed(tmp_path):
    url = "https://blocked.test/x"
    proc = run_check(tmp_path, {url: "403 0"})
    assert proc.returncode == 0
    assert "Blocked by the remote host" in proc.stdout
    assert url in proc.stdout.split("Blocked by the remote host")[1]


def test_serial_recheck_rescues_a_throttled_host(tmp_path):
    """A host that drops the parallel burst must not be reported at all.

    The first pass sees nothing; the serial recheck gets a 200. Without the
    recheck this URL would be listed as unreachable.
    """
    url = "https://throttled.test/x"
    proc = run_check(tmp_path, {url: FLAKY})
    assert proc.returncode == 0, proc.stdout + proc.stderr
    assert "Rechecking" in proc.stdout
    assert "Unreachable from this runner" not in proc.stdout
    assert f"{FILLER + 1} ok" in proc.stdout


def test_widespread_unreachability_fails_the_run(tmp_path):
    """Tolerating unreachable links only holds while they are a fringe.

    If most of the run cannot connect, the network is the problem and a
    reassuring "0 broken" would be a lie.
    """
    responses = {f"https://down{i}.test/x": "000 28" for i in range(40)}
    proc = run_check(tmp_path, responses)
    assert proc.returncode == 1
    assert "cannot be trusted" in proc.stdout + proc.stderr


def test_every_url_is_accounted_for(tmp_path):
    proc = run_check(
        tmp_path,
        {
            "https://a.test/x": "404 0",
            "https://b.test/x": "000 28",
            "https://c.test/x": "403 0",
        },
    )
    line = [l for l in proc.stdout.splitlines() if " ok, " in l][-1]
    # "N ok, N blocked, N unreachable, N broken (of N checked)"
    nums = [int(t) for t in line.replace(",", " ").split() if t.isdigit()]
    ok, blocked, unreachable, broken, total = nums
    assert (ok, blocked, unreachable, broken) == (FILLER, 1, 1, 1)
    assert ok + blocked + unreachable + broken == total
