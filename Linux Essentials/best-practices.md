# Shell Scripting Best Practices

A collection of conventions and patterns that make shell scripts more reliable, portable, and maintainable. These aren't opinions - they prevent real bugs.

---

## Start Every Script Right

Every [**`bash`**](https://www.gnu.org/software/bash/manual/) script should begin with:

```bash
#!/bin/bash
set -euo pipefail
```

### What Each Option Does

**`set -e`** (errexit) - exit immediately if any command returns non-zero:

```bash
set -e
cp important.txt /backup/     # if this fails, the script stops
rm important.txt               # this won't run if cp failed
```

Without `-e`, the script would happily continue after the failed `cp` and delete the file.

**`set -u`** (nounset) - treat references to unset variables as errors:

```bash
set -u
rm -rf "$DEPLOY_DIR/app"      # if DEPLOY_DIR is unset, script exits with an error
```

Without `-u`, an unset `DEPLOY_DIR` expands to empty, and you'd run `rm -rf /app`.

**`set -o pipefail`** - a pipeline fails if any command in it fails:

```bash
set -o pipefail
cat /nonexistent | sort        # pipeline returns non-zero (cat failed)
```

Without `pipefail`, only the exit code of the last command (`sort`) matters, hiding the `cat` failure.

---

## Always Quote Your Variables

Unquoted variables undergo word splitting and glob expansion. This causes bugs with filenames containing spaces, wildcards, or empty values.

```bash
# BAD
file=$1
rm $file              # if file="my documents", this runs: rm my documents

# GOOD
file="$1"
rm "$file"            # runs: rm "my documents"
```

```bash
# BAD
if [ -n $var ]; then   # if var is empty, this becomes: [ -n ] (always true)

# GOOD
if [ -n "$var" ]; then # correctly tests for non-empty
```

The rule is simple: always double-quote variable expansions (`"$var"`) unless you specifically want word splitting.

Exceptions where quoting is unnecessary:
- Inside `[[ ]]` (no word splitting, but quoting doesn't hurt)
- Inside `$(( ))` arithmetic

---

## Use [[ ]] Over [ ] in Bash

`[[ ]]` is a bash keyword that's safer and more powerful than `[ ]`:

```bash
# [ ] requires careful quoting
[ -n "$var" ]           # works
[ -n $var ]             # BUG if var is empty

# [[ ]] handles it
[[ -n $var ]]           # works even without quotes

# [[ ]] supports pattern matching
[[ $file == *.txt ]]    # glob pattern

# [[ ]] supports regex
[[ $email =~ ^[a-z]+@[a-z]+\.[a-z]+$ ]]

# [[ ]] uses familiar logical operators
[[ $a -gt 0 && $b -gt 0 ]]     # clean
[ "$a" -gt 0 ] && [ "$b" -gt 0 ]  # clunky equivalent with [ ]
```

If you're writing a bash script (not a [POSIX](https://pubs.opengroup.org/onlinepubs/9799919799/) sh script), always use `[[ ]]`.

---

## Prefer $() Over Backticks

Both perform command substitution, but `$()` is clearer and nests properly:

```bash
# BAD - backticks are hard to read and don't nest
result=`echo \`date\``

# GOOD - $() nests cleanly
result=$(echo $(date))
```

Backticks also have surprising escaping rules. `$()` behaves predictably.

---

## Use mktemp for Temporary Files

Never hardcode temporary file paths. Multiple script instances would collide, and predictable paths are a security risk.

```bash
# BAD
tmpfile="/tmp/mydata.tmp"

# GOOD
tmpfile=$(mktemp)
tmpdir=$(mktemp -d)

# Always clean up
trap 'rm -f "$tmpfile"' EXIT
```

`mktemp` creates a unique filename that doesn't already exist. Combine with `trap` to ensure cleanup.

---

## Use shellcheck

[**`shellcheck`**](https://www.shellcheck.net/) is a static analysis tool that catches common mistakes in shell scripts:

```bash
shellcheck myscript.sh
```

It finds issues like:
- Unquoted variables
- Useless `cat` usage
- Incorrect test syntax
- Word splitting bugs
- Unreachable code

Install it:

```bash
sudo apt install shellcheck       # Debian/Ubuntu
sudo dnf install ShellCheck       # Fedora
brew install shellcheck           # macOS
```

Run it in CI/CD to catch shell script bugs before they reach production.

Here's what shellcheck output looks like on a buggy script:

```bash
$ cat buggy.sh
#!/bin/bash
files=$(ls *.txt)
for f in $files; do
    if [ $f == "important" ]; then
        rm $f
    fi
done

$ shellcheck buggy.sh
In buggy.sh line 2:
files=$(ls *.txt)
        ^------^ SC2012: Use find instead of ls to better handle non-alphanumeric filenames.

In buggy.sh line 3:
for f in $files; do
         ^----^ SC2086: Double quote to prevent globbing and word splitting.

In buggy.sh line 4:
    if [ $f == "important" ]; then
         ^-- SC2086: Double quote to prevent globbing and word splitting.
         ^-- SC2039: In POSIX sh, == in place of = is undefined.
```

Each finding includes a code (like SC2086) that you can look up at the shellcheck wiki for a detailed explanation and fix. **Editor integration** makes this even more useful - the VS Code ShellCheck extension and vim plugins like ALE or Syntastic show warnings inline as you type, catching bugs before you even save the file.

---

## Don't Parse ls Output

The output of `ls` is meant for humans, not scripts. Filenames with spaces, newlines, or special characters will break parsing.

```bash
# BAD - breaks on filenames with spaces
for file in $(ls); do
    echo "$file"
done

# GOOD - globbing handles filenames correctly
for file in *; do
    echo "$file"
done

# GOOD - find with -print0 for truly safe handling
find . -type f -print0 | while IFS= read -r -d '' file; do
    echo "$file"
done
```

---

## Use Arrays for Lists

Don't store lists of items in a string variable. Use arrays.

```bash
# BAD - breaks on filenames with spaces
files="file one.txt file two.txt"
for f in $files; do
    echo "$f"        # prints: file, one.txt, file, two.txt
done

# GOOD - arrays preserve elements
files=("file one.txt" "file two.txt")
for f in "${files[@]}"; do
    echo "$f"        # prints: file one.txt, file two.txt
done
```

Array operations:

```bash
arr=("one" "two" "three")
echo "${arr[0]}"              # first element
echo "${arr[@]}"              # all elements
echo "${#arr[@]}"             # number of elements
arr+=("four")                 # append

# Build arrays from command output
mapfile -t lines < file.txt   # read file into array (one line per element)
```

---

## Portable vs Bash-Specific

If your script needs to run on minimal systems (Docker containers, embedded systems, Debian's `dash`), avoid bash-specific features:

| Bash-Specific | POSIX Alternative |
|--------------|-------------------|
| `[[ ]]` | `[ ]` |
| `$(( ))` | `$(( ))` (this one is POSIX) |
| `{1..10}` | `seq 1 10` |
| `function name {` | `name() {` |
| `source file` | `. file` |
| `$RANDOM` | No POSIX equivalent |
| Arrays | No POSIX equivalent |
| `<<<` here strings | `echo "str" \| cmd` |

If you need bash features, make sure your shebang is `#!/bin/bash`, not `#!/bin/sh`. On some systems, `/bin/sh` is `dash`, which doesn't support bash extensions.

**When to target POSIX sh:** Docker scratch images and minimal containers often only have `/bin/sh` (usually dash or busybox ash). Cron jobs on minimal systems may run under `sh` by default. CI/CD pipeline scripts that need to run across different environments (Alpine Linux, Ubuntu, macOS) are safer with POSIX sh. **When bash is fine:** application scripts, developer tools, interactive helpers, and anything where you control the execution environment. If you're writing a deployment script that only runs on your Ubuntu servers, use bash and enjoy its features - forcing POSIX compatibility on a known-bash environment just makes the code harder to read.

---

## Avoid Common Pitfalls

### Don't Use eval

`eval` executes a string as a command. It's almost always a security risk and there's usually a better way.

```bash
# BAD - eval is dangerous
eval "rm $user_input"

# GOOD - pass arguments directly
rm "$filename"
```

If you find yourself reaching for `eval` to dynamically construct variable names, bash has safer alternatives. **Indirect expansion** with `${!var}` lets you dereference a variable name stored in another variable:

```bash
key='HOME'
echo "${!key}"    # prints the value of $HOME
```

**Associative arrays** (bash 4+) are even better for key-value lookups:

```bash
declare -A config
config[host]='localhost'
config[port]='5432'
echo "${config[host]}"
```

Both approaches avoid the security risk of `eval` interpreting arbitrary strings as code.

### Handle Missing Commands

Check that required tools exist before using them:

```bash
for cmd in jq curl git; do
    if ! command -v "$cmd" &>/dev/null; then
        echo "Required command not found: $cmd" >&2
        exit 1
    fi
done
```

### Use readonly for Constants

```bash
readonly CONFIG_DIR="/etc/myapp"
readonly LOG_FILE="/var/log/myapp.log"
readonly MAX_RETRIES=3
```

`readonly` prevents accidental reassignment. Use it for values that should never change.

### Use Epoch Timestamps

For log files and backups, use epoch timestamps or ISO dates to avoid collisions and ensure sorting:

```bash
# Epoch seconds
logfile="deploy_$(date +%s).log"

# ISO format (human-readable and sortable)
logfile="deploy_$(date +%Y%m%d_%H%M%S).log"
```

---

## Script Template

A starting point for new scripts:

```bash
#!/bin/bash
set -euo pipefail

# BASH_SOURCE[0] is the path to this script, even when sourced from another script.
# $0 would give the caller's name instead. cd + pwd resolves symlinks and relative paths.
readonly SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
readonly SCRIPT_NAME="$(basename "$0")"

usage() {
    cat <<EOF
Usage: $SCRIPT_NAME [options] <argument>

Description of what this script does.

Options:
    -h, --help    Show this help message
    -v, --verbose Enable verbose output
EOF
    exit 1
}

log() {
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] $*" >&2
}

# main() is defined here but called at the bottom of the file. This pattern lets you
# define helper functions anywhere in the file without worrying about order - bash reads
# function definitions before executing main(). It also makes the entry point obvious.
main() {
    local verbose=false

    while [[ $# -gt 0 ]]; do
        case "$1" in
            -h|--help) usage ;;
            -v|--verbose) verbose=true; shift ;;
            -*) echo "Unknown option: $1" >&2; usage ;;
            *) break ;;
        esac
    done

    [[ $# -lt 1 ]] && usage

    log "Starting $SCRIPT_NAME"
    # ... your logic here ...
    log "Done"
}

# "$@" passes all command-line arguments to main, preserving quoting.
main "$@"
```

---

## Further Reading

- [ShellCheck Wiki](https://github.com/koalaman/shellcheck/wiki) - explanations for every ShellCheck warning and suggestion
- [ShellCheck](https://www.shellcheck.net/) - online shell script analysis tool
- [Bash Reference Manual](https://www.gnu.org/software/bash/manual/) - official bash documentation
- [POSIX Shell Command Language](https://pubs.opengroup.org/onlinepubs/9799919799/) - portable shell scripting specification
- [Google Shell Style Guide](https://google.github.io/styleguide/shellguide.html) - widely-referenced style conventions for shell scripts

---

**Previous:** [Archiving and Compression](archiving-and-compression.md) | [Back to Index](README.md)
