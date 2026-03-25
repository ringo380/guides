# Testing and Tooling in Python

**Version:** 0.1  
**Year:** 2026  

As your automation scripts grow from simple snippets to production-grade tools, reliability and maintainability become critical. Python has a mature ecosystem for testing and dependency management that helps ensure your code behaves as expected and is easy to share.

## Unit Testing with `pytest`

While Python includes a built-in `unittest` module, [**`pytest`**](https://docs.pytest.org/) is the industry standard due to its simpler syntax, powerful fixtures, and rich plugin ecosystem.

```bash
pip install pytest
```

### Writing Your First Test

`pytest` automatically discovers files that start with `test_` or end with `_test.py`.

```python
# script_to_test.py
def format_server_name(name):
    return name.strip().lower().replace(" ", "-")

# test_script.py
from script_to_test import format_server_name

def test_format_server_name_strips_whitespace():
    assert format_server_name("  WEB01  ") == "web01"

def test_format_server_name_replaces_spaces():
    assert format_server_name("DB Server 01") == "db-server-01"
```

To run your tests, simply execute `pytest` in the project root.

---

## Dependency Management

Managing external libraries is essential for reproducible environments.

### `pip` and `requirements.txt`

The simplest way to manage dependencies is using a `requirements.txt` file.

```bash
# Generate the file
pip freeze > requirements.txt

# Install from the file
pip install -r requirements.txt
```

### Modern Tooling: Poetry

For larger projects, [**Poetry**](https://python-poetry.org/) is the preferred tool for dependency management and packaging. It replaces `requirements.txt`, `setup.py`, and `pip` with a single `pyproject.toml` file.

```bash
# Initialize a new project
poetry init

# Add a dependency
poetry add requests

# Run a script within the managed environment
poetry run python my_script.py
```

---

## Code Quality and Linting

Consistent code style is enforced by linters and formatters, making your tools easier for others to read and maintain.

- [**`flake8`**](https://flake8.pycqa.org/): Checks for PEP 8 compliance and common errors.
- [**`black`**](https://black.readthedocs.io/): An "uncompromising" code formatter that automatically re-styles your code.
- [**`isort`**](https://pycqa.github.io/isort/): Automatically sorts your imports.

```bash
# Example: Running black on your code
black my_script.py
```

---

## Interactive Quiz: Testing and Tooling

Verify your understanding of Python's quality assurance tools.

```quiz
questions:
  - question: "Which command would you use to install a list of dependencies from a text file named `requirements.txt`?"
    options:
      - text: "pip install requirements.txt"
      - text: "pip get -r requirements.txt"
      - text: "pip install -r requirements.txt"
        correct: true
      - text: "python -m pip requirements.txt"
    explanation: "The `-r` (or `--requirement`) flag tells `pip` to read the dependency list from the specified file."

  - question: "In `pytest`, which keyword is used to verify that a value matches your expectation?"
    options:
      - text: "verify"
      - text: "check"
      - text: "assert"
        correct: true
      - text: "expect"
    explanation: "Python's built-in `assert` statement is the primary way to perform checks in `pytest`. If the expression following `assert` is False, the test fails."

  - question: "Which tool is used for 'uncompromising' automatic code formatting in Python?"
    options:
      - text: "flake8"
      - text: "pylint"
      - text: "black"
        correct: true
      - text: "pytest"
    explanation: "`black` is the most popular auto-formatter for Python, known for its strict, opinionated style that eliminates debates over code formatting."
```

---

## Further Reading

- [**Pytest Getting Started Guide**](https://docs.pytest.org/en/latest/getting-started.html)  
- [**Poetry: Basic Usage**](https://python-poetry.org/docs/basic-usage/)  
- [**Real Python: Effective Python Testing**](https://realpython.com/python-testing/)  

---

**Previous:** [System Automation](system-automation.md) | [Back to Index](README.md)
