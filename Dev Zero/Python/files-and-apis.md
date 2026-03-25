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

## Interactive Quiz: Files and APIs

Verify your understanding of Python's I/O and networking capabilities.

```quiz
questions:
  - question: "What is the primary benefit of using the `with open(...) as f:` syntax in Python?"
    options:
      - "It makes the code run significantly faster."
      - "It automatically handles file closing, even if an exception occurs."
      - "It encrypts the file contents while they are open in memory."
      - "It allows multiple processes to write to the same file simultaneously."
    answer: 1
    explanation: "The context manager (`with` statement) ensures that the file's `close()` method is called automatically when the block is exited, preventing resource leaks and potential file corruption."

  - question: "Which method in the `json` module should you use to parse a JSON-formatted string that is already in memory?"
    options:
      - "json.load()"
      - "json.parse()"
      - "json.loads()"
      - "json.read()"
    answer: 2
    explanation: "`json.loads()` (short for 'load string') is used to parse a JSON string, while `json.load()` is used to read and parse from a file-like object."

  - question: "How do you access the JSON response body from a `requests` Response object?"
    options:
      - "response.data"
      - "response.json()"
      - "json.parse(response.text)"
      - "response.body"
    answer: 1
    explanation: "The `requests` library provides a convenient `.json()` method on the response object that automatically parses the response body as JSON."
```

---

## Further Reading

- [**Python Docs: Reading and Writing Files**](https://docs.python.org/3/tutorial/inputoutput.html#reading-and-writing-files)  
- [**Requests: Quickstart Guide**](https://requests.readthedocs.io/en/latest/user/quickstart/)  
- [**Working with JSON Data in Python**](https://realpython.com/python-json/)  

---

**Previous:** [Data Structures and Logic](data-structures-and-logic.md) | **Next:** [System Automation](system-automation.md) | [Back to Index](README.md)
