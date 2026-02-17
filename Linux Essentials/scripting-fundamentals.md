# Scripting Fundamentals

[Bash](https://www.gnu.org/software/bash/manual/) scripts automate sequences of commands. This guide covers the control structures, functions, and error handling patterns that form the backbone of reliable shell scripts.

---

## Exit Codes

Every command returns an **exit code** when it finishes. By convention:

- **0** means success
- **Non-zero** means failure (the specific number can indicate different error types)

```bash
ls /tmp
echo $?    # 0 (success)

ls /nonexistent
echo $?    # 2 (no such file)
```

The special variable **`$?`** holds the exit code of the most recently executed command.

You can set an exit code in your own scripts with `exit`:

```bash
#!/bin/bash
if [ ! -f "$1" ]; then
    echo "File not found: $1" >&2
    exit 1
fi
```

---

## Conditionals

### test, [ ], and [[ ]]

There are three ways to evaluate conditions in bash:

**`test`** is the original command:

```bash
test -f /etc/passwd && echo "exists"
```

**`[ ]`** is equivalent to `test` (it's the same command under a different name):

```bash
[ -f /etc/passwd ] && echo "exists"
```

**`[[ ]]`** is a bash keyword with extra features:

```bash
[[ -f /etc/passwd ]] && echo "exists"
```

The spaces inside `[ ]` and `[[ ]]` are required. They're not just syntax - `[` is actually a command, and `]` is its final argument.

### Differences Between [ ] and [[ ]]

| Feature | `[ ]` | `[[ ]]` |
|---------|-------|---------|
| POSIX compatible | Yes | No (bash/zsh only) |
| Pattern matching | No | `[[ $str == glob* ]]` |
| Regex matching | No | `[[ $str =~ regex ]]` |
| Logical operators | `-a`, `-o` | `&&`, `\|\|` |
| Word splitting on variables | Yes (must quote) | No |

In bash scripts, prefer `[[ ]]` - it's safer and more powerful.

### Test Operators

**File tests:**

| Operator | True if... |
|----------|-----------|
| `-f file` | Regular file exists |
| `-d file` | Directory exists |
| `-e file` | Any file exists |
| `-r file` | File is readable |
| `-w file` | File is writable |
| `-x file` | File is executable |
| `-s file` | File exists and is non-empty |
| `-L file` | File is a symbolic link |
| `file1 -nt file2` | file1 is newer than file2 |
| `file1 -ot file2` | file1 is older than file2 |

The ones you'll use constantly: **`-f`** to check that a config file exists before trying to read it, **`-d`** to verify a directory is there before writing into it, **`-x`** to check that a command or script is executable before running it, **`-s`** to make sure a file isn't empty before processing it, and **`-nt`** to compare timestamps (useful in build systems to decide whether a target needs rebuilding).

**String tests:**

| Operator | True if... |
|----------|-----------|
| `-z "$str"` | String is empty (zero length) |
| `-n "$str"` | String is non-empty |
| `"$a" = "$b"` | Strings are equal |
| `"$a" != "$b"` | Strings are not equal |

**`-z`** is the go-to for checking whether a required variable has been set: `[[ -z "$DB_HOST" ]] && echo 'DB_HOST is required' >&2 && exit 1`. **`-n`** is its opposite - use it when you want to run something only if a variable has a value.

**Numeric comparison:**

| Operator | Meaning |
|----------|---------|
| `-eq` | Equal |
| `-ne` | Not equal |
| `-lt` | Less than |
| `-le` | Less than or equal |
| `-gt` | Greater than |
| `-ge` | Greater than or equal |

```bash
[ "$count" -gt 10 ]          # numeric comparison with [ ]
[[ $count -gt 10 ]]          # same with [[ ]] (quoting optional)
(( count > 10 ))             # arithmetic context (cleanest for numbers)
```

---

## if / elif / else

```bash
if [[ -f "$file" ]]; then
    echo "File exists"
elif [[ -d "$file" ]]; then
    echo "It's a directory"
else
    echo "Not found"
fi
```

You can use any command as a condition - `if` checks the exit code:

```bash
if grep -q "error" log.txt; then
    echo "Errors found"
fi

if ping -c 1 -W 2 google.com &>/dev/null; then
    echo "Network is up"
fi
```

---

## case / esac

**`case`** matches a value against patterns. It's cleaner than a chain of `elif` for multiple string comparisons.

```bash
case "$1" in
    start)
        echo "Starting..."
        ;;
    stop)
        echo "Stopping..."
        ;;
    restart|reload)
        echo "Restarting..."
        ;;
    *)
        echo "Usage: $0 {start|stop|restart}"
        exit 1
        ;;
esac
```

Patterns support globbing: `*` matches anything, `?` matches one character, `[...]` matches character classes.

```bash
case "$filename" in
    *.tar.gz)  tar xzf "$filename" ;;
    *.tar.bz2) tar xjf "$filename" ;;
    *.zip)     unzip "$filename" ;;
    *)         echo "Unknown format" ;;
esac
```

---

## Short-Circuit Operators

**`&&`** runs the second command only if the first succeeds:

```bash
mkdir -p /tmp/work && cd /tmp/work
```

**`||`** runs the second command only if the first fails:

```bash
cd /tmp/work || exit 1
```

Combined for a simple if/else:

```bash
[[ -f config.yaml ]] && echo "Config found" || echo "No config"
```

Be careful with this pattern. If the `&&` command fails, the `||` command also runs. For real conditional logic, use `if`.

---

## Loops

### for Loop (List)

```bash
for item in apple banana cherry; do
    echo "$item"
done

# Over files
for file in *.txt; do
    echo "Processing $file"
done

# Over command output
for user in $(cut -d: -f1 /etc/passwd); do
    echo "$user"
done

# Over a range
for i in {1..10}; do
    echo "$i"
done
```

### for Loop (C-Style)

```bash
for (( i=0; i<10; i++ )); do
    echo "$i"
done
```

### while Loop

```bash
count=0
while [[ $count -lt 5 ]]; do
    echo "$count"
    (( count++ ))
done
```

Reading a file line by line:

```bash
while IFS= read -r line; do
    echo "$line"
done < input.txt
```

The `IFS=` prevents stripping leading/trailing whitespace. The `-r` prevents backslash interpretation.

Reading from a command:

```bash
while IFS= read -r line; do
    echo "$line"
done < <(find . -name "*.txt")
```

### until Loop

Runs while the condition is false (the inverse of `while`):

```bash
until ping -c 1 -W 2 server.example.com &>/dev/null; do
    echo "Waiting for server..."
    sleep 5
done
echo "Server is up"
```

### break and continue

**`break`** exits the loop entirely:

```bash
for file in *.log; do
    if [[ $(wc -l < "$file") -gt 1000 ]]; then
        echo "Found large log: $file"
        break
    fi
done
```

**`continue`** skips to the next iteration:

```bash
for file in *.txt; do
    [[ -d "$file" ]] && continue    # skip directories
    echo "Processing $file"
done
```

Both `break` and `continue` accept a numeric argument for nested loops. `break 2` exits two levels of nesting, `continue 2` skips to the next iteration of the outer loop. This avoids the need for flag variables when you want an inner loop's result to control the outer loop.

---

## Functions

### Definition

Two equivalent syntaxes:

```bash
greet() {
    echo "Hello, $1"
}

function greet {
    echo "Hello, $1"
}
```

The first form is POSIX-compatible. The second is bash-specific.

### Arguments

Functions receive arguments the same way scripts do:

| Variable | Meaning |
|----------|---------|
| `$1`, `$2`, ... | Positional arguments |
| `$@` | All arguments (as separate words) |
| `$*` | All arguments (joined as a single string when quoted as `"$*"`) |
| `$#` | Number of arguments |
| `$0` | Still the script name (not the function name) |

The critical difference between `"$@"` and `"$*"` appears when they're double-quoted. `"$@"` expands to each argument as a separate word, preserving the original argument boundaries. `"$*"` joins all arguments into a single string separated by the first character of `IFS` (normally a space). This matters when passing filenames with spaces:

```bash
# If called with: ./script.sh "my file.txt" "other file.txt"

# CORRECT: passes two separate arguments to rm
for f in "$@"; do rm "$f"; done    # rm "my file.txt"; rm "other file.txt"

# BUG: joins into one string, then word-splits on spaces
for f in "$*"; do rm "$f"; done    # rm "my file.txt other file.txt" (one argument with spaces)
```

In almost all cases, you want `"$@"`. The only time `"$*"` is useful is when you intentionally want to join arguments into a single string, like building a log message: `log "Arguments: $*"`.

```bash
backup() {
    local src="$1"
    local dest="$2"

    if [[ $# -lt 2 ]]; then
        echo "Usage: backup <source> <destination>" >&2
        return 1
    fi

    cp -r "$src" "$dest"
}

backup /var/www /tmp/backup
```

### Return Values

Functions use `return` to set an exit code (0-255). They don't "return" data the way functions in other languages do.

```bash
is_valid_ip() {
    local ip="$1"
    [[ $ip =~ ^[0-9]+\.[0-9]+\.[0-9]+\.[0-9]+$ ]]
    return $?    # returns exit code of the test
}

if is_valid_ip "192.168.1.1"; then
    echo "Valid"
fi
```

To get data out of a function, print it and capture with command substitution:

```bash
get_extension() {
    echo "${1##*.}"
}

ext=$(get_extension "archive.tar.gz")
echo "$ext"    # gz
```

### Local Variables

Variables inside functions are global by default. Use **`local`** to scope them to the function:

```bash
my_func() {
    local temp="this stays inside"
    global_var="this leaks out"
}

my_func
echo "$temp"        # empty
echo "$global_var"  # this leaks out
```

Always use `local` for function variables unless you intentionally want them to be global.

---

## Error Handling

### set Options

Three options that make scripts much safer:

**`set -e`** (errexit) - exit immediately if a command fails:

```bash
set -e
rm /tmp/workfile      # if this fails, script exits
echo "This won't run if rm failed"
```

**`set -u`** (nounset) - treat unset variables as errors:

```bash
set -u
echo "$undefined_var"    # error: unbound variable
```

**`set -o pipefail`** - pipeline fails if any command in it fails:

```bash
set -o pipefail
cat /nonexistent | sort    # pipeline returns non-zero (cat failed)
```

### The Combination

Start every script with:

```bash
#!/bin/bash
set -euo pipefail
```

This catches the vast majority of common scripting errors: unhandled failures, typos in variable names, and hidden pipeline failures.

### trap

**`trap`** runs a command when the script receives a signal or exits. It's essential for cleanup.

```bash
cleanup() {
    rm -f "$tmpfile"
    echo "Cleaned up"
}

trap cleanup EXIT          # runs cleanup when script exits (any reason)
trap cleanup ERR           # runs cleanup on error
trap cleanup INT TERM      # runs cleanup on Ctrl-C or kill

tmpfile=$(mktemp)
# ... use tmpfile ...
# cleanup runs automatically when the script exits
```

Common signals to trap:

| Signal | When |
|--------|------|
| `EXIT` | Script exits (any reason) |
| `ERR` | A command fails (with `set -e`) |
| `INT` | `Ctrl-C` |
| `TERM` | `kill` (default signal) |

### Complete Example

Here's a script that demonstrates proper error handling:

```bash
#!/bin/bash
set -euo pipefail

readonly SCRIPT_NAME="$(basename "$0")"
readonly WORK_DIR="$(mktemp -d)"

log() {
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] $*" >&2
}

cleanup() {
    local exit_code=$?
    rm -rf "$WORK_DIR"
    if [[ $exit_code -ne 0 ]]; then
        log "ERROR: $SCRIPT_NAME failed with exit code $exit_code"
    fi
    exit $exit_code
}

trap cleanup EXIT

usage() {
    echo "Usage: $SCRIPT_NAME <input-file> <output-file>" >&2
    exit 1
}

main() {
    [[ $# -ne 2 ]] && usage

    local input="$1"
    local output="$2"

    [[ -f "$input" ]] || { log "Input file not found: $input"; exit 1; }

    log "Processing $input..."

    local tmpfile="$WORK_DIR/processed.tmp"
    sort -u "$input" > "$tmpfile"
    mv "$tmpfile" "$output"

    log "Done. Output written to $output"
}

main "$@"
```

This script:
- Fails immediately on errors (`set -euo pipefail`)
- Creates a temporary working directory
- Cleans up automatically on exit (success or failure)
- Logs to STDERR
- Validates arguments
- Uses `local` for all function variables
- Wraps logic in a `main` function

---

## Further Reading

- [Bash Reference Manual](https://www.gnu.org/software/bash/manual/) - official bash documentation covering scripting syntax, conditionals, loops, and builtins
- [POSIX Shell Command Language](https://pubs.opengroup.org/onlinepubs/9799919799/) - the portable shell scripting specification
- [ShellCheck](https://www.shellcheck.net/) - static analysis tool for shell scripts

---

**Previous:** [Job Control](job-control.md) | **Next:** [Disk and Filesystem](disk-and-filesystem.md) | [Back to Index](README.md)
