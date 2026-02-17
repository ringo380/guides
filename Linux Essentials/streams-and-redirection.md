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

Disable `noclobber` with:

```bash
set +o noclobber
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

---

## Pipelines

A **pipeline** connects the STDOUT of one command to the STDIN of the next using the `|` operator:

```bash
ls -la | grep ".txt" | sort -k5 -n
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

---

## tee

The **`tee`** command reads from STDIN and writes to both STDOUT and one or more files simultaneously. It splits the stream.

```bash
# Write to file and still see output on terminal
command | tee output.txt

# Append instead of overwrite
command | tee -a output.txt

# Write to multiple files
command | tee file1.txt file2.txt

# Use in a pipeline
ls -la | tee listing.txt | grep ".txt"
```

A common use is capturing intermediate output in a pipeline for debugging:

```bash
cat data.csv | tee /dev/stderr | sort -t, -k2 | tee /dev/stderr | uniq -c
```

This prints the data at each pipeline stage to STDERR (your terminal) while the actual data flows through the pipeline.

---

## Named Pipes (FIFOs)

A **named pipe** is a special file that acts as a pipeline between processes. Unlike anonymous pipes (`|`), named pipes exist as files on disk and can be used by unrelated processes.

Create one with `mkfifo`:

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

To avoid this in bash 4.2+, use `lastpipe`:

```bash
shopt -s lastpipe
count=0
echo -e "one\ntwo\nthree" | while read -r line; do
    (( count++ ))
done
echo $count    # 3
```

Or use process substitution instead:

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
