# Streams and Redirection

Every program in a Unix-like system communicates through streams. Understanding how to redirect, combine, and manipulate these streams is fundamental to working on the command line.

---

## Standard Streams

Every process starts with three open file descriptors:

| Stream | File Descriptor | Default | Purpose |
|--------|----------------|---------|---------|
| **STDIN** | 0 | Keyboard | Input to the program |
| **STDOUT** | 1 | Terminal | Normal output |
| **STDERR** | 2 | Terminal | Error messages and diagnostics |

These are just numbers the kernel uses to track open files. The fact that 0, 1, and 2 are pre-assigned is a convention that every Unix program follows.

```bash
# A program reads from STDIN (fd 0), writes output to STDOUT (fd 1),
# and writes errors to STDERR (fd 2)
grep "pattern" < input.txt > output.txt 2> errors.txt
```

```quiz
question: "What happens to stderr when you redirect stdout with > file.txt?"
type: multiple-choice
options:
  - text: "Stderr is also redirected to file.txt"
    feedback: "Only stdout (fd 1) is redirected by >. Stderr (fd 2) continues to the terminal unless explicitly redirected."
  - text: "Stderr still goes to the terminal"
    correct: true
    feedback: "Correct! > only redirects stdout (fd 1). Stderr (fd 2) is a separate stream and continues to the terminal unless you redirect it with 2>."
  - text: "Stderr is suppressed"
    feedback: "Stderr is never automatically suppressed. It continues to the terminal unless you redirect it with 2> or 2>/dev/null."
  - text: "The command fails with an error"
    feedback: "Redirecting stdout is perfectly valid and doesn't affect stderr at all. Both streams are independent."
```

---

## Basic Redirection

### Redirecting STDOUT

Use `>` to send standard output to a file instead of the terminal:

```bash
echo "Hello, World!" > output.txt
```

This creates `output.txt` if it doesn't exist, or **overwrites** it if it does.

### Redirecting STDIN

Use `<` to feed a file into a command's standard input:

```bash
grep "pattern" < input.txt
```

Many commands accept filenames as arguments (`grep "pattern" input.txt`), but STDIN redirection is useful when a command only reads from STDIN, or when you want to make the data flow explicit.

### Redirecting STDERR

Use `2>` to redirect error output:

```bash
find / -name "*.conf" 2> /dev/null
```

This runs `find` and discards all error messages (like "Permission denied") by sending them to `/dev/null`.

### Appending Output

Use `>>` to append instead of overwrite:

```bash
echo "New entry" >> log.txt
echo "Another error" 2>> errors.txt
```

```terminal
title: Redirection Data Flow
steps:
  - command: "echo 'hello' > output.txt"
    output: ""
    narration: "Stdout (fd 1) is redirected to output.txt. Nothing appears on screen because the output went to the file."
  - command: "cat output.txt"
    output: "hello"
    narration: "The file captured what would have gone to the terminal."
  - command: "ls /nonexistent 2> errors.txt"
    output: ""
    narration: "Stderr (fd 2) is redirected to errors.txt. The error message goes to the file, not the screen."
  - command: "cat errors.txt"
    output: "ls: cannot access '/nonexistent': No such file or directory"
    narration: "The error message was captured in the file."
  - command: "ls /etc/hosts /nonexistent > out.txt 2> err.txt"
    output: ""
    narration: "Stdout and stderr go to separate files. Successful output to out.txt, errors to err.txt."
  - command: "cat out.txt"
    output: "/etc/hosts"
    narration: "The successful listing went to stdout, captured in out.txt."
  - command: "cat err.txt"
    output: "ls: cannot access '/nonexistent': No such file or directory"
    narration: "The error went to stderr, captured in err.txt. The two streams are completely independent."
```

---

## Redirecting Both STDOUT and STDERR

There are several ways to combine or separate these streams.

### To the Same File

```bash
# Method 1: redirect STDOUT to file, then STDERR to where STDOUT goes
command > output.txt 2>&1

# Method 2: shorthand (bash)
command &> output.txt

# Method 3: appending both
command >> output.txt 2>&1
command &>> output.txt
```

### To Different Files

```bash
command > stdout.txt 2> stderr.txt
```

### Order Matters

The order of redirections is processed left to right, and it matters:

