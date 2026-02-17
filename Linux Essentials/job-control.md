# Job Control

Job control lets you manage multiple processes from a single terminal - running tasks in the background, pausing them, and switching between them. Combined with knowledge of signals and terminal multiplexers, you can keep long-running processes alive and organized.

---

## Foreground and Background Processes

By default, when you run a command, it runs in the **foreground**. Your terminal waits for it to finish before giving you a new prompt.

A **background** process runs without blocking your terminal.

### Starting a Background Process

Append `&` to run a command in the background:

```bash
sleep 300 &
# [1] 12345    (job number and PID)
```

The shell prints the **job number** in brackets and the **process ID**. You get your prompt back immediately.

### Viewing Jobs

```bash
jobs           # list all jobs in current shell
jobs -l        # include PIDs
```

```
[1]+  Running                 sleep 300 &
[2]-  Stopped                 vim notes.txt
```

The `+` marks the current job (default target for `fg`/`bg`). The `-` marks the previous job.

### Switching Between Foreground and Background

**`Ctrl-Z`** suspends (pauses) the current foreground process:

```bash
vim notes.txt      # editing a file
# press Ctrl-Z
# [1]+  Stopped                 vim notes.txt
```

**`bg`** resumes a stopped job in the background:

```bash
bg              # resume most recently stopped job
bg %2           # resume job number 2
```

**`fg`** brings a job to the foreground:

```bash
fg              # bring most recent job to foreground
fg %1           # bring job 1 to foreground
```

### Job References

| Reference | Meaning |
|-----------|---------|
| `%1` | Job number 1 |
| `%+` or `%%` | Current job |
| `%-` | Previous job |
| `%string` | Job whose command starts with "string" |
| `%?string` | Job whose command contains "string" |

---

## Signals

**Signals** are software interrupts sent to processes. They tell a process to do something - usually to stop, pause, or terminate.

### Common Signals

