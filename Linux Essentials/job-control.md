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

```terminal
title: Job Suspend/Background/Foreground Workflow
steps:
  - command: "sleep 300"
    output: ""
    narration: "Start a long-running command. It blocks the terminal - you can't type anything else."
  - command: "^Z"
    output: "[1]+  Stopped                 sleep 300"
    narration: "Ctrl-Z sends SIGTSTP, suspending the process. It's paused but still exists. The shell gives you back your prompt."
  - command: "jobs"
    output: "[1]+  Stopped                 sleep 300"
    narration: "The jobs command shows all background/stopped jobs. [1] is the job number, + marks it as the current job."
  - command: "bg %1"
    output: "[1]+ sleep 300 &"
    narration: "bg resumes the stopped job in the background. It's now running but your terminal is free for other commands."
  - command: "jobs"
    output: "[1]+  Running                 sleep 300 &"
    narration: "The job is now Running (not Stopped). The & confirms it's in the background."
  - command: "fg %1"
    output: "sleep 300"
    narration: "fg brings the job back to the foreground. The terminal is blocked again until the command finishes or you Ctrl-Z it again."
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

**SIGKILL** is unique because the kernel handles it directly - the signal is never delivered to the process. The kernel simply removes the process from its scheduling table. This is why SIGKILL can't be caught, ignored, or handled: the process never gets a chance to run any code in response. It also means the process can't clean up - temporary files stay behind, network connections are left half-open, and shared resources may be left in an inconsistent state.

**SIGQUIT** produces a core dump in addition to terminating the process. This is useful for debugging a hung process: if a program is stuck and you want to analyze what it was doing, press `Ctrl-\` to send SIGQUIT. The resulting core file can be loaded into `gdb` for post-mortem analysis. In normal usage, you'll send SIGTERM (polite request) first, SIGQUIT (terminate with dump) if you need diagnostic information, and SIGKILL (force kill) only as a last resort.

```quiz
question: "What is the difference between Ctrl-C and Ctrl-\\?"
type: multiple-choice
options:
  - text: "Ctrl-C suspends the process; Ctrl-\\ terminates it"
    feedback: "Ctrl-Z suspends (SIGTSTP). Ctrl-C sends SIGINT (interrupt), and Ctrl-\\ sends SIGQUIT which is stronger."
  - text: "Ctrl-C sends SIGINT (can be caught); Ctrl-\\ sends SIGQUIT (produces core dump)"
    correct: true
    feedback: "Correct! SIGINT (Ctrl-C) is a polite interrupt that programs commonly handle. SIGQUIT (Ctrl-\\) is stronger - it also terminates the process but produces a core dump for debugging. Use Ctrl-\\ when Ctrl-C doesn't work."
  - text: "They are identical - both send SIGTERM"
    feedback: "Neither sends SIGTERM. Ctrl-C sends SIGINT (signal 2) and Ctrl-\\ sends SIGQUIT (signal 3). SIGTERM (signal 15) is sent by the kill command."
  - text: "Ctrl-\\ sends SIGKILL which cannot be caught"
    feedback: "Ctrl-\\ sends SIGQUIT, not SIGKILL. SIGQUIT can be caught by the process. SIGKILL (signal 9) has no keyboard shortcut."
```

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

```quiz
question: "Why should you try kill (SIGTERM) before kill -9 (SIGKILL)?"
type: multiple-choice
options:
  - text: "SIGTERM is faster than SIGKILL"
    feedback: "SIGKILL is actually more immediate. The reason to prefer SIGTERM is about cleanup, not speed."
  - text: "SIGTERM lets the process clean up (save data, remove temp files, close connections)"
    correct: true
    feedback: "Correct! SIGTERM is a polite request that the process can handle - saving state, closing files, releasing locks. SIGKILL terminates immediately with no chance to clean up, which can leave temp files, corrupt data, or orphan child processes."
  - text: "SIGKILL doesn't actually stop the process"
    feedback: "SIGKILL always stops the process (unless it's in uninterruptible sleep). The issue is that it does so without giving the process a chance to clean up."
  - text: "Only root can send SIGKILL"
    feedback: "Any user can send SIGKILL to their own processes. The distinction is about cleanup behavior, not permissions."
