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

!!! danger "Without set -u, unset variable in rm -rf expands to empty"

    This is one of the most dangerous scripting bugs. `rm -rf "$UNSET_VAR/"` becomes `rm -rf /` when the variable is empty. The **`-u`** option makes bash abort immediately on any reference to an unset variable, turning a catastrophic silent failure into a clear error message.

**`set -o pipefail`** - a pipeline fails if any command in it fails:

```bash
set -o pipefail
cat /nonexistent | sort        # pipeline returns non-zero (cat failed)
```

Without `pipefail`, only the exit code of the last command (`sort`) matters, hiding the `cat` failure.

```quiz
question: "Which of these commands would NOT trigger set -e to exit the script?"
type: multiple-choice
options:
  - text: "A command that returns exit code 1"
    feedback: "A bare command with non-zero exit does trigger set -e. The exceptions are commands in specific syntactic positions."
  - text: "A command in an if condition: if failing_cmd; then ..."
    correct: true
    feedback: "Correct! Commands used as conditions in if, while, until, or as part of && and || chains are exempt from set -e. The shell needs to evaluate their exit code to make a decision, so it can't abort on failure there."
  - text: "A command at the beginning of the script"
    feedback: "Position in the script doesn't matter. set -e applies to any command not in an exempt position (if condition, && chain, etc.)."
  - text: "A command run with sudo"
    feedback: "sudo doesn't bypass set -e. If the sudo command fails, set -e will still trigger (unless it's in an exempt position like an if condition)."
```

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

```quiz
question: "What's wrong with: [ -f $file ] (without quotes around $file)?"
type: multiple-choice
options:
  - text: "Nothing - [ ] handles unquoted variables correctly"
    feedback: "[ ] is an external command and is affected by word splitting. If $file is empty, it becomes [ -f ] which is a different test entirely."
  - text: "If $file is empty or contains spaces, the test breaks or tests the wrong thing"
    correct: true
    feedback: "Correct! If file is empty, [ -f ] tests if '-f' is a non-empty string (always true!). If file contains spaces, word splitting creates extra arguments and [ throws a 'too many arguments' error. Always quote: [ -f \"$file\" ]"
  - text: "The -f flag requires an absolute path"
    feedback: "-f works with any path (relative or absolute). The issue is word splitting and empty variable handling without quotes."
  - text: "[ ] doesn't support the -f flag"
    feedback: "[ ] (test) fully supports -f. The problem is that unquoted variables undergo word splitting, which breaks the syntax."
```

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

!!! tip "Use shellcheck in CI/CD pipelines"

    Add `shellcheck *.sh` to your CI pipeline to catch bugs automatically on every commit. ShellCheck's exit code is non-zero when it finds issues, making it easy to integrate. Use `# shellcheck disable=SC2086` comments to suppress specific warnings when you know what you're doing.

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

```quiz
question: "What is ShellCheck?"
type: multiple-choice
options:
  - text: "A shell that runs scripts in a sandbox"
    feedback: "ShellCheck doesn't execute scripts. It's a static analysis tool that reads your script and finds issues without running it."
  - text: "A static analysis tool that finds bugs and style issues in shell scripts"
    correct: true
    feedback: "Correct! ShellCheck analyzes shell scripts without running them, catching common bugs like unquoted variables, useless cat, incorrect test syntax, and non-portable constructs. Each finding includes a wiki link explaining the issue and fix."
  - text: "A replacement for bash with better error messages"
    feedback: "ShellCheck isn't a shell - it's a linter/analyzer. It reads your bash/sh scripts and reports issues, similar to how ESLint works for JavaScript."
  - text: "A security scanner that checks for vulnerable commands"
    feedback: "While ShellCheck can catch some security issues (like unquoted variables vulnerable to injection), it's primarily a general-purpose shell script linter, not a security-focused tool."
```