```bash
# WRONG: redirects STDERR to where STDOUT currently points (terminal),
# then redirects STDOUT to file
command 2>&1 > file.txt    # STDERR still goes to terminal

# RIGHT: redirects STDOUT to file, then STDERR to where STDOUT now points (file)
command > file.txt 2>&1    # both go to file
```

Think of `2>&1` as "make fd 2 point to wherever fd 1 is pointing right now." If fd 1 hasn't been redirected yet, it still points to the terminal.

```quiz
question: "What is the difference between cmd > file 2>&1 and cmd 2>&1 > file?"
type: multiple-choice
options:
  - text: "They are identical - both redirect stdout and stderr to file"
    feedback: "Order matters! In the second form, 2>&1 copies stderr to wherever stdout currently points (the terminal), then > redirects stdout to the file. So stderr goes to the terminal."
  - text: "The first sends both to file; the second sends only stdout to file"
    correct: true
    feedback: "Correct! Redirections are processed left to right. In the first form, stdout goes to file, then stderr goes where stdout is (file). In the second, stderr goes where stdout is (terminal), then stdout moves to file."
  - text: "The first sends only stderr to file; the second sends both"
    feedback: "It's the other way around. The first form captures both streams in the file."
  - text: "The second form is a syntax error"
    feedback: "Both forms are valid syntax. The issue is that they produce different results because redirections are processed left to right."
```

---

## Redirecting to /dev/null

**`/dev/null`** is a special file that discards everything written to it. It's the system's trash can.

```bash
# Discard all output
command > /dev/null 2>&1

# Discard only errors
command 2> /dev/null

# Discard only normal output, see only errors
command > /dev/null
```

A common pattern for checking if a command succeeds without seeing its output:

```bash
if grep -q "pattern" file.txt 2>/dev/null; then
    echo "Found it"
fi
```

```command-builder
base: ""
description: Build a shell redirection to route stdout and stderr
options:
  - flag: ""
    type: select
    label: "Command"
    placeholder: "command to run"
    explanation: "The command whose output you want to redirect"
    choices:
      - ["my_script.sh", "Script"]
      - ["find / -name '*.log'", "Find command"]
      - ["make build", "Build command"]
  - flag: ""
    type: select
    label: "Stdout destination"
    explanation: "Where to send standard output (fd 1)"
    choices:
      - ["> output.txt", "Overwrite file"]
      - [">> output.txt", "Append to file"]
      - ["> /dev/null", "Discard"]
      - ["", "Terminal (default)"]
  - flag: ""
    type: select
    label: "Stderr destination"
    explanation: "Where to send standard error (fd 2)"
    choices:
      - ["2> errors.txt", "Separate error file"]
      - ["2>> errors.txt", "Append to error file"]
      - ["2> /dev/null", "Discard errors"]
      - ["2>&1", "Merge with stdout"]
      - ["", "Terminal (default)"]
```

---

## The noclobber Option

If you're worried about accidentally overwriting files with `>`, you can enable **`noclobber`**:

```bash
set -o noclobber
echo "data" > existing_file.txt   # bash: existing_file.txt: cannot overwrite existing file
```

To force overwrite even with `noclobber` set, use `>|`:

```bash
echo "data" >| existing_file.txt   # works even with noclobber
```

`noclobber` is worth enabling in multi-user environments where multiple people share a server, or in scripts that write to shared log paths. It's also a good safety net during long terminal sessions where you might accidentally redirect to a file you've been building up - one stray `>` instead of `>>` and hours of collected output is gone. Some sysadmins enable it in their `.bashrc` by default and use `>|` for the rare cases they actually want to overwrite.

Disable `noclobber` with:

```bash
set +o noclobber
```

```exercise
title: Redirect Both Streams to a File
difficulty: beginner
scenario: |
  You're running a backup script that produces both normal output and error messages.
  You need to capture everything - both stdout and stderr - into a single log file
  called `backup.log`, while ensuring the file is created fresh each time (not appended).

  Write the command to redirect both streams to the same file using two different methods.
hints:
  - "Method 1: Redirect stdout to the file first, then redirect stderr to where stdout points with 2>&1"
  - "Method 2: Use the bash shorthand &> which redirects both streams at once"
  - "Remember: with method 1, the order matters - stdout redirect must come before 2>&1"
solution: |
  ```bash
  # Method 1: Traditional (works in sh and bash)
  ./backup.sh > backup.log 2>&1

  # Method 2: Bash shorthand
  ./backup.sh &> backup.log

  # To append instead of overwrite:
  ./backup.sh >> backup.log 2>&1
  # or
  ./backup.sh &>> backup.log
  ```

  Both methods capture stdout and stderr in `backup.log`. Method 1 is more portable
  (works in POSIX sh). Method 2 is bash-specific but more readable.
```

