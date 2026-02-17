# Linux CLI Essentials

A comprehensive guide to working effectively on the Linux command line. These guides take you from "I can type commands" to understanding how the shell actually works and using it productively.

Each topic is covered in its own guide. Start anywhere - they're self-contained, but the order below follows a natural learning path.

---

## Guides

### [Shell Basics](shell-basics.md)

What the shell is, how it starts up, and how it processes your input. Covers shell types, configuration files, the `PATH` variable, variables, quoting rules, and the full set of shell expansions (brace, tilde, parameter, arithmetic, command substitution, and globbing).

### [Streams and Redirection](streams-and-redirection.md)

How programs communicate through STDIN, STDOUT, and STDERR. Covers basic redirection, appending, `/dev/null`, here documents, here strings, file descriptor manipulation, pipelines (exit status, `PIPESTATUS`, named pipes), `tee`, subshells, and process substitution.

### [Text Processing](text-processing.md)

The core toolkit for searching, transforming, and analyzing text. Covers `grep` (with regular expressions - basic, extended, and POSIX classes), `sed` (substitution, addresses, in-place editing), `awk` (fields, patterns, BEGIN/END, variables), `cut`, `sort`, `uniq`, `tr`, `wc`, `head`, `tail`, and `tee`.

### [Finding Files](finding-files.md)

Searching directory trees and operating on the results. Covers `find` (name, type, size, time, permission, and owner tests, depth control, logical operators, and actions) and `xargs` (null-delimited input, placeholder substitution, parallel execution).

### [File Permissions](file-permissions.md)

The Linux permission model explained. Covers reading `ls -l` output, `chmod` (symbolic and octal modes), `chown`, `chgrp`, `umask`, and special permission bits (setuid, setgid, sticky bit) with real-world examples.

### [Job Control](job-control.md)

Managing processes from the terminal. Covers foreground/background processes, `Ctrl-Z`/`bg`/`fg`/`jobs`, signals (`SIGTERM`, `SIGKILL`, etc.), `kill`/`killall`/`pkill`, `nohup`, `disown`, `ps`, `top`/`htop`, and terminal multiplexers (`screen` and `tmux`).

### [Scripting Fundamentals](scripting-fundamentals.md)

Writing reliable bash scripts. Covers exit codes, conditionals (`test`/`[ ]`/`[[ ]]` and their differences), `if`/`elif`/`else`, `case`, `for`/`while`/`until` loops, functions (arguments, return values, local variables), and error handling (`set -euo pipefail`, `trap`).

### [Disk and Filesystem](disk-and-filesystem.md)

Managing storage. Covers `df` (filesystem usage), `du` (directory sizes), `mount`/`umount`, `/etc/fstab`, `lsblk`, partition management (`fdisk`/`parted`), `mkfs`, and `fsck`.

### [Networking](networking.md)

Essential networking from the command line. Covers `ping`/`traceroute`/`mtr`, `curl`/`wget`, `ssh` (keys, config, port forwarding, jump hosts), `scp`/`rsync`, `ss`/`ip`, `dig`/`nslookup`, and `nc` (netcat).

### [System Information](system-information.md)

Understanding what's running on a system. Covers `uname`, `uptime` (and how to interpret load averages), `free` (and what buff/cache means), `lscpu`, `lsof`, `vmstat`, the `/proc` and `/sys` virtual filesystems, and `dmesg`.

### [Archiving and Compression](archiving-and-compression.md)

Bundling and compressing files. Covers `tar` (with gzip, bzip2, and xz), standalone `gzip`/`bzip2`/`xz`, `zip`/`unzip`, and guidance on when to use each format.

### [Best Practices](best-practices.md)

Conventions that prevent real bugs. Covers `set -euo pipefail`, quoting variables, `[[ ]]` vs `[ ]`, `$()` vs backticks, `mktemp`, `shellcheck`, avoiding `ls` parsing, using arrays, portability considerations, and a script template.