```exercise
title: Fix a Buggy Script Using ShellCheck Principles
difficulty: intermediate
scenario: |
  The following script has multiple common shell scripting bugs. Identify and fix
  all the issues. There are at least 6 problems:

  ```bash
  #!/bin/bash

  dir=$1
  files=`ls $dir`
  count=0

  for f in $files; do
    if [ -f $dir/$f ]; then
      size=`du -sh $dir/$f | awk '{print $1}'`
      echo "File: $f Size: $size"
      count=$count+1
    fi
  done

  echo "Total files: $count"
  ```
hints:
  - "Missing set -euo pipefail at the top"
  - "Never parse ls output - use a glob pattern instead: for f in \"$dir\"/*"
  - "All variable references need double quotes to handle spaces in filenames"
  - "Backticks should be replaced with $() for readability and nestability"
  - "count=$count+1 doesn't do arithmetic - it creates the string '0+1'. Use $(( )) for math"
  - "The script doesn't check if $1 was provided or if the directory exists"
solution: |
  ```bash
  #!/bin/bash
  set -euo pipefail

  dir="${1:?Usage: $0 <directory>}"

  if [[ ! -d "$dir" ]]; then
      echo "Error: '$dir' is not a directory" >&2
      exit 1
  fi

  count=0

  for f in "$dir"/*; do
      if [[ -f "$f" ]]; then
          size=$(du -sh "$f" | awk '{print $1}')
          echo "File: $(basename "$f") Size: $size"
          (( count++ ))
      fi
  done

  echo "Total files: $count"
  ```

  Fixes applied:
  1. Added `set -euo pipefail` for safety
  2. Added input validation with `${1:?}` and directory check
  3. Replaced `` `ls $dir` `` with glob `"$dir"/*`
  4. Quoted all variable references
  5. Replaced backticks with `$()`
  6. Fixed arithmetic: `count=$count+1` → `(( count++ ))`
  7. Used `[[ ]]` instead of `[ ]` for safer conditionals
```

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

!!! warning "Globbing handles spaces correctly where ls parsing does not"

    Shell **globbing** (`for f in *.txt`) expands filenames as properly quoted tokens, so `my file.txt` stays as one argument. Parsing `ls` output (`for f in $(ls)`) splits on whitespace, turning `my file.txt` into two separate arguments: `my` and `file.txt`. Globbing is both safer and simpler.

```quiz
question: "Why is it dangerous to parse the output of ls in scripts?"
type: multiple-choice
options:
  - text: "ls is too slow for scripts"
    feedback: "Speed isn't the issue. ls output is unreliable for programmatic use because filenames can contain unexpected characters."
  - text: "ls doesn't exist on all Unix systems"
    feedback: "ls is universally available. The problem is that its output format is ambiguous when filenames contain spaces, newlines, or special characters."
  - text: "Filenames with spaces, newlines, or special characters break ls output parsing"
    correct: true
    feedback: "Correct! ls output is designed for humans, not scripts. A filename with spaces looks like multiple files, and filenames with newlines create phantom entries. Use glob patterns (for f in *.txt) or find -print0 | xargs -0 instead."
  - text: "ls output format changes based on the locale"
    feedback: "While locale does affect ls formatting (dates, etc.), the main issue is that filenames with special characters make ls output ambiguous to parse."
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

!!! tip "Use mapfile to read files into arrays"

    **`mapfile -t lines < file.txt`** (also called `readarray`) reads an entire file into an array with one element per line. The `-t` flag strips trailing newlines. This is safer than `lines=($(cat file))` which breaks on spaces and globbing characters.

```exercise
title: Rewrite a Script with Proper Quoting and Arrays
difficulty: intermediate
scenario: |
  This script tries to process a list of filenames that may contain spaces.
  It's completely broken. Rewrite it using arrays and proper quoting:

  ```bash
  #!/bin/bash
  filelist="My Documents/report.txt
  Project Files/data.csv
  backup 2024.tar.gz"

  for file in $filelist; do
    if [ -f $file ]; then
      cp $file /backup/
      echo Copied $file
    fi
  done
  ```
hints:
  - "Use a bash array instead of a newline-separated string: files=(...)"
  - "Quote the array expansion: for file in \"${files[@]}\""
  - "Quote every variable reference: \"$file\", not $file"
  - "\"${files[@]}\" expands each element as a separate quoted word"
solution: |
  ```bash
  #!/bin/bash
  set -euo pipefail

  files=(
      "My Documents/report.txt"
      "Project Files/data.csv"
      "backup 2024.tar.gz"
  )

  for file in "${files[@]}"; do
      if [[ -f "$file" ]]; then
          cp "$file" /backup/
          echo "Copied $file"
      fi
  done
  ```

  Key changes:
  - **Array** instead of string: each filename is a separate element
  - **"${files[@]}"** expands to each element as a separate word
  - **"$file"** is quoted everywhere to prevent word splitting
  - **[[ ]]** instead of [ ] for safer tests
  - `echo "Copied $file"` is quoted to prevent globbing of any special characters
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

!!! warning "#!/bin/sh may not be bash on all systems"

    On **Debian**, **Ubuntu**, and **Alpine**, `/bin/sh` is **`dash`** (or `ash`), not bash. If your script uses `[[ ]]`, arrays, `$RANDOM`, process substitution, or any bash-specific feature, it will silently break or produce wrong results under `dash`. Always use `#!/bin/bash` for bash scripts.

**When to target POSIX sh:** Docker scratch images and minimal containers often only have `/bin/sh` (usually dash or busybox ash). Cron jobs on minimal systems may run under `sh` by default. CI/CD pipeline scripts that need to run across different environments (Alpine Linux, Ubuntu, macOS) are safer with POSIX sh. **When bash is fine:** application scripts, developer tools, interactive helpers, and anything where you control the execution environment. If you're writing a deployment script that only runs on your Ubuntu servers, use bash and enjoy its features - forcing POSIX compatibility on a known-bash environment just makes the code harder to read.

---

## Avoid Common Pitfalls

### Don't Use eval

!!! danger "eval is almost always a security risk"

    **`eval`** interprets its arguments as shell code, meaning any user-controlled input becomes executable commands. An attacker passing `; rm -rf /` as input to `eval "process $input"` gets arbitrary command execution. Use **indirect expansion** (`${!var}`), **associative arrays**, or **`declare -n`** nameref variables instead.

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

!!! tip "Use readonly for configuration constants"

    Declare values that should never change with **`readonly`**: paths, URLs, retry counts, and other configuration. If any code accidentally tries to reassign a `readonly` variable, bash raises an error immediately rather than silently using the wrong value.

### Use Epoch Timestamps

For log files and backups, use epoch timestamps or ISO dates to avoid collisions and ensure sorting:

```bash
# Epoch seconds
logfile="deploy_$(date +%s).log"

# ISO format (human-readable and sortable)
logfile="deploy_$(date +%Y%m%d_%H%M%S).log"
```

---

!!! tip "Always use --dry-run when available before destructive operations"

    Many commands offer a **`--dry-run`** (or `-n`) flag that shows what *would* happen without actually doing it. Use it before `rsync --delete`, `rm -rf`, `apt autoremove`, `git clean`, and similar destructive operations. The few seconds spent previewing can prevent hours of recovery work.

## Script Template

<div class="diagram-container">
<img src="../../assets/images/linux-essentials/script-template-structure.svg" alt="Ideal script structure showing shebang, readonly constants, utility functions, cleanup trap, usage, main function, arg parsing, business logic, and main call at bottom">
</div>

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

```code-walkthrough
language: bash
title: Production-Ready Script Template
code: |
  #!/bin/bash
  set -euo pipefail

  readonly PROG="$(basename "$0")"
  readonly ARGS=("$@")

  usage() {
      cat <<EOF
  Usage: $PROG [OPTIONS] <input>
    -o FILE   Output file (default: stdout)
    -v        Verbose mode
    -h        Show this help
  EOF
      exit "${1:-0}"
  }

  log() { echo "[$PROG] $*" >&2; }
  die() { log "ERROR: $*"; exit 1; }

  main() {
      local output="" verbose=false

      while getopts ":o:vh" opt; do
          case "$opt" in
              o) output="$OPTARG" ;;
              v) verbose=true ;;
              h) usage 0 ;;
              :) die "Option -$OPTARG requires an argument" ;;
              ?) die "Unknown option: -$OPTARG" ;;
          esac
      done
      shift $((OPTIND - 1))

      [[ $# -lt 1 ]] && usage 1
      local input="$1"

      [[ -f "$input" ]] || die "File not found: $input"

      $verbose && log "Processing $input"

      if [[ -n "$output" ]]; then
          process "$input" > "$output"
      else
          process "$input"
      fi
  }

  process() {
      local file="$1"
      wc -l "$file"
  }

  main "${ARGS[@]}"
annotations:
  - line: 2
    text: "The safety trio: -e (exit on error), -u (error on unset variables), -o pipefail (catch pipe failures)."
  - line: 4
    text: "readonly prevents accidental modification. Store the program name for usage messages and logging."
  - line: 5
    text: "Save the original arguments in an array before they get shifted away by option processing."
  - line: 7
    text: "A usage function that accepts an exit code. Called with 0 for -h (help), 1 for errors."
  - line: 17
    text: "Utility functions for consistent logging. >&2 sends to stderr so stdout stays clean for data."
  - line: 20
    text: "Wrapping logic in main() keeps variables local and prevents accidental globals."
  - line: 23
    text: "getopts handles single-character flags. The leading : in ':o:vh' enables silent error handling."
  - line: 32
    text: "shift removes processed options, leaving only positional arguments in $@."
  - line: 34
    text: "Validate required arguments early. Fail fast with a helpful message."
  - line: 48
    text: "Separate processing logic into its own function for testability and clarity."
  - line: 53
    text: "Call main with the saved arguments. This pattern ensures the entire script is parsed before execution."
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
