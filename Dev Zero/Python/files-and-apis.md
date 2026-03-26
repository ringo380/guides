# Working with Files and APIs (Python)

**Version:** 0.2
**Year:** 2026

---

## Copyright Notice

Copyright (c) 2025-2026 Ryan Thomas Robson / Robworks Software LLC. Licensed under [CC BY-NC-ND 4.0](../../LICENSE-CONTENT). You may share this material for non-commercial purposes with attribution, but you may not distribute modified versions.

---

Sysadmin automation usually boils down to two things: reading data from somewhere and acting on it. The "somewhere" is either the local filesystem (config files, logs, CSVs) or a remote API (monitoring services, cloud providers, notification systems). Python handles both with clean, consistent patterns.

---

## Local File Operations

Python uses the **context manager** pattern (`with` statement) to handle files safely. The file is guaranteed to close when the block exits, even if an error occurs mid-read.

### Reading and Writing

[**`open()`**](https://docs.python.org/3/library/functions.html#open) is the built-in function for file access.

```python
# Read an entire file into a string
with open("/etc/hostname", "r") as f:
    hostname = f.read().strip()

# Read line by line (memory-efficient for large files)
with open("/var/log/auth.log", "r") as f:
    for line in f:
        if "Failed password" in line:
            print(line.strip())

# Write to a file (overwrites existing content)
with open("inventory.txt", "w") as f:
    f.write("web01\nweb02\ndb01\n")

# Append to an existing file
with open("audit.log", "a") as f:
    f.write("2026-03-25: Updated server inventory.\n")
```

### File Modes

| Mode | Description | Creates File? | Truncates? |
|------|-------------|---------------|------------|
| `"r"` | Read (text) | No - raises FileNotFoundError | No |
| `"w"` | Write (text) | Yes | Yes - empties the file |
| `"a"` | Append (text) | Yes | No - adds to end |
| `"x"` | Exclusive create | Yes - raises FileExistsError if exists | N/A |
| `"rb"` | Read (binary) | No | No |
| `"wb"` | Write (binary) | Yes | Yes |

Binary modes (`"rb"`, `"wb"`) are needed for non-text files: images, compressed archives, protocol buffers, database dumps.

### Modern Path Handling with `pathlib`

The [**`pathlib`**](https://docs.python.org/3/library/pathlib.html) module (Python 3.4+) provides an object-oriented interface for filesystem paths. It's cleaner and more portable than string manipulation with `os.path`.

```python
from pathlib import Path

# Build paths without worrying about separators
log_dir = Path("/var/log")
auth_log = log_dir / "auth.log"      # PosixPath('/var/log/auth.log')

# Check existence and type
auth_log.exists()                     # True
auth_log.is_file()                    # True
log_dir.is_dir()                      # True

# Read and write in one step
content = auth_log.read_text()
Path("output.txt").write_text("hello\n")

# List directory contents
for p in log_dir.iterdir():
    if p.suffix == ".log":
        print(f"{p.name}: {p.stat().st_size} bytes")

# Glob for pattern matching
for p in log_dir.glob("*.log"):
    print(p)

# Recursive glob
for p in Path("/etc").rglob("*.conf"):
    print(p)
```

!!! tip "Prefer `pathlib` over `os.path`"
    `os.path.join("/var", "log", "auth.log")` works, but `Path("/var") / "log" / "auth.log"` is more readable and gives you methods like `.read_text()`, `.exists()`, and `.glob()` for free. Most modern Python code and libraries accept `Path` objects wherever a string path works.

---

## Working with JSON

JSON is the standard format for configuration files and API responses. Python's [**`json`**](https://docs.python.org/3/library/json.html) module converts JSON strings to Python dictionaries and lists, and vice versa.

```python
import json

# Parse a JSON file
with open("config.json") as f:
    config = json.load(f)          # File -> dict/list

# Parse a JSON string
raw = '{"status": "ok", "count": 42}'
data = json.loads(raw)             # String -> dict/list

# Write Python data as JSON
new_config = {"debug": True, "port": 8080, "hosts": ["web01", "web02"]}
with open("settings.json", "w") as f:
    json.dump(new_config, f, indent=2)  # indent for human-readable output

# Convert Python data to a JSON string
json_str = json.dumps(new_config, indent=2)
```

**`json.load()`** reads from a file object. **`json.loads()`** parses a string. The "s" stands for "string." This is the most common source of confusion.

---

## Working with CSV

Many sysadmin data sources (inventory exports, billing reports, monitoring data) come as CSV files.

```python
import csv

# Read a CSV file
with open("servers.csv") as f:
    reader = csv.DictReader(f)       # Each row becomes a dict
    for row in reader:
        print(f"{row['hostname']}: {row['ip_address']}")

# Write a CSV file
servers = [
    {"hostname": "web01", "ip": "10.0.0.1", "role": "frontend"},
    {"hostname": "db01", "ip": "10.0.1.1", "role": "database"},
]

with open("inventory.csv", "w", newline="") as f:
    writer = csv.DictWriter(f, fieldnames=["hostname", "ip", "role"])
    writer.writeheader()
    writer.writerows(servers)
```

`csv.DictReader` is almost always what you want - it maps each row to a dictionary using the header row as keys, so you access fields by name instead of index.

---

## Working with YAML

YAML is common in configuration management (Ansible, Kubernetes, Docker Compose). It's not in the standard library, so you need the [**`PyYAML`**](https://pyyaml.org/) package.

```bash
pip install pyyaml
```

```python
import yaml

# Read a YAML file
with open("playbook.yml") as f:
    config = yaml.safe_load(f)        # Always use safe_load, never load()

# Write YAML
data = {"services": {"web": {"image": "nginx", "ports": ["80:80"]}}}
with open("compose.yml", "w") as f:
    yaml.dump(data, f, default_flow_style=False)
```

!!! warning "Always use `yaml.safe_load()`"
    `yaml.load()` (without `safe_`) can execute arbitrary Python code embedded in the YAML file. This is a remote code execution vulnerability if you're loading untrusted input. Always use `yaml.safe_load()` unless you have a specific, verified reason not to.

---

## Interacting with APIs

While Python's standard library includes `urllib`, the [**`requests`**](https://requests.readthedocs.io/) library is the industry standard for HTTP calls. It handles encoding, sessions, headers, and error reporting with a clean interface.

```bash
pip install requests
```

### GET Requests

```python
import requests

response = requests.get("https://api.github.com/repos/python/cpython")

if response.status_code == 200:
    repo = response.json()          # Parse JSON response body
    print(f"Stars: {repo['stargazers_count']}")
    print(f"Language: {repo['language']}")
else:
    print(f"Error: HTTP {response.status_code}")
```

### POST Requests

```python
import requests

alert = {
    "severity": "critical",
    "message": "CPU usage exceeded 95% on app01",
    "timestamp": "2026-03-25T14:30:00Z"
}

response = requests.post(
    "https://hooks.slack.com/services/T00000/B00000/XXXXX",
    json=alert                      # Automatically serializes and sets Content-Type
)

if response.ok:                     # True for any 2xx status
    print("Alert sent successfully.")
```

### Authentication and Headers

```python
import requests

# API key in headers
headers = {
    "Authorization": "Bearer your-api-token-here",
    "Accept": "application/json"
}

response = requests.get(
    "https://api.cloudprovider.com/v1/instances",
    headers=headers
)

# Basic auth
response = requests.get(
    "https://monitoring.internal/api/status",
    auth=("username", "password")
)
```

### Sessions and Connection Reuse

When making multiple requests to the same host, use a **Session** to reuse TCP connections and persist headers:

```python
import requests

session = requests.Session()
session.headers.update({
    "Authorization": "Bearer your-token",
    "Accept": "application/json"
})

# All requests through this session include the headers above
instances = session.get("https://api.cloud.com/v1/instances").json()
volumes = session.get("https://api.cloud.com/v1/volumes").json()
```

### Handling Timeouts and Errors

Network calls fail. Always set timeouts and handle errors:

```python
import requests

try:
    response = requests.get(
        "https://api.example.com/status",
        timeout=10                   # 10 seconds (connect + read)
    )
    response.raise_for_status()      # Raises HTTPError for 4xx/5xx
    data = response.json()
except requests.ConnectionError:
    print("Could not connect to the API.")
except requests.Timeout:
    print("Request timed out after 10 seconds.")
except requests.HTTPError as e:
    print(f"API returned error: {e}")
```

```code-walkthrough
language: python
title: HTTP Request with Error Handling
code: |
  import requests

  try:
      response = requests.get(
          "https://api.example.com/status",
          timeout=10
      )
      response.raise_for_status()
      data = response.json()
  except requests.ConnectionError:
      print("Could not connect to the API.")
  except requests.Timeout:
      print("Request timed out after 10 seconds.")
  except requests.HTTPError as e:
      print(f"API returned error: {e}")
annotations:
  - line: 3
    text: "The try block wraps everything that can fail - the request, status check, and JSON parsing."
  - line: 4
    text: "requests.get() can raise ConnectionError (DNS failure, refused connection) or Timeout."
  - line: 6
    text: "timeout=10 sets a 10-second limit for both connection and response. Without this, a stalled server blocks your script indefinitely."
  - line: 8
    text: "raise_for_status() inspects the response code and raises HTTPError for any 4xx or 5xx status. Without it, a 500 response silently passes through."
  - line: 9
    text: "response.json() parses the body as JSON into a Python dict or list. This can raise ValueError if the response isn't valid JSON."
  - line: 10
    text: "ConnectionError catches network-level failures: DNS resolution, refused connections, dropped packets."
  - line: 12
    text: "Timeout fires when the server takes longer than the specified timeout to respond."
  - line: 14
    text: "HTTPError is raised by raise_for_status() for 4xx/5xx codes. The exception object contains the response, so e.response.status_code gives the exact code."
```

### Pagination

Many APIs return results in pages. You need to loop until there are no more pages:

```python
import requests

def get_all_items(base_url, headers):
    items = []
    url = base_url

    while url:
        response = requests.get(url, headers=headers, timeout=10)
        response.raise_for_status()
        data = response.json()

        items.extend(data["results"])
        url = data.get("next")      # None when there are no more pages

    return items
```

---

```terminal
scenario: "Read a JSON config file, query an API, and write the results"
steps:
  - command: "cat config.json"
    output: "{\n  \"api_url\": \"https://api.github.com/repos/python/cpython\",\n  \"output_file\": \"repo_info.json\",\n  \"timeout\": 10\n}"
    narration: "A JSON configuration file that specifies the API endpoint, output file, and timeout. This separates configuration from code - a fundamental operations pattern."
  - command: "python3 -c \"import json; config = json.load(open('config.json')); print(f'URL: {config[\\\"api_url\\\"]}')\""
    output: "URL: https://api.github.com/repos/python/cpython"
    narration: "Load and parse the JSON config file with json.load(). The result is a Python dictionary that you can access with bracket notation."
  - command: "python3 -c \"import requests; r = requests.get('https://api.github.com/repos/python/cpython', timeout=10); print(f'Status: {r.status_code}'); print(f'Stars: {r.json()[\\\"stargazers_count\\\"]}')\""
    output: "Status: 200\nStars: 65432"
    narration: "Make a GET request to the GitHub API. The response.json() method parses the response body directly into a Python dictionary."
  - command: "python3 -c \"import json; data = {'repo': 'cpython', 'stars': 65432}; print(json.dumps(data, indent=2))\""
    output: "{\n  \"repo\": \"cpython\",\n  \"stars\": 65432\n}"
    narration: "json.dumps() converts a Python dictionary back to a formatted JSON string. Use indent=2 for human-readable output when writing config files or API responses."
  - command: "python3 -c \"from pathlib import Path; p = Path('/var/log'); logs = sorted(p.glob('*.log')); print(f'Found {len(logs)} log files'); [print(f'  {f.name}: {f.stat().st_size:,} bytes') for f in logs[:3]]\""
    output: "Found 12 log files\n  auth.log: 245,678 bytes\n  kern.log: 89,012 bytes\n  syslog: 1,456,789 bytes"
    narration: "pathlib makes file discovery clean and readable. The glob() method finds files by pattern, and stat() provides metadata like size."
```

---

## Interactive Quizzes

```quiz
question: "What is the primary benefit of using the `with open(...) as f:` syntax?"
type: multiple-choice
options:
  - text: "It makes file operations faster."
    feedback: "The with statement is about safe resource management, not performance."
  - text: "It automatically closes the file when the block exits, even if an exception occurs."
    correct: true
    feedback: "Correct! The context manager ensures close() is called regardless of how the block exits - normal completion, return, or exception. Without it, an error mid-read could leave the file handle open."
  - text: "It encrypts the file contents."
    feedback: "The with statement handles resource lifecycle, not encryption."
  - text: "It allows multiple processes to write simultaneously."
    feedback: "Concurrent file access requires explicit file locking, not context managers."
```

```quiz
question: "What is the difference between `json.load()` and `json.loads()`?"
type: multiple-choice
options:
  - text: "load() is faster than loads()."
    feedback: "Performance isn't the distinction. They accept different input types."
  - text: "load() reads from a file object, loads() parses a string."
    correct: true
    feedback: "Correct! json.load(file_object) reads and parses from a file. json.loads(string) parses a JSON-formatted string already in memory. The 's' stands for 'string'."
  - text: "loads() can parse YAML as well as JSON."
    feedback: "loads() only handles JSON. You need the PyYAML library for YAML."
  - text: "load() is deprecated in favor of loads()."
    feedback: "Both functions are current and serve different purposes."
```

```quiz
question: "Why should you always set a `timeout` parameter when using `requests.get()`?"
type: multiple-choice
options:
  - text: "It makes the request faster."
    feedback: "Timeouts don't speed up successful requests - they limit how long you wait for unresponsive servers."
  - text: "Without a timeout, the request can hang indefinitely if the server doesn't respond."
    correct: true
    feedback: "Correct! The default timeout is None (wait forever). If a server stops responding, your script blocks indefinitely. Always set a reasonable timeout so your automation can detect failures and move on."
  - text: "The server requires a timeout header."
    feedback: "Timeouts are client-side. The server doesn't know or care about your timeout value."
  - text: "It prevents rate limiting."
    feedback: "Timeouts and rate limits are separate concepts. A timeout protects against unresponsive servers."
```

---

```exercise
title: "Build a Configuration-Driven API Client"
scenario: |
  You need a reusable script that reads its configuration from a JSON file and makes authenticated API requests. Write a script that:

  1. Reads a `config.json` file containing: `api_url`, `auth_token`, `output_file`, and `timeout`
  2. Makes a GET request to the API URL with the auth token in an Authorization header
  3. Handles connection errors, timeouts, and HTTP errors with meaningful messages
  4. Parses the JSON response and saves it to the output file with pretty formatting
  5. Prints a summary: status code, response size, and output file path
hints:
  - "Use json.load() to read the config, requests.get() for the API call, json.dump() to write results"
  - "Set headers={'Authorization': f'Bearer {config[\"auth_token\"]}'}"
  - "Wrap the request in try/except for requests.ConnectionError, requests.Timeout, requests.HTTPError"
  - "Use response.raise_for_status() after the request to convert HTTP errors to exceptions"
solution: |
  #!/usr/bin/env python3
  """Configuration-driven API client with error handling."""

  import json
  import sys
  import requests

  def main():
      # Load configuration
      try:
          with open("config.json") as f:
              config = json.load(f)
      except FileNotFoundError:
          print("Error: config.json not found")
          sys.exit(1)
      except json.JSONDecodeError as e:
          print(f"Error: Invalid JSON in config.json: {e}")
          sys.exit(1)

      # Make the API request
      headers = {"Authorization": f"Bearer {config['auth_token']}"}

      try:
          response = requests.get(
              config["api_url"],
              headers=headers,
              timeout=config.get("timeout", 10)
          )
          response.raise_for_status()
      except requests.ConnectionError:
          print(f"Error: Could not connect to {config['api_url']}")
          sys.exit(1)
      except requests.Timeout:
          print(f"Error: Request timed out after {config.get('timeout', 10)}s")
          sys.exit(1)
      except requests.HTTPError as e:
          print(f"Error: API returned {e.response.status_code}")
          sys.exit(1)

      # Save results
      data = response.json()
      output_path = config["output_file"]

      with open(output_path, "w") as f:
          json.dump(data, f, indent=2)

      print(f"Status: {response.status_code}")
      print(f"Response size: {len(response.content):,} bytes")
      print(f"Saved to: {output_path}")

  if __name__ == "__main__":
      main()
```

---

```exercise
title: "Config-Driven API Reporter"
difficulty: intermediate
scenario: |
  You need a script that ties together file reading, API calls, error handling, and CSV output. Write a Python script that:

  1. Reads a JSON config file (`report_config.json`) containing a list of API endpoints (each with `name`, `url`, and `timeout`)
  2. Makes a GET request to each endpoint, catching connection errors and timeouts individually
  3. Collects the results: endpoint name, HTTP status code (or "ERROR"), and response time in milliseconds
  4. Writes the results to a CSV file (`api_report.csv`) with columns: `name`, `status`, `response_ms`
  5. Prints a summary line: how many succeeded and how many failed

  Example config:
  ```json
  {
    "endpoints": [
      {"name": "GitHub API", "url": "https://api.github.com", "timeout": 5},
      {"name": "Example", "url": "https://example.com", "timeout": 3}
    ],
    "output_file": "api_report.csv"
  }
  ```
hints:
  - "Use json.load() to read the config, then loop over config['endpoints']"
  - "Track response time with: start = time.time(); response = requests.get(...); elapsed = (time.time() - start) * 1000"
  - "Wrap each request in its own try/except so one failure doesn't stop the entire report"
  - "Use csv.DictWriter with fieldnames=['name', 'status', 'response_ms'] to write results"
solution: |
  #!/usr/bin/env python3
  """Config-driven API health reporter."""

  import csv
  import json
  import sys
  import time
  import requests

  def main():
      try:
          with open("report_config.json") as f:
              config = json.load(f)
      except (FileNotFoundError, json.JSONDecodeError) as e:
          print(f"Error loading config: {e}")
          sys.exit(1)

      results = []
      for endpoint in config["endpoints"]:
          name = endpoint["name"]
          try:
              start = time.time()
              response = requests.get(endpoint["url"], timeout=endpoint.get("timeout", 10))
              elapsed_ms = round((time.time() - start) * 1000)
              results.append({"name": name, "status": response.status_code, "response_ms": elapsed_ms})
          except (requests.ConnectionError, requests.Timeout) as e:
              results.append({"name": name, "status": "ERROR", "response_ms": 0})

      output_file = config.get("output_file", "api_report.csv")
      with open(output_file, "w", newline="") as f:
          writer = csv.DictWriter(f, fieldnames=["name", "status", "response_ms"])
          writer.writeheader()
          writer.writerows(results)

      succeeded = sum(1 for r in results if r["status"] != "ERROR")
      failed = len(results) - succeeded
      print(f"Report written to {output_file}: {succeeded} succeeded, {failed} failed")

  if __name__ == "__main__":
      main()
```

---

## Further Reading

- [Python Docs: Reading and Writing Files](https://docs.python.org/3/tutorial/inputoutput.html#reading-and-writing-files) - official guide to file I/O
- [Python Docs: pathlib](https://docs.python.org/3/library/pathlib.html) - object-oriented filesystem path handling
- [Requests: Quickstart Guide](https://requests.readthedocs.io/en/latest/user/quickstart/) - getting started with the requests library
- [Real Python: Working with JSON](https://realpython.com/python-json/) - complete guide to JSON parsing, serialization, and best practices

---

**Previous:** [Data Structures and Logic](data-structures-and-logic.md) | **Next:** [System Automation](system-automation.md) | [Back to Index](README.md)
