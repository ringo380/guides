# Log Management

When something breaks on a Linux system - a service crashes, a login fails, a disk fills up - the first place you look is the logs. Every significant event on a Linux machine is recorded somewhere, and knowing how to find, filter, and manage those logs is one of the most practical skills a sysadmin can have.

Modern Linux distributions run two logging systems in parallel: **systemd's journal** (managed by `journald`) and a traditional syslog daemon (usually [**rsyslog**](https://www.rsyslog.com/)). They serve different purposes and complement each other.

---

## The /var/log Directory

Most traditional log files live in `/var/log/`. The exact files vary by distribution, but the core ones are consistent.

### Common Log Files

| File | Contents | Distribution |
|------|----------|-------------|
| `/var/log/syslog` | General system messages | Debian/Ubuntu |
| `/var/log/messages` | General system messages | RHEL/Fedora |
| `/var/log/auth.log` | Authentication events (logins, sudo, SSH) | Debian/Ubuntu |
| `/var/log/secure` | Authentication events | RHEL/Fedora |
| `/var/log/kern.log` | Kernel messages | Debian/Ubuntu |
| `/var/log/dmesg` | Kernel ring buffer (hardware, drivers) | All |
| `/var/log/dpkg.log` | Package manager actions | Debian/Ubuntu |
| `/var/log/dnf.log` | Package manager actions | RHEL/Fedora |
| `/var/log/boot.log` | Boot-time service messages | Most |
| `/var/log/cron` | Cron job execution | RHEL/Fedora |
| `/var/log/wtmp` | Login records (binary, read with `last`) | All |
| `/var/log/btmp` | Failed login records (binary, read with `lastb`) | All |
| `/var/log/lastlog` | Last login per user (binary, read with `lastlog`) | All |

Applications typically create their own log files or subdirectories: `/var/log/nginx/`, `/var/log/mysql/`, `/var/log/postgresql/`.

!!! tip "Binary vs text logs"
    Most files in `/var/log/` are plain text and can be read with `cat`, `less`, `grep`, and other standard tools. The exceptions are `wtmp`, `btmp`, and `lastlog` - these are binary files. Use `last` (for `wtmp`), `lastb` (for `btmp`), and `lastlog` to read them.

### Quick Log Inspection

```bash
# View the last 50 lines of the system log
tail -50 /var/log/syslog

# Follow a log file in real time
tail -f /var/log/auth.log

# Search for errors in the system log
grep -i error /var/log/syslog

# Show today's authentication events
grep "$(date +%b\ %d)" /var/log/auth.log

# View login history
last -20

# View failed login attempts (requires root)
sudo lastb -20
```

---

## journalctl Deep Dive

The [System Services guide](system-services.md) introduced `journalctl` basics. Here we cover the full range of filtering and management capabilities.

### Filtering by Unit and Identifier

```bash
# Logs for a specific systemd service
journalctl -u nginx

# Logs for multiple services
journalctl -u nginx -u php-fpm

# Logs by syslog identifier (for non-systemd programs)
journalctl -t CROND

# Logs by PID
journalctl _PID=1234

# Logs by UID (all messages from a specific user's processes)
journalctl _UID=1000
```

### Filtering by Time

```bash
# Since a specific time
journalctl --since "2026-03-25 09:00:00"

# Relative time
journalctl --since "2 hours ago"

# Time range
journalctl --since "2026-03-25 09:00" --until "2026-03-25 10:00"

# Current boot only
journalctl -b

# Previous boot
journalctl -b -1

# List all recorded boots
journalctl --list-boots
```

### Filtering by Priority

Syslog defines eight severity levels. `journalctl -p` filters by these levels and includes all messages at that level and above (more severe):

| Level | Name | Meaning |
|-------|------|---------|
| 0 | emerg | System unusable |
| 1 | alert | Immediate action required |
| 2 | crit | Critical failure |
| 3 | err | Error |
| 4 | warning | Warning |
| 5 | notice | Normal but noteworthy |
| 6 | info | Informational |
| 7 | debug | Debug messages |

```bash
# Errors and above (emerg, alert, crit, err)
journalctl -p err

# Range of priorities
journalctl -p warning..err

# Errors from nginx since boot
journalctl -b -u nginx -p err
```

