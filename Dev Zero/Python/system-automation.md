---
difficulty: intermediate
time_estimate: "35 min"
prerequisites:
  - files-and-apis
learning_outcomes:
  - "Use os, subprocess, and shutil to automate system tasks"
  - "Replace shell scripts with structured Python automation"
tags:
  - python
  - programming
  - automation
---
# System Automation with Python

**Version:** 0.2
**Year:** 2026

---

## Copyright Notice

Copyright (c) 2025-2026 Ryan Thomas Robson / Robworks Software LLC. Licensed under [CC BY-NC-ND 4.0](../../LICENSE-CONTENT). You may share this material for non-commercial purposes with attribution, but you may not distribute modified versions.

---

Python's real power for sysadmins lies in its ability to interact with the operating system. Whether you're managing files, running external commands, parsing arguments, or building monitoring checks, Python provides robust modules that are more reliable, testable, and readable than complex Bash scripts.

---

## File and Directory Operations

### `os` Module Basics

The [**`os`**](https://docs.python.org/3/library/os.html) module provides low-level operating system interfaces.

```python
import os

# Current working directory
cwd = os.getcwd()

# Environment variables
home = os.getenv("HOME")
debug = os.getenv("DEBUG", "false")    # Default if not set

# List directory contents
for entry in os.listdir("/var/log"):
    full_path = os.path.join("/var/log", entry)
    if os.path.isfile(full_path):
        size = os.path.getsize(full_path)
        print(f"{entry}: {size:,} bytes")

# Create directories
os.makedirs("/tmp/backup/2026/03", exist_ok=True)  # Creates parents, no error if exists
```

### `pathlib` for Modern File Operations

[**`pathlib`**](https://docs.python.org/3/library/pathlib.html) provides a cleaner interface for everything `os.path` does.

```python
from pathlib import Path

# Build paths
log_dir = Path("/var/log")
backup_dir = Path("/tmp/backup") / "2026" / "03"
backup_dir.mkdir(parents=True, exist_ok=True)

# Find files by pattern
for log_file in log_dir.glob("*.log"):
    print(f"{log_file.name}: {log_file.stat().st_size:,} bytes")

# Recursive search
for conf in Path("/etc").rglob("*.conf"):
    print(conf)
```

### `shutil` for High-Level Operations

[**`shutil`**](https://docs.python.org/3/library/shutil.html) handles operations that work on entire files and directory trees.

```python
import shutil

# Copy a file (preserves metadata with copy2)
shutil.copy2("config.yaml", "config.yaml.bak")

# Move a file
shutil.move("temp_data.csv", "/data/archives/")

# Copy an entire directory tree
shutil.copytree("/etc/nginx", "/tmp/nginx-backup")

# Delete a directory tree (equivalent to rm -rf)
shutil.rmtree("/tmp/nginx-backup")

# Create a compressed archive
shutil.make_archive("/tmp/logs-backup", "gztar", "/var/log")
# Creates /tmp/logs-backup.tar.gz
```

### `tempfile` for Safe Temporary Files

The [**`tempfile`**](https://docs.python.org/3/library/tempfile.html) module creates temporary files and directories that are cleaned up automatically.

```python
import tempfile

# Temporary file (auto-deleted when closed)
with tempfile.NamedTemporaryFile(mode="w", suffix=".json", delete=False) as tmp:
    tmp.write('{"status": "processing"}')
    print(f"Temp file: {tmp.name}")

# Temporary directory (auto-deleted when context exits)
with tempfile.TemporaryDirectory() as tmpdir:
    work_file = Path(tmpdir) / "output.txt"
    work_file.write_text("intermediate results")
    # Process files in tmpdir...
# Directory and contents are gone here
```

---

## Running External Commands

The [**`subprocess`**](https://docs.python.org/3/library/subprocess.html) module is the standard way to run shell commands from Python.

### `subprocess.run()` - The Default Choice

`subprocess.run()` executes a command, waits for it to finish, and returns the result.

```python
import subprocess

# Run a command and capture output
result = subprocess.run(
    ["df", "-h", "/"],
    capture_output=True,
    text=True                        # Return strings, not bytes
)

if result.returncode == 0:
    print(result.stdout)
else:
    print(f"Error: {result.stderr}")
```

### Capturing stdout and stderr Separately

```python
# Capture both streams
result = subprocess.run(
    ["systemctl", "status", "nginx"],
    capture_output=True,
    text=True
)

print(f"Exit code: {result.returncode}")
print(f"stdout:\n{result.stdout}")
print(f"stderr:\n{result.stderr}")
```

### Checking Return Codes

```python
# Raise an exception if the command fails
try:
    result = subprocess.run(
        ["nginx", "-t"],
        capture_output=True,
        text=True,
        check=True                   # Raises CalledProcessError on non-zero exit
    )
    print("Nginx config is valid")
except subprocess.CalledProcessError as e:
    print(f"Nginx config error:\n{e.stderr}")
```

### Passing Input to Commands

```python
# Pipe a string as stdin
result = subprocess.run(
    ["grep", "ERROR"],
    input="INFO: All good\nERROR: Disk full\nINFO: Syncing...\nERROR: Timeout",
    capture_output=True,
    text=True
)
print(result.stdout)
# ERROR: Disk full
# ERROR: Timeout
```

!!! warning "`shell=True` is a security risk"
    Never pass user input to `subprocess.run()` with `shell=True`. It enables shell injection attacks where a malicious input like `; rm -rf /` gets executed. Always pass commands as a list of arguments (which bypasses the shell entirely), or use `shlex.quote()` if you absolutely must use `shell=True`.

    ```python
    # DANGEROUS - user_input could contain shell metacharacters
    subprocess.run(f"grep {user_input} /var/log/syslog", shell=True)

    # SAFE - each argument is passed directly to the program
    subprocess.run(["grep", user_input, "/var/log/syslog"])
    ```

### `subprocess.run()` vs `subprocess.Popen()`

| Feature | `run()` | `Popen()` |
|---------|---------|-----------|
| Waits for completion | Yes (blocking) | No (non-blocking) |
| Returns | `CompletedProcess` | `Popen` object |
| Use when | You need the result before proceeding | You need to interact with the process while it runs |

Use `run()` for 95% of cases. Use `Popen()` when you need to stream output line by line, send input interactively, or run commands concurrently.

```python
# Popen for streaming output
process = subprocess.Popen(
    ["tail", "-f", "/var/log/syslog"],
    stdout=subprocess.PIPE,
    text=True
)

for line in process.stdout:
    if "ERROR" in line:
        print(f"ALERT: {line.strip()}")
        process.terminate()
        break
```

---

## Logging

The [**`logging`**](https://docs.python.org/3/library/logging.html) module is Python's built-in logging framework. It replaces `print()` for anything beyond quick debugging.

```python
import logging

# Basic configuration
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s",
    datefmt="%Y-%m-%d %H:%M:%S"
)

logger = logging.getLogger(__name__)

logger.info("Service check started")
logger.warning("Disk usage at 85%%")
logger.error("Connection to db01 failed")
logger.critical("All backend servers unreachable")
```

### Logging to a File

```python
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
    handlers=[
        logging.FileHandler("/var/log/my-tool.log"),
        logging.StreamHandler()      # Also print to console
    ]
)
```

!!! tip "Use `logging` instead of `print()` for operational scripts"
    `print()` goes to stdout and has no concept of severity levels, timestamps, or output routing. The `logging` module gives you all three, plus the ability to change verbosity without modifying code (`--verbose` sets level to DEBUG, default is INFO, `--quiet` sets WARNING). For one-off scripts during development, `print()` is fine. For anything that runs in production, use `logging`.

---

## Command-Line Arguments

### `sys.argv` for Simple Scripts

```python
import sys

if len(sys.argv) < 2:
    print(f"Usage: {sys.argv[0]} <hostname>")
    sys.exit(1)

hostname = sys.argv[1]
print(f"Checking {hostname}...")
```

### `argparse` for Production Tools

The [**`argparse`**](https://docs.python.org/3/library/argparse.html) module builds CLI interfaces with help text, type validation, default values, and subcommands.

```python
import argparse

parser = argparse.ArgumentParser(
    description="Archive and compress old log files."
)
parser.add_argument(
    "directory",
    help="Directory containing logs to archive"
)
parser.add_argument(
    "--days", type=int, default=7,
    help="Archive logs older than this many days (default: 7)"
)
parser.add_argument(
    "--compress", choices=["gzip", "bzip2", "none"], default="gzip",
    help="Compression method (default: gzip)"
)
parser.add_argument(
    "-v", "--verbose", action="store_true",
    help="Enable verbose output"
)
parser.add_argument(
    "-n", "--dry-run", action="store_true",
    help="Show what would be done without making changes"
)

args = parser.parse_args()

print(f"Archiving logs in {args.directory} older than {args.days} days")
if args.verbose:
    print(f"Compression: {args.compress}")
if args.dry_run:
    print("(dry run - no changes will be made)")
```

```bash
$ python3 archive_logs.py --help
usage: archive_logs.py [-h] [--days DAYS] [--compress {gzip,bzip2,none}]
                       [-v] [-n] directory

Archive and compress old log files.

positional arguments:
  directory             Directory containing logs to archive

options:
  -h, --help            show this help message and exit
  --days DAYS           Archive logs older than this many days (default: 7)
  --compress {gzip,bzip2,none}
                        Compression method (default: gzip)
  -v, --verbose         Enable verbose output
  -n, --dry-run         Show what would be done without making changes
```

---

## Environment Variables

Environment variables pass configuration to scripts without hardcoding values or using config files.

```python
import os

# Read with defaults
db_host = os.getenv("DB_HOST", "localhost")
db_port = int(os.getenv("DB_PORT", "5432"))
debug = os.getenv("DEBUG", "false").lower() == "true"

# Require a variable (fail fast if missing)
api_key = os.environ["API_KEY"]    # Raises KeyError if not set

# Safer pattern
api_key = os.getenv("API_KEY")
if not api_key:
    print("Error: API_KEY environment variable is required")
    sys.exit(1)
```

---

## Real-World Pattern: Service Health Checker

```python
#!/usr/bin/env python3
"""Check the health of services and report status."""

import argparse
import logging
import subprocess
import sys

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s"
)
logger = logging.getLogger("healthcheck")

def check_service(name):
    """Check if a systemd service is active."""
    result = subprocess.run(
        ["systemctl", "is-active", name],
        capture_output=True, text=True
    )
    return result.stdout.strip() == "active"

def check_port(host, port):
    """Check if a TCP port is reachable."""
    result = subprocess.run(
        ["timeout", "3", "bash", "-c", f"echo > /dev/tcp/{host}/{port}"],
        capture_output=True
    )
    return result.returncode == 0

def main():
    parser = argparse.ArgumentParser(description="Service health checker")
    parser.add_argument("--services", nargs="+", default=["nginx", "postgresql"])
    parser.add_argument("--check-ports", nargs="+", help="host:port pairs to check")
    parser.add_argument("-v", "--verbose", action="store_true")
    args = parser.parse_args()

    if args.verbose:
        logger.setLevel(logging.DEBUG)

    failures = []

    for service in args.services:
        if check_service(service):
            logger.info(f"{service}: OK")
        else:
            logger.error(f"{service}: DOWN")
            failures.append(service)

    if args.check_ports:
        for pair in args.check_ports:
            host, port = pair.split(":")
            if check_port(host, int(port)):
                logger.info(f"{host}:{port}: REACHABLE")
            else:
                logger.error(f"{host}:{port}: UNREACHABLE")
                failures.append(pair)

    if failures:
        logger.critical(f"Failed checks: {', '.join(failures)}")
        sys.exit(2)
    else:
        logger.info("All checks passed")
        sys.exit(0)

if __name__ == "__main__":
    main()
```

```code-walkthrough
language: python
title: Service Health Checker Structure
code: |
  #!/usr/bin/env python3
  """Check the health of services and report status."""

  import argparse
  import logging
  import subprocess
  import sys

  logging.basicConfig(
      level=logging.INFO,
      format="%(asctime)s [%(levelname)s] %(message)s"
  )
  logger = logging.getLogger("healthcheck")

  def check_service(name):
      """Check if a systemd service is active."""
      result = subprocess.run(
          ["systemctl", "is-active", name],
          capture_output=True, text=True
      )
      return result.stdout.strip() == "active"

  def main():
      parser = argparse.ArgumentParser(description="Service health checker")
      parser.add_argument("--services", nargs="+", default=["nginx", "postgresql"])
      parser.add_argument("-v", "--verbose", action="store_true")
      args = parser.parse_args()

      if args.verbose:
          logger.setLevel(logging.DEBUG)
annotations:
  - line: 1
    text: "The shebang line makes this script directly executable on Unix systems with `chmod +x` - no need to type `python3` before the filename."
  - line: 4
    text: "argparse, logging, and subprocess form the standard toolkit for CLI automation scripts. All three are in the standard library."
  - line: 9
    text: "Configure logging once at module level. The format string adds timestamps and severity levels to every message automatically."
  - line: 13
    text: "getLogger() with a name creates a named logger. This is useful when multiple modules log to the same destination - you can tell which component produced each message."
  - line: 15
    text: "Each check is a standalone function that returns a boolean. This makes the script testable - you can call check_service() in a unit test without running main()."
  - line: 18
    text: "The command is passed as a list, not a string. This avoids shell=True and prevents shell injection if the service name comes from user input."
  - line: 19
    text: "capture_output=True captures both stdout and stderr. text=True decodes bytes to strings so you can use string methods like .strip() directly."
  - line: 25
    text: "nargs='+' accepts one or more values after the flag. The default provides sensible services to check when no arguments are given."
  - line: 26
    text: "action='store_true' makes --verbose a boolean flag. No value needed - its presence sets args.verbose to True."
  - line: 30
    text: "Changing the logger level at runtime based on a CLI flag. DEBUG shows everything; the default INFO level hides debug-level messages."
```

---

```terminal
scenario: "Build and test a system automation script"
steps:
  - command: "python3 -c \"import subprocess; r = subprocess.run(['uptime'], capture_output=True, text=True); print(r.stdout.strip())\""
    output: " 14:23:01 up 42 days,  3:17,  2 users,  load average: 0.15, 0.22, 0.18"
    narration: "subprocess.run() captures the output of any command. The capture_output=True and text=True flags give you the output as a Python string."
  - command: "python3 -c \"import subprocess; r = subprocess.run(['systemctl', 'is-active', 'nginx'], capture_output=True, text=True); print(f'nginx: {r.stdout.strip()} (exit code {r.returncode})')\""
    output: "nginx: active (exit code 0)"
    narration: "Check a systemd service status. 'is-active' returns 'active' with exit code 0, or 'inactive'/'failed' with a non-zero code. This makes it easy to use in conditionals."
  - command: "python3 -c \"import os; print(f'HOME={os.getenv(\\\"HOME\\\")}'); print(f'USER={os.getenv(\\\"USER\\\")}'); print(f'DEBUG={os.getenv(\\\"DEBUG\\\", \\\"not set\\\")}')\""
    output: "HOME=/home/admin\nUSER=admin\nDEBUG=not set"
    narration: "Environment variables are the standard way to pass configuration to scripts. os.getenv() returns None (or a default) if the variable isn't set, avoiding KeyError exceptions."
  - command: "python3 -c \"from pathlib import Path; import shutil; Path('/tmp/demo-backup').mkdir(exist_ok=True); shutil.copy2('/etc/hostname', '/tmp/demo-backup/'); print('Backed up:', list(Path('/tmp/demo-backup').iterdir()))\""
    output: "Backed up: [PosixPath('/tmp/demo-backup/hostname')]"
    narration: "Combine pathlib for directory creation with shutil for file copying. copy2 preserves file metadata (timestamps, permissions)."
  - command: "python3 -c \"import logging; logging.basicConfig(level=logging.INFO, format='%(asctime)s [%(levelname)s] %(message)s'); logging.info('Backup complete'); logging.warning('Disk at 82%%')\""
    output: "2026-03-25 14:23:05 [INFO] Backup complete\n2026-03-25 14:23:05 [WARNING] Disk at 82%"
    narration: "The logging module produces timestamped, leveled output. In production, route this to a file or syslog instead of the console."
```

---

## Interactive Quizzes

```quiz
question: "Which function should you use to recursively delete a directory tree?"
type: multiple-choice
options:
  - text: "os.remove()"
    feedback: "os.remove() deletes a single file. It raises an error on directories."
  - text: "os.rmdir()"
    feedback: "os.rmdir() deletes only empty directories. It fails if the directory has contents."
  - text: "shutil.rmtree()"
    correct: true
    feedback: "Correct! shutil.rmtree() recursively removes a directory and all its contents, like rm -rf. Use it with caution."
  - text: "pathlib.Path.unlink()"
    feedback: "unlink() removes a single file. For directories, use shutil.rmtree()."
```

```quiz
question: "Why is `shell=True` dangerous in `subprocess.run()`?"
type: multiple-choice
options:
  - text: "It makes the command run slower."
    feedback: "There's a small overhead from spawning a shell, but the real issue is security."
  - text: "It enables shell injection attacks when user input is part of the command."
    correct: true
    feedback: "Correct! With shell=True, metacharacters like ;, |, and $() are interpreted by the shell. User input containing '; rm -rf /' would be executed. Passing commands as a list bypasses the shell entirely."
  - text: "It only works on Linux, not macOS."
    feedback: "shell=True works on both platforms. The security risk exists on all operating systems."
  - text: "It prevents output capture."
    feedback: "You can capture output with shell=True. The issue is security, not functionality."
```

```quiz
question: "What is the main advantage of `logging` over `print()` for production scripts?"
type: multiple-choice
options:
  - text: "logging is faster than print."
    feedback: "Performance is similar. The advantage is in functionality."
  - text: "logging provides severity levels, timestamps, and configurable output destinations."
    correct: true
    feedback: "Correct! logging supports DEBUG/INFO/WARNING/ERROR/CRITICAL levels, automatic timestamps, output to files and syslog, and runtime verbosity control. print() has none of these."
  - text: "print() is deprecated in Python 3."
    feedback: "print() is not deprecated and is fine for interactive use and quick scripts."
  - text: "logging uses less memory."
    feedback: "Memory usage is similar. The advantage is operational features."
```

---

```exercise
title: "Write a System Health Checker"
scenario: |
  Your team needs a monitoring tool that can be run from cron or a monitoring system. Write a command-line health checker that:

  1. Accepts `--services` (list of systemd service names) and `--disk-paths` (list of filesystem paths) as arguments
  2. Checks each service with `systemctl is-active` via subprocess
  3. Checks each disk path with `shutil.disk_usage`, warning at 80% and critical at 90%
  4. Uses the `logging` module for all output (not `print`)
  5. Supports a `--verbose` flag that enables DEBUG-level logging
  6. Exits with code 0 if all checks pass, 1 for warnings, 2 for critical failures
hints:
  - "Use argparse with nargs='+' for arguments that accept multiple values"
  - "subprocess.run(['systemctl', 'is-active', name], capture_output=True, text=True) returns the status"
  - "Track the worst exit code: worst = max(worst, current_code)"
  - "Set logger.setLevel(logging.DEBUG) when --verbose is passed"
solution: |
  #!/usr/bin/env python3
  """System health checker with configurable checks."""

  import argparse
  import logging
  import shutil
  import subprocess
  import sys

  logging.basicConfig(
      level=logging.INFO,
      format="%(asctime)s [%(levelname)s] %(message)s",
      datefmt="%Y-%m-%d %H:%M:%S"
  )
  logger = logging.getLogger("healthcheck")

  def check_service(name):
      result = subprocess.run(
          ["systemctl", "is-active", name],
          capture_output=True, text=True
      )
      status = result.stdout.strip()
      if status == "active":
          logger.info(f"Service {name}: OK")
          return 0
      else:
          logger.error(f"Service {name}: {status}")
          return 2

  def check_disk(path, warn=80, crit=90):
      try:
          total, used, free = shutil.disk_usage(path)
      except OSError as e:
          logger.error(f"Disk {path}: {e}")
          return 2

      percent = (used / total) * 100
      if percent >= crit:
          logger.critical(f"Disk {path}: {percent:.1f}% (CRITICAL)")
          return 2
      elif percent >= warn:
          logger.warning(f"Disk {path}: {percent:.1f}% (WARNING)")
          return 1
      else:
          logger.info(f"Disk {path}: {percent:.1f}% (OK)")
          return 0

  def main():
      parser = argparse.ArgumentParser(description="System health checker")
      parser.add_argument("--services", nargs="+", default=[])
      parser.add_argument("--disk-paths", nargs="+", default=["/"])
      parser.add_argument("-v", "--verbose", action="store_true")
      args = parser.parse_args()

      if args.verbose:
          logger.setLevel(logging.DEBUG)

      worst = 0
      for svc in args.services:
          worst = max(worst, check_service(svc))
      for path in args.disk_paths:
          worst = max(worst, check_disk(path))

      if worst == 0:
          logger.info("All checks passed")
      sys.exit(worst)

  if __name__ == "__main__":
      main()
```

---

```exercise
title: "Build a File Processing CLI Tool"
difficulty: intermediate
scenario: |
  Your team needs a command-line utility that processes files in a directory. Write a Python script (`file_processor.py`) that:

  1. Uses `argparse` to accept: a required `directory` positional argument, an optional `--pattern` flag (default: `*.log`), an optional `--command` flag (a shell command to run on each file, default: `wc -l`), and a `--verbose` flag
  2. Uses `pathlib.Path.glob()` to find all files matching the pattern in the given directory (non-recursive)
  3. Runs the specified command on each matched file using `subprocess.run()`, passing the command as a list (split the command string and append the file path)
  4. Logs each result using the `logging` module: the filename, the command output (stripped), and whether it succeeded or failed
  5. Prints a summary at the end: total files found, successful, and failed

  Example usage:
  ```
  python3 file_processor.py /var/log --pattern "*.log" --command "wc -l" --verbose
  ```
hints:
  - "Use pathlib.Path(args.directory).glob(args.pattern) to find matching files"
  - "Split the command string with args.command.split() and append str(file_path) to the list"
  - "Wrap each subprocess.run() in try/except for subprocess.CalledProcessError when using check=True"
  - "Track success/failure counts with simple integer counters"
solution: |
  #!/usr/bin/env python3
  """Process files matching a pattern with a shell command."""

  import argparse
  import logging
  import subprocess
  import sys
  from pathlib import Path

  logging.basicConfig(
      level=logging.INFO,
      format="%(asctime)s [%(levelname)s] %(message)s",
      datefmt="%Y-%m-%d %H:%M:%S"
  )
  logger = logging.getLogger("file_processor")

  def main():
      parser = argparse.ArgumentParser(description="Process files with a command")
      parser.add_argument("directory", help="Directory to search for files")
      parser.add_argument("--pattern", default="*.log", help="Glob pattern (default: *.log)")
      parser.add_argument("--command", default="wc -l", help="Command to run on each file (default: wc -l)")
      parser.add_argument("-v", "--verbose", action="store_true", help="Enable debug logging")
      args = parser.parse_args()

      if args.verbose:
          logger.setLevel(logging.DEBUG)

      target_dir = Path(args.directory)
      if not target_dir.is_dir():
          logger.error(f"Not a directory: {args.directory}")
          sys.exit(1)

      files = sorted(target_dir.glob(args.pattern))
      if not files:
          logger.warning(f"No files matching '{args.pattern}' in {args.directory}")
          sys.exit(0)

      logger.info(f"Found {len(files)} files matching '{args.pattern}'")

      succeeded = 0
      failed = 0

      for file_path in files:
          cmd = args.command.split() + [str(file_path)]
          logger.debug(f"Running: {' '.join(cmd)}")

          try:
              result = subprocess.run(cmd, capture_output=True, text=True, check=True)
              output = result.stdout.strip()
              logger.info(f"{file_path.name}: {output}")
              succeeded += 1
          except subprocess.CalledProcessError as e:
              logger.error(f"{file_path.name}: command failed (exit {e.returncode})")
              failed += 1

      logger.info(f"Summary: {len(files)} total, {succeeded} succeeded, {failed} failed")

  if __name__ == "__main__":
      main()
```

---

## Further Reading

- [Python Docs: subprocess](https://docs.python.org/3/library/subprocess.html) - complete reference for running external commands
- [Python Docs: pathlib](https://docs.python.org/3/library/pathlib.html) - modern object-oriented path handling
- [Python Docs: argparse](https://docs.python.org/3/library/argparse.html) - building command-line interfaces
- [Python Docs: logging](https://docs.python.org/3/library/logging.html) - the standard logging framework
- [Real Python: Working with Files](https://realpython.com/working-with-files-in-python/) - practical guide to file operations

---

**Previous:** [Working with Files and APIs](files-and-apis.md) | **Next:** [Testing and Tooling](testing-and-tooling.md) | [Back to Index](README.md)
