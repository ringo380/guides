---
difficulty: intermediate
time_estimate: "50 min"
prerequisites:
  - object-oriented-programming
learning_outcomes:
  - "Use closures, decorators, and generators to write reusable Python code"
  - "Navigate the import system and create properly structured packages"
  - "Manage project environments with advanced pip and poetry workflows"
tags:
  - python
  - programming
  - functions
  - modules
---
# Functions and Modules

**Version:** 0.1
**Year:** 2026

---

## Copyright Notice

Copyright (c) 2025-2026 Ryan Thomas Robson / Robworks Software LLC. Licensed under [CC BY-NC-ND 4.0](../../LICENSE-CONTENT). You may share this material for non-commercial purposes with attribution, but you may not distribute modified versions.

---

You already know how to define functions with `def` and install packages with `pip`. This guide goes deeper on both fronts. Python treats functions as ordinary objects - you can pass them around, nest them, and transform them with decorators. On the module side, the import system that runs every time you write `import os` is a sophisticated machinery of finders, loaders, and caches. Understanding both halves - functions as building blocks and modules as the organizational layer - is what separates scripts from maintainable projects.

```mermaid
flowchart LR
    A["First-Class Functions"] --> B["Closures"]
    B --> C["Decorators"]
    C --> D["Generators"]
    D --> E["Import System"]
    E --> F["Packages"]
    F --> G["Environments"]
```

The guide follows the path from left to right: advanced function features first, then the module and package system, and finally the tooling that ties it all together.

---

## First-Class Functions

In Python, **functions are objects**. A `def` statement creates a function object and binds it to a name, but that name is just a variable like any other. You can assign it, store it in a data structure, or pass it as an argument.

```python
def add(a, b):
    return a + b

def subtract(a, b):
    return a - b

# Functions stored in a dictionary
operations = {
    "add": add,
    "subtract": subtract,
}

result = operations["add"](10, 3)  # 13
```

This pattern - a **dispatch table** - replaces long `if`/`elif` chains with a clean lookup. It appears everywhere in Python: web framework route registries, CLI argument handlers, and plugin systems.