---

## Here Documents

A **here document** feeds a block of text into a command's STDIN. The text continues until the shell sees the delimiter on a line by itself.

```bash
cat << EOF
Hello, $USER.
Today is $(date).
EOF
```

Variables and command substitutions are expanded inside here documents. To prevent expansion, quote the delimiter:

```bash
cat << 'EOF'
This is literal: $USER $(date)
No expansion happens here.
EOF
```

### Indented Here Documents

Use `<<-` to strip leading tabs (not spaces) from the content. This is useful for keeping here documents indented inside functions or loops:

```bash
if true; then
	cat <<-EOF
	This text can be indented with tabs.
	The tabs are stripped from the output.
	EOF
fi
```

### Here Strings

A **here string** (`<<<`) passes a single string as STDIN:

```bash
grep "pattern" <<< "search this string for a pattern"

# Useful with variables
data="one two three"
read -r first rest <<< "$data"
echo "$first"    # one
echo "$rest"     # two three
```

```quiz
question: "What is the key difference between a here document (<<EOF) and a here string (<<<)?"
type: multiple-choice
options:
  - text: "Here documents can only contain one line"
    feedback: "It's the opposite - here documents support multiple lines, while here strings are typically single-line."
  - text: "Here strings don't support variable expansion"
    feedback: "Here strings do support variable expansion (unless quoted). The difference is about multi-line vs single-line input."
  - text: "Here documents provide multi-line input; here strings provide single-line input"
    correct: true
    feedback: "Correct! Here documents (<<DELIM) let you provide a block of text spanning multiple lines. Here strings (<<<) feed a single string to stdin. Both support variable expansion by default."
  - text: "Here strings are faster because they use a temporary file"
    feedback: "Here documents typically use temporary files, not here strings. Here strings may use pipes internally. The real difference is multi-line vs single-line."
```

---

## File Descriptor Manipulation

Beyond the three standard streams, you can open and manage additional file descriptors using `exec`.

### Opening File Descriptors

```bash
# Open fd 3 for writing to a file
exec 3> output.txt
echo "Written to fd 3" >&3
echo "More data" >&3
exec 3>&-    # Close fd 3

# Open fd 4 for reading from a file
exec 4< input.txt
read -r line <&4
echo "Read: $line"
exec 4<&-    # Close fd 4

# Open fd 5 for both reading and writing
exec 5<> file.txt
```

### Practical Example: Logging

```bash
# Open a log file on fd 3
exec 3>> /var/log/myscript.log

log() {
    echo "$(date '+%Y-%m-%d %H:%M:%S') $*" >&3
}

log "Script started"
# ... do work ...
log "Script finished"

exec 3>&-    # Close the log file
```

### Swapping STDOUT and STDERR

```bash
# Swap so STDOUT goes to stderr and STDERR goes to stdout
command 3>&1 1>&2 2>&3 3>&-
```

This uses fd 3 as a temporary holding place, similar to swapping two variables with a temp variable.

```code-walkthrough
language: bash
title: The exec File Descriptor Logging Pattern
code: |
  exec 3>> /var/log/app.log
  echo "Starting backup at $(date)" >&3
  tar czf /backup/data.tar.gz /data 2>&3
  echo "Backup complete at $(date)" >&3
  exec 3>&-
annotations:
  - line: 1
    text: "exec with a redirection (no command) opens fd 3 for appending to the log file. This fd stays open for the entire script."
  - line: 2
    text: ">&3 redirects this echo's stdout to fd 3 (the log file). The terminal sees nothing."
  - line: 3
    text: "2>&3 sends tar's stderr to fd 3. Normal tar output still goes to the terminal, but errors go to the log."
  - line: 4
    text: "Another message to the log via fd 3. Having a persistent fd avoids repeatedly opening/closing the file."
  - line: 5
    text: "exec 3>&- closes fd 3. Always close file descriptors when done to free system resources."
```

---

## Pipelines

A **pipeline** connects the STDOUT of one command to the STDIN of the next using the `|` operator:

```bash
ls -la | grep "\.txt" | sort -k5 -n
```

Each command in a pipeline runs in its own subshell, and they all run concurrently. Data flows between them through kernel buffers.

