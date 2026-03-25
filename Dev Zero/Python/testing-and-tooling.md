# Testing and Tooling in Python

**Version:** 0.2
**Year:** 2026

---

## Copyright Notice

Copyright (c) 2025-2026 Ryan Thomas Robson / Robworks Software LLC. Licensed under [CC BY-NC-ND 4.0](../../LICENSE-CONTENT). You may share this material for non-commercial purposes with attribution, but you may not distribute modified versions.

---

As your automation scripts grow from quick hacks to production tools, you need confidence that they work correctly and stay maintainable. Python has a mature ecosystem for testing, code quality, and dependency management that turns scripts into reliable software.

---

## Unit Testing with `pytest`

While Python includes the built-in `unittest` module, [**`pytest`**](https://docs.pytest.org/) is the industry standard. Its plain `assert` statements, automatic test discovery, and powerful fixture system make tests easier to write and read.

```bash
pip install pytest
```

### Writing Your First Test

`pytest` discovers files matching `test_*.py` or `*_test.py` and runs functions that start with `test_`.

```python
# server_utils.py
def format_server_name(name):
    """Normalize a server name to lowercase kebab-case."""
    return name.strip().lower().replace(" ", "-")

def parse_host_port(address):
    """Split 'host:port' into (host, port) tuple."""
    host, port_str = address.rsplit(":", 1)
    return host, int(port_str)
```

```python
# test_server_utils.py
from server_utils import format_server_name, parse_host_port
import pytest

def test_format_strips_whitespace():
    assert format_server_name("  WEB01  ") == "web01"

def test_format_replaces_spaces():
    assert format_server_name("DB Server 01") == "db-server-01"

def test_format_lowercases():
    assert format_server_name("CacheNode") == "cachenode"

def test_parse_host_port():
    assert parse_host_port("db01:5432") == ("db01", 5432)

def test_parse_host_port_invalid():
    with pytest.raises(ValueError):
        parse_host_port("no-port-here")
```

```bash
$ pytest -v
test_server_utils.py::test_format_strips_whitespace PASSED
test_server_utils.py::test_format_replaces_spaces PASSED
test_server_utils.py::test_format_lowercases PASSED
test_server_utils.py::test_parse_host_port PASSED
test_server_utils.py::test_parse_host_port_invalid PASSED
```

!!! tip "pytest discovery conventions"
    Keep test files next to the code they test, or in a `tests/` directory. Name test files `test_<module>.py` and test functions `test_<behavior>`. pytest finds them automatically - no registration or test suites needed.

### Fixtures

**Fixtures** provide test dependencies (data, connections, temporary files) that are set up before each test and cleaned up after. They replace the setup/teardown pattern from `unittest`.

```python
import pytest
import json
from pathlib import Path

@pytest.fixture
def sample_config(tmp_path):
    """Create a temporary config file for testing."""
    config = {"hostname": "test-server", "port": 8080, "debug": True}
    config_file = tmp_path / "config.json"
    config_file.write_text(json.dumps(config))
    return config_file

def test_load_config(sample_config):
    """Test that config loading works with a real file."""
    with open(sample_config) as f:
        data = json.load(f)
    assert data["hostname"] == "test-server"
    assert data["port"] == 8080

def test_config_file_exists(sample_config):
    """Test that the fixture creates a valid file."""
    assert sample_config.exists()
    assert sample_config.suffix == ".json"
```

`tmp_path` is a built-in pytest fixture that provides a temporary directory unique to each test. It's automatically cleaned up after the test session.

### Parametrize

Run the same test with multiple inputs:

```python
@pytest.mark.parametrize("input_name,expected", [
    ("  WEB01  ", "web01"),
    ("DB Server 01", "db-server-01"),
    ("CacheNode", "cachenode"),
    ("already-formatted", "already-formatted"),
    ("UPPER CASE NAME", "upper-case-name"),
])
def test_format_server_name(input_name, expected):
    assert format_server_name(input_name) == expected
```

This generates 5 separate test cases from a single test function, each with a clear pass/fail status.

---

## Mocking

When your code calls external services, databases, or system commands, you don't want tests to depend on those systems being available. [**`unittest.mock`**](https://docs.python.org/3/library/unittest.mock.html) replaces real dependencies with controlled substitutes.

```python
from unittest.mock import patch, MagicMock
import subprocess

def is_service_running(name):
    """Check if a systemd service is active."""
    result = subprocess.run(
        ["systemctl", "is-active", name],
        capture_output=True, text=True
    )
    return result.stdout.strip() == "active"

@patch("subprocess.run")
def test_service_running(mock_run):
    mock_run.return_value = MagicMock(stdout="active\n", returncode=0)
    assert is_service_running("nginx") is True

@patch("subprocess.run")
def test_service_not_running(mock_run):
    mock_run.return_value = MagicMock(stdout="inactive\n", returncode=3)
    assert is_service_running("nginx") is False
```

!!! warning "Don't over-mock"
    Mocking is a tool, not a goal. If you mock every dependency, your tests verify your mocks, not your code. Mock at boundaries (external APIs, system commands, databases) but let internal logic run for real. A test that mocks everything and passes doesn't prove anything works.

### When to Mock vs When to Use Real Objects

| Situation | Approach |
|-----------|----------|
| External API calls | Mock - don't hit real APIs in tests |
| System commands (`systemctl`, `docker`) | Mock - tests shouldn't require services running |
| File operations | Use `tmp_path` fixture with real files |
| Pure functions (string formatting, math) | No mocking needed - test directly |
| Database queries | Use a test database or mock the connection |

---

## Test Coverage

**Coverage** measures which lines of code your tests execute. It doesn't guarantee correctness, but uncovered code is definitely untested.

```bash
pip install pytest-cov

# Run tests with coverage report
pytest --cov=server_utils --cov-report=term-missing

# Output:
# Name                Stmts   Miss  Cover   Missing
# --------------------------------------------------
# server_utils.py        12      2    83%   15, 22
```

The `Missing` column tells you exactly which lines need tests. Aim for 80-90% coverage on critical code. 100% coverage is rarely worth the effort for utility scripts.

---

## Code Quality Tools

### Linting with `ruff`

[**`ruff`**](https://docs.astral.sh/ruff/) is the modern Python linter - it replaces `flake8`, `isort`, `pycodestyle`, and dozens of other tools in a single fast binary.

```bash
pip install ruff

# Check for issues
ruff check .

# Fix auto-fixable issues
ruff check --fix .

# Format code (replaces black)
ruff format .
```

### Formatting with `black`

[**`black`**](https://black.readthedocs.io/) is the "uncompromising" code formatter. It makes stylistic decisions for you, eliminating debates over formatting.

```bash
pip install black

# Format a file
black my_script.py

# Check without modifying (useful in CI)
black --check my_script.py
```

### Type Checking with `mypy`

[**`mypy`**](https://mypy-lang.org/) checks type annotations without running your code, catching bugs like passing a string where an integer is expected.

```python
# server_utils.py (with type annotations)
def format_server_name(name: str) -> str:
    return name.strip().lower().replace(" ", "-")

def parse_host_port(address: str) -> tuple[str, int]:
    host, port_str = address.rsplit(":", 1)
    return host, int(port_str)
```

```bash
pip install mypy
mypy server_utils.py
```

Type annotations are optional in Python, but they become valuable as your codebase grows. Start by annotating function signatures - you don't need to annotate every variable.

---

## Project Structure

Once a script grows beyond a single file, organizing it properly makes it testable and distributable.

### Minimal Project Layout

```
my-tool/
├── my_tool/
│   ├── __init__.py          # Makes this a Python package
│   ├── cli.py               # Command-line interface (argparse)
│   ├── checks.py            # Business logic (service checks, disk checks)
│   └── utils.py             # Shared utilities
├── tests/
│   ├── test_checks.py
│   └── test_utils.py
├── pyproject.toml            # Project metadata, dependencies, tool config
├── README.md
└── .gitignore
```

### `pyproject.toml`

[**`pyproject.toml`**](https://packaging.python.org/en/latest/guides/writing-pyproject-toml/) is the modern standard for Python project configuration. It replaces `setup.py`, `setup.cfg`, and tool-specific config files.

```toml
[project]
name = "my-tool"
version = "0.1.0"
description = "System health checker"
requires-python = ">=3.10"
dependencies = [
    "requests>=2.28",
]

[project.optional-dependencies]
dev = [
    "pytest>=7.0",
    "pytest-cov",
    "ruff",
    "mypy",
]

[project.scripts]
my-tool = "my_tool.cli:main"

[tool.pytest.ini_options]
testpaths = ["tests"]

[tool.ruff]
line-length = 100

[tool.mypy]
strict = true
```

```code-walkthrough
title: "pyproject.toml Anatomy"
description: "How a modern Python project defines its metadata, dependencies, and tool configuration."
code: |
  [project]
  name = "my-tool"
  version = "0.1.0"
  description = "System health checker"
  requires-python = ">=3.10"
  dependencies = [
      "requests>=2.28",
  ]

  [project.optional-dependencies]
  dev = [
      "pytest>=7.0",
      "pytest-cov",
      "ruff",
      "mypy",
  ]

  [project.scripts]
  my-tool = "my_tool.cli:main"

  [tool.pytest.ini_options]
  testpaths = ["tests"]

  [tool.ruff]
  line-length = 100
annotations:
  - line: 1
    text: "The [project] table defines metadata that pip and other tools use. This follows PEP 621."
  - line: 2
    text: "Package name as it appears on PyPI. Use hyphens for names, underscores for the import directory."
  - line: 5
    text: "Minimum Python version. This prevents installation on older interpreters that lack features you depend on."
  - line: 6
    text: "Runtime dependencies. These are installed automatically when someone pip installs your package."
  - line: 10
    text: "Optional dependency groups. Install with pip install -e '.[dev]' to get testing and linting tools."
  - line: 18
    text: "Console script entry points. After installation, typing 'my-tool' on the command line runs the main() function from my_tool/cli.py."
  - line: 21
    text: "Tool-specific configuration. pytest, ruff, mypy, and other tools read their settings from pyproject.toml instead of separate config files."
```

---

## Pre-commit Hooks

[**`pre-commit`**](https://pre-commit.com/) runs checks automatically before each git commit, catching issues before they reach code review.

```bash
pip install pre-commit
```

```yaml
# .pre-commit-config.yaml
repos:
  - repo: https://github.com/astral-sh/ruff-pre-commit
    rev: v0.3.0
    hooks:
      - id: ruff
        args: [--fix]
      - id: ruff-format
  - repo: https://github.com/pre-commit/pre-commit-hooks
    rev: v4.5.0
    hooks:
      - id: trailing-whitespace
      - id: end-of-file-fixer
      - id: check-yaml
      - id: check-added-large-files
```

```bash
# Install the hooks into your git repo
pre-commit install

# Run against all files (useful for first-time setup)
pre-commit run --all-files
```

---

```terminal
scenario: "Set up a Python project with testing and quality tools"
steps:
  - command: "mkdir -p my_tool tests && touch my_tool/__init__.py"
    output: ""
    narration: "Create the project structure. The __init__.py file makes my_tool a Python package that can be imported."
  - command: "cat my_tool/utils.py"
    output: "def format_server_name(name):\n    return name.strip().lower().replace(' ', '-')\n\ndef parse_host_port(address):\n    host, port_str = address.rsplit(':', 1)\n    return host, int(port_str)"
    narration: "A utility module with two functions. These are the functions we'll test."
  - command: "cat tests/test_utils.py"
    output: "from my_tool.utils import format_server_name, parse_host_port\nimport pytest\n\ndef test_format_strips_whitespace():\n    assert format_server_name('  WEB01  ') == 'web01'\n\ndef test_parse_host_port():\n    assert parse_host_port('db01:5432') == ('db01', 5432)\n\ndef test_parse_invalid():\n    with pytest.raises(ValueError):\n        parse_host_port('no-port')"
    narration: "Test file with three test functions. pytest discovers these automatically by filename and function name conventions."
  - command: "pytest -v"
    output: "tests/test_utils.py::test_format_strips_whitespace PASSED\ntests/test_utils.py::test_parse_host_port PASSED\ntests/test_utils.py::test_parse_invalid PASSED\n\n3 passed in 0.02s"
    narration: "Run pytest with verbose output. All three tests pass. The -v flag shows each test name and its result."
  - command: "pytest --cov=my_tool --cov-report=term-missing"
    output: "tests/test_utils.py ...                                  [100%]\n\nName                  Stmts   Miss  Cover   Missing\n---------------------------------------------------\nmy_tool/__init__.py       0      0   100%\nmy_tool/utils.py          6      0   100%\n---------------------------------------------------\nTOTAL                     6      0   100%\n\n3 passed in 0.05s"
    narration: "Run with coverage. 100% means every line in utils.py is executed by at least one test. The Missing column would show uncovered line numbers."
  - command: "ruff check my_tool/"
    output: "All checks passed!"
    narration: "ruff checks for style violations, common bugs, and import ordering. A clean result means the code follows Python best practices."
```

---

## Interactive Quizzes

```quiz
question: "Which command installs dependencies from a requirements.txt file?"
type: multiple-choice
options:
  - text: "pip install requirements.txt"
    feedback: "This tries to install a package literally named 'requirements.txt' from PyPI."
  - text: "pip install -r requirements.txt"
    correct: true
    feedback: "Correct! The -r flag tells pip to read the dependency list from the file. Each line specifies a package and optional version constraint."
  - text: "pip get -r requirements.txt"
    feedback: "There is no 'get' command in pip."
  - text: "python -m requirements install"
    feedback: "There is no 'requirements' module. Use pip install -r."
```

```quiz
question: "What does `pytest.raises(ValueError)` verify in a test?"
type: multiple-choice
options:
  - text: "That the test function itself raises ValueError."
    feedback: "pytest.raises is a context manager that wraps code you expect to fail, not the test function itself."
  - text: "That the code inside the with block raises a ValueError exception."
    correct: true
    feedback: "Correct! pytest.raises is used as a context manager: 'with pytest.raises(ValueError): code_that_should_fail()'. The test passes if the expected exception is raised, and fails if it isn't."
  - text: "That ValueError is defined in the module."
    feedback: "pytest.raises tests runtime behavior, not definitions."
  - text: "That no ValueError occurs."
    feedback: "It's the opposite - the test expects a ValueError to be raised."
```

```quiz
question: "Why should you avoid mocking everything in your tests?"
type: multiple-choice
options:
  - text: "Mocking is slower than running real code."
    feedback: "Mocks are actually faster than real dependencies. The problem is correctness, not speed."
  - text: "If you mock all dependencies, your tests verify the mocks, not your actual code."
    correct: true
    feedback: "Correct! Over-mocking means your tests pass even when the real integration is broken. Mock at system boundaries (APIs, databases, system commands) but let internal logic run for real."
  - text: "Python doesn't support mocking."
    feedback: "Python has excellent mocking support via unittest.mock in the standard library."
  - text: "Mocking makes tests harder to read."
    feedback: "Readability can be an issue, but the real problem is that over-mocked tests don't prove your code works."
```

---

```exercise
title: "Add Tests to an Existing Function"
scenario: |
  You have a `check_disk(path)` function that returns `('OK', 0)`, `('WARNING', 1)`, or `('CRITICAL', 2)` based on disk usage percentage. Write a comprehensive test suite that:

  1. Uses `@pytest.mark.parametrize` to test multiple thresholds (normal, warning, critical)
  2. Uses `@patch` to mock `shutil.disk_usage` so tests don't depend on actual disk state
  3. Tests the error case where the path doesn't exist (should return `('ERROR', 2)`)
  4. Includes at least 5 test cases covering normal, warning, critical, error, and edge cases (exactly 80%)
  5. Verifies both the status string and exit code for each case
hints:
  - "Mock shutil.disk_usage to return a named tuple: MagicMock(total=100, used=X, free=100-X)"
  - "Use @pytest.mark.parametrize('used,expected_status,expected_code', [...]) for multiple thresholds"
  - "For the error case, make the mock raise OSError"
  - "Edge case: 80% exactly should trigger WARNING (test boundary conditions)"
solution: |
  import pytest
  from unittest.mock import patch, MagicMock

  # Function under test
  def check_disk(path, warn=80, crit=90):
      import shutil
      try:
          usage = shutil.disk_usage(path)
      except OSError:
          return ("ERROR", 2)
      percent = (usage.used / usage.total) * 100
      if percent >= crit:
          return ("CRITICAL", 2)
      elif percent >= warn:
          return ("WARNING", 1)
      return ("OK", 0)

  @pytest.mark.parametrize("used,expected_status,expected_code", [
      (50, "OK", 0),           # Normal usage
      (79, "OK", 0),           # Just below warning
      (80, "WARNING", 1),      # Exactly at warning threshold
      (85, "WARNING", 1),      # In warning range
      (90, "CRITICAL", 2),     # At critical threshold
      (99, "CRITICAL", 2),     # Near full
  ])
  @patch("shutil.disk_usage")
  def test_check_disk_thresholds(mock_usage, used, expected_status, expected_code):
      mock_usage.return_value = MagicMock(total=100, used=used, free=100-used)
      status, code = check_disk("/")
      assert status == expected_status
      assert code == expected_code

  @patch("shutil.disk_usage", side_effect=OSError("No such path"))
  def test_check_disk_missing_path(mock_usage):
      status, code = check_disk("/nonexistent")
      assert status == "ERROR"
      assert code == 2
```

---

## Further Reading

- [pytest Documentation](https://docs.pytest.org/) - fixtures, parametrize, plugins, and configuration
- [Real Python: Effective Testing](https://realpython.com/python-testing/) - practical testing strategies and patterns
- [Ruff Documentation](https://docs.astral.sh/ruff/) - fast linter and formatter replacing flake8, isort, and more
- [Python Packaging Guide](https://packaging.python.org/en/latest/guides/writing-pyproject-toml/) - the official guide to pyproject.toml
- [pre-commit Documentation](https://pre-commit.com/) - automated code quality checks on every commit

---

**Previous:** [System Automation](system-automation.md) | [Back to Index](README.md)
