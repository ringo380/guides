# Log Management

Logs are the primary way to understand what is happening on a Linux system. They record everything from kernel messages and security events to application errors and scheduled task outputs.

## Where Logs Live

In a traditional Linux system, most logs are stored in the [**`/var/log`**](https://refspecs.linuxfoundation.org/FHS_3.0/fhs/ch05s08.html) directory.

- `/var/log/syslog` or `/var/log/messages`: General system messages.
- `/var/log/auth.log` or `/var/log/secure`: Authentication and security events.
- `/var/log/dmesg`: Kernel ring buffer messages (boot-up messages).
- `/var/log/apache2/` or `/var/log/nginx/`: Web server access and error logs.

---

## Modern Logging: systemd-journald

Most modern Linux distributions use `systemd-journald` to collect logs. It stores logs in a binary format, which allows for faster searching and metadata-rich entries.

### Using `journalctl`

The [**`journalctl`**](https://www.freedesktop.org/software/systemd/man/journalctl.html) command is the primary tool for querying the journal.

```bash
# View all logs
journalctl

# View logs for the current boot only
journalctl -b

# Follow new logs in real-time (like tail -f)
journalctl -f

# View logs for a specific service
journalctl -u nginx

# Filter by time range
journalctl --since "2023-10-01" --until "2023-10-02 12:00:00"

# Show only errors and above
journalctl -p err
```

---

## Log Rotation with logrotate

Since logs can grow indefinitely, Linux uses [**`logrotate`**](https://github.com/logrotate/logrotate) to periodically rotate, compress, and delete old log files.

Configuration files are typically found in `/etc/logrotate.conf` and `/etc/logrotate.d/`.

```text
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
        if [ -f /var/run/nginx.pid ]; then
            kill -USR1 `cat /var/run/nginx.pid`
        fi
    endscript
}
```

---

## Structured Log Parsing

Logs are most useful when you can search and filter them. This often involves the text processing tools covered in earlier guides.

```bash
# Count unique IP addresses in an Nginx access log
awk '{print $1}' /var/log/nginx/access.log | sort | uniq -c | sort -nr

# Find failed SSH login attempts
grep "Failed password" /var/log/auth.log
```

For more advanced analysis, logs are often shipped to centralized systems like the **ELK Stack** (Elasticsearch, Logstash, Kibana) or **Loki**.

---

## Interactive Quizzes: Log Management

Test your understanding of Linux logging.

```quiz
question: "Which command is used to view logs managed by systemd-journald?"
type: multiple-choice
options:
  - text: "logctl"
    feedback: "There is no 'logctl' command in modern Linux."
  - text: "syslog-view"
    feedback: "syslog-view is not a standard Linux command."
  - text: "journalctl"
    correct: true
    feedback: "Correct! `journalctl` is the standard tool for interacting with the systemd journal."
  - text: "systemctl logs"
    feedback: "The command is journalctl, not systemctl logs (though systemctl can show some status information)."
```

```quiz
question: "What is the primary purpose of the `logrotate` utility?"
type: multiple-choice
options:
  - text: "To encrypt log files for security."
    feedback: "logrotate is for rotation and compression, not encryption."
  - text: "To prevent log files from consuming all available disk space."
    correct: true
    feedback: "Correct! `logrotate` manages log growth by rotating old logs out, compressing them, and eventually deleting them based on your configuration."
  - text: "To send logs to a remote server."
    feedback: "Tools like rsyslog or fluentd are used for remote log shipping."
  - text: "To translate binary logs into text."
    feedback: "Journald handles binary logs; logrotate works on text files in /var/log."
```

```quiz
question: "In `journalctl`, which flag is used to follow logs in real-time as they are written?"
type: multiple-choice
options:
  - text: "-f"
    correct: true
    feedback: "Correct! Like the `tail` command, `-f` (or `--follow`) allows you to watch logs as they happen."
  - text: "-t"
    feedback: "-t is for filtering by identifier (tag)."
  - text: "-r"
    feedback: "-r shows the journal entries in reverse order (newest first)."
  - text: "-n"
    feedback: "-n specifies the number of lines to show (default 10)."
```

---

## Further Reading

- [**systemd-journald Documentation**](https://www.freedesktop.org/software/systemd/man/systemd-journald.service.html)  
- [**DigitalOcean: How to use journalctl**](https://www.digitalocean.com/community/tutorials/how-to-use-journalctl-to-view-and-manipulate-systemd-logs)  
- [**Logrotate Manual Page**](https://linux.die.net/man/8/logrotate)  

---

**Previous:** [Firewall and Networking Security](firewall-fundamentals.md) | [Back to Index](README.md)
