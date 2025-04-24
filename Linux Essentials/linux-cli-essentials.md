# Linux CLI Essentials

## Introduction

This guide introduces key concepts necessary for complex shell scripting behavior, including streams, redirection, pipelines, subshells, and process substitution. These are fundamental to shell operation in Unix-like systems.

---

## Table of Contents

- [Streams](#streams)
  - [Standard Streams](#standard-streams)
- [Redirection](#redirection)
  - [Basic Redirection](#basic-redirection)
  - [Appending Output](#appending-output)
  - [Redirecting Both STDOUT and STDERR](#redirecting-both-stdout-and-stderr)
- [Here Documents](#here-documents)
- [Pipelines](#pipelines)
- [Subshells](#subshells)
- [Process Substitution](#process-substitution)
- [Best Practices](#best-practices)
- [Finding Files with `find`](#finding-files-with-find)
  - [Introduction to `find`](#introduction-to-find)
  - [Tests and Actions in `find`](#tests-and-actions-in-find)
- [Grep and Regular Expressions](#grep-and-regular-expressions)
  - [Basic Regular Expressions](#basic-regular-expressions)

---

## Streams

### Standard Streams

In Unix-like systems, every program operates with three standard streams that are automatically opened upon startup:

1. **STDIN (Standard Input)**: Stream used for input, which can be provided from files, peripherals, or other programs. It has a file descriptor of 0.
2. **STDOUT (Standard Output)**: Stream used for output (non-error data), typically displayed in the terminal. Its file descriptor is 1.
3. **STDERR (Standard Error)**: Stream used for error messages and diagnostics. It has a file descriptor of 2.

These file descriptors allow you to manipulate these streams for redirection.

---

## Redirection

### Basic Redirection

Redirection is a powerful concept that allows you to control where your input and output go. You can redirect input or output streams to files or other commands.

- **Redirecting STDOUT**: 
  ```bash
  echo "Hello, World!" > output.txt
  ```
  This command writes "Hello, World!" to `output.txt`. If the file exists, it will be overwritten.

- **Redirecting STDIN**:
  ```bash
  grep "pattern" < input.txt
  ```
  This command uses `input.txt` as input for `grep`.

### Appending Output

If you want to append output to a file instead of overwriting it, use the `>>` operator:

```bash
echo "Another line" >> output.txt
```
This adds "Another line" to the end of `output.txt`.

### Redirecting Both STDOUT and STDERR

Sometimes you may want to redirect both standard output and standard error to the same file. Here are a few methods:

- **Redirecting both to a file**:
  ```bash
  command > output.txt 2>&1
  ```
  Or:
  ```bash
  command &> output.txt
  ```

- **Redirecting only STDERR**:
  ```bash
  command 2> error.txt
  ```

---

## Here Documents

A **Here Document** allows you to provide multiple lines of input to a command via redirection until a specified delimiter is reached.

```bash
cat > list.txt << "EOF"
This is a line of text.
Another line of text.
EOF
```
This will write the specified lines to `list.txt`.

Here Documents are often used with commands that require structured input, like `cat` or scripting.

---

## Pipelines

A **pipeline** passes the standard output of one command as the standard input to another command, using the pipe operator `|`.

For example:
```bash
ls -l | grep ".txt"
```
This command lists the files in the current directory and filters them for `.txt` files.

Pipelines are extremely useful for chaining together commands and processing data in a step-by-step fashion.

---

## Subshells

A **subshell** is a child process spawned by the shell. When commands are run in a pipeline, each command typically runs in its own subshell.

Subshells inherit the environment from their parent shell, but any changes to the environment (e.g., setting a variable) in the subshell do not affect the parent shell.

Example:
```bash
(cd /tmp && ls)
pwd
```
Even though the `cd` command changes the directory in the subshell, the `pwd` command runs in the parent shell, so it will still print the original working directory.

---

## Process Substitution

**Process Substitution** is an advanced feature in bash that allows the output of a command to be used as if it were a file. It provides a way to treat processes as files and redirect their input or output.

- **Example**:
  ```bash
  cat <(ls -lh)
  ```
  Here, `ls -lh` is treated as a file, and its output is passed to `cat`.

Process substitution is useful when you need to compare or combine output from multiple commands, but a program expects a file as input.

---

## Best Practices

### Avoid Truncating Files
When redirecting output, always be careful to avoid accidentally truncating important files. Use `>>` to append instead of `>` if you're unsure.

- **Bad**: `echo "data" > important.txt` (this will overwrite `important.txt`).
- **Good**: `echo "data" >> important.txt` (this will append to `important.txt`).

### Use Epoch Timestamps for Logs
When creating log files, it's useful to include a timestamp in the filename:
```bash
echo "Log entry" > log_$(date +%s).txt
```
This ensures that your logs have unique filenames.

---

## Finding Files with `find`

### Introduction to `find`

The `find` command is a versatile tool for searching files and directories. It can be used to search based on name, size, modification date, and other criteria.

### Basic Usage

- **Find files by name**:
  ```bash
  find . -name "*.txt"
  ```
  This finds all files with a `.txt` extension in the current directory and its subdirectories.

### Tests and Actions in `find`

- **Test for file type**: 
  ```bash
  find /path/to/search -type f
  ```
  This finds all regular files in the specified directory.

- **Find files by size**: 
  ```bash
  find . -size +1M
  ```
  This finds files larger than 1MB.

- **Using `-exec` to execute a command on each result**:
  ```bash
  find . -type f -exec ls -lh {} \;
  ```
  This command finds all regular files and lists them using `ls -lh`.

### Combining Tests with Logical Operators

You can combine tests with logical operators like `-and`, `-or`, and `!` (negation). For example:
```bash
find . -type f -name "*.txt" -or -name "*.log"
```
This finds all `.txt` and `.log` files in the current directory.

---

## Grep and Regular Expressions

### Introduction to `grep`

The `grep` command searches for patterns within files. It can be used with regular expressions to perform complex pattern matching.

### Basic `grep` Usage

- **Search for a pattern**:
  ```bash
  grep "pattern" file.txt
  ```
  This searches for lines containing "pattern" in `file.txt`.

### Useful `grep` Options

- **Case-insensitive search**:
  ```bash
  grep -i "pattern" file.txt
  ```

- **Invert match (show lines that do not contain the pattern)**:
  ```bash
  grep -v "pattern" file.txt
  ```

- **Show only the matched part of the line**:
  ```bash
  grep -o "pattern" file.txt
  ```

### Basic Regular Expressions

- `^`: Anchors a match to the start of a line.
  ```bash
  grep "^robworks" file.txt
  ```

- `$`: Anchors a match to the end of a line.
  ```bash
  grep "pattern$" file.txt
  ```

- `.`: Matches any single character.
  ```bash
  grep "gr.p" file.txt
  ```

### Extended Regular Expressions

Extended regular expressions allow for more powerful pattern matching. To enable them in `grep`, use the `-E` option:
```bash
grep -E "pattern1|pattern2" file.txt
```
This searches for either "pattern1" or "pattern2".

---

## Conclusion

This guide covers critical shell concepts such as streams, redirection, pipelines, subshells, process substitution, and using tools like `find` and `grep`. By understanding and mastering these concepts, you can work more efficiently in Unix-like environments, automating tasks and processing data seamlessly.