### Pipeline Exit Status

By default, the exit status of a pipeline is the exit status of the **last** command:

```bash
false | true
echo $?    # 0 (true succeeded, even though false failed)
```

Use `set -o pipefail` to make the pipeline return the exit status of the last command that failed:

```bash
set -o pipefail
false | true
echo $?    # 1 (false failed)
```

The **`PIPESTATUS`** array (bash-specific) captures the exit status of every command in the last pipeline:

```bash
cat /nonexistent | grep "pattern" | wc -l
echo "${PIPESTATUS[@]}"    # 1 1 0
echo "${PIPESTATUS[0]}"    # 1 (cat failed)
echo "${PIPESTATUS[2]}"    # 0 (wc succeeded)
```

### Piping STDERR

By default, only STDOUT is piped. To include STDERR in the pipeline:

```bash
# Method 1: redirect STDERR to STDOUT first
command 2>&1 | grep "error"

# Method 2: bash shorthand
command |& grep "error"
```

This is useful when a program writes important data to STDOUT but buries diagnostics in STDERR. For example, filtering compiler warnings without losing the build output:

```bash
# Count errors from a build, ignoring normal output
make 2>&1 >/dev/null | grep -c 'error:'

# Separate error output from data in a script
./process_data.sh 2> >(grep -v 'warning' >> errors.log) > results.txt
```

The `|&` shorthand is convenient for quick debugging, but in scripts, the explicit `2>&1 |` form is clearer about what's happening.

---

## tee