| Signal | Number | Default Action | Meaning |
|--------|--------|---------------|---------|
| `SIGHUP` | 1 | Terminate | Hangup - terminal closed |
| `SIGINT` | 2 | Terminate | Interrupt - `Ctrl-C` |
| `SIGQUIT` | 3 | Core dump | Quit - `Ctrl-\` |
| `SIGKILL` | 9 | Terminate | Kill - cannot be caught or ignored |
| `SIGTERM` | 15 | Terminate | Terminate - polite request to exit |
| `SIGTSTP` | 20 | Stop | Terminal stop - `Ctrl-Z` |
| `SIGCONT` | 18 | Continue | Resume a stopped process |
| `SIGUSR1` | 10 | Terminate | User-defined signal 1 |
| `SIGUSR2` | 12 | Terminate | User-defined signal 2 |

### Sending Signals

**`kill`** sends a signal to a process by PID:

```bash
kill 12345            # sends SIGTERM (default)
kill -15 12345        # same thing, explicit
kill -TERM 12345      # same thing, by name
kill -9 12345         # sends SIGKILL (cannot be caught)
kill -KILL 12345      # same thing, by name
```

Always try `SIGTERM` first. It gives the process a chance to clean up (close files, remove temp files, etc.). Only use `SIGKILL` as a last resort - the process gets no chance to clean up.

**`killall`** kills processes by name:

```bash
killall nginx          # SIGTERM to all nginx processes
killall -9 python3     # SIGKILL to all python3 processes
```

**`pkill`** kills processes matching a pattern:

```bash
pkill -f "python script.py"    # match against full command line
pkill -u ryan                   # kill all processes owned by ryan
pkill -t pts/2                  # kill all processes on terminal pts/2
```

### Listing Signals

```bash
kill -l             # list all signal names and numbers
```

---

## Keeping Processes Running

When you close a terminal, the shell sends `SIGHUP` to all its child processes, which usually terminates them. There are several ways to prevent this.

### nohup

**`nohup`** runs a command immune to hangup signals:

```bash
nohup long_running_script.sh &
```

Output goes to `nohup.out` by default if STDOUT isn't redirected. Better to redirect explicitly:

```bash
nohup ./script.sh > output.log 2>&1 &
```

### disown

If you forgot to start a process with `nohup`, you can use **`disown`** to remove it from the shell's job table:

```bash
./long_process.sh &
disown %1          # remove job 1 from shell's job table
disown -h %1       # keep in job table but don't send SIGHUP on exit
```

---

## Process Information

### ps

**`ps`** shows a snapshot of current processes:

```bash
ps                     # processes in current terminal
ps aux                 # all processes, all users, detailed
ps -ef                 # same thing, different format (POSIX)
ps aux --sort=-%mem    # sort by memory usage (descending)
ps -u ryan             # processes owned by ryan
ps -p 12345            # info on specific PID
```

Key columns in `ps aux`:

| Column | Meaning |
|--------|---------|
| `USER` | Process owner |
| `PID` | Process ID |
| `%CPU` | CPU usage percentage |
| `%MEM` | Memory usage percentage |
| `VSZ` | Virtual memory size (KB) |
| `RSS` | Resident set size - physical memory (KB) |
| `TTY` | Controlling terminal |
| `STAT` | Process state |
| `START` | Start time |
| `TIME` | Cumulative CPU time |
| `COMMAND` | Command that started the process |

Process states in the `STAT` column:

| State | Meaning |
|-------|---------|
| `R` | Running |
| `S` | Sleeping (waiting for event) |
| `D` | Uninterruptible sleep (usually I/O) |
| `T` | Stopped |
| `Z` | Zombie (finished but parent hasn't collected status) |

### top and htop

**`top`** shows a live, updating view of processes:

```bash
top
```

Useful keystrokes inside `top`:

| Key | Action |
|-----|--------|
| `q` | Quit |
| `M` | Sort by memory |
| `P` | Sort by CPU |
| `k` | Kill a process (prompts for PID) |
| `1` | Toggle per-CPU display |
| `c` | Show full command line |

**`htop`** is an improved version of `top` with color, mouse support, and easier process management. It's not installed by default but is available in most package managers:

```bash
sudo apt install htop    # Debian/Ubuntu
sudo dnf install htop    # Fedora/RHEL
htop
```

---

## Terminal Multiplexers

Terminal multiplexers let you create multiple virtual terminals inside a single terminal session. Crucially, sessions persist even if your connection drops.

### screen

**`screen`** is the older, widely available multiplexer.

```bash
screen                     # start a new session
screen -S mywork           # start a named session
screen -ls                 # list sessions
screen -r mywork           # reattach to a session
screen -d -r mywork        # detach elsewhere and reattach here
```

Key bindings inside screen (prefixed with `Ctrl-a`):

| Keys | Action |
|------|--------|
| `Ctrl-a c` | Create new window |
| `Ctrl-a n` | Next window |
| `Ctrl-a p` | Previous window |
| `Ctrl-a d` | Detach from session |
| `Ctrl-a "` | List windows |
| `Ctrl-a k` | Kill current window |
| `Ctrl-a [` | Enter copy/scroll mode |

### tmux

**`tmux`** is the more modern alternative with better scripting support and split panes.

```bash
tmux                       # start a new session
tmux new -s mywork         # start a named session
tmux ls                    # list sessions
tmux attach -t mywork      # attach to a session
tmux kill-session -t mywork # kill a session
```

Key bindings (prefixed with `Ctrl-b`):

| Keys | Action |
|------|--------|
| `Ctrl-b c` | Create new window |
| `Ctrl-b n` | Next window |
| `Ctrl-b p` | Previous window |
| `Ctrl-b d` | Detach from session |
| `Ctrl-b %` | Split pane vertically |
| `Ctrl-b "` | Split pane horizontally |
| `Ctrl-b arrow` | Switch between panes |
| `Ctrl-b z` | Toggle pane zoom (fullscreen) |
| `Ctrl-b [` | Enter copy mode |
| `Ctrl-b w` | List windows |
| `Ctrl-b x` | Kill current pane |

### Common Workflow

```bash
# Start a named session for a project
tmux new -s deploy

# Run a long task
./deploy.sh

# Detach (Ctrl-b d) and close the terminal

# Later, reattach
tmux attach -t deploy
# Your process is still running
```

This is especially useful over SSH connections. If your connection drops, the tmux session keeps running. Just SSH back in and reattach.
