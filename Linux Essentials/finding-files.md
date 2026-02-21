# Finding Files

The [`find`](https://www.gnu.org/software/findutils/manual/) command searches directory trees for files matching specified criteria. Combined with `xargs`, it forms a powerful pattern for batch operations on files.

---

## find

### Basic Usage

```bash
find /path/to/search -name "*.txt"     # find by filename pattern
find . -type f                          # all regular files
find . -type d                          # all directories
find /var/log -name "*.log"             # absolute path search
```

The general form is `find [path] [expression]`. If you omit the path, `find` searches the current directory.

### Tests

**By name:**

```bash
find . -name "*.conf"          # case-sensitive name match
find . -iname "readme*"        # case-insensitive name match
find . -path "*/src/*.js"      # match against the full path
```

!!! tip "Use -iname for case-insensitive matching"
    File naming conventions vary across projects and platforms. Use `-iname` instead of `-name` when you're unsure about capitalization: `find . -iname 'readme*'` matches `README.md`, `Readme.txt`, and `readme.rst` all at once.

**By type:**

| Flag | Type |
|------|------|
| `-type f` | Regular file |
| `-type d` | Directory |
| `-type l` | Symbolic link |
| `-type b` | Block device |
| `-type c` | Character device |
| `-type p` | Named pipe (FIFO) |
| `-type s` | Socket |

In practice, you'll use `-type f` (regular files) and `-type d` (directories) constantly, and `-type l` (symlinks) occasionally. The others are rare: **`-type b`** (block devices) for finding disk devices in `/dev`, **`-type c`** (character devices) for things like terminal devices and `/dev/null`, **`-type p`** (named pipes) when debugging inter-process communication, and **`-type s`** (sockets) when tracking down Unix domain sockets used by services like MySQL or Docker.

**By size:**

```bash
find . -size +10M              # larger than 10 megabytes
find . -size -1k               # smaller than 1 kilobyte
find . -size 100c              # exactly 100 bytes
```

Size suffixes: `c` (bytes), `k` (kilobytes), `M` (megabytes), `G` (gigabytes). Without a suffix, the unit is 512-byte blocks.

**By time:**

!!! warning "-mtime counts in 24-hour periods, not calendar days"
    `find -mtime +7` means "more than 7 full 24-hour periods ago," not "more than 7 calendar days." A file modified 7.5 days ago has an mtime of 7 (truncated), so `+7` won't match it - you'd need `+6`. For minute-level precision, use `-mmin` instead.

Timestamps are measured in 24-hour periods. `+7` means "more than 7 days ago", `-1` means "within the last day", and `7` (no sign) means "between exactly 7 and 8 days ago."

```bash
find . -mtime -7               # modified within the last 7 days
find . -mtime +30              # modified more than 30 days ago
find . -atime -1               # accessed within the last day
find . -ctime +90              # metadata changed more than 90 days ago
find . -newer reference.txt    # modified more recently than reference.txt
```

For minute-level precision, use `-mmin`, `-amin`, `-cmin`:

```bash
find . -mmin -60               # modified within the last 60 minutes
```

**By permissions:**

```bash
find . -perm 644               # exactly 644
find . -perm -644              # at least these permissions (all specified bits set)
find . -perm /111              # any execute bit set (user, group, or other)
find . -perm -u+x              # user execute bit set
```

The three `-perm` modes correspond to different questions. **`-perm 644`** (exact) asks 'are the permissions *exactly* 644?' - nothing more, nothing less. **`-perm -644`** (dash prefix, all-bits) asks 'are *at least* these bits set?' - the file could have more permissions than specified. **`-perm /111`** (slash prefix, any-bit) asks 'is *any* of these bits set?' - useful for finding anything executable. Think of exact as '=', dash as 'includes all of', and slash as 'includes any of'.

```quiz
question: "What is the difference between find -perm 644 and find -perm -644?"
type: multiple-choice
options:
  - text: "They are identical - both find files with permission 644"
    feedback: "-perm 644 requires an exact match. -perm -644 checks that all the specified bits are set, but the file may have additional permissions."
  - text: "-perm 644 matches exactly 644; -perm -644 matches files where at least these bits are set"
    correct: true
    feedback: "Correct! -perm 644 is exact match only. -perm -644 means 'all of these bits must be set' - a file with 744 would match -644 (owner has read+write+execute, which includes read+write) but not 644 exactly."
  - text: "-perm -644 excludes files with permission 644"
    feedback: "The dash doesn't mean 'exclude'. It means 'at least these permissions'. Files with exactly 644 would also match -644."
  - text: "-perm 644 is for files only; -perm -644 is for directories only"
    feedback: "Both work on any file type. The difference is exact match (644) vs minimum permissions (-644)."
```

**By owner:**

```bash
find . -user root              # owned by root
find . -group www-data         # group is www-data
find . -nouser                 # files with no matching user in /etc/passwd
find . -nogroup                # files with no matching group
```

### Depth Control

```bash
find . -maxdepth 1             # current directory only (no recursion)
find . -maxdepth 2             # at most 2 levels deep
find . -mindepth 1             # skip the starting directory itself
find . -mindepth 2 -maxdepth 3 # between 2 and 3 levels deep
```

!!! tip "Use -maxdepth 1 for current directory only"
    `find . -maxdepth 1 -type f` lists files in the current directory without recursing into subdirectories. This is often more reliable than `ls` parsing for scripts, and you can combine it with other find tests like `-name` or `-mtime`.

```quiz
question: "What does find /home -maxdepth 1 -type d do?"
type: multiple-choice
options:
  - text: "Lists all directories recursively under /home"
    feedback: "-maxdepth 1 limits the search to one level deep. Without it, find would recurse fully."
  - text: "Lists /home itself plus its immediate subdirectories only"
    correct: true
    feedback: "Correct! -maxdepth 1 means: search /home (depth 0) and its direct children (depth 1), but don't recurse deeper. Combined with -type d, it shows only directories at those levels."
  - text: "Lists only the subdirectories inside /home, not /home itself"
    feedback: "Close, but -maxdepth 1 includes the starting point (/home) at depth 0. To exclude it, add -mindepth 1: find /home -mindepth 1 -maxdepth 1 -type d"
  - text: "Follows symbolic links one level deep"
    feedback: "-maxdepth controls how many directory levels to descend, not symbolic link following. Link following is controlled by -L."
```

```terminal
title: find Depth and Type Filtering
steps:
  - command: "find /etc -maxdepth 1 -type f | head -5"
    output: |
      /etc/hostname
      /etc/fstab
      /etc/hosts
      /etc/resolv.conf
      /etc/passwd
    narration: "-maxdepth 1 searches only the top level of /etc. -type f limits results to regular files (no directories)."
  - command: "find /etc -maxdepth 1 -type d | head -5"
    output: |
      /etc
      /etc/ssh
      /etc/apt
      /etc/cron.d
      /etc/default
    narration: "Same depth, but -type d shows directories. Note /etc itself is included (depth 0). Add -mindepth 1 to exclude it."
  - command: "find /var/log -name '*.log' -mtime -7 | head -5"
    output: |
      /var/log/syslog
      /var/log/auth.log
      /var/log/kern.log
      /var/log/dpkg.log
      /var/log/alternatives.log
    narration: "Combining criteria: files ending in .log that were modified in the last 7 days. -mtime -7 means 'less than 7 days ago'."
  - command: "find /var/log -name '*.log' -size +1M -mtime -30"
    output: |
      /var/log/syslog
      /var/log/auth.log
    narration: "Multiple criteria are AND'd together: .log files, larger than 1MB, modified in the last 30 days."
```

### Logical Operators

<div class="diagram-container">
<img src="../../assets/images/linux-essentials/find-expression-tree.svg" alt="find expression evaluation chain showing how tests are evaluated left to right with short-circuit logic">
</div>

```bash
find . -name "*.txt" -and -size +1M    # both conditions (-and is implicit)
find . -name "*.txt" -or -name "*.md"  # either condition
find . ! -name "*.tmp"                 # negation
find . \( -name "*.txt" -or -name "*.md" \) -and -mtime -7  # grouping
```

Note that `-and` is the default operator between tests. When you write `find . -name '*.txt' -size +1M`, the `-and` is implicit - both conditions must be true. You only need to write `-and` explicitly for readability, or when combining it with `-or` and grouping.

### Actions

**`-exec` (per file):**

```bash
find . -name "*.tmp" -exec rm {} \;
```

The `{}` is replaced with each filename. The `\;` marks the end of the command. One `rm` process runs per file.

**`-exec` (batching):**

```bash
find . -name "*.tmp" -exec rm {} +
```

The `+` passes as many filenames as possible to a single command invocation. This is much faster when operating on many files.

!!! warning "-exec {} + doesn't work with commands needing a single filename"
    The `+` terminator batches multiple filenames into one command invocation. This means the command sees all files as arguments at once. Commands like `mv` that expect a specific filename argument structure need `\;` (one invocation per file) or `xargs -I {}` for placeholder substitution.

The performance difference between `\;` and `+` is significant. With `\;`, find spawns a new process for every single file. If you're operating on 1000 files, that's 1000 separate `rm` processes. With `+`, find passes as many filenames as will fit on one command line, so 1000 files might be handled in a single `rm` invocation. The limit on how many arguments `+` can batch is determined by **`ARG_MAX`** (the kernel's maximum argument length, typically 2MB on modern Linux). You can check it with `getconf ARG_MAX`. For very large file sets, `+` will make multiple invocations as needed to stay within this limit.

```quiz
question: "What is the difference between find -exec cmd {} \\; and find -exec cmd {} +?"
type: multiple-choice
options:
  - text: "\\; runs the command once per file; + runs it once with all files as arguments"
    correct: true
    feedback: "Correct! With \\;, find runs the command separately for each match (like a loop). With +, it batches files into a single command invocation (like xargs), which is much faster for large result sets."
  - text: "+ runs the command in the background for each file"
    feedback: "The + doesn't run anything in the background. It batches all matched files into as few command invocations as possible."
  - text: "\\; preserves filenames with spaces; + doesn't"
    feedback: "Both handle filenames with spaces correctly since find passes them directly as arguments, not through a shell."
  - text: "They produce the same result but + is newer syntax"
    feedback: "They can produce different results. Commands that only accept one file argument (like mv to a specific name) need \\;. Commands that accept multiple files (like rm, chmod) work better with +."
```

**`-delete`:**

```bash
find . -name "*.tmp" -delete
```

Built-in deletion - faster than `-exec rm`. Note that `-delete` implies `-depth` (processes files before their parent directories).

!!! danger "-delete implies -depth processing order"
    When you use `-delete`, find automatically enables `-depth` mode, processing directory contents before the directory itself. This changes the order that other expressions see files. If your command combines `-delete` with `-prune`, they will conflict - `-prune` needs breadth-first traversal, but `-delete` forces depth-first.

**`-print0`:**

```bash
find . -name "*.txt" -print0
```

Separates results with null characters instead of newlines. This handles filenames containing spaces, newlines, or other special characters. Pair with `xargs -0`.

!!! tip "Always pair -print0 with xargs -0"
    The null byte is the only character that cannot appear in a Unix filename. Using `-print0 | xargs -0` is the only fully safe way to pass filenames between commands. Regular newline-delimited output breaks on the (legal) filename `my\nfile.txt`.

### Practical Examples

```bash
# Delete files older than 30 days
find /tmp -type f -mtime +30 -delete

# Find large files
find / -type f -size +100M 2>/dev/null

# Find and chmod directories
find . -type d -exec chmod 755 {} +

# Find empty files and directories
find . -empty

# Find zero-byte files only
find . -type f -empty

# Find broken symlinks
find . -xtype l

# Find files modified today
find . -daystart -mtime -1

# Find setuid programs
find / -perm -4000 -type f 2>/dev/null
```

```exercise
title: Find Large Log Files
difficulty: beginner
scenario: |
  Your server's disk is filling up. You need to find all `.log` files under `/var/log`
  that are larger than 10MB and were modified in the last 30 days.

  Write a find command that shows these files with their sizes in human-readable format.
hints:
  - "Use -name '*.log' to match log files"
  - "Use -size +10M to find files larger than 10MB"
  - "Use -mtime -30 for files modified in the last 30 days"
  - "Pipe to xargs ls -lh to see human-readable sizes, or use find's -exec with ls -lh"
solution: |
  ```bash
  # Method 1: Using -exec
  find /var/log -name '*.log' -size +10M -mtime -30 -exec ls -lh {} \;

  # Method 2: Using xargs (more efficient for many files)
  find /var/log -name '*.log' -size +10M -mtime -30 -print0 | xargs -0 ls -lh

  # Method 3: Using find's -printf for custom format
  find /var/log -name '*.log' -size +10M -mtime -30 -printf '%s %p\n' | sort -rn
  ```

  The -print0 | xargs -0 pattern safely handles filenames with spaces.
  -printf '%s %p\n' prints size in bytes and path, which sort -rn orders by size.
```

```exercise
title: Fix File Permissions Recursively
difficulty: intermediate
scenario: |
  After extracting a tarball, all files and directories have 777 permissions. You need
  to fix this: directories should be 755 and regular files should be 644.

  Write the find commands to fix this, starting from the current directory.
hints:
  - "Use -type d for directories and -type f for files"
  - "Use -exec chmod to change permissions"
  - "Run the directory command first, then the file command"
  - "Use {} + instead of {} \\; for better performance"
solution: |
  ```bash
  # Fix directory permissions (755 = rwxr-xr-x)
  find . -type d -exec chmod 755 {} +

  # Fix file permissions (644 = rw-r--r--)
  find . -type f -exec chmod 644 {} +
  ```

  Using `{} +` batches files into fewer chmod invocations, making it significantly
  faster than `{} \;` for large directory trees. If some files need to be executable
  (scripts), handle those separately:

  ```bash
  find . -type f -name '*.sh' -exec chmod 755 {} +
  ```
```

```command-builder
base: find
description: Build a find command to search for files by various criteria
options:
  - flag: ""
    type: select
    label: "Search path"
    explanation: "Where to start the search"
    choices:
      - [".", "Current directory"]
      - ["/var/log", "/var/log"]
      - ["/home", "/home"]
      - ["/etc", "/etc"]
  - flag: "-type"
    type: select
    label: "File type"
    explanation: "What kind of filesystem objects to find"
    choices:
      - ["f", "Regular files"]
      - ["d", "Directories"]
      - ["l", "Symbolic links"]
      - ["", "Any type"]
  - flag: "-name"
    type: text
    label: "Name pattern"
    placeholder: "'*.log'"
    explanation: "Glob pattern for the filename (case-sensitive, use -iname for case-insensitive)"
  - flag: ""
    type: select
    label: "Size filter"
    explanation: "Filter by file size"
    choices:
      - ["", "Any size"]
      - ["-size +10M", "Larger than 10MB"]
      - ["-size +100M", "Larger than 100MB"]
      - ["-size -1k", "Smaller than 1KB"]
  - flag: ""
    type: select
    label: "Time filter"
    explanation: "Filter by modification time"
    choices:
      - ["", "Any time"]
      - ["-mtime -7", "Modified in last 7 days"]
      - ["-mtime -30", "Modified in last 30 days"]
      - ["-mtime +90", "Not modified in 90+ days"]
```

---

## xargs

[**`xargs`**](https://www.gnu.org/software/findutils/manual/) reads items from STDIN and passes them as arguments to a command. It bridges the gap between commands that produce output (like `find`) and commands that expect arguments.

### Basic Usage

```bash
echo "file1 file2 file3" | xargs rm
# equivalent to: rm file1 file2 file3
```

### Safe Filename Handling

The default `xargs` splits on whitespace, which breaks on filenames with spaces. Use null-delimited input:

```bash
find . -name "*.txt" -print0 | xargs -0 rm
find . -name "*.log" -print0 | xargs -0 grep "error"
```

The `-print0` / `-0` pair is the standard pattern for safely processing arbitrary filenames.

```quiz
question: "Why would you use find -print0 | xargs -0 instead of find | xargs?"
type: multiple-choice
options:
  - text: "It's faster because -print0 uses binary output"
    feedback: "-print0 uses null bytes as delimiters instead of newlines. It's not about speed but about correctly handling special characters in filenames."
  - text: "It correctly handles filenames containing spaces, quotes, or newlines"
    correct: true
    feedback: "Correct! Filenames can legally contain spaces, quotes, and even newlines. Regular xargs splits on whitespace, breaking these filenames. -print0/-0 uses null bytes (which can't appear in filenames) as delimiters, making it safe for all filenames."
  - text: "-print0 sorts the output for more predictable processing"
    feedback: "-print0 doesn't sort. It changes the delimiter from newline to null byte, which is the only character guaranteed not to appear in Unix filenames."
  - text: "It prevents find from following symbolic links"
    feedback: "Symbolic link behavior is controlled by -L and -P flags, not by the output format. -print0 only changes how filenames are delimited."
```

### Placeholder Substitution

Use `-I {}` to control where arguments are placed:

```bash
find . -name "*.bak" | xargs -I {} mv {} /tmp/backups/
```

With `-I`, xargs runs the command once per input line (not batched).

### Argument Batching

Control how many arguments are passed at once:

```bash
echo "1 2 3 4 5 6" | xargs -n 2 echo
# echo 1 2
# echo 3 4
# echo 5 6
```

### Parallel Execution

Use `-P` to run multiple processes in parallel:

```bash
find . -name "*.png" -print0 | xargs -0 -P 4 -I {} convert {} -resize 50% {}
```

This runs up to 4 `convert` processes at a time.

!!! danger "xargs -P with output-producing commands causes interleaved output"
    When using `xargs -P` for parallel execution, output from concurrent processes can mix together unpredictably. This is safe for silent operations like `gzip` or `chmod`, but produces garbled results for commands like `grep` or `wc`. For parallel output, consider GNU `parallel` which buffers output per job.

A few things to be aware of with parallel `xargs`. First, **output interleaving**: when multiple processes write to the terminal simultaneously, their output lines can mix together. This is fine for operations that don't produce output (like `gzip` or `chmod`), but problematic for commands that do. Second, **choosing a `-P` value**: a good starting point is the number of CPU cores (`nproc`), but for I/O-bound tasks you can often go higher. Third, **safety**: parallel execution is safe when each invocation operates on independent files. It's risky when operations have side effects that interact - for example, parallel appends to the same log file will produce garbled output.

### Confirmation

Use `-p` to prompt before each execution:

```bash
find . -name "*.tmp" | xargs -p rm
# rm file1.tmp file2.tmp?...y
```

### Practical Examples

```bash
# Delete files found by grep
grep -rl "deprecated" src/ | xargs rm

# Count lines in all Python files
find . -name "*.py" -print0 | xargs -0 wc -l

# Compress files in parallel
find . -name "*.log" -print0 | xargs -0 -P 4 gzip

# Search for a pattern in files found by find
find . -name "*.conf" -print0 | xargs -0 grep -l "listen"

# Rename files
ls *.jpeg | xargs -I {} bash -c 'mv "$1" "${1%.jpeg}.jpg"' _ {}
```

### find -exec vs xargs

Both can run commands on found files. The differences:

| Feature | `find -exec {} \;` | `find -exec {} +` | `find | xargs` |
|---------|--------------------|--------------------|----------------|
| Process per file | Yes | No (batched) | No (batched) |
| Handles special filenames | Yes | Yes | Only with `-print0 \| xargs -0` |
| Parallel execution | No | No | Yes (`-P`) |
| Speed | Slowest | Fast | Fast |

For most tasks, `find -exec {} +` is the simplest safe option. Use `xargs` when you need parallel execution or more control over argument handling.

```command-builder
base: find
description: Build a find + action pipeline to process matched files
options:
  - flag: ""
    type: select
    label: "Search path"
    explanation: "Where to start searching"
    choices:
      - [".", "Current directory"]
      - ["/var/log", "/var/log"]
      - ["/tmp", "/tmp"]
  - flag: ""
    type: select
    label: "What to find"
    explanation: "Criteria for matching files"
    choices:
      - ["-type f -name '*.log'", "Log files"]
      - ["-type f -name '*.tmp' -mtime +7", "Temp files older than 7 days"]
      - ["-type f -size +100M", "Files over 100MB"]
      - ["-type d -empty", "Empty directories"]
  - flag: ""
    type: select
    label: "Action"
    explanation: "What to do with the matched files"
    choices:
      - ["-print", "Print paths (default)"]
      - ["-exec ls -lh {} +", "Show with sizes"]
      - ["-print0 | xargs -0 rm", "Delete them"]
      - ["-exec chmod 644 {} +", "Set permissions to 644"]
      - ["-print0 | xargs -0 tar czf archive.tar.gz", "Archive them"]
```

---

## Further Reading

- [GNU Findutils Manual](https://www.gnu.org/software/findutils/manual/) - official documentation for find, xargs, and locate
- [Linux man-pages Project](https://man7.org/linux/man-pages/) - comprehensive manual pages including find(1) and xargs(1)

---

**Previous:** [Text Processing](text-processing.md) | **Next:** [File Permissions](file-permissions.md) | [Back to Index](README.md)
