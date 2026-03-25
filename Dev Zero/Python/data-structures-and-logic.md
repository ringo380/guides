# Data Structures and Logic (Python)

**Version:** 0.1  
**Year:** 2026

---

## Copyright Notice

Copyright (c) 2025-2026 Ryan Thomas Robson / Robworks Software LLC. Licensed under [CC BY-NC-ND 4.0](../../LICENSE-CONTENT). You may share this material for non-commercial purposes with attribution, but you may not distribute modified versions.

---

Modern sysadmin tasks involve more than just parsing single lines of text. We often need to store collections of data, transform them, and make decisions based on their contents. Python's built-in data structures and clean control flow logic are designed for exactly these scenarios.

## Core Data Structures

Python has four primary collection types, each with unique properties and use cases.

### Lists: Ordered Collections

[**`List`**](https://docs.python.org/3/tutorial/introduction.html#lists) is the most versatile data structure. It's an ordered sequence of elements, which can be modified after creation (mutable).

```python
# A list of server names
servers = ["web01", "web02", "db01", "db02"]

# Adding elements
servers.append("cache01")

# Accessing by index (0-indexed)
primary_db = servers[2]  # "db01"

# Slicing (start:stop:step)
web_servers = servers[0:2]  # ["web01", "web02"]

# Iterating over a list
for server in servers:
    print(f"Checking status for {server}...")
```

### Dictionaries: Key-Value Pairs

[**`Dictionary`**](https://docs.python.org/3/tutorial/datastructures.html#dictionaries) (or "dict") is a collection of key-value pairs. Keys must be unique and immutable (like strings or integers).

```python
# A dictionary representing server configuration
config = {
    "hostname": "app01",
    "ip_address": "10.0.0.5",
    "role": "application",
    "uptime_days": 142
}

# Accessing values
print(config["ip_address"])  # "10.0.0.5"

# Adding or updating
config["environment"] = "production"

# Checking if a key exists
if "backup_enabled" not in config:
    config["backup_enabled"] = False
```

### Tuples and Sets

- **Tuples**: Like lists, but **immutable** (cannot be changed after creation). Used for data that should not be accidentally modified (e.g., a coordinate pair `(latitude, longitude)`).
- **Sets**: An unordered collection of **unique** elements. Excellent for deduplication and set operations like unions and intersections.

```python
# A set of unique IP addresses from a log file
unique_ips = {"192.168.1.1", "10.0.0.5", "192.168.1.1"}
print(unique_ips)  # {"192.168.1.1", "10.0.0.5"} - duplicates are removed
```

---

## Control Flow Logic

Python uses standard logical operators (`if`, `elif`, `else`) and loops (`for`, `while`) to control the execution path.

### Conditionals

Python's `if` statements are clean and readable, using `and`, `or`, and `not` for complex logic.

```python
load_average = 4.5
disk_full = True

if load_average > 5.0 and disk_full:
    print("CRITICAL: High load and low disk space!")
elif load_average > 5.0:
    print("WARNING: High CPU load.")
elif disk_full:
    print("WARNING: Disk is full.")
else:
    print("System health is OK.")
```

### For Loops and List Comprehensions

The `for` loop is primarily used to iterate over a collection.

```python
# Transforming a list of filenames to absolute paths
files = ["access.log", "error.log", "auth.log"]
log_dir = "/var/log"

# Standard for loop
absolute_paths = []
for f in files:
    absolute_paths.append(f"{log_dir}/{f}")

# List Comprehension (concise Pythonic way)
absolute_paths = [f"{log_dir}/{f}" for f in files]
```

---

## Interactive Quizzes: Data Structures and Logic

Test your knowledge of Python's collections and control flow.

```quiz
question: "Which data structure would be most appropriate for storing a collection of unique usernames from a large CSV file?"
type: multiple-choice
options:
  - text: "List"
    feedback: "Lists allow duplicates. If you need unique usernames, a list is not the most efficient choice."
  - text: "Tuple"
    feedback: "Tuples allow duplicates and are immutable. Not ideal for gathering a collection of unique items."
  - text: "Set"
    correct: true
    feedback: "Correct! A Set is ideal because it automatically handles deduplication, ensuring that each username appears only once regardless of how many times it appeared in the source file."
  - text: "Dictionary"
    feedback: "While dictionary keys must be unique, a Set is simpler for storing a collection of unique values."
```

```quiz
question: "What is the result of the following list slice? `['a', 'b', 'c', 'd'][1:3]`"
type: multiple-choice
options:
  - text: "['a', 'b']"
    feedback: "Slice starts at index 1 ('b'), not index 0 ('a')."
  - text: "['b', 'c']"
    correct: true
    feedback: "Correct! List slicing is inclusive of the start index (1) and exclusive of the stop index (3). Index 1 is 'b' and index 2 is 'c'. Index 3 ('d') is excluded."
  - text: "['b', 'c', 'd']"
    feedback: "Index 3 ('d') is the stop index, so it's excluded from the slice."
  - text: "['a', 'b', 'c']"
    feedback: "Slice starts at index 1 ('b'), not index 0 ('a')."
```

```quiz
question: "Which keyword is used to add an alternative condition to an `if` statement if the first condition is False?"
type: multiple-choice
options:
  - text: "else if"
    feedback: "This is used in languages like Java or C, but not Python."
  - text: "elseif"
    feedback: "This is used in languages like PHP or Perl, but not Python."
  - text: "elif"
    correct: true
    feedback: "Correct! Python uses the `elif` keyword (short for 'else if') to provide additional conditional branches."
  - text: "otherwise"
    feedback: "This is not a Python keyword."
```

---

## Further Reading

- [**Python Tutorial: Data Structures**](https://docs.python.org/3/tutorial/datastructures.html)  
- [**W3Schools: Python Dictionaries**](https://www.w3schools.com/python/python_dictionaries.asp)  
- [**Real Python: List Comprehensions**](https://realpython.com/list-comprehension-python/)  

---

**Previous:** [Introduction to Python](python_dev0_introduction.md) | **Next:** [Working with Files and APIs](files-and-apis.md) | [Back to Index](README.md)
