# Scripting Fundamentals

[Bash](https://www.gnu.org/software/bash/manual/) scripts automate sequences of commands. This guide covers the control structures, functions, and error handling patterns that form the backbone of reliable shell scripts.

---

<div class="diagram-container">
<img src="../../assets/images/linux-essentials/script-control-flow.svg" alt="Script execution flow showing set -euo pipefail, argument parsing, validation, main logic, error handling with traps, and cleanup">
</div>

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

```terminal
title: Exit Codes and Conditional Execution
steps:
  - command: "true; echo $?"
    output: "0"
    narration: "The true command always succeeds (exit code 0). $? holds the exit code of the last command."
  - command: "false; echo $?"
    output: "1"
    narration: "false always fails (exit code 1). Non-zero exit codes indicate failure."
  - command: "ls /etc/hosts > /dev/null; echo $?"
    output: "0"
    narration: "ls succeeded because /etc/hosts exists. Exit code 0 means success."
  - command: "ls /nonexistent 2>/dev/null; echo $?"
    output: "2"
    narration: "ls failed because the path doesn't exist. Different commands use different non-zero codes to indicate specific error types."
  - command: "false && echo 'this runs' || echo 'this runs instead'"
    output: "this runs instead"
    narration: "&& only runs the next command if the previous succeeded. || runs if it failed. This creates a simple if/else pattern."
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

!!! tip "Use [[ ]] over [ ] in bash scripts"

    **`[[ ]]`** doesn't word-split variables, so `[[ -n $var ]]` works even if `$var` is empty or contains spaces. It also supports pattern matching (`==`), regex (`=~`), and logical operators (`&&`, `||`) directly. The only reason to use `[ ]` is when writing portable POSIX `sh` scripts.

```quiz
question: "What is the main advantage of [[ ]] over [ ] in bash?"
type: multiple-choice
options:
  - text: "[[ ]] is faster because it's compiled"
    feedback: "[[ ]] is a bash keyword (not an external command like [), but the advantage isn't speed - it's safety and features."
  - text: "[[ ]] supports pattern matching and doesn't require quoting variables"
    correct: true
    feedback: "Correct! [[ ]] is a bash keyword that prevents word splitting on variables (so unquoted $var is safe), supports regex with =~, pattern matching with ==, and logical operators && and || directly."
  - text: "[[ ]] is POSIX-compliant while [ ] is bash-specific"
    feedback: "It's the opposite. [ ] (test) is POSIX-compliant. [[ ]] is a bash/zsh extension. Use [ ] in scripts that need to run on /bin/sh."
  - text: "[[ ]] can test file permissions while [ ] cannot"
    feedback: "Both support file tests like -r, -w, -x, -f, -d. The advantages of [[ ]] are safer variable handling and pattern matching."
```

### Test Operators

<div class="diagram-container">
<img src="../../assets/images/linux-essentials/test-operator-categories.svg" alt="Test operator categories showing file tests, string tests, numeric tests, and pattern/regex tests">
</div>

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

```quiz
question: "What does the test [ -z \"$var\" ] check?"
type: multiple-choice
options:
  - text: "Whether the variable var exists"
    feedback: "-z checks if the string is empty (zero length). A variable can exist but be empty, or be unset. -z returns true for both cases."
  - text: "Whether the string is zero length (empty)"
    correct: true
    feedback: "Correct! -z returns true if the string has zero length. This is true both when the variable is unset and when it's set to an empty string. The opposite is -n, which checks for non-zero length."
  - text: "Whether the variable contains only zeros"
    feedback: "-z doesn't check content. It checks string length. [ -z '000' ] is false because '000' has length 3."
  - text: "Whether the variable is set to the integer 0"
    feedback: "-z checks for empty strings, not numeric zero. [ -z '0' ] is false because '0' has length 1. For numeric comparison, use [ \"$var\" -eq 0 ]."
```

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

!!! tip "Use (( )) for arithmetic comparisons"

    **`(( ))`** lets you write math comparisons using familiar operators like `>`, `<`, `==`, `>=` instead of the cryptic `-gt`, `-lt`, `-eq`, `-ge` flags. Variables inside `(( ))` don't need the `$` prefix. Use `(( ))` for numeric logic, `[[ ]]` for string and file tests.

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

```exercise
title: Build a CLI Argument Parser with case
difficulty: intermediate
scenario: |
  Write a bash script that accepts command-line arguments using a case statement
  inside a while loop. The script should support:

  - `-v` or `--verbose` to enable verbose mode
  - `-o FILE` or `--output FILE` to set an output file
  - `-h` or `--help` to show usage and exit
  - Any unknown flag should print an error and exit with code 1
hints:
  - "Use a while loop with shift to process arguments one at a time"
  - "Use case \"$1\" in to match the current argument"
  - "For flags that take a value (like -o), grab $2 and shift twice"
  - "Use *) as the default case for unknown arguments"
solution: |
  ```bash
  #!/bin/bash
  set -euo pipefail

  VERBOSE=false
  OUTPUT=""

  usage() {
      echo "Usage: $0 [-v|--verbose] [-o|--output FILE] [-h|--help]"
      exit 0
  }

  while [[ $# -gt 0 ]]; do
      case "$1" in
          -v|--verbose)
              VERBOSE=true
              shift
              ;;
          -o|--output)
              OUTPUT="${2:?'--output requires a filename'}"
              shift 2
              ;;
          -h|--help)
              usage
              ;;
          -*)
              echo "Unknown option: $1" >&2
              exit 1
              ;;
          *)
              break  # Stop processing flags, remaining args are positional
              ;;
      esac
  done

  $VERBOSE && echo "Verbose mode enabled"
  [[ -n "$OUTPUT" ]] && echo "Output file: $OUTPUT"
  echo "Remaining arguments: $@"
  ```

  Key patterns: `shift` removes the processed argument, `${2:?message}` fails
  with a message if the required value is missing, and `break` on non-flag
  arguments allows mixing flags and positional parameters.
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

!!! warning "Avoid the && || pseudo-if for complex logic"

    The pattern `condition && do_this || do_that` looks like an if/else but isn't. If `do_this` fails, `do_that` also runs - you get *both* branches. This is fine for simple cases like `[[ -f file ]] && echo "yes" || echo "no"` where `echo` won't fail, but for anything more complex, use a proper `if` statement.

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

!!! warning "The while-read-pipe subshell problem"

    Piping into a `while` loop runs it in a **subshell**, so variable changes inside the loop are lost when it finishes: `cat file | while read line; do count=$((count+1)); done; echo $count` prints `0`. Use process substitution instead: `while read line; do ...; done < <(cat file)` or redirect from a file: `while read line; do ...; done < file`.

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

```quiz
question: "What is the difference between \"$@\" and \"$*\" in a shell script?"
type: multiple-choice
options:
  - text: "$@ includes the script name; $* excludes it"
    feedback: "Neither includes the script name ($0). Both represent the positional parameters ($1, $2, ...). The difference is how they handle quoting."
  - text: "\"$@\" preserves each argument as a separate word; \"$*\" joins all arguments into a single word"
    correct: true
    feedback: "Correct! \"$@\" expands to \"$1\" \"$2\" \"$3\" (separate words). \"$*\" expands to \"$1 $2 $3\" (one word). This matters when arguments contain spaces: \"$@\" preserves 'hello world' as one argument, \"$*\" splits it."
  - text: "\"$*\" preserves arguments; \"$@\" splits them"
    feedback: "It's the opposite. \"$@\" preserves individual arguments. \"$*\" merges them into a single string."
  - text: "They are identical when quoted"
    feedback: "They behave very differently when quoted. \"$@\" preserves argument boundaries. \"$*\" joins everything with the first character of IFS."
```

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

!!! danger "return sets exit status, echo outputs data"

    **`return`** only sets a numeric exit status (0-255) - it does not send data back to the caller. To pass data out of a function, use **`echo`** (or `printf`) and capture it with `$(function_name)`. Confusing the two is a common bug: `result=$(my_func)` captures stdout, while `$?` captures the return code.

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

!!! tip "Use local for all function variables"

    Without **`local`**, every variable in a function is **global** - it persists after the function returns and can collide with variables in other functions or the main script. Always declare function variables with `local` unless you deliberately want them visible outside the function. This is especially important in scripts with multiple functions that might reuse common names like `i`, `result`, or `file`.

```code-walkthrough
language: bash
title: Functions with Local Variables and Return Values
code: |
  validate_port() {
      local port="$1"
      local -i min=1 max=65535

      if [[ -z "$port" ]]; then
          echo "Error: port number required" >&2
          return 1
      fi

      if (( port < min || port > max )); then
          echo "Error: port must be $min-$max" >&2
          return 1
      fi

      echo "$port"
      return 0
  }

  if result=$(validate_port "$1"); then
      echo "Valid port: $result"
  else
      exit 1
  fi
annotations:
  - line: 1
    text: "Function names follow the same rules as variable names. Parentheses are optional but conventional."
  - line: 2
    text: "local restricts the variable to this function's scope. Without local, it would be global and could clash with variables elsewhere."
  - line: 3
    text: "local -i declares an integer variable. Bash will perform arithmetic on assignment, catching non-numeric values."
  - line: 5
    text: "Validate inputs early. Check for empty/missing arguments before doing any work."
  - line: 7
    text: "return sets the function's exit status (0=success, non-zero=failure). It does NOT output a value - use echo for that."
  - line: 10
    text: "Arithmetic comparison with (( )). Inside (( )), you don't need $ on variables and can use <, >, ==, etc."
  - line: 15
    text: "echo outputs the result to stdout. This is how bash functions 'return' data - through command substitution."
  - line: 16
    text: "return 0 signals success. The caller checks the exit status to know if the function succeeded."
  - line: 19
    text: "Command substitution captures the function's stdout in a variable. The if checks the function's exit status."
```

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

!!! warning "set -e exceptions: if, &&, ||, while"

    **`set -e`** doesn't exit on *every* failure. Commands used as conditions in `if`, `while`, or `until` statements are exempt, as are commands in `&&` and `||` chains. This is by design - the shell needs to evaluate the exit code to make a decision. Be aware that `cmd && other` silently swallows `cmd`'s failure under `set -e`.

!!! danger "set -u catches rm -rf $UNSET_VAR expanding to rm -rf /"

    Without **`set -u`**, referencing an unset variable silently expands to an empty string. This turns `rm -rf "$DEPLOY_DIR/app"` into `rm -rf /app` when `DEPLOY_DIR` is unset. With `-u`, bash immediately raises an error instead of expanding the empty variable. This single option prevents an entire class of catastrophic scripting bugs.

```quiz
question: "What does set -e do in a bash script?"
type: multiple-choice
options:
  - text: "Enables extended globbing"
    feedback: "Extended globbing is enabled with shopt -s extglob. set -e controls error behavior."
  - text: "Exits the script immediately if any command returns a non-zero exit status"
    correct: true
    feedback: "Correct! set -e (errexit) causes the script to exit on the first command failure. There are exceptions: commands in if conditions, && or || chains, and while/until loops don't trigger the exit."
  - text: "Echoes each command before executing it"
    feedback: "That's set -x (xtrace). set -e is about error handling, not debugging output."
  - text: "Exports all variables automatically"
    feedback: "That's set -a (allexport). set -e makes the script exit on command failures."
```

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

!!! tip "trap EXIT for guaranteed cleanup"

    **`trap cleanup EXIT`** fires when the script exits for *any* reason: normal completion, `set -e` abort, `Ctrl-C`, or `kill`. This makes it the single most reliable cleanup mechanism. Always use `EXIT` rather than trapping individual signals, unless you need different behavior for different signals.

Common signals to trap:

| Signal | When |
|--------|------|
| `EXIT` | Script exits (any reason) |
| `ERR` | A command fails (with `set -e`) |
| `INT` | `Ctrl-C` |
| `TERM` | `kill` (default signal) |

```exercise
title: Write a Robust Script Header
difficulty: intermediate
scenario: |
  Write a bash script template that includes all the recommended safety settings
  and a cleanup trap. The script should:

  1. Use strict mode (set -euo pipefail)
  2. Set up a trap that runs a cleanup function on EXIT
  3. Create a temporary directory for working files
  4. Clean up the temp directory when the script exits (normally or on error)
hints:
  - "set -e exits on errors, -u exits on unset variables, -o pipefail catches pipe failures"
  - "trap 'commands' EXIT runs commands when the script exits for any reason"
  - "mktemp -d creates a temporary directory and prints its path"
  - "Define the cleanup function before the trap statement"
solution: |
  ```bash
  #!/bin/bash
  set -euo pipefail

  # Create temp directory
  TMPDIR=$(mktemp -d)

  # Cleanup function
  cleanup() {
      rm -rf "$TMPDIR"
      echo "Cleaned up temp directory"
  }

  # Register cleanup on EXIT (runs on normal exit, errors, and signals)
  trap cleanup EXIT

  # Your script logic here
  echo "Working in $TMPDIR"
  # ... do work ...
  ```

  The EXIT trap fires on normal exit, errexit (-e), and most signals. This
  guarantees cleanup even if the script fails partway through. Using a function
  (instead of inline commands) makes complex cleanup easier to manage.
```

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

```code-walkthrough
language: bash
title: Bash Error Handling Template
code: |
  #!/bin/bash
  set -euo pipefail
  IFS=$'\n\t'

  readonly SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
  readonly SCRIPT_NAME="$(basename "$0")"

  log() { echo "[$(date '+%Y-%m-%d %H:%M:%S')] $*" >&2; }
  die() { log "FATAL: $*"; exit 1; }

  trap 'log "Error on line $LINENO. Exit code: $?"' ERR
annotations:
  - line: 2
    text: "-e: exit on error. -u: error on unset variables. -o pipefail: catch failures in pipes, not just the last command."
  - line: 3
    text: "Set IFS to newline and tab only. This prevents word splitting on spaces in for loops and other expansions."
  - line: 5
    text: "BASH_SOURCE[0] is the path to this script. cd + dirname + pwd resolves it to an absolute path, even if called via symlink."
  - line: 6
    text: "Store the script's own name for use in usage messages and log output. basename strips the directory path."
  - line: 8
    text: "A reusable log function that timestamps messages and sends them to stderr (so stdout stays clean for data)."
  - line: 9
    text: "die() logs a fatal message and exits. Having a standard exit pattern makes error handling consistent."
  - line: 11
    text: "The ERR trap fires when any command fails (under set -e). $LINENO tells you exactly where the error occurred."
```

---

## Further Reading

- [Bash Reference Manual](https://www.gnu.org/software/bash/manual/) - official bash documentation covering scripting syntax, conditionals, loops, and builtins
- [POSIX Shell Command Language](https://pubs.opengroup.org/onlinepubs/9799919799/) - the portable shell scripting specification
- [ShellCheck](https://www.shellcheck.net/) - static analysis tool for shell scripts

---

**Previous:** [Job Control](job-control.md) | **Next:** [Disk and Filesystem](disk-and-filesystem.md) | [Back to Index](README.md)
