# Introduction to Python for Sysadmins

**Version:** 0.1  
**Year:** 2026  

Python has become the de facto standard for systems automation and tool building. Its clean syntax and extensive standard library make it an ideal choice for replacing complex shell scripts and integrating with modern APIs.

## Environment Setup

One of the most important concepts in Python development is the **Virtual Environment**. It allows you to create isolated spaces for your projects, ensuring that dependencies for one script don't break another.

### Using `venv`

[**`venv`**](https://docs.python.org/3/library/venv.html) is the standard tool for creating virtual environments in Python 3.

```bash
# Create a virtual environment in a folder named 'venv'
python3 -m venv venv

# Activate the environment
source venv/bin/activate

# Install a package (e.g., requests)
pip install requests

# Deactivate when finished
deactivate
```

---

## Basic Syntax

Python uses **indentation** to define blocks of code, rather than braces or keywords. This enforces readability but can be a trap for those used to other languages.

```python
# A simple script to check disk usage
import shutil

def check_disk(path):
    total, used, free = shutil.disk_usage(path)
    percent_used = (used / total) * 100
    
    if percent_used > 90:
        print(f"WARNING: Disk usage at {percent_used:.2f}% on {path}")
    else:
        print(f"Disk usage is healthy: {percent_used:.2f}%")

check_disk("/")
```

### Key Differences from Shell Scripting

- **Variables**: No `$` prefix (e.g., `name = "Junie"` instead of `name="Junie"`).
- **Strings**: Single and double quotes are interchangeable; f-strings (`f"{var}"`) are the preferred way to format.
- **Lists and Dictionaries**: Built-in support for complex data structures that are cumbersome in shell.
- **Import System**: Access powerful functionality via modules (`import os`, `import json`).

---

## Interactive Quiz: Python Basics

Verify your understanding of Python fundamentals.

```quiz
questions:
  - question: "What is the primary reason for using a Virtual Environment in Python?"
    options:
      - "To make Python scripts run faster."
      - "To isolate project dependencies and avoid version conflicts."
      - "To encrypt the source code for security."
      - "To compile Python into a binary executable."
    answer: 1
    explanation: "Virtual environments ensure that each project has its own set of libraries, preventing 'dependency hell' where one project needs version A of a library and another needs version B."

  - question: "How does Python primarily define blocks of code (like the body of a function or a loop)?"
    options:
      - "Using curly braces `{ }`."
      - "Using `BEGIN` and `END` keywords."
      - "Using consistent indentation (whitespace)."
      - "Using semicolons `;` at the end of every line."
    answer: 2
    explanation: "Python is unique in using whitespace (indentation) to define block structure. This is one of the features that contributes to its readability."

  - question: "Which tool is the standard package manager for Python?"
    options:
      - "apt"
      - "npm"
      - "pip"
      - "cpan"
    answer: 2
    explanation: "`pip` is the standard tool for installing and managing Python packages from the Python Package Index (PyPI)."
```

---

## Further Reading

- [**Python Official Documentation**](https://docs.python.org/)  
- [**Real Python: Virtual Environments**](https://realpython.com/python-virtual-environments-a-primer/)  
- [**Automate the Boring Stuff with Python**](https://automatetheboringstuff.com/)  

---

**Next:** [Data Structures and Logic](data-structures-and-logic.md) | [Back to Index](README.md)