### Output Formats

```bash
# Default (human-readable)
journalctl -u nginx

# JSON (one object per line - pipe to jq)
journalctl -u nginx -o json | jq '.MESSAGE'

# JSON pretty-printed
journalctl -u nginx -o json-pretty

# Message only (no metadata)
journalctl -u nginx -o cat

# Verbose (all fields)
journalctl -u nginx -o verbose

# Short with microsecond timestamps
journalctl -u nginx -o short-precise
```

### Journal Disk Usage

```bash
# Check how much space the journal uses
journalctl --disk-usage

# Remove old entries to shrink to a size limit
sudo journalctl --vacuum-size=500M

# Remove entries older than a time limit
sudo journalctl --vacuum-time=30d

# Remove by number of journal files
sudo journalctl --vacuum-files=5
```

```terminal
title: "Investigating a Failed Service with journalctl"
steps:
  - command: "systemctl --failed"
    output: "  UNIT                LOAD   ACTIVE SUB    DESCRIPTION\n● myapp.service       loaded failed failed My Application Server\n\n1 loaded units listed."
    narration: "Start by checking which services have failed. systemctl --failed gives a quick overview."
  - command: "journalctl -u myapp --since '1 hour ago' -p err"
    output: "Mar 25 14:15:01 server01 myapp[4521]: ERROR: Cannot bind to port 8000: Address already in use\nMar 25 14:15:01 server01 systemd[1]: myapp.service: Main process exited, code=exited, status=1/FAILURE\nMar 25 14:15:01 server01 systemd[1]: myapp.service: Failed with result 'exit-code'."
    narration: "Filter by unit and priority to cut through the noise. The error is clear: port 8000 is already in use. Something else is listening on that port."
  - command: "ss -tlnp | grep 8000"
    output: "LISTEN 0      128    0.0.0.0:8000   0.0.0.0:*    users:((\"python3\",pid=3892,fd=5))"
    narration: "ss reveals another Python process is occupying the port. This is likely a stale instance that didn't shut down properly."
  - command: "journalctl -u myapp -o json-pretty --since '1 hour ago' | head -20"
    output: "{\n    \"__REALTIME_TIMESTAMP\" : \"1711371301000000\",\n    \"_PID\" : \"4521\",\n    \"_UID\" : \"33\",\n    \"_GID\" : \"33\",\n    \"_COMM\" : \"python3\",\n    \"SYSLOG_IDENTIFIER\" : \"myapp\",\n    \"PRIORITY\" : \"3\",\n    \"MESSAGE\" : \"ERROR: Cannot bind to port 8000: Address already in use\",\n    \"_SYSTEMD_UNIT\" : \"myapp.service\"\n}"
    narration: "JSON output includes metadata not visible in the default format: the exact PID, UID, binary name, and microsecond timestamp. This is useful for correlation and automated log parsing."
  - command: "journalctl --disk-usage"
    output: "Archived and active journals take up 248.0M in the file system."
    narration: "Check journal disk usage periodically. On long-running servers, the journal can grow to several gigabytes if not managed. Use --vacuum-size or configure SystemMaxUse in journald.conf to cap it."
```

```quiz
question: "You run journalctl -p warning -u sshd --since '1 hour ago'. Which messages will appear?"
type: multiple-choice
options:
  - text: "All sshd messages at warning, err, crit, alert, and emerg levels from the last hour"
    correct: true
    feedback: "Correct. The -p flag filters by priority and includes the specified level plus all more severe levels above it. warning (4) includes err (3), crit (2), alert (1), and emerg (0)."
  - text: "Only sshd messages at exactly the warning level from the last hour"
    feedback: "The -p filter includes the specified level and everything more severe. To filter an exact range, use -p warning..warning."
  - text: "All sshd messages from the last hour, with warnings highlighted"
    feedback: "-p is a filter, not a highlighter. Messages below the specified priority are excluded from the output."
  - text: "All messages from all services at warning level from the last hour"
    feedback: "The -u sshd flag restricts output to the sshd unit only. Without -u, you'd see all services."
```

---

## rsyslog

