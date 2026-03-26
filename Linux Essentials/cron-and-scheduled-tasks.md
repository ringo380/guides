# Cron and Scheduled Tasks

Automating repetitive tasks is one of the most practical things you can do as a system administrator. Instead of remembering to run backups at midnight, rotate logs every Sunday, or check disk space every hour, you schedule the job once and let the system handle it. Linux provides two main tools for this: **cron** (the traditional scheduler) and **systemd timers** (the modern alternative).

---

## How Cron Works

The **cron daemon** (`crond` or `cron`, depending on your distribution) runs continuously in the background. Every minute, it wakes up, checks all configured crontab files, and runs any commands whose schedule matches the current time.

Each cron entry follows a fixed format - five time fields followed by the command to execute:

```
┌───────────── minute (0-59)
│ ┌───────────── hour (0-23)
│ │ ┌───────────── day of month (1-31)
│ │ │ ┌───────────── month (1-12)
│ │ │ │ ┌───────────── day of week (0-7, where 0 and 7 are Sunday)
│ │ │ │ │
* * * * * command to execute
```

Each field accepts specific values, ranges, steps, and lists:

| Syntax | Meaning | Example |
|--------|---------|---------|
| `*` | Every possible value | `* * * * *` runs every minute |
| `5` | Exact value | `5 * * * *` runs at minute 5 of every hour |
| `1,15` | List of values | `0 1,15 * * *` runs at 1:00 AM and 3:00 PM |
| `1-5` | Range | `0 9 * * 1-5` runs at 9:00 AM Monday through Friday |
| `*/10` | Step (every Nth) | `*/10 * * * *` runs every 10 minutes |

Month and day-of-week fields also accept three-letter abbreviations: `jan`, `feb`, `mon`, `tue`, etc.

```code-walkthrough
language: bash
title: Anatomy of a Crontab Entry
code: |
  */15 * * * * root /usr/local/bin/check-disk-space.sh >> /var/log/disk-check.log 2>&1
annotations:
  - line: 1
    text: "*/15 in the minute field means 'every 15 minutes'. The slash defines a step value - starting from 0, it matches 0, 15, 30, and 45."
  - line: 1
    text: "The first * is the hour field (0-23). An asterisk means every hour, so combined with */15, this runs at :00, :15, :30, and :45 of every hour."
  - line: 1
    text: "The second * is the day-of-month field (1-31). Asterisk means every day."
  - line: 1
    text: "The third * is the month field (1-12). Asterisk means every month."
  - line: 1
    text: "The fourth * is the day-of-week field (0-7, where 0 and 7 are Sunday). Asterisk means every day of the week."
  - line: 1
    text: "'root' is the user field - only present in system crontabs (/etc/crontab and /etc/cron.d/). User crontabs created with crontab -e omit this field."
  - line: 1
    text: ">> appends stdout to the log file. 2>&1 redirects stderr to the same file. Without this, cron emails any output to the crontab owner."
```

```quiz
question: "What does the cron expression 30 2 * * 0 mean?"
type: multiple-choice
options:
  - text: "Every 30 minutes on the 2nd of the month"
    feedback: "The first field (30) is the minute, and the second field (2) is the hour. This runs at a specific time, not every 30 minutes."
  - text: "At 2:30 AM every Sunday"
    correct: true
    feedback: "Correct! Minute 30, hour 2, every day of month, every month, day of week 0 (Sunday)."
  - text: "At 2:30 AM every day"
    feedback: "Close, but the last field (0) restricts it to Sunday only. An asterisk (*) would mean every day."
  - text: "Every 2 hours and 30 minutes"
    feedback: "Cron fields are independent - they don't combine into a duration. The first field is minute, the second is hour."
```

---

## Managing User Crontabs

Every user on the system can have their own crontab. The `crontab` command manages it:

```bash
crontab -e    # Edit your crontab (opens in $EDITOR)
crontab -l    # List your current crontab entries
crontab -r    # Remove your entire crontab (use with caution)
```