Functions can also accept other functions as arguments. You have already used this with built-in functions like [**`sorted()`**](https://docs.python.org/3/library/functions.html#sorted):

```python
servers = [
    {"name": "web-1", "load": 0.82},
    {"name": "db-1", "load": 0.45},
    {"name": "cache-1", "load": 0.91},
]

# Pass a function (lambda) as the sort key
by_load = sorted(servers, key=lambda s: s["load"])
```

And functions can return other functions. This is the foundation for closures and decorators, which you will see next.

```code-walkthrough
title: Dispatch Table Pattern
description: A function registry that maps string commands to callable handlers.
language: python
code: |
    import sys

    def cmd_status(args):
        print(f"Checking status of {args.host}...")
        return check_host(args.host)

    def cmd_restart(args):
        print(f"Restarting {args.service} on {args.host}...")
        return restart_service(args.host, args.service)

    def cmd_logs(args):
        print(f"Fetching last {args.lines} lines from {args.host}...")
        return fetch_logs(args.host, args.lines)

    COMMANDS = {
        "status": cmd_status,
        "restart": cmd_restart,
        "logs": cmd_logs,
    }

    def main():
        args = parse_args()
        handler = COMMANDS.get(args.command)
        if handler is None:
            print(f"Unknown command: {args.command}", file=sys.stderr)
            sys.exit(1)
        handler(args)
annotations:
    - line: 1
      text: "Standard library import - sys.exit and sys.stderr for error handling."
    - line: 3
      text: "Each command handler is a plain function with the same signature (takes args, returns a result)."
    - line: 15
      text: "The dispatch table maps command name strings to function objects - no parentheses, so nothing is called yet."
    - line: 23
      text: "COMMANDS.get() returns None for unknown commands instead of raising a KeyError."
    - line: 27
      text: "handler(args) calls whichever function was looked up. Adding a new command means adding one function and one dictionary entry."
```

---

## Closures and Scope

When a function is defined inside another function, the inner function can reference variables from the enclosing scope. This creates a **closure** - the inner function "closes over" the enclosing variables, keeping them alive even after the outer function returns.

Python resolves variable names using the **LEGB rule**, checking four scopes in order:

1. **Local** - names assigned inside the current function
2. **Enclosing** - names in any enclosing function (for nested functions)
3. **Global** - names at the module level
4. **Built-in** - names in the `builtins` module (`len`, `print`, `range`, etc.)

```python
limit = 100  # Global scope

def make_checker(threshold):  # threshold is in the enclosing scope
    def check(value):         # value is in the local scope
        return value > threshold
    return check

is_high = make_checker(80)
is_high(95)   # True  - threshold=80 is captured in the closure
is_high(50)   # False
```

The function `make_checker` is a **factory function** - it creates and returns a new function each time it is called. Each returned function carries its own copy of `threshold`.

!!! tip "The `nonlocal` keyword"
    If an inner function needs to *modify* an enclosing variable (not just read it), use `nonlocal`. Without it, an assignment creates a new local variable instead of updating the enclosing one.

```python
def make_counter(start=0):
    count = start
    def increment():
        nonlocal count
        count += 1
        return count
    return increment

counter = make_counter()
counter()  # 1
counter()  # 2
counter()  # 3
```

A practical use of closures is building **configurable retry logic**:

```python
import time

def make_retrier(max_attempts=3, delay=1.0):
    def retry(func, *args, **kwargs):
        last_error = None
        for attempt in range(1, max_attempts + 1):
            try:
                return func(*args, **kwargs)
            except Exception as e:
                last_error = e
                if attempt < max_attempts:
                    time.sleep(delay)
        raise last_error
    return retry

cautious_retry = make_retrier(max_attempts=5, delay=2.0)
result = cautious_retry(fetch_data, "https://api.example.com/health")
```

Each call to `make_retrier` captures `max_attempts` and `delay` in a closure, producing a self-contained retry function with its own configuration.

---

## Decorators

A **decorator** is a function that takes a function as input and returns a modified version of it. You have already seen the building blocks - first-class functions and closures. A decorator combines them into a pattern for wrapping behavior around existing functions.

Start with the manual approach:

```python
import time

def timing(func):
    def wrapper(*args, **kwargs):
        start = time.perf_counter()
        result = func(*args, **kwargs)
        elapsed = time.perf_counter() - start
        print(f"{func.__name__} took {elapsed:.4f}s")
        return result
    return wrapper

def process_data(records):
    # ... expensive computation ...
    return sorted(records, key=lambda r: r["score"])

process_data = timing(process_data)  # Manually wrap
```

The last line is what the **`@` syntax** replaces. These two forms are equivalent:

```python
# With @ syntax
@timing
def process_data(records):
    return sorted(records, key=lambda r: r["score"])

# Without @ syntax
def process_data(records):
    return sorted(records, key=lambda r: r["score"])
process_data = timing(process_data)
```

There is one problem with the simple wrapper above: the wrapped function loses its original name and docstring. Calling `process_data.__name__` returns `"wrapper"` instead of `"process_data"`. The [**`functools.wraps`**](https://docs.python.org/3/library/functools.html#functools.wraps) decorator fixes this by copying metadata from the original function to the wrapper:

```code-walkthrough
title: Building a @timing Decorator
description: A complete decorator with functools.wraps, showing the wrapping mechanics step by step.
language: python
code: |
    import functools
    import time

    def timing(func):
        @functools.wraps(func)
        def wrapper(*args, **kwargs):
            start = time.perf_counter()
            result = func(*args, **kwargs)
            elapsed = time.perf_counter() - start
            print(f"{func.__name__} took {elapsed:.4f}s")
            return result
        return wrapper

    @timing
    def fetch_report(report_id):
        """Download and parse a report by ID."""
        data = download(report_id)
        return parse(data)

    # fetch_report.__name__ == "fetch_report" (preserved by @wraps)
    # fetch_report.__doc__  == "Download and parse a report by ID."
annotations:
    - line: 4
      text: "The decorator takes a single argument: the function being decorated."
    - line: 5
      text: "@functools.wraps(func) copies __name__, __doc__, and other attributes from func to wrapper."
    - line: 6
      text: "*args and **kwargs let wrapper accept any arguments, so the decorator works on functions with any signature."
    - line: 8
      text: "The original function is called inside the wrapper. The decorator adds behavior around it."
    - line: 12
      text: "Return wrapper - this function object replaces the original in the caller's namespace."
    - line: 14
      text: "@timing is equivalent to: fetch_report = timing(fetch_report)"
    - line: 20
      text: "Thanks to @wraps, introspection tools and help() still show the original name and docstring."
```

### Decorators with Arguments

Sometimes you want a decorator that takes configuration. A **decorator factory** is a function that returns a decorator:

```python
import functools
import time

def timing(threshold=0.0):
    def decorator(func):
        @functools.wraps(func)
        def wrapper(*args, **kwargs):
            start = time.perf_counter()
            result = func(*args, **kwargs)
            elapsed = time.perf_counter() - start
            if elapsed > threshold:
                print(f"SLOW: {func.__name__} took {elapsed:.4f}s")
            return result
        return wrapper
    return decorator

@timing(threshold=0.5)
def process_batch(items):
    # Only logs if execution exceeds 0.5 seconds
    ...
```

There are three layers: `timing()` returns `decorator`, which takes `func` and returns `wrapper`. The `@timing(threshold=0.5)` call executes the outer function first, producing the actual decorator.

### Stacking Decorators

Multiple decorators execute from bottom to top:

```python
@require_auth       # 3rd: checks authentication
@validate_input     # 2nd: validates the arguments
@timing()           # 1st: wraps the innermost function
def create_user(username, email):
    ...
```

The function is first wrapped by `@timing()`, then that result is wrapped by `@validate_input`, and finally by `@require_auth`. When `create_user()` is called, `require_auth` runs first (outermost), then `validate_input`, then `timing`, then the original function.

!!! warning "Decorator order matters"
    If `@timing()` is above `@require_auth`, the timer includes the authentication check. If it is below, it only measures the core function. Place decorators deliberately based on what you want each one to see.

```quiz
title: Decorator Mechanics
questions:
    - question: "What does `@functools.wraps(func)` do inside a decorator?"
      options:
        - text: "Makes the decorator run faster"
          correct: false
          explanation: "wraps has no effect on execution speed."
        - text: "Copies the original function's __name__, __doc__, and other metadata to the wrapper"
          correct: true
          explanation: "Without @wraps, the decorated function loses its original name and docstring. wraps preserves these attributes for introspection."
        - text: "Prevents the original function from being garbage collected"
          correct: false
          explanation: "The closure already holds a reference to the original function. wraps handles metadata, not memory management."
        - text: "Makes the decorator work with async functions"
          correct: false
          explanation: "Async support requires awaiting the result inside the wrapper. wraps only handles metadata."
    - question: "Given `@A @B @C def f(): ...`, what is the wrapping order?"
      options:
        - text: "A wraps first, then B, then C"
          correct: false
          explanation: "Decorators apply bottom-to-top. C wraps first."
        - text: "C wraps first, then B wraps that result, then A wraps the final result"
          correct: true
          explanation: "Decorators apply bottom-to-top: f = A(B(C(f))). When f() is called, A's wrapper runs first (outermost), then B's, then C's, then the original f."
        - text: "All three wrap f simultaneously"
          correct: false
          explanation: "Decorators are applied sequentially, one at a time, from bottom to top."
        - text: "The order depends on the decorators' return types"
          correct: false
          explanation: "The order is always bottom-to-top, determined by their position in the source code."
    - question: "What does a decorator factory return?"
      options:
        - text: "The wrapped function"
          correct: false
          explanation: "That is what the inner decorator returns. The factory returns the decorator itself."
        - text: "A decorator (a function that takes a function and returns a function)"
          correct: true
          explanation: "A decorator factory like timing(threshold=0.5) returns a decorator. That decorator then receives the target function and returns the wrapper."
        - text: "A class instance"
          correct: false
          explanation: "While class-based decorators exist, a decorator factory specifically returns a function."
        - text: "None"
          correct: false
          explanation: "Returning None would replace the decorated function with None, breaking it."
```

---

## Generators and Iterators

A **generator** is a function that produces a sequence of values one at a time, pausing between each. Instead of building an entire list in memory and returning it, a generator **yields** values on demand.

```python
def count_up(limit):
    n = 1
    while n <= limit:
        yield n
        n += 1

for number in count_up(5):
    print(number)  # 1, 2, 3, 4, 5
```

When Python encounters `yield`, the function's execution is suspended - local variables, instruction pointer, and all - until the next value is requested. This makes generators ideal for processing large datasets or infinite sequences without exhausting memory.

### Generator State

A generator object has four possible states:

- **Created** - the generator function was called, but `next()` has not been called yet
- **Suspended** - paused at a `yield` expression, waiting for the next `next()` call
- **Running** - currently executing (between a `next()` call and the next `yield`)
- **Closed** - the function has returned or `close()` was called

```python
gen = count_up(3)        # Created
next(gen)                # Running -> yields 1 -> Suspended
next(gen)                # Running -> yields 2 -> Suspended
next(gen)                # Running -> yields 3 -> Suspended
next(gen)                # Running -> returns  -> raises StopIteration
```

### Generator Expressions

Just as list comprehensions provide a compact syntax for building lists, **generator expressions** produce values lazily:

```python
# List comprehension - builds entire list in memory
squares_list = [x ** 2 for x in range(1_000_000)]

# Generator expression - produces values on demand
squares_gen = (x ** 2 for x in range(1_000_000))
```

The generator expression uses parentheses instead of brackets and consumes almost no memory regardless of the range size. You can iterate over it once, but you cannot index into it or get its length without consuming it.

```terminal
title: Generator Memory Comparison
description: Comparing memory usage between a list and a generator for large sequences.
steps:
    - command: python3
      narration: "Start a Python REPL to compare memory usage."
      output: "Python 3.12.0 (main, Oct  2 2025, 00:00:00)\n>>>"
    - command: "import sys"
      narration: "Import sys to measure object sizes."
      output: ">>>"
    - command: "big_list = [x ** 2 for x in range(1_000_000)]"
      narration: "Create a list with one million squared values."
      output: ">>>"
    - command: "sys.getsizeof(big_list)"
      narration: "Check how much memory the list consumes."
      output: "8448728"
    - command: "big_gen = (x ** 2 for x in range(1_000_000))"
      narration: "Create a generator expression for the same computation."
      output: ">>>"
    - command: "sys.getsizeof(big_gen)"
      narration: "The generator object itself is tiny - it stores only the suspended state, not the values. Over 8 MB versus about 200 bytes."
      output: "200"
    - command: "sum(big_gen)"
      narration: "You can still iterate through all values. The generator produces them one at a time."
      output: "333332833333500000"
```

### yield from

When a generator needs to delegate to another generator or iterable, [**`yield from`**](https://docs.python.org/3/reference/expressions.html#yield-expressions) passes values through directly:

```python
def read_files(paths):
    for path in paths:
        yield from read_lines(path)

def read_lines(path):
    with open(path) as f:
        for line in f:
            yield line.rstrip("\n")
```

Without `yield from`, you would need an inner `for` loop that yields each value individually. `yield from` also propagates `send()` and `throw()` calls to the inner generator, which matters for advanced coroutine patterns.

!!! tip "When to use generators"
    Use a generator when you are processing data that could be large, you only need to iterate through it once, and you do not need random access. Common examples: reading files line by line, streaming API responses, transforming database result sets, and pipeline-style data processing.

---

## The Import System

Every `import` statement triggers a multi-step process. Understanding it helps you debug import errors, avoid circular imports, and structure projects effectively.

### How Import Works

When Python encounters `import mymodule`, it follows these steps:

1. **Check the cache** - look in [**`sys.modules`**](https://docs.python.org/3/library/sys.html#sys.modules) for an already-loaded module. If found, return it immediately.
2. **Find the module** - search [**`sys.path`**](https://docs.python.org/3/library/sys.html#sys.path) using a series of **finders** (importlib meta path finders). The default finders check built-in modules, frozen modules, and the filesystem.
3. **Load the module** - once found, a **loader** reads the source, compiles it to bytecode (cached in `__pycache__/`), and executes the module's top-level code.
4. **Cache the module** - store the module object in `sys.modules` so future imports skip steps 2-3.

```python
import sys

# After importing os, it is cached
import os
print("os" in sys.modules)  # True

# Importing again returns the cached object - the module code does not re-execute
import os  # No-op, returns cached module
```

### Import Styles

```python
import os                        # Access as os.path.join(...)
from os.path import join         # Access as join(...)
from os.path import join as pjoin  # Access as pjoin(...)
import os.path                   # Access as os.path.join(...)
```

The `from` form binds specific names into the current namespace. The plain `import` form binds the top-level module. Neither form is inherently better - `from` is convenient for frequently used names, while plain `import` makes the source module explicit at every call site.

### Relative Imports

Inside a package, you can import from sibling or parent modules using dots:

```python
# Inside mypackage/utils/helpers.py
from . import formatting          # Same directory (mypackage/utils/)
from .formatting import bold      # Specific name from sibling
from .. import config             # Parent directory (mypackage/)
from ..core import engine         # Sibling of parent (mypackage/core/)
```

A single dot (`.`) means the current package directory. Two dots (`..`) mean the parent. Relative imports only work inside packages - they fail in standalone scripts run directly with `python script.py`.

### sys.path

`sys.path` is a list of directory paths that Python's filesystem finder searches, in order:

```python
import sys
for p in sys.path:
    print(p)
```

The first entry is typically the directory containing the script being run (or an empty string `""` for the interactive interpreter). The rest come from the `PYTHONPATH` environment variable, the site-packages directory (where pip installs packages), and the standard library path.

!!! warning "Modifying sys.path"
    You can append directories to `sys.path` at runtime, but doing so makes your code dependent on filesystem layout. Prefer installing packages properly (with `pip install -e .`) over `sys.path` manipulation.

### Circular Imports

A circular import happens when module A imports module B, and module B imports module A. Python does not raise an error immediately - it returns the partially initialized module from `sys.modules` - but you may get `ImportError` or `AttributeError` if you try to use a name that has not been defined yet.

```python
# models.py
from validators import validate_user  # validators.py imports models.py too

class User:
    def save(self):
        validate_user(self)
```

```python
# validators.py
from models import User  # Circular: models.py imports validators.py

def validate_user(user):
    if not isinstance(user, User):
        raise TypeError("Expected a User instance")
```

Three strategies to break the cycle:

1. **Move the import inside the function** that needs it (lazy import)
2. **Reorganize** so shared types live in a third module both can import
3. **Use `TYPE_CHECKING`** for type-hint-only imports that do not need runtime access

```python
# Option 1: Lazy import
def validate_user(user):
    from models import User  # Imported only when this function runs
    if not isinstance(user, User):
        raise TypeError("Expected a User instance")
```

### The \_\_name\_\_ Guard

When Python loads a module, it sets the `__name__` attribute. If the module is the entry point (run directly), `__name__` is `"__main__"`. If it is imported, `__name__` is the module's qualified name.

```python
# mymodule.py
def main():
    print("Running as a script")

if __name__ == "__main__":
    main()
```

This guard lets a file serve as both an importable module and a standalone script. Without it, the `main()` call would execute every time another module imports `mymodule`.

```quiz
title: Import System
questions:
    - question: "What happens when you import a module that is already in sys.modules?"
      options:
        - text: "Python re-reads and re-executes the module source"
          correct: false
          explanation: "Re-executing would cause duplicate side effects. The cache exists specifically to prevent this."
        - text: "Python returns the cached module object without re-executing any code"
          correct: true
          explanation: "sys.modules acts as a cache. Once a module is loaded, subsequent import statements return the same object immediately."
        - text: "Python raises an ImportError"
          correct: false
          explanation: "A module in sys.modules means it was already successfully loaded."
        - text: "Python checks if the source file has changed and reloads if necessary"
          correct: false
          explanation: "Automatic reloading does not happen. You must explicitly call importlib.reload() for that."
    - question: "Why do relative imports fail in a script run directly with `python script.py`?"
      options:
        - text: "Relative imports require Python 3.10+"
          correct: false
          explanation: "Relative imports have been available since Python 3.0."
        - text: "The script has no __package__ attribute, so Python cannot resolve the dots"
          correct: true
          explanation: "When run directly, __package__ is None and __name__ is '__main__'. Python needs package context to resolve relative imports. Run the module with python -m mypackage.script instead."
        - text: "The file must have a .pyw extension for relative imports"
          correct: false
          explanation: "File extensions have nothing to do with import resolution."
        - text: "Relative imports only work on Linux"
          correct: false
          explanation: "Relative imports are platform-independent - they depend on package context, not the operating system."
    - question: "What is the safest way to break a circular import?"
      options:
        - text: "Delete one of the modules"
          correct: false
          explanation: "Removing code is not a solution to an architectural problem."
        - text: "Add both modules to sys.path"
          correct: false
          explanation: "sys.path controls where Python finds modules, not how it resolves circular dependencies."
        - text: "Move the import inside the function that needs it, or extract shared types to a third module"
          correct: true
          explanation: "Lazy imports (inside functions) delay the import until needed, by which time both modules are fully loaded. Extracting to a third module eliminates the cycle entirely."
        - text: "Use import * to load everything at once"
          correct: false
          explanation: "Wildcard imports make circular dependencies worse by increasing the chance of hitting uninitialized names."
```

---

## Creating Packages

A **package** is a directory that Python recognizes as a collection of modules. The simplest way to make one is to add an `__init__.py` file.

### Package Structure

```
mypackage/
├── __init__.py        # Makes this directory a package
├── __main__.py        # Entry point for python -m mypackage
├── core.py
├── formatting.py
└── utils/
    ├── __init__.py
    └── helpers.py
```

The `__init__.py` file runs when the package is first imported. It can be empty, or it can define the package's public API:

```python
# mypackage/__init__.py
from .core import Engine
from .formatting import bold, table

__all__ = ["Engine", "bold", "table"]
```

[**`__all__`**](https://docs.python.org/3/reference/simple_stmts.html#the-import-statement) controls what `from mypackage import *` exports. Without it, a wildcard import brings in every public name defined in `__init__.py`.

### Namespace Packages

Since Python 3.3, a directory without `__init__.py` can still act as a **namespace package**. This allows a single logical package to be split across multiple directories (useful for large organizations with distributed codebases). For most projects, use regular packages with `__init__.py` - namespace packages are a specialized tool.

### Project Layouts

Two common layouts for distributable packages:

```
# Flat layout                    # src layout
myproject/                       myproject/
├── pyproject.toml               ├── pyproject.toml
├── mypackage/                   ├── src/
│   ├── __init__.py              │   └── mypackage/
│   └── core.py                  │       ├── __init__.py
└── tests/                       │       └── core.py
    └── test_core.py             └── tests/
                                     └── test_core.py
```

The **src layout** prevents accidentally importing the local source directory instead of the installed package during testing. The **flat layout** is simpler and works well for smaller projects. The [Python Packaging User Guide](https://packaging.python.org/en/latest/discussions/src-layout-vs-flat-layout/) has a detailed comparison.

### The \_\_main\_\_.py Entry Point

Adding `__main__.py` to a package lets you run it with `python -m mypackage`:

```python
# mypackage/__main__.py
from .core import Engine

def main():
    engine = Engine()
    engine.run()

if __name__ == "__main__":
    main()
```

This is the standard way to make a package executable. The `-m` flag tells Python to find the package in `sys.path` and run its `__main__.py`.

```code-walkthrough
title: Anatomy of a Python Package
description: A multi-module package with re-exports, internal helpers, and a public API.
language: python
code: |
    # --- mypackage/__init__.py ---
    """Server management toolkit."""
    from .monitor import HealthChecker, StatusReport
    from .deploy import Deployer

    __all__ = ["HealthChecker", "StatusReport", "Deployer"]
    __version__ = "1.0.0"

    # --- mypackage/monitor.py ---
    from ._helpers import format_timestamp

    class HealthChecker:
        def check(self, host):
            return {"host": host, "status": "ok",
                    "checked_at": format_timestamp()}

    class StatusReport:
        def __init__(self, checks):
            self.checks = checks

    # --- mypackage/_helpers.py ---
    from datetime import datetime, timezone

    def format_timestamp():
        return datetime.now(timezone.utc).isoformat()

    # --- mypackage/deploy.py ---
    from ._helpers import format_timestamp

    class Deployer:
        def deploy(self, service, version):
            return {"service": service, "version": version,
                    "deployed_at": format_timestamp()}

    # --- mypackage/__main__.py ---
    from .monitor import HealthChecker

    def main():
        checker = HealthChecker()
        result = checker.check("web-1.prod")
        print(f"Status: {result['status']}")

    if __name__ == "__main__":
        main()
annotations:
    - line: 1
      text: "__init__.py defines the package's public face. Users see HealthChecker, StatusReport, and Deployer at the top level."
    - line: 3
      text: "Re-exports pull specific classes from internal modules into the package namespace. Users write 'from mypackage import HealthChecker' instead of 'from mypackage.monitor import HealthChecker'."
    - line: 6
      text: "__all__ explicitly lists public names. This controls 'from mypackage import *' and signals intent to other developers."
    - line: 7
      text: "__version__ is a common convention for tracking the package version. Tools like setuptools can read it."
    - line: 10
      text: "Relative import from a private module. The underscore prefix on _helpers signals that it is internal to the package."
    - line: 21
      text: "_helpers.py contains utility functions shared across the package. The leading underscore tells users this module is not part of the public API."
    - line: 36
      text: "__main__.py is the entry point for 'python -m mypackage'. It imports from the package using relative imports."
    - line: 43
      text: "The __name__ guard ensures main() only runs when executed directly, not when imported."
```

```exercise
title: Build a CLI Toolkit Package
difficulty: intermediate
scenario: |
    Create a package called `syskit` that provides three utility modules for system administration. The package should expose a clean public API through `__init__.py` and be runnable with `python -m syskit`.

    Your package structure should be:

    ```
    syskit/
    ├── __init__.py       # Re-export public API, define __all__
    ├── __main__.py       # Entry point: run all checks and print a summary
    ├── disk.py           # disk_usage(path) -> dict with total, used, free (bytes)
    ├── network.py        # ping(host) -> dict with host, reachable (bool), latency_ms
    └── formatting.py     # format_bytes(n) -> human-readable string (e.g., "1.5 GB")
    ```

    The `__init__.py` should re-export `disk_usage`, `ping`, and `format_bytes`. The `__main__.py` should call `disk_usage("/")` and `ping("localhost")`, format the results, and print them.
hints:
    - "Use `shutil.disk_usage(path)` to get disk statistics - it returns a named tuple with `total`, `used`, and `free` attributes."
    - "Use `subprocess.run(['ping', '-c', '1', '-W', '2', host])` to check reachability. A return code of 0 means success. On macOS/Linux, parse the output for round-trip time, or just report reachability."
    - "For format_bytes, divide by 1024 repeatedly to find the right unit (B, KB, MB, GB, TB). Use an f-string with one decimal place."
    - "In __main__.py, import from the package with relative imports: `from .disk import disk_usage`"
solution: |
    ```python
    # syskit/__init__.py
    from .disk import disk_usage
    from .network import ping
    from .formatting import format_bytes

    __all__ = ["disk_usage", "ping", "format_bytes"]

    # syskit/disk.py
    import shutil

    def disk_usage(path):
        usage = shutil.disk_usage(path)
        return {
            "path": path,
            "total": usage.total,
            "used": usage.used,
            "free": usage.free,
        }

    # syskit/network.py
    import subprocess

    def ping(host):
        result = subprocess.run(
            ["ping", "-c", "1", "-W", "2", host],
            capture_output=True, text=True
        )
        return {
            "host": host,
            "reachable": result.returncode == 0,
        }

    # syskit/formatting.py
    def format_bytes(n):
        for unit in ("B", "KB", "MB", "GB", "TB"):
            if n < 1024:
                return f"{n:.1f} {unit}"
            n /= 1024
        return f"{n:.1f} PB"

    # syskit/__main__.py
    from .disk import disk_usage
    from .network import ping
    from .formatting import format_bytes

    def main():
        disk = disk_usage("/")
        net = ping("localhost")

        print(f"Disk (/):")
        print(f"  Total: {format_bytes(disk['total'])}")
        print(f"  Used:  {format_bytes(disk['used'])}")
        print(f"  Free:  {format_bytes(disk['free'])}")
        print()
        print(f"Network:")
        print(f"  {net['host']}: {'reachable' if net['reachable'] else 'unreachable'}")

    if __name__ == "__main__":
        main()
    ```
```

---

## Virtual Environments Deep Dive

The [Introduction guide](python_dev0_introduction.md) covered creating and activating virtual environments. Here you will look at what `venv` actually builds and how activation works under the hood.

### What venv Creates

Running `python3 -m venv myenv` creates a directory structure like this:

```
myenv/
├── bin/                     # Scripts and symlinks (Linux/macOS)
│   ├── python -> python3.12  # Symlink to the base Python
│   ├── python3 -> python3.12
│   ├── python3.12
│   ├── pip
│   ├── pip3
│   └── activate             # Shell script that modifies PATH
├── include/                 # C headers (for compiling extensions)
├── lib/
│   └── python3.12/
│       └── site-packages/   # Where pip installs packages
├── lib64 -> lib             # Symlink (Linux only)
└── pyvenv.cfg               # Configuration file
```

The `pyvenv.cfg` file tells Python this is a virtual environment:

```ini
home = /usr/local/bin
include-system-site-packages = false
version = 3.12.0
```

### How Activation Works

The `activate` script does two things:

1. **Prepends `myenv/bin/` to `PATH`** - so running `python` or `pip` resolves to the virtual environment's copies first
2. **Sets `VIRTUAL_ENV`** to the environment's root path

That is it. There is no system-level configuration change, no daemon, no container. Activation is just a `PATH` modification in your current shell session.

You can also use a virtual environment **without activating it** by calling its Python directly:

```bash
# Without activation
myenv/bin/python my_script.py
myenv/bin/pip install requests
```

This is common in CI pipelines and automation scripts where sourcing an `activate` script adds unnecessary complexity.

```terminal
title: Inside a Virtual Environment
description: Inspecting what venv creates and how it changes Python's behavior.
steps:
    - command: "python3 -m venv /tmp/demo-env"
      narration: "Create a fresh virtual environment."
      output: ""
    - command: "ls /tmp/demo-env/bin/ | head -8"
      narration: "The bin/ directory contains symlinks to Python and copies of pip, plus the activate script."
      output: "activate\nactivate.csh\nactivate.fish\npip\npip3\npip3.12\npython\npython3"
    - command: "cat /tmp/demo-env/pyvenv.cfg"
      narration: "pyvenv.cfg tells Python where the base interpreter lives and whether to include system packages."
      output: "home = /usr/local/bin\ninclude-system-site-packages = false\nversion = 3.12.0\nexecutable = /usr/local/bin/python3.12\ncommand = /usr/local/bin/python3.12 -m venv /tmp/demo-env"
    - command: "/tmp/demo-env/bin/python -c \"import sys; print(sys.prefix)\""
      narration: "sys.prefix points to the virtual environment, not the system Python. This is how Python knows to use the environment's site-packages."
      output: "/tmp/demo-env"
    - command: "/tmp/demo-env/bin/python -c \"import sys; print('\\n'.join(sys.path[:4]))\""
      narration: "sys.path starts with the environment's lib directory. Packages installed here are found before system packages."
      output: "\n/usr/local/lib/python312.zip\n/usr/local/lib/python3.12\n/tmp/demo-env/lib/python3.12/site-packages"
```

### Multiple Python Versions

If you have multiple Python versions installed, create separate environments for each:

```bash
python3.11 -m venv env311
python3.12 -m venv env312

env311/bin/python --version  # Python 3.11.x
env312/bin/python --version  # Python 3.12.x
```

Each environment is independent. Packages installed in `env311` are not visible to `env312`.

!!! tip "System site-packages"
    The `--system-site-packages` flag lets a virtual environment fall back to globally installed packages. This is useful when you want access to system-wide libraries (like those installed by the OS package manager) but still want to isolate project-specific dependencies: `python3 -m venv --system-site-packages myenv`

---

## Advanced pip and poetry

The [Testing and Tooling](testing-and-tooling.md) guide covered basic `pip install` and `pyproject.toml`. This section goes further into reproducible dependency management.

### pip: Beyond Basic Install

**Constraints files** restrict package versions without installing them. They are useful when you want to pin transitive dependencies (dependencies of your dependencies) without listing them in your requirements:

```
# constraints.txt
urllib3==2.1.0
certifi==2024.2.2
```

```bash
pip install -r requirements.txt -c constraints.txt
```

**Hash checking** verifies that downloaded packages match expected checksums, preventing supply-chain attacks:

```bash
pip install --require-hashes -r requirements.txt
```

This requires every entry in `requirements.txt` to include a hash:

```
requests==2.31.0 \
    --hash=sha256:942c5a758f98d790eaed1a29cb6eefc7f0edf3fcb0fce8aea3fbd5951d8bcc8e
```

**Editable installs** link your local source directory into `site-packages` so changes take effect immediately without reinstalling:

```bash
pip install -e .          # Install current project in editable mode
pip install -e ./mylib    # Install a local dependency in editable mode
```

### pip-tools: Compiled Requirements

[**pip-tools**](https://pip-tools.readthedocs.io/) adds a two-file workflow that separates what you want from what you get:

```bash
pip install pip-tools
```

1. Write your direct dependencies in `requirements.in`:
```
# requirements.in
requests>=2.28
click>=8.0
```

2. Compile a fully pinned `requirements.txt`:
```bash
pip-compile requirements.in
```

This produces a `requirements.txt` with exact versions and hashes for every package, including transitive dependencies. When you want to update, run `pip-compile --upgrade`.

### poetry: Advanced Workflows

[**Poetry**](https://python-poetry.org/) manages dependencies, virtual environments, and packaging in one tool.

**Dependency groups** separate production, dev, and optional dependencies:

```toml
# pyproject.toml
[tool.poetry.dependencies]
python = "^3.11"
requests = "^2.31"

[tool.poetry.group.dev.dependencies]
pytest = "^8.0"
ruff = "^0.3"

[tool.poetry.group.docs.dependencies]
mkdocs = "^1.5"
```

```bash
poetry install                    # Install all groups
poetry install --without docs     # Skip docs group
poetry install --only dev         # Only dev dependencies
```

**Lock files** (`poetry.lock`) pin every dependency to an exact version and hash. The lock file is checked into version control so every developer and CI runner uses identical packages. Run `poetry lock` to regenerate it after changing `pyproject.toml`.

### PEP 723: Inline Script Metadata

[**PEP 723**](https://peps.python.org/pep-0723/) (Python 3.12+) lets you declare dependencies inside a script using a special comment block. Tools like [**`pipx`**](https://pipx.pypa.io/) and [**`uv`**](https://docs.astral.sh/uv/) read this metadata and install dependencies automatically:

```python
# /// script
# requires-python = ">=3.12"
# dependencies = [
#     "requests>=2.31",
#     "rich>=13.0",
# ]
# ///

import requests
from rich import print

response = requests.get("https://api.example.com/status")
print(response.json())
```

```bash
# Run with automatic dependency resolution
pipx run my_script.py
# Or with uv
uv run my_script.py
```

This eliminates the need for a separate `requirements.txt` or virtual environment setup for one-off scripts.

```quiz
title: Dependency Management
questions:
    - question: "What does `pip install -e .` do?"
      options:
        - text: "Installs the package in a new virtual environment"
          correct: false
          explanation: "Editable installs use the current environment, not a new one."
        - text: "Installs the package so that local source changes take effect without reinstalling"
          correct: true
          explanation: "An editable install creates a link from site-packages to your source directory. When you edit your code, the changes are immediately available without running pip install again."
        - text: "Installs the package and all its dependencies with exact versions"
          correct: false
          explanation: "That would be pip install with a lock file. The -e flag specifically enables editable/development mode."
        - text: "Installs the package from the current directory to the global Python"
          correct: false
          explanation: "An editable install goes into whichever environment pip belongs to (usually a virtual environment, not the global Python)."
    - question: "What is the purpose of a poetry.lock file?"
      options:
        - text: "It prevents other users from installing the package"
          correct: false
          explanation: "Lock files control versions, not access."
        - text: "It pins every dependency (including transitive) to exact versions for reproducible installs"
          correct: true
          explanation: "The lock file records the exact version and hash of every package resolved during 'poetry lock'. Checking it into version control ensures everyone gets identical dependencies."
        - text: "It encrypts the dependency list for security"
          correct: false
          explanation: "Lock files are plain text and are meant to be readable and version-controlled."
        - text: "It replaces pyproject.toml"
          correct: false
          explanation: "pyproject.toml declares your intent (version ranges). The lock file records the exact resolution. Both are needed."
    - question: "How does PEP 723 inline script metadata help with one-off scripts?"
      options:
        - text: "It compiles the script to a binary for faster execution"
          correct: false
          explanation: "PEP 723 is about dependency metadata, not compilation."
        - text: "It embeds dependency declarations directly in the script so tools can auto-install them"
          correct: true
          explanation: "The /// script comment block tells tools like pipx and uv which packages the script needs. They create a temporary environment, install the dependencies, and run the script - no manual setup required."
        - text: "It converts the script to a package automatically"
          correct: false
          explanation: "PEP 723 keeps scripts as scripts. It adds metadata without requiring package structure."
        - text: "It only works with poetry"
          correct: false
          explanation: "PEP 723 is a standard recognized by multiple tools including pipx, uv, and hatch."
```

---

## Bringing It Together

The concepts from this guide - decorators, dynamic imports, and package structure - combine naturally in a plugin architecture. The following exercise asks you to build one from scratch.

```exercise
title: Plugin System with Decorators and Dynamic Imports
difficulty: intermediate
scenario: |
    Build a plugin loader for a monitoring system. The system should:

    1. Define a `@register` decorator that adds handler functions to a central registry, keyed by event name.
    2. Use `importlib` and `pathlib` to dynamically discover and load all `.py` files in a `plugins/` directory.
    3. After loading, call the appropriate handler when an event occurs.

    The file structure:

    ```
    monitor/
    ├── registry.py      # @register decorator and the handlers dict
    ├── loader.py        # discover_plugins(path) using importlib
    ├── __init__.py      # Empty
    └── plugins/
        ├── __init__.py  # Empty
        ├── disk.py      # @register("disk_full") handler
        └── cpu.py       # @register("cpu_high") handler
    ```

    Example usage after loading:
    ```python
    from monitor.registry import handlers
    from monitor.loader import discover_plugins

    discover_plugins("monitor/plugins")
    handlers["disk_full"]({"host": "web-1", "usage": 95})
    # Output: DISK ALERT on web-1: 95% usage
    ```
hints:
    - "The `@register(event_name)` decorator is a decorator factory: it returns a decorator that adds the function to a `handlers` dict and returns the function unchanged."
    - "In `loader.py`, use `pathlib.Path(path).glob('*.py')` to find plugin files. Skip `__init__.py`."
    - "Use `importlib.import_module()` to load each plugin. Convert the file path to a module path: if the file is `monitor/plugins/disk.py`, the module name is `monitor.plugins.disk`."
    - "Each plugin file just needs to import the decorator and define a function: `from monitor.registry import register`"
solution: |
    ```python
    # monitor/registry.py
    handlers = {}

    def register(event_name):
        def decorator(func):
            handlers[event_name] = func
            return func
        return decorator

    # monitor/loader.py
    import importlib
    from pathlib import Path

    def discover_plugins(plugin_dir):
        plugin_path = Path(plugin_dir)
        for py_file in sorted(plugin_path.glob("*.py")):
            if py_file.name == "__init__.py":
                continue
            # Convert path to module name: monitor/plugins/disk.py -> monitor.plugins.disk
            module_name = str(py_file.with_suffix("")).replace("/", ".")
            importlib.import_module(module_name)

    # monitor/plugins/disk.py
    from monitor.registry import register

    @register("disk_full")
    def handle_disk_full(event):
        print(f"DISK ALERT on {event['host']}: {event['usage']}% usage")

    # monitor/plugins/cpu.py
    from monitor.registry import register

    @register("cpu_high")
    def handle_cpu_high(event):
        print(f"CPU ALERT on {event['host']}: {event['load']} load average")
    ```
```

---

## Further Reading

- [Python Data Model - Callable Objects](https://docs.python.org/3/reference/datamodel.html#object.__call__) - how Python determines whether an object can be called as a function
- [functools Module](https://docs.python.org/3/library/functools.html) - `wraps`, `lru_cache`, `partial`, and other function utilities
- [The Import System](https://docs.python.org/3/reference/import.html) - the official reference for finders, loaders, and module specs
- [Python Packaging User Guide](https://packaging.python.org/) - the definitive guide to creating distributable packages
- [PEP 723 - Inline Script Metadata](https://peps.python.org/pep-0723/) - embedding dependency declarations in standalone scripts
- [Real Python: Primer on Decorators](https://realpython.com/primer-on-python-decorators/) - practical decorator tutorial with additional examples

---

**Previous:** [Object-Oriented Programming](object-oriented-programming.md) | [Back to Index](README.md)