[**rsyslog**](https://www.rsyslog.com/) is the traditional syslog daemon on most Linux distributions. It receives log messages from applications, the kernel, and network sources, and routes them to files, remote servers, or databases based on configurable rules.

### The Syslog Model

Every syslog message has two properties:

**Facility** - the source category:

| Code | Facility | Typical Use |
|------|----------|-------------|
| 0 | kern | Kernel messages |
| 1 | user | User-level programs |
| 3 | daemon | System daemons |
| 4 | auth | Authentication (login, su, sudo) |
| 5 | syslog | Syslog daemon itself |
| 6 | lpr | Printing |
| 9 | cron | Cron daemon |
| 10 | authpriv | Private authentication messages |
| 16-23 | local0-local7 | Available for custom use |

**Severity** - same eight levels as journalctl (emerg through debug).

### rsyslog.conf

The main configuration is `/etc/rsyslog.conf`, with additional files in `/etc/rsyslog.d/`:

```bash
# Standard rsyslog rules (Debian/Ubuntu default)
auth,authpriv.*                 /var/log/auth.log
*.*;auth,authpriv.none          /var/log/syslog
kern.*                          /var/log/kern.log
mail.*                          /var/log/mail.log
cron.*                          /var/log/cron.log
```

The selector format is `facility.severity`. The action (right side) is usually a file path.

| Selector | Meaning |
|----------|---------|
| `auth.*` | All severities from the auth facility |
| `*.err` | Errors from all facilities |
| `auth.warning` | Warnings and above from auth |
| `auth.=info` | Only info from auth (exact match) |
| `auth.!err` | Everything except err and above from auth |
| `*.*;auth.none` | Everything from all facilities, excluding auth |

### Logging to a Remote Server

rsyslog can forward logs to a central log server:

```bash
# Forward all logs via TCP (reliable)
*.* @@logserver.example.com:514

# Forward only auth logs via UDP (traditional)
auth.* @logserver.example.com:514
```

`@` means UDP, `@@` means TCP. TCP is preferred for reliability - UDP can silently drop messages under load.

On the receiving server, enable TCP reception in `/etc/rsyslog.conf`:

```bash
module(load="imtcp")
input(type="imtcp" port="514")
```

### Custom Application Logging

Use `local0` through `local7` facilities for your own applications:

```bash
# In /etc/rsyslog.d/myapp.conf
local0.*    /var/log/myapp.log
```

Your application can send to this facility using the `logger` command:

```bash
# Send a message to the local0 facility
logger -p local0.info "Application started successfully"
logger -p local0.err "Database connection failed"
```

---

## logrotate

Log files grow without bound unless managed. [**logrotate**](https://man7.org/linux/man-pages/man8/logrotate.8.html) handles this by periodically rotating, compressing, and removing old logs.

### Configuration

Global settings live in `/etc/logrotate.conf`. Per-application configs go in `/etc/logrotate.d/`:

```bash
# /etc/logrotate.d/nginx
/var/log/nginx/*.log {
    daily
    missingok
    rotate 14
    compress
    delaycompress
    notifempty
    create 0640 www-data adm
    sharedscripts
    postrotate
        [ -f /var/run/nginx.pid ] && kill -USR1 $(cat /var/run/nginx.pid)
    endscript
}
```

### Key Directives

| Directive | Meaning |
|-----------|---------|
| `daily` / `weekly` / `monthly` | Rotation frequency |
| `rotate 14` | Keep 14 rotated copies |
| `compress` | Compress rotated files with gzip |
| `delaycompress` | Wait one rotation before compressing (useful for programs that hold file handles) |
| `missingok` | Don't error if the log file is missing |
| `notifempty` | Don't rotate if the file is empty |
| `create 0640 user group` | Create the new log file with these permissions |
| `copytruncate` | Copy the log then truncate the original (for apps that can't reopen files) |
| `postrotate` / `endscript` | Commands to run after rotation (e.g., signal the app to reopen logs) |
| `sharedscripts` | Run postrotate once for all matched files, not once per file |
| `maxsize 100M` | Rotate when file exceeds this size, regardless of time |
| `dateext` | Use date in rotated filename instead of numeric suffix |

!!! tip "copytruncate vs postrotate"
    Most well-behaved daemons reopen their log files when signaled (nginx uses `USR1`, Apache uses `GRACEFUL`). For these, use `postrotate` to send the signal. `copytruncate` is a fallback for programs that keep the file descriptor open and can't be told to reopen - it copies the file content then truncates the original, but there's a small window where log lines can be lost.

### Testing logrotate

```bash
# Dry run - shows what would happen without doing it
sudo logrotate -d /etc/logrotate.d/nginx

# Force rotation (ignoring time checks)
sudo logrotate -f /etc/logrotate.d/nginx

# Verbose output
sudo logrotate -v /etc/logrotate.conf
```

Always test with `-d` (debug/dry-run) before making changes to production logrotate configs.

```quiz
question: "A custom application writes to /var/log/myapp.log but never closes and reopens the file. After logrotate runs, the application keeps writing to the old (now rotated) file. Which logrotate directive fixes this without modifying the application?"
type: multiple-choice
options:
  - text: "copytruncate - copies the log file then truncates the original, so the app's open file handle stays valid"
    correct: true
    feedback: "Correct. copytruncate copies the file contents to the rotated copy, then truncates the original file to zero bytes. The application's file descriptor still points to the same inode, which is now empty, and new writes go to the original path."
  - text: "create - creates a new empty file to replace the rotated one"
    feedback: "create makes a new file at the original path, but the application's open file descriptor still points to the old inode (now rotated). New writes go to the rotated file, not the new one."
  - text: "compress - compresses the rotated file so the app can't write to it"
    feedback: "compress only affects the rotated copy. The application's behavior depends on file descriptors, not whether the rotated file is compressed."
  - text: "sharedscripts - ensures the application is only signaled once"
    feedback: "sharedscripts controls how postrotate runs, but if the application can't reopen files, signaling it doesn't help. copytruncate avoids the need for the app to do anything."
```

---

## Structured Log Parsing

Production troubleshooting often means extracting specific data from large log files. The [Text Processing guide](text-processing.md) covers the core tools (`grep`, `awk`, `sed`). Here are patterns specific to log analysis.

### Extracting Failed SSH Attempts

```bash
# Find all failed password attempts
grep "Failed password" /var/log/auth.log

# Extract just the IP addresses
grep "Failed password" /var/log/auth.log | grep -oP 'from \K[\d.]+'

# Count attempts per IP, sorted by frequency
grep "Failed password" /var/log/auth.log | grep -oP 'from \K[\d.]+' | sort | uniq -c | sort -rn | head -20

# Same thing with awk
awk '/Failed password/ {for(i=1;i<=NF;i++) if($i=="from") print $(i+1)}' /var/log/auth.log | sort | uniq -c | sort -rn
```

### Timeline Reconstruction

```bash
# Show all events for a specific time window
awk '$0 >= "Mar 25 14:00" && $0 <= "Mar 25 14:30"' /var/log/syslog

# Correlate events across multiple log files
grep "14:1[0-5]:" /var/log/syslog /var/log/auth.log | sort -t: -k2,3
```

### JSON Log Parsing with jq

Many modern applications output JSON logs. [**`jq`**](https://jqlang.github.io/jq/) is the standard tool for processing them:

```bash
# Pretty-print JSON logs
cat /var/log/myapp/app.json | jq '.'

# Extract specific fields
cat /var/log/myapp/app.json | jq '{timestamp: .ts, level: .level, message: .msg}'

# Filter by level
cat /var/log/myapp/app.json | jq 'select(.level == "error")'

# Count errors by type
cat /var/log/myapp/app.json | jq -r 'select(.level == "error") | .error_type' | sort | uniq -c | sort -rn

# journalctl JSON output piped to jq
journalctl -u nginx -o json | jq -r 'select(.PRIORITY == "3") | .MESSAGE'
```

### Common One-liners

```bash
# Top 10 largest log files
du -sh /var/log/* 2>/dev/null | sort -rh | head -10

# Find log files modified in the last hour
find /var/log -type f -mmin -60

# Watch multiple log files simultaneously
tail -f /var/log/syslog /var/log/auth.log

# Extract unique error messages from syslog
grep -i error /var/log/syslog | sed 's/^.*]: //' | sort -u
```

---

## Centralized Logging

On a single server, local logs are sufficient. When managing dozens or hundreds of machines, you need centralized logging - all logs shipped to one place for search, alerting, and long-term storage.

### rsyslog Forwarding

The simplest approach uses rsyslog's built-in forwarding (covered in the rsyslog section above):

```bash
# On each client, add to /etc/rsyslog.d/remote.conf:
*.* @@logserver.example.com:514
```

### systemd-journal-upload

systemd can ship journal entries directly to a remote journal:

```bash
# Install journal-upload
sudo apt install systemd-journal-remote

# Configure /etc/systemd/journal-upload.conf
[Upload]
URL=http://logserver.example.com:19532

# Enable the service
sudo systemctl enable --now systemd-journal-upload
```

### Log Aggregation Stacks

For larger environments, dedicated log aggregation systems provide search, dashboards, and alerting:

| Stack | Components | Use Case |
|-------|------------|----------|
| ELK | Elasticsearch, Logstash, Kibana | Full-text search, visualization |
| Grafana + Loki | Promtail, Loki, Grafana | Lightweight, label-based queries |
| Graylog | MongoDB, Elasticsearch, Graylog | Centralized with built-in alerting |

These are beyond the scope of this guide, but knowing they exist helps you plan logging infrastructure as your environment grows.

```exercise
title: Log Investigation and logrotate Configuration
difficulty: intermediate
scenario: |
  You're investigating suspicious activity on a server and need to set up proper log management.

  1. Find all failed SSH login attempts from the last 24 hours using journalctl
  2. Extract the unique source IP addresses from those failed attempts
  3. Check how much disk space the journal is consuming
  4. Write a logrotate configuration for a custom application that writes to
     /var/log/myapp/app.log with these requirements:
     - Rotate daily, keep 30 days of logs
     - Compress rotated files (but delay compression by one rotation)
     - The application can't reopen files on signal
     - Don't rotate empty files
     - Create new files with permissions 0640, owned by appuser:appgroup
hints:
  - "journalctl -u sshd has SSH logs; combine with grep for 'Failed password'"
  - "Use grep -oP with a Perl regex to extract IPs, or awk to find the field after 'from'"
  - "journalctl --disk-usage shows journal size"
  - "If the app can't reopen files, you need copytruncate instead of postrotate"
  - "Test your config with logrotate -d /path/to/config"
solution: |
  ```bash
  # Step 1: Find failed SSH attempts
  journalctl -u sshd --since "24 hours ago" | grep "Failed password"

  # Step 2: Extract unique IPs
  journalctl -u sshd --since "24 hours ago" | grep "Failed password" | \
    grep -oP 'from \K[\d.]+' | sort -u

  # Step 3: Check journal disk usage
  journalctl --disk-usage
  ```

  ```bash
  # Step 4: /etc/logrotate.d/myapp
  /var/log/myapp/app.log {
      daily
      rotate 30
      compress
      delaycompress
      copytruncate
      notifempty
      missingok
      create 0640 appuser appgroup
  }
  ```

  ```bash
  # Test the config
  sudo logrotate -d /etc/logrotate.d/myapp
  ```

  The key decisions: `copytruncate` because the application can't reopen files,
  `delaycompress` so the most recent rotated file stays uncompressed for easy
  reading, and `missingok` to avoid errors if the log hasn't been created yet.
```

---

## Further Reading

- [journalctl man page](https://www.freedesktop.org/software/systemd/man/journalctl.html) - complete journal query reference
- [rsyslog Documentation](https://www.rsyslog.com/doc/master/) - rsyslog configuration and module reference
- [logrotate man page](https://man7.org/linux/man-pages/man8/logrotate.8.html) - log rotation configuration reference
- [jq Manual](https://jqlang.github.io/jq/manual/) - JSON processing tool documentation
- [Arch Wiki: systemd/Journal](https://wiki.archlinux.org/title/Systemd/Journal) - practical journal configuration guide
- [syslog(3) man page](https://man7.org/linux/man-pages/man3/syslog.3.html) - syslog facility and severity reference

---

**Previous:** [SSH Configuration](ssh-configuration.md) | **Next:** [Networking](networking.md) | [Back to Index](README.md)