```

---

## Keeping Processes Running

When you close a terminal, the shell sends `SIGHUP` to all its child processes, which usually terminates them. There are several ways to prevent this.

### nohup

[**`nohup`**](https://www.gnu.org/software/coreutils/manual/) runs a command immune to hangup signals:

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

The key difference: **`nohup`** is preventive - you use it *before* starting a process. **`disown`** is reactive - you use it *after* a process is already running and you realize you need it to survive terminal closure. A common workflow: you start a long build, realize you need to log out, press `Ctrl-Z` to suspend it, `bg` to resume in the background, and `disown` to detach it from the shell. If you'd planned ahead, you would have used `nohup` from the start.

```quiz
question: "What is the difference between nohup and disown?"
type: multiple-choice
options:
  - text: "nohup works on running processes; disown only works when starting a process"
    feedback: "It's the opposite. nohup must be used when starting a command. disown works on already-running background jobs."
  - text: "nohup redirects output to a file; disown does not"
    feedback: "While nohup does redirect output to nohup.out by default, that's a side effect. The core difference is when they're used."
  - text: "nohup is used before starting a command; disown detaches an already-running job"
    correct: true
    feedback: "Correct! nohup command & starts the command immune to hangup signals. disown %1 removes an already-running background job from the shell's job table. Use nohup when planning ahead, disown when you forgot to use nohup."
  - text: "They are identical - disown is just the modern replacement for nohup"
    feedback: "They serve related but different purposes. nohup is a separate command that wraps execution. disown is a shell builtin that modifies the job table."
```

---

## Process Information

### ps

[**`ps`**](https://gitlab.com/procps-ng/procps) shows a snapshot of current processes:

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

**VSZ** (Virtual Memory Size) is the total amount of memory the process has *mapped*, including shared libraries, memory-mapped files, and memory that's been allocated but never used. **RSS** (Resident Set Size) is how much physical RAM the process is actually using right now. VSZ is almost always larger than RSS because virtual memory includes pages that haven't been loaded from disk yet and shared libraries counted in full even though they're shared with other processes. When checking if a process is using too much memory, look at RSS. When checking if a process might run into address space limits, look at VSZ.

Process states in the `STAT` column:

| State | Meaning |
|-------|---------|
| `R` | Running |
| `S` | Sleeping (waiting for event) |
| `D` | Uninterruptible sleep (usually I/O) |
| `T` | Stopped |
| `Z` | Zombie (finished but parent hasn't collected status) |

The **D state** (uninterruptible sleep) deserves special attention. A process in D state is waiting on I/O that the kernel considers non-interruptible - typically disk or network I/O at the kernel level. You cannot kill a D-state process, not even with SIGKILL, because the kernel won't deliver signals to it until the I/O completes. Processes stuck in D state are commonly seen with NFS mounts that have become unreachable or failing disk drives. If you see many processes in D state, investigate your storage and network mounts.

The **Z state** (zombie) means the process has finished executing but its parent hasn't called `wait()` to collect its exit status. The zombie takes up no resources other than a process table entry. A few zombies are harmless, but a large accumulation suggests the parent process has a bug. You can't kill a zombie directly - killing the parent (or restarting it) clears them, because `init`/`systemd` adopts orphaned processes and reaps their exit status.

```quiz
question: "What does a process state of D (uninterruptible sleep) typically mean?"
type: multiple-choice
options:
  - text: "The process is in a debugging state"
    feedback: "D doesn't stand for debug. T (traced/stopped) is the state for debugged processes."
  - text: "The process is waiting for disk I/O and cannot be interrupted, even by signals"
    correct: true
    feedback: "Correct! D state means the process is waiting for I/O (usually disk) in a kernel code path that can't be interrupted. These processes can't be killed with SIGKILL until the I/O completes. A stuck D-state process often indicates a hardware or NFS issue."
  - text: "The process has been killed but is waiting for its parent to read its exit status"
    feedback: "That's a zombie (Z) state. D state is about waiting for I/O operations to complete."
  - text: "The process is a daemon running in the background"
    feedback: "Daemons can be in any state - usually S (sleeping). D specifically means uninterruptible sleep, typically waiting for I/O."
