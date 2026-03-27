---
difficulty: intermediate
time_estimate: "35 min"
prerequisites:
  - shell-basics
  - package-management
learning_outcomes:
  - "Manage services with systemctl: start, stop, enable, and check status"
  - "Write and modify systemd unit files for custom services"
  - "Use journalctl to query and filter systemd journal logs"
  - "Debug boot problems using systemd targets and dependency analysis"
tags:
  - cli
  - systemd
---
# System Services and systemd

On nearly every modern Linux distribution, **systemd** is the first process that starts after the kernel boots. It manages services, handles logging, mounts filesystems, and coordinates the entire startup sequence. If you administer a Linux server, you interact with systemd daily - starting services, reading logs, and troubleshooting boot problems all go through it.

---

## What an Init System Does

When the Linux kernel finishes its own initialization, it starts a single userspace process: the **init system** (PID 1). This process is responsible for bringing up everything else - mounting filesystems, starting network services, launching login prompts.

The original Unix approach was **SysVinit**, which ran shell scripts in sequence from `/etc/init.d/`. It worked, but startup was slow because services launched one at a time, and writing init scripts was tedious and error-prone.

**Upstart** (Ubuntu, 2006) introduced event-driven service startup, and **systemd** (Fedora, 2011) took that further with parallel startup, dependency tracking, socket activation, and a unified logging system. By 2015, Debian, Ubuntu, RHEL, Fedora, Arch, and SUSE had all adopted [**systemd**](https://systemd.io/) as their default init system.

---

## Managing Services with systemctl

[**`systemctl`**](https://www.freedesktop.org/software/systemd/man/systemctl.html) is the primary command for interacting with systemd. Every long-running daemon on the system - web servers, databases, SSH, cron - is managed through it.

### Starting and Stopping

```bash
# Start a service immediately
sudo systemctl start nginx

# Stop a service
sudo systemctl stop nginx

# Restart a service (stop, then start)
sudo systemctl restart nginx

# Reload configuration without restarting (not all services support this)
sudo systemctl reload nginx

# Restart only if the service is already running
sudo systemctl try-restart nginx
```

The difference between `restart` and `reload` matters in production. A `restart` kills the process and starts a new one, dropping all active connections. A `reload` signals the running process to re-read its configuration files without interrupting existing connections. Not every service supports reload - if it doesn't, systemd returns an error.

### Checking Status

```bash
# Show detailed status of a service
systemctl status nginx

# Check if a service is running (returns 0 or non-zero exit code)
systemctl is-active nginx

# Check if a service is enabled at boot
systemctl is-enabled nginx

# Check if a service has failed
systemctl is-failed nginx
```

The `status` output includes the service state, PID, memory usage, and the most recent log lines - it's usually the first thing you check when something goes wrong. For practical examples of managing a production service like Nginx, see the **[Nginx Configuration](../Nginx/configuration.md)** guide.

### Enabling and Disabling

Starting a service makes it run now. **Enabling** it makes it start automatically at boot:

```bash
# Enable a service to start at boot
sudo systemctl enable nginx

# Enable AND start it immediately
sudo systemctl enable --now nginx

# Disable a service from starting at boot (does not stop it now)
sudo systemctl disable nginx

# Disable AND stop it immediately
sudo systemctl disable --now nginx
```

### Masking

Masking goes further than disabling - it prevents a service from being started at all, even manually:

```bash
# Mask a service (symlinks it to /dev/null)
sudo systemctl mask nginx

# Unmask a service
sudo systemctl unmask nginx
```

This is useful when you want to guarantee a service never runs - for example, masking a firewall service during migration to prevent accidental lockouts.

### Listing Services

```bash
# List all active services
systemctl list-units --type=service

# List all services (including inactive)
systemctl list-units --type=service --all

# List enabled/disabled status of all services
systemctl list-unit-files --type=service

# Show only failed services
systemctl --failed
```

```command-builder
base: systemctl
description: Build a systemctl command to manage systemd services
options:
  - flag: ""
    type: select
    label: "Action"
    explanation: "The operation to perform on the service"
    choices:
      - ["status", "Show service status (status)"]
      - ["start", "Start a service (start)"]
      - ["stop", "Stop a service (stop)"]
      - ["restart", "Stop then start a service (restart)"]
      - ["reload", "Reload config without restart (reload)"]
      - ["enable", "Start at boot (enable)"]
      - ["disable", "Remove from boot (disable)"]
      - ["enable --now", "Enable and start immediately (enable --now)"]
      - ["disable --now", "Disable and stop immediately (disable --now)"]
      - ["mask", "Prevent service from starting entirely (mask)"]
      - ["unmask", "Remove mask (unmask)"]
      - ["is-active", "Check if running (is-active)"]
      - ["is-enabled", "Check if enabled at boot (is-enabled)"]
  - flag: ""
    type: text
    label: "Unit name"
    placeholder: "nginx"
    explanation: "The service or unit to manage (e.g., nginx, sshd, postgresql)"
  - flag: ""
    type: select
    label: "List units"
    explanation: "List units instead of managing a specific one (overrides unit name)"
    choices:
      - ["", "Manage a specific unit"]
      - ["list-units --type=service", "List all active services"]
      - ["list-units --type=service --all", "List all services including inactive"]
      - ["list-unit-files --type=service", "List enabled/disabled status of all services"]
      - ["--failed", "Show only failed services"]
      - ["list-timers", "List all active timers"]
```

```terminal
title: "Managing a Service with systemctl"
steps:
  - command: "systemctl status sshd"
    output: "● sshd.service - OpenBSD Secure Shell server\n     Loaded: loaded (/usr/lib/systemd/system/sshd.service; enabled; preset: enabled)\n     Active: active (running) since Tue 2026-03-25 08:12:33 UTC; 6h ago\n       Docs: man:sshd(8)\n             man:sshd_config(5)\n   Main PID: 842 (sshd)\n      Tasks: 1 (limit: 4647)\n     Memory: 5.3M (peak: 6.1M)\n        CPU: 312ms\n     CGroup: /system.slice/sshd.service\n             └─842 \"sshd: /usr/sbin/sshd -D [listener] 0 of 10-100 startups\"\n\nMar 25 08:12:33 server01 systemd[1]: Started sshd.service - OpenBSD Secure Shell server."
    narration: "systemctl status shows everything about a service at a glance: whether it's running, its PID, memory usage, how long it's been up, and the last few log lines. The 'enabled' in the Loaded line means it starts automatically at boot."
  - command: "systemctl is-active sshd"
    output: "active"
    narration: "is-active returns a single word and sets the exit code. Scripts use this to check service health: if systemctl is-active --quiet sshd; then echo 'running'; fi"
  - command: "systemctl is-enabled sshd"
    output: "enabled"
    narration: "is-enabled tells you whether the service starts at boot. Possible values include enabled, disabled, masked, and static (static means the unit has no [Install] section and can't be enabled directly)."
  - command: "sudo systemctl restart sshd"
    output: ""
    narration: "Restarting a service stops and starts it. For SSH specifically, existing connections are preserved because sshd forks child processes for each connection - only the listener process restarts."
  - command: "journalctl -u sshd --since '5 minutes ago' --no-pager"
    output: "Mar 25 14:32:01 server01 systemd[1]: Stopping sshd.service - OpenBSD Secure Shell server...\nMar 25 14:32:01 server01 sshd[842]: Received signal 15; terminating.\nMar 25 14:32:01 server01 systemd[1]: sshd.service: Deactivated successfully.\nMar 25 14:32:01 server01 systemd[1]: Stopped sshd.service - OpenBSD Secure Shell server.\nMar 25 14:32:01 server01 systemd[1]: Started sshd.service - OpenBSD Secure Shell server."
    narration: "journalctl -u filters logs to a specific unit. Combined with --since, you can see exactly what happened during the restart. Signal 15 is SIGTERM - systemd sends it first, giving the process a chance to shut down gracefully."
```

```quiz
question: "You want to completely prevent a service from being started, even manually with systemctl start. Which command achieves this?"
type: multiple-choice
options:
  - text: "sudo systemctl mask servicename"
    correct: true
    feedback: "Correct. Masking symlinks the unit file to /dev/null, making it impossible to start through any means until unmasked."
  - text: "sudo systemctl disable servicename"
    feedback: "Disabling only removes the service from the boot sequence. It can still be started manually with systemctl start."
  - text: "sudo systemctl stop --permanent servicename"
    feedback: "There is no --permanent flag for systemctl stop. stop only affects the current session."
  - text: "sudo systemctl disable --now servicename"
    feedback: "This disables the service at boot and stops it now, but it can still be started manually afterward. Masking is the only way to fully prevent startup."
```

---

## Understanding Unit Files

Every service, socket, timer, and mount point that systemd manages is defined in a **unit file**. Unit files are plain-text INI-style configuration files.

### Where Unit Files Live

| Location | Purpose |
|----------|---------|
| `/usr/lib/systemd/system/` | Shipped by packages (distribution defaults) |
| `/etc/systemd/system/` | Administrator overrides (highest priority) |
| `/run/systemd/system/` | Runtime units (transient, lost on reboot) |

Files in `/etc/systemd/system/` take priority over files with the same name in `/usr/lib/systemd/system/`. This means you can override a package-provided unit without modifying the original.

### Anatomy of a Service Unit

Here's a typical service unit file:

```ini
[Unit]
Description=My Application Server
Documentation=https://example.com/docs
After=network.target postgresql.service
Wants=postgresql.service

[Service]
Type=simple
User=appuser
Group=appuser
WorkingDirectory=/opt/myapp
ExecStart=/opt/myapp/bin/server --config /etc/myapp/config.yaml
ExecReload=/bin/kill -HUP $MAINPID
Restart=on-failure
RestartSec=5
StandardOutput=journal
StandardError=journal

[Install]
WantedBy=multi-user.target
```

### The [Unit] Section

Defines metadata and ordering:

| Directive | Purpose |
|-----------|---------|
| `Description=` | Human-readable name shown in `systemctl status` |
| `Documentation=` | Links to documentation (man pages, URLs) |
| `After=` | Start this unit after the listed units (ordering only) |
| `Before=` | Start this unit before the listed units |
| `Wants=` | Soft dependency - try to start the listed units, but don't fail if they can't |
| `Requires=` | Hard dependency - if the listed unit fails, this unit fails too |

!!! tip "After vs Requires"
    `After=` controls order. `Requires=` controls dependency. They're independent. If you need a service to start after PostgreSQL AND fail if PostgreSQL isn't running, you need both: `After=postgresql.service` and `Requires=postgresql.service`.

### The [Service] Section

Defines how the service runs:

| Directive | Purpose |
|-----------|---------|
| `Type=simple` | Default. systemd considers the service started as soon as `ExecStart` runs |
| `Type=forking` | For daemons that fork into the background. systemd waits for the parent to exit |
| `Type=oneshot` | For tasks that run once and exit. systemd waits for completion |
| `Type=notify` | The service signals readiness via `sd_notify()`. Most reliable for complex services |
| `ExecStart=` | The command to run |
| `ExecReload=` | The command to reload configuration |
| `Restart=` | When to restart: `no`, `on-failure`, `on-abnormal`, `on-abort`, `always` |
| `RestartSec=` | Delay before restarting |
| `User=` / `Group=` | Run the process as this user/group |
| `WorkingDirectory=` | Set the working directory before starting |
| `Environment=` | Set environment variables: `Environment=NODE_ENV=production` |
| `EnvironmentFile=` | Read environment variables from a file |

### The [Install] Section

Defines what happens when you run `systemctl enable`:

| Directive | Purpose |
|-----------|---------|
| `WantedBy=multi-user.target` | Enable this service in the standard multi-user boot (most services) |
| `WantedBy=graphical.target` | Enable for graphical desktop environments |
| `RequiredBy=` | Like WantedBy but creates a hard dependency |

```code-walkthrough
language: ini
title: Anatomy of a systemd Service Unit File
code: |
  [Unit]
  Description=My Application Server
  Documentation=https://example.com/docs
  After=network.target postgresql.service
  Wants=postgresql.service

  [Service]
  Type=simple
  User=appuser
  Group=appuser
  WorkingDirectory=/opt/myapp
  ExecStart=/opt/myapp/bin/server --config /etc/myapp/config.yaml
  ExecReload=/bin/kill -HUP $MAINPID
  Restart=on-failure
  RestartSec=5
  StandardOutput=journal
  StandardError=journal

  [Install]
  WantedBy=multi-user.target
annotations:
  - line: 1
    text: "[Unit] defines metadata and relationships with other units. This section is common to all unit types (services, timers, sockets, etc.)."
  - line: 2
    text: "Description appears in systemctl status output and journalctl. Make it concise but descriptive enough to identify the service."
  - line: 3
    text: "Documentation links are shown in systemctl status. Accepts man: pages, https:// URLs, or file:// paths."
  - line: 4
    text: "After= controls startup ordering. This service starts after network.target and postgresql.service - but only if those units are being started. It does not pull them in as dependencies."
  - line: 5
    text: "Wants= is a soft dependency. systemd tries to start postgresql.service alongside this unit, but won't fail this service if PostgreSQL can't start. Use Requires= for hard dependencies."
  - line: 7
    text: "[Service] defines how the process runs. This section is specific to .service unit files."
  - line: 8
    text: "Type=simple means systemd considers the service 'started' as soon as ExecStart launches. Use 'forking' for daemons that fork into the background, 'oneshot' for scripts that run and exit."
  - line: 9
    text: "User= and Group= run the process as a non-root user. The process cannot access files owned by other users unless group permissions allow it."
  - line: 11
    text: "WorkingDirectory sets the current directory before running ExecStart. The application sees this as its pwd."
  - line: 12
    text: "ExecStart must use an absolute path - systemd doesn't use PATH. This is the main command that runs when the service starts."
  - line: 13
    text: "ExecReload defines the command for 'systemctl reload'. HUP (hangup) is the conventional signal for 'reread your config'. $MAINPID is a systemd variable holding the service's PID."
  - line: 14
    text: "Restart=on-failure restarts the process if it exits with a non-zero status, is killed by a signal, or times out. Use 'always' to restart regardless of exit status."
  - line: 15
    text: "RestartSec=5 waits 5 seconds before restarting. Prevents a crashing service from consuming resources in a tight restart loop."
  - line: 16
    text: "StandardOutput=journal sends stdout to the systemd journal. View it with journalctl -u unitname. The default is 'journal' in most distributions."
  - line: 19
    text: "[Install] defines what happens when you run 'systemctl enable'. Without this section, the service can't be enabled (it's 'static')."
  - line: 20
    text: "WantedBy=multi-user.target means enabling this service adds it to the standard multi-user boot sequence. Most server services use this target."
```

### Editing Unit Files Safely

Never edit files in `/usr/lib/systemd/system/` directly - package updates will overwrite your changes. Instead, use drop-in overrides:

```bash
# Create an override for a service
sudo systemctl edit nginx
```

This opens an editor for `/etc/systemd/system/nginx.service.d/override.conf`. Directives here merge with (and override) the original unit file.

To replace the entire unit file instead of just adding overrides:

```bash
# Edit a full copy of the unit file
sudo systemctl edit --full nginx
```

After editing any unit files, reload the systemd daemon:

```bash
sudo systemctl daemon-reload
```

---

## Writing a Custom Service

Here's a practical example: you have a Python web application that should start at boot, restart on failure, and run as a dedicated user.

Create the unit file at `/etc/systemd/system/myapp.service`:

```ini
[Unit]
Description=My Python Web Application
After=network.target

[Service]
Type=simple
User=www-data
Group=www-data
WorkingDirectory=/opt/myapp
Environment=PYTHONUNBUFFERED=1
ExecStart=/opt/myapp/venv/bin/python -m uvicorn app:main --host 0.0.0.0 --port 8000
Restart=on-failure
RestartSec=10

[Install]
WantedBy=multi-user.target
```

Then enable and start it:

```bash
# Reload systemd to pick up the new unit file
sudo systemctl daemon-reload

# Enable the service to start at boot and start it now
sudo systemctl enable --now myapp

# Verify it's running
systemctl status myapp
```

!!! warning "ExecStart must use absolute paths"
    systemd does not use the shell's `PATH` variable. Every binary in `ExecStart` must be a full path (`/usr/bin/python`, not just `python`). If you need shell features like pipes or variable expansion, use `ExecStart=/bin/bash -c 'your command here'`.

```quiz
question: "A service unit file has After=postgresql.service but no Requires= or Wants= directive for PostgreSQL. What happens if PostgreSQL fails to start?"
type: multiple-choice
options:
  - text: "The service starts anyway, just after PostgreSQL would have started"
    correct: true
    feedback: "Correct. After= only controls ordering, not dependencies. Without Requires= or Wants=, systemd doesn't care whether PostgreSQL is actually running - it just ensures ordering if both happen to start."
  - text: "The service fails to start because its dependency is down"
    feedback: "After= is not a dependency directive. You need Requires= or Wants= to express that relationship."
  - text: "systemd skips the service and marks it as inactive"
    feedback: "systemd won't skip it. After= only affects ordering. The service starts at the appropriate time regardless of PostgreSQL's state."
  - text: "The service starts before PostgreSQL instead"
    feedback: "If PostgreSQL isn't being started at all, the After= ordering is irrelevant and the service starts normally. But it doesn't change the ordering to 'before'."
```

---

## Viewing Logs with journalctl

systemd includes its own logging system, the **journal**, managed by `systemd-journald`. Every service's stdout and stderr, plus kernel messages and syslog output, flow into the journal.

[**`journalctl`**](https://www.freedesktop.org/software/systemd/man/journalctl.html) is the tool for reading it.

### Filtering by Unit

```bash
# Show all logs for a specific service
journalctl -u nginx

# Follow logs in real time (like tail -f)
journalctl -u nginx -f

# Show logs from multiple units
journalctl -u nginx -u php-fpm
```

### Filtering by Time

```bash
# Logs since a specific timestamp
journalctl --since "2026-03-25 14:00:00"

# Logs from the last hour
journalctl --since "1 hour ago"

# Logs between two times
journalctl --since "2026-03-25 14:00" --until "2026-03-25 15:00"

# Logs from the current boot only
journalctl -b

# Logs from the previous boot
journalctl -b -1
```

### Filtering by Priority

Journal entries have syslog priority levels:

| Level | Name | Meaning |
|-------|------|---------|
| 0 | emerg | System is unusable |
| 1 | alert | Immediate action required |
| 2 | crit | Critical conditions |
| 3 | err | Error conditions |
| 4 | warning | Warning conditions |
| 5 | notice | Normal but significant |
| 6 | info | Informational |
| 7 | debug | Debug-level messages |

```bash
# Show only errors and above
journalctl -p err

# Show only errors from a specific service
journalctl -u nginx -p err

# Show warnings and above since boot
journalctl -b -p warning
```

### Output Formatting

```bash
# Show full output without paging
journalctl --no-pager

# JSON output (useful for piping to jq)
journalctl -u nginx -o json-pretty --since "1 hour ago"

# Show only the message field (no timestamps or metadata)
journalctl -u nginx -o cat
```

### Persistent Journal Storage

By default on some distributions, the journal only keeps logs in memory (`/run/log/journal/`), which means logs are lost on reboot. To make them persistent:

```bash
# Create the persistent journal directory
sudo mkdir -p /var/log/journal

# Restart journald to pick up the change
sudo systemctl restart systemd-journald
```

You can also control journal size in `/etc/systemd/journald.conf`:

```ini
[Journal]
Storage=persistent
SystemMaxUse=500M
SystemMaxFileSize=50M
MaxRetentionSec=1month
```

After editing, restart journald:

```bash
sudo systemctl restart systemd-journald
```

---

## Targets

Targets are systemd's replacement for SysVinit runlevels. A target is a group of units that represents a system state.

| Target | SysVinit Equivalent | Purpose |
|--------|---------------------|---------|
| `poweroff.target` | Runlevel 0 | System shutdown |
| `rescue.target` | Runlevel 1 | Single-user rescue mode |
| `multi-user.target` | Runlevel 3 | Multi-user, no GUI (servers) |
| `graphical.target` | Runlevel 5 | Multi-user with GUI (desktops) |
| `reboot.target` | Runlevel 6 | System reboot |
| `emergency.target` | - | Minimal emergency shell |

```bash
# Check the default target
systemctl get-default

# Set the default target (takes effect on next boot)
sudo systemctl set-default multi-user.target

# Switch to a target immediately
sudo systemctl isolate rescue.target

# List all available targets
systemctl list-units --type=target
```

!!! danger "Isolating targets"
    `systemctl isolate` stops all services that aren't part of the target. Running `systemctl isolate rescue.target` on a remote server kills your SSH session. Only use it with console access or in `rescue.target`/`emergency.target` scenarios where you're already at the physical console.

---

## Timers

systemd timers are a modern alternative to cron jobs. They offer better logging (through journalctl), dependency management, and randomized delays to prevent thundering herd problems.

A timer requires two unit files: a `.timer` file and a matching `.service` file.

### Example: Daily Cleanup Task

Create `/etc/systemd/system/cleanup.service`:

```ini
[Unit]
Description=Daily cleanup of temporary files

[Service]
Type=oneshot
ExecStart=/usr/local/bin/cleanup.sh
```

Create `/etc/systemd/system/cleanup.timer`:

```ini
[Unit]
Description=Run cleanup daily at 3am

[Timer]
OnCalendar=*-*-* 03:00:00
RandomizedDelaySec=900
Persistent=true

[Install]
WantedBy=timers.target
```

Enable the timer (not the service):

```bash
sudo systemctl daemon-reload
sudo systemctl enable --now cleanup.timer
```

### Timer Types

| Directive | Type | Example |
|-----------|------|---------|
| `OnCalendar=` | Realtime (calendar-based) | `OnCalendar=Mon *-*-* 09:00:00` |
| `OnBootSec=` | Monotonic (relative to boot) | `OnBootSec=15min` |
| `OnUnitActiveSec=` | Monotonic (relative to last activation) | `OnUnitActiveSec=1h` |
| `OnStartupSec=` | Monotonic (relative to systemd start) | `OnStartupSec=5min` |

### OnCalendar Syntax

The calendar format is `DayOfWeek Year-Month-Day Hour:Minute:Second`:

```bash
# Every day at midnight
OnCalendar=*-*-* 00:00:00
# Shorthand
OnCalendar=daily

# Every Monday at 9am
OnCalendar=Mon *-*-* 09:00:00

# Every 15 minutes
OnCalendar=*:0/15

# First day of every month at noon
OnCalendar=*-*-01 12:00:00

# Validate a calendar expression
systemd-analyze calendar "Mon *-*-* 09:00:00"
```

`Persistent=true` means if the system was off when the timer would have fired, it runs immediately on next boot. `RandomizedDelaySec=` adds jitter so multiple machines with the same timer don't all fire at the exact same second.

### Listing Timers

```bash
# List all active timers with their next trigger time
systemctl list-timers

# Include inactive timers
systemctl list-timers --all
```

---

## Debugging and Analysis

### Boot Performance

```bash
# Show how long each service took to start
systemd-analyze blame

# Show the critical chain (the longest dependency path)
systemd-analyze critical-chain

# Show total boot time breakdown
systemd-analyze

# Generate an SVG chart of the boot process
systemd-analyze plot > boot-chart.svg
```

`systemd-analyze blame` lists services sorted by startup time. If a service is slow, check whether it's blocking other services with `systemd-analyze critical-chain unitname`.

### Dependency Trees

```bash
# Show what a service depends on
systemctl list-dependencies nginx

# Show reverse dependencies (what depends on a service)
systemctl list-dependencies nginx --reverse

# Show the full dependency tree for the default target
systemctl list-dependencies default.target
```

### Troubleshooting Failed Services

```bash
# List all failed units
systemctl --failed

# Show the status and recent logs of a failed service
systemctl status failed-service

# View the full logs for troubleshooting
journalctl -u failed-service --since "10 minutes ago"

# Reset the failed state after fixing the issue
sudo systemctl reset-failed failed-service
```

A common pattern: a service fails, you check `systemctl status` for the error, dig deeper with `journalctl -u`, fix the config or code, run `daemon-reload` if you changed the unit file, then start it again.

```exercise
title: Create a Custom systemd Service
difficulty: intermediate
scenario: |
  You have a monitoring script at `/usr/local/bin/health-check.sh` that pings an endpoint
  and logs the result. You need to:

  1. Write a systemd service unit that runs the script as the `nobody` user
  2. Configure it to restart automatically on failure with a 30-second delay
  3. Set it to start after the network is available
  4. Enable it to start at boot
  5. Write a systemd timer that runs this service every 5 minutes
  6. Check the logs to verify it's working
hints:
  - "Service units go in /etc/systemd/system/ with a .service extension"
  - "Use Type=oneshot for scripts that run and exit rather than long-running daemons"
  - "After=network-online.target ensures the network is fully up, not just that the network stack loaded"
  - "Timer files must have the same base name as the service they trigger"
  - "Use systemctl list-timers to verify your timer is scheduled"
solution: |
  ```ini
  # /etc/systemd/system/health-check.service
  [Unit]
  Description=Endpoint Health Check
  After=network-online.target
  Wants=network-online.target

  [Service]
  Type=oneshot
  User=nobody
  ExecStart=/usr/local/bin/health-check.sh
  ```

  ```ini
  # /etc/systemd/system/health-check.timer
  [Unit]
  Description=Run health check every 5 minutes

  [Timer]
  OnCalendar=*:0/5
  Persistent=true

  [Install]
  WantedBy=timers.target
  ```

  ```bash
  # Reload, enable, and verify
  sudo systemctl daemon-reload
  sudo systemctl enable --now health-check.timer
  systemctl list-timers | grep health-check
  journalctl -u health-check --since "10 minutes ago"
  ```

  Note: the service unit has no `[Install]` section because it's triggered by the timer,
  not enabled directly. You enable the timer, not the service.
```

---

## Further Reading

- [systemd Documentation](https://systemd.io/) - official project page with specifications and design documents
- [systemctl man page](https://www.freedesktop.org/software/systemd/man/systemctl.html) - complete command reference
- [journalctl man page](https://www.freedesktop.org/software/systemd/man/journalctl.html) - journal query tool reference
- [systemd.service man page](https://www.freedesktop.org/software/systemd/man/systemd.service.html) - service unit file format
- [systemd.timer man page](https://www.freedesktop.org/software/systemd/man/systemd.timer.html) - timer unit file format
- [systemd-analyze man page](https://www.freedesktop.org/software/systemd/man/systemd-analyze.html) - boot performance and debugging tools
- [Arch Wiki: systemd](https://wiki.archlinux.org/title/Systemd) - comprehensive practical reference with examples

---

**Previous:** [Package Management](package-management.md) | **Next:** [User and Group Management](user-and-group-management.md) | [Back to Index](README.md)
