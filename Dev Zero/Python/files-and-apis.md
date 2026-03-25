# Working with Files and APIs (Python)

**Version:** 0.1  
**Year:** 2026  

Sysadmin automation often involves interacting with external data sources—whether they are local configuration files, system logs, or remote web services. Python makes these tasks straightforward with its built-in `json` module and the widely used `requests` library.

## Local File Operations

Python uses the **context manager** pattern (`with` statement) to handle files safely. This ensures that a file is properly closed even if an error occurs during processing.

### Reading and Writing

[**`open()`**](https://docs.python.org/3/library/functions.html#open) is the primary function for file access.

```python
# Reading a file line-by-line
with open("/etc/hostname", "r") as f:
    hostname = f.read().strip()
    print(f"System hostname is: {hostname}")

# Writing to a new file
with open("inventory.txt", "w") as f:
    f.write("web01\nweb02\ndb01\n")

# Appending to an existing file
with open("audit.log", "a") as f:
    f.write("2026-03-25: Updated server inventory.\n")
```

---

## Working with JSON

JSON is the standard format for configuration files and API responses. Python's [**`json`**](https://docs.python.org/3/library/json.html) module converts JSON strings into Python dictionaries and lists.

```python
import json

# Parsing a JSON file
with open("config.json", "r") as f:
    config = json.load(f)

# Accessing nested data
log_level = config["logging"]["level"]

# Saving data to JSON
new_config = {"debug": True, "port": 8080}
with open("settings.json", "w") as f:
    json.dump(new_config, f, indent=4)
```

---

## Interacting with APIs

While Python's standard library includes `urllib`, the [**`requests`**](https://requests.readthedocs.io/) library is the industry standard for making HTTP calls. It must be installed via `pip`.

```bash
pip install requests
```

### Making a GET Request

Many modern monitoring and cloud services provide REST APIs.

```python
import requests

def get_service_status(service_id):
    url = f"https://api.monitoring.io/v1/services/{service_id}"
    response = requests.get(url)
    
    if response.status_code == 200:
        data = response.json()
        return data["status"]
    else:
        return f"Error: Received {response.status_code}"

status = get_service_status("web-cluster-01")
print(f"Service status: {status}")
```

### Making a POST Request

Use POST to send data, such as triggering a deployment or sending an alert.

```python
import requests
import json

alert_payload = {
    "severity": "critical",
    "message": "CPU usage exceeded 95% on app01",
    "timestamp": "2026-03-25T14:30:00Z"
}

response = requests.post(
    "https://api.pagerduty.com/alerts",
    data=json.dumps(alert_payload),
    headers={"Content-Type": "application/json"}
)

if response.ok:
    print("Alert sent successfully.")
```

---

## Interactive Quizzes: Files and APIs

Verify your understanding of Python's I/O and networking capabilities.

```quiz
question: "What is the primary benefit of using the `with open(...) as f:` syntax in Python?"
type: multiple-choice
options:
  - text: "It makes the code run significantly faster."
    feedback: "The with statement is for safe resource management, not performance."
  - text: "It automatically handles file closing, even if an exception occurs."
    correct: true
    feedback: "Correct! The context manager (`with` statement) ensures that the file's `close()` method is called automatically when the block is exited, preventing resource leaks and potential file corruption."
  - text: "It encrypts the file contents while they are open in memory."
    feedback: "Encryption is a separate process. The with statement doesn't encrypt data."
  - text: "It allows multiple processes to write to the same file simultaneously."
    feedback: "Simultaneous access depends on OS file locks and how you open the file. The with statement doesn't solve this."
```

```quiz
question: "Which method in the `json` module should you use to parse a JSON-formatted string that is already in memory?"
type: multiple-choice
options:
  - text: "json.load()"
    feedback: "json.load() is used to read and parse from a file-like object."
  - text: "json.parse()"
    feedback: "Python's json module doesn't have a parse() method."
  - text: "json.loads()"
    correct: true
    feedback: "Correct! `json.loads()` (short for 'load string') is used to parse a JSON string, while `json.load()` is used to read and parse from a file-like object."
  - text: "json.read()"
    feedback: "The method is loads(), not read()."
```

```quiz
question: "How do you access the JSON response body from a `requests` Response object?"
type: multiple-choice
options:
  - text: "response.data"
    feedback: "Response objects don't have a .data attribute by default in requests."
  - text: "response.json()"
    correct: true
    feedback: "Correct! The `requests` library provides a convenient `.json()` method on the response object that automatically parses the response body as JSON."
  - text: "json.parse(response.text)"
    feedback: "While you could use json.loads(response.text), the .json() method is the more Pythonic way."
  - text: "response.body"
    feedback: "The attribute is usually .text or .content, but the method for JSON is .json()."
```

---

## Further Reading

- [**Python Docs: Reading and Writing Files**](https://docs.python.org/3/tutorial/inputoutput.html#reading-and-writing-files)  
- [**Requests: Quickstart Guide**](https://requests.readthedocs.io/en/latest/user/quickstart/)  
- [**Working with JSON Data in Python**](https://realpython.com/python-json/)  

---

**Previous:** [Data Structures and Logic](data-structures-and-logic.md) | **Next:** [System Automation](system-automation.md) | [Back to Index](README.md)