```

### top and htop

[**`top`**](https://gitlab.com/procps-ng/procps) shows a live, updating view of processes:

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

[**`htop`**](https://htop.dev/) is an improved version of `top` with color, mouse support, and easier process management. It's not installed by default but is available in most package managers:

```bash
sudo apt install htop    # Debian/Ubuntu
sudo dnf install htop    # Fedora/RHEL
htop
```

```exercise
title: Find and Manage a Runaway Process
difficulty: intermediate
scenario: |
  Your server is running slowly and you suspect a process is consuming too much memory.
  Using command-line tools:

  1. Find the process using the most memory
  2. Identify what it is and who's running it
  3. Send it a graceful termination signal
  4. Verify it stopped, and if not, force-kill it
hints:
  - "Use ps aux --sort=-%mem | head to find the top memory consumers"
  - "The RSS column in ps shows resident memory in kilobytes"
  - "Try kill PID (SIGTERM) first, then check if the process is gone with ps -p PID"
  - "If SIGTERM doesn't work after a few seconds, use kill -9 PID (SIGKILL)"
solution: |
  ```bash
  # Step 1: Find the top memory consumer
  ps aux --sort=-%mem | head -5

  # Step 2: Note the PID (column 2) and command (last column)
  # Example output shows PID 12345 using 45% memory

  # Step 3: Send SIGTERM (graceful shutdown)
  kill 12345

  # Step 4: Wait a moment, then check if it's gone
  sleep 2
  ps -p 12345

  # Step 5: If still running, force kill
  kill -9 12345

  # Verify it's gone
  ps -p 12345
  ```

  Always try SIGTERM first - it lets the process save state and clean up.
  Only use SIGKILL (-9) as a last resort since it can leave corrupt files
  and orphaned child processes.
```

---

## Terminal Multiplexers

Terminal multiplexers let you create multiple virtual terminals inside a single terminal session. Crucially, sessions persist even if your connection drops.

### screen

[**`screen`**](https://www.gnu.org/software/screen/manual/) is the older, widely available multiplexer.

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

[**`tmux`**](https://github.com/tmux/tmux/wiki) is the more modern alternative with better scripting support and split panes.

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

```terminal
title: tmux Session Management
steps:
  - command: "tmux new -s work"
    output: ""
    narration: "Create a new tmux session named 'work'. You're now inside tmux - notice the green status bar at the bottom."
  - command: "# Press Ctrl-b then d"
    output: "[detached (from session work)]"
    narration: "Ctrl-b d detaches from the session. The session keeps running in the background - all your processes continue."
  - command: "tmux ls"
    output: "work: 1 windows (created Mon Jan 15 10:30:00 2024)"
    narration: "tmux ls lists all sessions. Your 'work' session is still running with all its windows and processes intact."
  - command: "tmux attach -t work"
    output: ""
    narration: "Reattach to the session. Everything is exactly as you left it. This survives SSH disconnections too."
```

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

**Which to choose?** If you're setting up a new system, use **tmux** - it has better split-pane support, more intuitive configuration, and a scriptable command interface. Use **screen** if it's already installed on a server you're working with and you don't want to (or can't) install additional software. screen is nearly universal on older systems, while tmux may not be pre-installed. The core workflow (start a session, detach, reattach later) is the same in both.

---

## Further Reading

- [tmux Wiki](https://github.com/tmux/tmux/wiki) - terminal multiplexer documentation and FAQ
- [GNU Screen Manual](https://www.gnu.org/software/screen/manual/) - official Screen user manual
- [procps-ng](https://gitlab.com/procps-ng/procps) - source and docs for ps, top, vmstat, free, and related utilities
- [htop](https://htop.dev/) - interactive process viewer
- [GNU Coreutils - nohup](https://www.gnu.org/software/coreutils/manual/) - run commands immune to hangups
- [Linux man-pages - signal(7)](https://man7.org/linux/man-pages/) - comprehensive signal reference

---

**Previous:** [File Permissions](file-permissions.md) | **Next:** [Scripting Fundamentals](scripting-fundamentals.md) | [Back to Index](README.md)