The [**`tee`**](https://www.gnu.org/software/coreutils/manual/) command reads from STDIN and writes to both STDOUT and one or more files simultaneously. It splits the stream.

```bash
# Write to file and still see output on terminal
command | tee output.txt

# Append instead of overwrite
command | tee -a output.txt

# Write to multiple files
command | tee file1.txt file2.txt

# Use in a pipeline
ls -la | tee listing.txt | grep "\.txt"
```

A common use is capturing intermediate output in a pipeline for debugging:

```bash
cat data.csv | tee /dev/stderr | sort -t, -k2 | tee /dev/stderr | uniq -c
```

This prints the data at each pipeline stage to STDERR (your terminal) while the actual data flows through the pipeline.

```quiz
question: "What does the tee command do?"
type: multiple-choice
options:
  - text: "It splits stderr from stdout"
    feedback: "tee doesn't separate streams. It reads from stdin and writes to both stdout and one or more files simultaneously."
  - text: "It reads from stdin and writes to both stdout and a file"
    correct: true
    feedback: "Correct! tee is like a T-junction in plumbing - it copies stdin to stdout AND to one or more named files, letting you save output while still seeing it on screen."
  - text: "It redirects a file to two different commands"
    feedback: "tee reads from stdin, not from files directly. You typically pipe into tee to split the stream."
  - text: "It merges two input streams into one"
    feedback: "tee doesn't merge streams - it duplicates one stream to multiple destinations (stdout plus files)."
```

---

## Named Pipes (FIFOs)

A **named pipe** is a special file that acts as a pipeline between processes. Unlike anonymous pipes (`|`), named pipes have a name in the filesystem and can be used by unrelated processes. The data itself passes through kernel buffers, not through disk.

Create one with [`mkfifo`](https://www.gnu.org/software/coreutils/manual/):

```bash
mkfifo /tmp/mypipe
```

In one terminal, write to the pipe:

```bash
echo "Hello from process A" > /tmp/mypipe
```

In another terminal, read from the pipe:

```bash
cat /tmp/mypipe    # Hello from process A
```

The writer blocks until a reader opens the pipe, and vice versa. This makes named pipes useful for inter-process communication.

Clean up when you're done:

```bash
rm /tmp/mypipe
```

---

## Subshells

A **subshell** is a child copy of the current shell. It inherits the parent's environment but runs in a separate process. Changes made in a subshell don't affect the parent.

### Explicit Subshells

Parentheses create a subshell:

```bash
(cd /tmp && ls)
pwd    # still in original directory
```

```bash
x=10
(x=20; echo "inside: $x")    # inside: 20
echo "outside: $x"           # outside: 10
```

### Where Subshells Appear

Subshells are created in several situations:

- **Parentheses**: `(commands)`
- **Pipelines**: each command in `cmd1 | cmd2 | cmd3` runs in its own subshell
- **Command substitution**: `$(command)`
- **Background processes**: `command &`
- **Process substitution**: `<(command)` and `>(command)`

The pipeline subshell issue is a common gotcha:

```bash
count=0
echo -e "one\ntwo\nthree" | while read -r line; do
    (( count++ ))
done
echo $count    # 0! The while loop ran in a subshell
```

To avoid this in bash 4.2+, use `lastpipe`. Note that `lastpipe` only takes effect when job control is off, so it works in scripts but not in an interactive shell (unless you also run `set +m`):

```bash
#!/bin/bash
shopt -s lastpipe
count=0
echo -e "one\ntwo\nthree" | while read -r line; do
    (( count++ ))
done
echo $count    # 3
```

Or use process substitution instead (works everywhere, including interactive shells):

```bash
count=0
while read -r line; do
    (( count++ ))
done < <(echo -e "one\ntwo\nthree")
echo $count    # 3
```

---

## Process Substitution

**Process substitution** lets you use the output of a command where a filename is expected. It creates a temporary file descriptor that acts like a file.

### Output Process Substitution

`<(command)` provides command output as a readable file:

```bash
diff <(ls dir1) <(ls dir2)
```

This compares the file listings of two directories without creating temporary files. `diff` thinks it's reading two files, but they're actually the output of two `ls` commands.

```bash
# Compare sorted output of two commands
diff <(sort file1.txt) <(sort file2.txt)

# Feed command output to a program that only accepts files
paste <(cut -f1 data.tsv) <(cut -f3 data.tsv)
```

### Input Process Substitution

`>(command)` provides a writable file descriptor:

```bash
# Write to two files simultaneously with different processing
tee >(gzip > compressed.gz) >(wc -l > linecount.txt) > /dev/null < input.txt
```

### What's Actually Happening

Process substitution creates a path like `/dev/fd/63` that the command can open and read from (or write to). You can see this:

```bash
echo <(true)    # /dev/fd/63 (or similar)
```

This is why it works with commands that expect filenames but not with commands that expect STDIN.

```terminal
title: Process Substitution in Action
steps:
  - command: "diff <(ls /usr/bin | head -5) <(ls /usr/sbin | head -5)"
    output: |
      1,5c1,5
      < [
      < 2to3
      < 411toppm
      < GET
      < HEAD
      ---
      > aa-enabled
      > aa-exec
      > aa-features-abi
      > aa-remove-unknown
      > aa-status
    narration: "Process substitution creates temporary file descriptors. diff sees two 'files' - each containing the output of a command."
  - command: "echo <(echo hello)"
    output: "/dev/fd/63"
    narration: "Process substitution creates a /dev/fd path. The command's output is available through this file descriptor."
  - command: "cat <(echo 'from process substitution')"
    output: "from process substitution"
    narration: "Any command that reads files can use process substitution to read from command output instead."
```

```exercise
title: Compare Command Outputs with Process Substitution
difficulty: intermediate
scenario: |
  You need to compare the installed packages on two servers. You have SSH access to both
  `server1` and `server2`. On each server, the command `rpm -qa | sort` lists all installed
  packages in sorted order.

  Using process substitution, write a single command that shows which packages differ
  between the two servers - without creating any temporary files.
hints:
  - "Use diff to compare two inputs"
  - "Process substitution <() lets you use command output as a file argument"
  - "You can nest SSH commands inside process substitution: <(ssh server1 'command')"
solution: |
  ```bash
  diff <(ssh server1 'rpm -qa | sort') <(ssh server2 'rpm -qa | sort')
  ```

  This runs `rpm -qa | sort` on each server via SSH, feeds each output into a process
  substitution, and diff compares them as if they were files. No temp files needed.

  To see only package names that differ (without the diff formatting):
  ```bash
  comm -3 <(ssh server1 'rpm -qa | sort') <(ssh server2 'rpm -qa | sort')
  ```
```

---

## Further Reading

- [Bash Reference Manual - Redirections](https://www.gnu.org/software/bash/manual/) - official documentation on redirection operators and file descriptors
- [GNU Coreutils - tee](https://www.gnu.org/software/coreutils/manual/) - tee invocation and options
- [POSIX Shell Command Language](https://pubs.opengroup.org/onlinepubs/9799919799/) - portable redirection and pipeline semantics

---

**Previous:** [Shell Basics](shell-basics.md) | **Next:** [Text Processing](text-processing.md) | [Back to Index](README.md)
