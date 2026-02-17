# Finding Files

The `find` command searches directory trees for files matching specified criteria. Combined with `xargs`, it forms a powerful pattern for batch operations on files.

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

**By size:**

```bash
find . -size +10M              # larger than 10 megabytes
find . -size -1k               # smaller than 1 kilobyte
find . -size 100c              # exactly 100 bytes
```

Size suffixes: `c` (bytes), `k` (kilobytes), `M` (megabytes), `G` (gigabytes).

**By time:**

Timestamps are measured in 24-hour periods. `+7` means "more than 7 days ago" and `-1` means "within the last day."

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
find . -perm /644              # any of these permissions (any specified bit set)
find . -perm -u+x              # user execute bit set
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

### Logical Operators

```bash
find . -name "*.txt" -and -size +1M    # both conditions (-and is implicit)
find . -name "*.txt" -or -name "*.md"  # either condition
find . ! -name "*.tmp"                 # negation
find . \( -name "*.txt" -or -name "*.md" \) -and -mtime -7  # grouping
```

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

**`-delete`:**

```bash
find . -name "*.tmp" -delete
```

Built-in deletion - faster than `-exec rm`. Note that `-delete` implies `-depth` (processes files before their parent directories).

**`-print0`:**

```bash
find . -name "*.txt" -print0
```

Separates results with null characters instead of newlines. This handles filenames containing spaces, newlines, or other special characters. Pair with `xargs -0`.

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

# Find broken symlinks
find . -xtype l

# Find files modified today
find . -daystart -mtime -1

# Find setuid programs
find / -perm -4000 -type f 2>/dev/null
```

---

## xargs

**`xargs`** reads items from STDIN and passes them as arguments to a command. It bridges the gap between commands that produce output (like `find`) and commands that expect arguments.

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