When you run `crontab -e`, your editor opens with the current crontab contents (or an empty file if you don't have one yet). Add entries, save, and exit. Cron validates the syntax and installs the new crontab immediately.

```terminal
title: "Creating a Crontab Entry"
steps:
  - command: "crontab -l"
    output: "no crontab for user"
    narration: "Start by checking if you have any existing cron jobs. A fresh user account has no crontab."
  - command: "echo '*/5 * * * * echo \"health check\" >> /tmp/cron-test.log' | crontab -"
    output: ""
    narration: "This sets a crontab that writes 'health check' to a log file every 5 minutes. The pipe to crontab - installs the content directly without opening an editor."
  - command: "crontab -l"
    output: "*/5 * * * * echo \"health check\" >> /tmp/cron-test.log"
    narration: "Confirm the entry is installed. Cron will start executing it at the next 5-minute interval."
  - command: "crontab -r"
    output: ""
    narration: "Remove the crontab when you're done testing. This deletes all entries - there's no way to remove a single line with crontab -r."
```

User crontabs are stored in `/var/spool/cron/crontabs/` (Debian/Ubuntu) or `/var/spool/cron/` (RHEL/CentOS). You should never edit these files directly - always use `crontab -e`.

!!! warning "crontab -r deletes everything"
    `crontab -r` removes your entire crontab with no confirmation. If you want to remove a single entry, use `crontab -e` and delete the specific line. Some administrators alias `crontab -r` to `crontab -ri` for interactive confirmation, but this alias doesn't exist by default.

---

## System Crontab Files

Beyond per-user crontabs, the system has several locations for scheduled tasks managed by root:

**`/etc/crontab`** is the system-wide crontab. It has the same five time fields as a user crontab, but adds a sixth field - the username to run the command as:

```bash
# /etc/crontab - system-wide cron entries
SHELL=/bin/bash
PATH=/sbin:/bin:/usr/sbin:/usr/bin

# minute hour dom month dow user command
*/15 * * * * root /usr/local/bin/check-disk-space.sh
0 3 * * * root /usr/local/bin/backup.sh
```

**`/etc/cron.d/`** holds individual crontab fragment files. Each file uses the same six-field format as `/etc/crontab`. Packages often install their cron jobs here - for example, a monitoring agent might drop a file at `/etc/cron.d/monitoring` instead of modifying `/etc/crontab`. This keeps system cron jobs modular and easy to manage.

**Drop-in directories** provide a simpler approach for common schedules. Any executable script placed in these directories runs on the corresponding schedule:

| Directory | Schedule |
|-----------|----------|
| `/etc/cron.hourly/` | Once per hour |
| `/etc/cron.daily/` | Once per day |
| `/etc/cron.weekly/` | Once per week |
| `/etc/cron.monthly/` | Once per month |

Scripts in these directories don't need cron syntax at all - they just need to be executable (`chmod +x`). The exact run time depends on your system's configuration in `/etc/crontab` or `/etc/anacrontab`.

---

## Cron Environment and Gotchas

Cron jobs run in a minimal environment that is very different from your interactive shell. This is the most common source of cron job failures.

**PATH is minimal**: Cron's default `PATH` is typically `/usr/bin:/bin`. Commands that work fine in your terminal may fail in cron because they live in `/usr/local/bin`, `/sbin`, or elsewhere. Always use full paths to commands in cron jobs, or set `PATH` explicitly at the top of your crontab:

```bash
# Set PATH in your crontab
PATH=/usr/local/bin:/usr/bin:/bin:/usr/sbin:/sbin

# Or use full paths in each command
0 3 * * * /usr/local/bin/restic backup /home
```

**No shell profile**: Cron doesn't source `~/.bashrc`, `~/.bash_profile`, or any other profile files. Environment variables, aliases, and functions from your shell configuration don't exist in cron. If your script depends on environment variables, set them explicitly in the crontab or source them in the script itself.

**Output goes to email**: By default, cron emails any output (stdout and stderr) from a job to the crontab owner. If no mail system is configured, output is silently discarded - you'll never know your job failed. Handle output explicitly:

```bash
# Redirect all output to a log file
0 3 * * * /usr/local/bin/backup.sh >> /var/log/backup.log 2>&1

# Discard output entirely (only if you truly don't care)
*/5 * * * * /usr/local/bin/health-check.sh > /dev/null 2>&1

# Send to a specific email
MAILTO=admin@example.com
0 6 * * 1 /usr/local/bin/weekly-report.sh
```

!!! tip "Debugging cron jobs"
    When a cron job doesn't work, test it the way cron runs it: `env -i /bin/sh -c 'your-command-here'`. This starts with an empty environment, just like cron does. If the command fails here but works in your terminal, the problem is almost certainly an environment issue (missing PATH, environment variables, or shell features).

**Overlapping jobs**: If a job runs longer than the interval between executions, you'll get multiple instances running simultaneously. Use [**flock**](https://man7.org/linux/man-pages/man1/flock.1.html) to prevent overlap:

```bash
# Only one instance runs at a time - others skip if locked
*/5 * * * * flock -n /tmp/backup.lock /usr/local/bin/backup.sh
```

The `-n` flag makes `flock` exit immediately (rather than wait) if the lock is already held, so the second instance silently skips instead of queuing up.

---

## Anacron

Standard cron assumes the machine is always running. If a daily job is scheduled for 3:00 AM and the machine is off at that time, the job simply doesn't run - cron doesn't retry it later. **Anacron** solves this for periodic jobs on machines that aren't always on, like laptops and desktops.

Anacron doesn't run at precise times. Instead, it checks whether a job has run within its required period (daily, weekly, monthly). If not, it runs the job with a configurable delay after boot. Configuration lives in `/etc/anacrontab`:

```bash
# /etc/anacrontab
# period  delay  identifier     command
1         5      cron.daily     run-parts /etc/cron.daily
7         10     cron.weekly    run-parts /etc/cron.weekly
@monthly  15     cron.monthly   run-parts /etc/cron.monthly
```

The fields are:

| Field | Meaning |
|-------|---------|
| Period | How often the job should run (in days, or `@monthly`) |
| Delay | Minutes to wait after anacron starts before running the job |
| Identifier | A unique name used for the timestamp file in `/var/spool/anacron/` |
| Command | The command to execute |

Anacron records when each job last ran in `/var/spool/anacron/`. On most modern distributions, anacron is triggered by cron itself (via a daily cron job) or by a systemd timer. The delay values prevent all jobs from running at once and overwhelming the system during boot.

On most desktop distributions, the `/etc/cron.daily/`, `/etc/cron.weekly/`, and `/etc/cron.monthly/` directories are already managed by anacron. This means scripts you place there will run reliably even if the machine was off during the scheduled time.

---

## Systemd Timers

On systems that use **systemd** (most modern Linux distributions), **timer units** provide an alternative to cron. Timers are paired with service units - the timer defines the schedule, and the service defines the command to run.

To see all active timers on a system:

```bash
systemctl list-timers --all
```

This shows each timer's next and last trigger time, the associated service, and whether it's active.

### Creating a Timer

A systemd timer requires two unit files: a `.service` file (what to run) and a `.timer` file (when to run it). Here's an example that runs a backup script daily at 3:00 AM:

**`/etc/systemd/system/backup.service`**:

```ini
[Unit]
Description=Daily backup

[Service]
Type=oneshot
ExecStart=/usr/local/bin/backup.sh
```

**`/etc/systemd/system/backup.timer`**:

```ini
[Unit]
Description=Run backup daily at 3:00 AM

[Timer]
OnCalendar=*-*-* 03:00:00
Persistent=true

[Install]
WantedBy=timers.target
```

Enable and start the timer:

```bash
sudo systemctl daemon-reload
sudo systemctl enable --now backup.timer
```

The `Persistent=true` setting is the systemd equivalent of anacron - if the system was off when the timer should have fired, it runs the job as soon as possible after boot.

### Timer Schedule Syntax

Systemd uses a calendar expression format that's more readable than cron's five fields:

| Expression | Meaning |
|-----------|---------|
| `*-*-* 03:00:00` | Every day at 3:00 AM |
| `Mon *-*-* 09:00:00` | Every Monday at 9:00 AM |
| `*-*-01 00:00:00` | First day of every month at midnight |
| `*-*-* *:00/15:00` | Every 15 minutes |

You can also use relative timers with `OnBootSec` (time after boot) and `OnUnitActiveSec` (time after last run):

```ini
[Timer]
OnBootSec=5min
OnUnitActiveSec=1h
```

This runs 5 minutes after boot and then every hour after each successful run.

Use `systemd-analyze calendar` to test your expressions:

```bash
systemd-analyze calendar "Mon *-*-* 09:00:00"
```

---

## Cron vs Systemd Timers

Both tools schedule tasks, but they have different strengths:

| Feature | Cron | Systemd Timers |
|---------|------|----------------|
| Configuration | Single line per job | Two unit files per job |
| Logging | Email or manual redirect | Automatic journald integration |
| Missed runs | Lost (unless anacron) | `Persistent=true` handles it |
| Dependencies | None | Can depend on other services |
| Resource control | None | Full cgroup integration (CPU, memory limits) |
| Randomized delay | Not built-in | `RandomizedDelaySec` prevents thundering herd |
| Learning curve | Simple | More verbose, more powerful |

**Use cron** for simple, quick-to-set-up scheduled commands - especially on systems where you need to add or modify jobs frequently. The single-line format is hard to beat for convenience.

**Use systemd timers** when you need logging integration, dependency management, resource limits, or reliability for missed runs. If your system already uses systemd for everything else, timers keep your configuration consistent.

```quiz
question: "Which approach would you choose for a production server backup that must run even if the server was rebooted during the scheduled time?"
type: multiple-choice
options:
  - text: "A standard cron job in the user's crontab"
    feedback: "A standard cron job won't retry if the system was off during the scheduled time. The backup would be silently skipped."
  - text: "A script in /etc/cron.daily/ managed by anacron"
    feedback: "This would work for a daily schedule, but anacron only handles daily/weekly/monthly periods and lacks logging integration."
  - text: "A systemd timer with Persistent=true"
    correct: true
    feedback: "Correct! Persistent=true ensures the job runs after a missed schedule, and systemd provides automatic logging via journald, resource controls, and dependency management - all important for production backups."
  - text: "A cron job with flock to prevent overlap"
    feedback: "flock prevents concurrent execution, but it doesn't help with missed runs. The job still won't run if the system was off at the scheduled time."
```

---

## Practical Exercise

```exercise
title: "Scheduling Tasks with Cron"
description: "Practice writing cron expressions for common scheduling scenarios."
tasks:
  - prompt: "Write a cron expression that runs a script at 6:30 AM every weekday (Monday through Friday)."
    solution: "30 6 * * 1-5 /path/to/script.sh"
    hint: "The day-of-week field uses 0=Sunday, 1=Monday, through 6=Saturday. You can use a range with a hyphen."
  - prompt: "Write a cron expression that runs a log rotation script at midnight on the 1st and 15th of every month."
    solution: "0 0 1,15 * * /path/to/rotate-logs.sh"
    hint: "Use a comma-separated list in the day-of-month field to specify multiple days."
  - prompt: "Write a cron expression that runs a health check every 10 minutes, but only between 8 AM and 6 PM."
    solution: "*/10 8-17 * * * /path/to/health-check.sh"
    hint: "Use a step value (*/10) in the minute field and a range (8-17) in the hour field. Hour 17 covers 5:00-5:59 PM."
```

```command-builder
base: crontab
description: Build a crontab management command
options:
  - flag: ""
    type: select
    label: "Action"
    explanation: "What to do with the crontab"
    choices:
      - ["-l", "List current crontab entries (-l)"]
      - ["-e", "Edit crontab in your default editor (-e)"]
      - ["-r", "Remove entire crontab (-r)"]
  - flag: ""
    type: select
    label: "User"
    explanation: "Manage another user's crontab (requires root)"
    choices:
      - ["", "Current user (default)"]
      - ["-u root", "root user (-u root)"]
      - ["-u www-data", "www-data user (-u www-data)"]
```

---

## Further Reading

- [crontab(5) man page](https://man7.org/linux/man-pages/man5/crontab.5.html) - crontab file format reference
- [crontab.guru](https://crontab.guru/) - interactive cron expression editor and explainer
- [systemd.timer(5)](https://www.freedesktop.org/software/systemd/man/latest/systemd.timer.html) - systemd timer unit documentation
- [systemd.time(7)](https://www.freedesktop.org/software/systemd/man/latest/systemd.time.html) - calendar event and time span syntax reference
- [Anacron man page](https://man7.org/linux/man-pages/man8/anacron.8.html) - anacron configuration and behavior
- [flock(1)](https://man7.org/linux/man-pages/man1/flock.1.html) - file-based locking for preventing concurrent cron job execution

---

**Previous:** [Best Practices](best-practices.md) | [Back to Index](README.md)
