# System Automation with Python

**Version:** 0.1  
**Year:** 2026

---

## Copyright Notice

Copyright (c) 2025-2026 Ryan Thomas Robson / Robworks Software LLC. Licensed under [CC BY-NC-ND 4.0](../../LICENSE-CONTENT). You may share this material for non-commercial purposes with attribution, but you may not distribute modified versions.

---

Python's real power for sysadmins lies in its ability to interact with the underlying operating system. Whether you are managing files, running external commands, or parsing command-line arguments, Python provides robust modules that are often more reliable and readable than complex Bash scripts.

## Core Automation Modules

Python includes several built-in modules specifically designed for system tasks.

- [**`os`**](https://docs.python.org/3/library/os.html): Miscellaneous operating system interfaces (env vars, directory listing).
- [**`sys`**](https://docs.python.org/3/library/sys.html): System-specific parameters and functions (command-line arguments, exit codes).
- [**`shutil`**](https://docs.python.org/3/library/shutil.html): High-level file operations (copying, moving, archiving).
- [**`subprocess`**](https://docs.python.org/3/library/subprocess.html): Running external commands and capturing their output.

---

## Managing Files and Directories

While Bash is great for quick file operations, Python's `os` and `shutil` modules provide better error handling and cross-platform compatibility.

### Directory Listing and Navigation

```python
import os

# Get current working directory
cwd = os.getcwd()

# List all files in a directory
for filename in os.listdir("/var/log"):
    if filename.endswith(".log"):
        print(f"Found log file: {filename}")

# Check if a path exists and is a file
if os.path.isfile("/etc/hosts"):
    print("Hosts file exists.")
```

### High-Level File Operations

```python
import shutil
import os

# Copy a file
shutil.copy2("config.yaml", "config.yaml.bak")  # copy2 preserves metadata

# Move a file
shutil.move("temp_data.csv", "/data/archives/")

# Recursively delete a directory (equivalent to rm -rf)
if os.path.exists("old_project"):
    shutil.rmtree("old_project")
```

---

## Running External Commands

The [**`subprocess`**](https://docs.python.org/3/library/subprocess.html) module is the modern way to run shell commands from Python.

### Capturing Output

The `subprocess.run()` function is the recommended approach for most tasks.

```python
import subprocess

# Run a simple command and capture its output
result = subprocess.run(["df", "-h", "/"], capture_output=True, text=True)

if result.returncode == 0:
    print("Disk usage for root partition:")
    print(result.stdout)
else:
    print(f"Error running df: {result.stderr}")
```

### Passing Input to Commands

```python
# Pass a string as stdin to a command
process = subprocess.run(
    ["grep", "ERROR"], 
    input="INFO: All good\nERROR: Disk full\nINFO: Syncing...", 
    capture_output=True, 
    text=True
)
print(process.stdout)  # "ERROR: Disk full"
```

---

## Handling Command-Line Arguments

For simple scripts, use `sys.argv`. For complex tools with flags and help menus, use the built-in [**`argparse`**](https://docs.python.org/3/library/argparse.html) module.

```python
import argparse

parser = argparse.ArgumentParser(description="A tool to archive logs.")
parser.add_argument("directory", help="The directory containing logs to archive")
parser.add_argument("--days", type=int, default=7, help="Archive logs older than X days")
parser.add_argument("-v", "--verbose", action="store_true", help="Enable verbose output")

args = parser.parse_args()

print(f"Archiving logs in {args.directory} older than {args.days} days.")
if args.verbose:
    print("Verbose mode enabled.")
```

---

## Interactive Quizzes: System Automation

Test your understanding of Python's system interaction capabilities.

```quiz
question: "Which module should you use if you need to recursively delete a directory tree (similar to `rm -rf`)?"
type: multiple-choice
options:
  - text: "os"
    feedback: "os.remove() deletes a single file, and os.rmdir() deletes an empty directory. Neither deletes recursively."
  - text: "sys"
    feedback: "The sys module is for system parameters, not file operations."
  - text: "shutil"
    correct: true
    feedback: "Correct! `shutil.rmtree()` is the standard function for recursively deleting a directory and all of its contents."
  - text: "subprocess"
    feedback: "While you could call 'rm -rf' via subprocess, using shutil.rmtree() is more Pythonic and platform-independent."
```

```quiz
question: "What is the recommended function for running an external command and waiting for it to complete?"
type: multiple-choice
options:
  - text: "os.system()"
    feedback: "os.system() is considered legacy and provides limited control over input/output."
  - text: "subprocess.run()"
    correct: true
    feedback: "Correct! `subprocess.run()` (introduced in Python 3.5) is the recommended high-level function for executing commands."
  - text: "subprocess.Popen()"
    feedback: "Popen is for advanced scenarios where you need more control over the process lifecycle. For simple tasks, run() is preferred."
  - text: "sys.execute()"
    feedback: "There is no sys.execute() function in the standard library."
```

```quiz
question: "How do you access the list of raw command-line arguments passed to a Python script?"
type: multiple-choice
options:
  - text: "sys.args"
    feedback: "The name of the list is sys.argv, not sys.args."
  - text: "os.argv"
    feedback: "Command-line arguments are stored in the sys module, not os."
  - text: "sys.argv"
    correct: true
    feedback: "Correct! `sys.argv` is a list in Python that contains all the command-line arguments passed to the script, where `sys.argv[0]` is the script name itself."
  - text: "argparse.list()"
    feedback: "argparse is used for parsing arguments, but the raw arguments themselves are in sys.argv."
```

---

## Further Reading

- [**Python Docs: os Module**](https://docs.python.org/3/library/os.html)  
- [**Python Docs: subprocess Module**](https://docs.python.org/3/library/subprocess.html)  
- [**Real Python: Working with Files and Directories**](https://realpython.com/working-with-files-in-python/)  

---

**Previous:** [Working with Files and APIs](files-and-apis.md) | **Next:** [Testing and Tooling](testing-and-tooling.md) | [Back to Index](README.md)
