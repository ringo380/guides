# Shell Basics

This guide covers how the shell works under the hood - what it is, how it starts up, how it finds commands, and how it processes what you type before anything runs.

---

## What Is a Shell?

A **shell** is a program that interprets your commands and passes them to the operating system. When you open a terminal, the shell is the program that shows you a prompt and waits for input.

There are several shells in common use:

| Shell | Path | Notes |
|-------|------|-------|
| `bash` | `/bin/bash` | Default on most Linux distributions |
| `zsh` | `/bin/zsh` | Default on macOS since Catalina |
| `sh` | `/bin/sh` | POSIX-compliant, minimal |
| `dash` | `/bin/dash` | Lightweight, used as `/bin/sh` on Debian/Ubuntu |

[**bash**](https://www.gnu.org/software/bash/manual/) is the default on most Linux servers and the shell you'll encounter in nearly every tutorial and sysadmin guide. If you're SSH'd into a Linux box, you're probably running bash.

[**zsh**](https://www.zsh.org/) has better interactive features like smarter tab completion and spelling correction. macOS switched to it as the default because of bash's licensing - newer bash versions are GPLv3, which Apple avoids.

[**dash**](http://gondor.apana.org.au/~herbert/dash/) exists for speed. Debian and Ubuntu use it as `/bin/sh` for system boot scripts because it starts and runs faster than bash. You won't use it interactively, but your system runs hundreds of dash scripts during boot.

**sh** is the [**POSIX**](https://pubs.opengroup.org/onlinepubs/9799919799/) compatibility baseline. Scripts written for `sh` are portable across Unix-like systems. On modern Linux, `/bin/sh` is usually a symlink to dash or bash.

Check which shell you're currently running:

```bash
echo $SHELL      # Your default login shell
echo $0          # The shell running right now
```

These can differ. `$SHELL` is set at login based on `/etc/passwd`. `$0` shows what's actually executing.

To see all available shells on your system:

```bash
cat /etc/shells
```

---

## Login vs Non-Login Shells

The distinction matters because it determines which configuration files get loaded.

A **login shell** is the first shell that starts when you log in to the system - via SSH, a virtual console, or `su -`. It reads a specific set of startup files.

A **non-login shell** is what you get when you open a new terminal window in a desktop environment, or run `bash` from an existing shell. It reads a different set of files.

You can test whether your current shell is a login shell:

```bash
shopt -q login_shell && echo "login" || echo "non-login"
```

An **interactive** shell is one where you type commands at a prompt. A **non-interactive** shell runs a script file without user input.

---

## Configuration File Load Order

Bash reads different files depending on the shell type. Here's the load order:

### Login Shell

1. `/etc/profile` - system-wide, runs for all users
2. Then the **first** of these that exists (in order):
   - `~/.bash_profile`
   - `~/.bash_login`
   - `~/.profile`

On logout, bash reads `~/.bash_logout` if it exists.

### Non-Login Interactive Shell

1. `~/.bashrc`

This is why most people put their aliases and prompt customizations in `~/.bashrc`, and then source it from `~/.bash_profile`:

```bash
# ~/.bash_profile
if [ -f ~/.bashrc ]; then
    source ~/.bashrc
fi
```

### Zsh (for comparison)

Zsh has its own load order:

1. `/etc/zshenv` then `~/.zshenv` (always)
2. `/etc/zprofile` then `~/.zprofile` (login shells)
3. `/etc/zshrc` then `~/.zshrc` (interactive shells)
4. `/etc/zlogin` then `~/.zlogin` (login shells)

---

## Sourcing Files

**Sourcing** a file runs it in the current shell rather than in a subshell. This means any variables, functions, or settings defined in the file affect your current session.

```bash
source ~/.bashrc
# or equivalently:
. ~/.bashrc
```

The dot (`.`) is the POSIX-compatible way to source a file. `source` is a bash built-in that does the same thing.

If you run a script normally (`bash script.sh` or `./script.sh`), it executes in a new subshell. Any variables it sets disappear when it finishes.

```bash
# This sets VAR in a subshell - your current shell won't see it
bash -c 'VAR=hello'
echo $VAR    # empty

# This sets VAR in the current shell
source <(echo 'VAR=hello')
echo $VAR    # hello
```

---

## The PATH Variable

When you type a command like `ls`, the shell needs to find the actual program to run. It does this by searching through directories listed in the **`PATH`** environment variable.

```bash
echo $PATH
```

This prints a colon-separated list of directories:

```
/usr/local/bin:/usr/bin:/bin:/usr/sbin:/sbin
```

The shell searches these directories left to right and runs the first match it finds. If the command isn't found in any `PATH` directory, you get `command not found`.

To add a directory to your `PATH`:

```bash
# Prepend (searched first)
export PATH="/opt/mytools/bin:$PATH"

# Append (searched last)
export PATH="$PATH:$HOME/bin"
```

Put `PATH` modifications in `~/.bashrc` or `~/.bash_profile` to make them permanent.

---

## Finding Commands

The shell provides several ways to find out what a command actually is and where it lives.

**`type`** - shows how the shell interprets a command:

```bash
type ls        # ls is aliased to 'ls --color=auto'
type cd        # cd is a shell builtin
type bash      # bash is /usr/bin/bash
type if        # if is a shell keyword
```

**`which`** - searches `PATH` for the command's location:

```bash
which python3  # /usr/bin/python3
```

`which` only finds external commands. It won't find builtins or aliases.

**`command -v`** - the POSIX-portable way to check if a command exists:

```bash
command -v git   # /usr/bin/git
command -v cd    # cd (builtin)
```

This is the preferred method for scripts because it works across shells and handles builtins:

```bash
if command -v docker &>/dev/null; then
    echo "Docker is installed"
fi
```

---

## Variables

### Shell Variables vs Environment Variables

A **shell variable** exists only in the current shell session:

```bash
greeting="hello"
echo $greeting    # hello
```

An **environment variable** is exported to child processes. Any program you launch from the shell can read it:

```bash
export API_KEY="abc123"
# or:
API_KEY="abc123"
export API_KEY
```

To see all environment variables:

```bash
env       # or: printenv
```

To see all shell variables (including non-exported ones):

```bash
set
```

To remove a variable:

```bash
unset greeting
```

### Variable Naming

Variable names can contain letters, numbers, and underscores. They cannot start with a number. By convention, environment variables use `UPPER_CASE` and local shell variables use `lower_case`.

```bash
MY_CONFIG="/etc/app.conf"    # conventional naming for an env var (export separately)
counter=0                     # local shell variable
```

### Referencing Variables

Use `$VARIABLE` or `${VARIABLE}` to reference a variable's value:

```bash
name="world"
echo "Hello $name"       # Hello world
echo "Hello ${name}"     # Hello world
```

Braces are required when the variable name could be ambiguous:

```bash
fruit="apple"
echo "$fruits"       # empty - shell looks for variable 'fruits'
echo "${fruit}s"     # apples
```

---

## Quoting

Quoting controls how the shell interprets special characters.

### Double Quotes

**Double quotes** preserve whitespace and prevent word splitting and pathname expansion, but allow variable expansion and command substitution:

```bash
name="Ryan Robson"
echo $name       # Ryan Robson (two arguments to echo - works by coincidence)
echo "$name"     # Ryan Robson (one argument to echo - correct)

files="*.txt"
echo $files      # expands to matching filenames
echo "$files"    # literally: *.txt
```

### Single Quotes

**Single quotes** preserve everything literally. No expansion of any kind happens inside single quotes:

```bash
echo '$HOME'           # literally: $HOME
echo '$(whoami)'       # literally: $(whoami)
echo 'it'\''s here'    # it's here (break out and back in to include a single quote)
```

### No Quotes

Without quotes, the shell performs word splitting, pathname expansion, and variable expansion. This is usually not what you want for strings that might contain spaces:

```bash
file="my document.txt"
cat $file        # tries to open 'my' and 'document.txt' separately
cat "$file"      # opens 'my document.txt' correctly
```

### Escaping with Backslash

A **backslash** (`\`) escapes a single character, removing its special meaning:

```bash
echo "The price is \$5"    # The price is $5
echo "She said \"hi\""     # She said "hi"
```

### Word Splitting and IFS

When the shell expands an unquoted variable, it splits the result into separate words based on the **`IFS`** (Internal Field Separator) variable. By default, `IFS` contains space, tab, and newline.

```bash
data="one:two:three"

# Default IFS - no splitting on colons
for item in $data; do echo "$item"; done
# one:two:three

# Custom IFS
IFS=":"
for item in $data; do echo "$item"; done
# one
# two
# three
```

Always reset `IFS` after changing it, or set it only in a subshell:

```bash
(IFS=":"; for item in $data; do echo "$item"; done)
```

---

## Shell Expansions

The shell processes your command line through several expansion stages before executing anything. Understanding the order helps you predict what the shell will do with your input.

### Order of Expansion

1. Brace expansion
2. Tilde expansion
3. Parameter and variable expansion
4. Arithmetic expansion
5. Command substitution (left to right)
6. Word splitting
7. Pathname expansion (globbing)
8. Quote removal

Otherwise known as:
_Big Tasty Pies Always Come With Perfect Quiche._

### Brace Expansion

**Brace expansion** generates strings. It happens before any other expansion, so it works even with non-existent files.

Lists:

```bash
echo {a,b,c}           # a b c
echo file.{txt,md,sh}  # file.txt file.md file.sh
mkdir -p project/{src,tests,docs}
```

Sequences:

```bash
echo {1..5}            # 1 2 3 4 5
echo {a..f}            # a b c d e f
echo {01..10}          # 01 02 03 04 05 06 07 08 09 10
echo {0..20..5}        # 0 5 10 15 20 (step of 5)
```

Combinations:

```bash
echo {A,B}{1,2}        # A1 A2 B1 B2
```

### Tilde Expansion

**Tilde expansion** converts `~` to directory paths:

```bash
echo ~           # /home/ryan (your home directory)
echo ~root       # /root (root's home directory)
echo ~+         # current working directory ($PWD)
echo ~-         # previous working directory ($OLDPWD)
```

### Parameter Expansion

**Parameter expansion** is how the shell substitutes variable values. Beyond basic `${var}`, bash supports several transformations:

Default values:

```bash
echo ${name:-"Anonymous"}     # Use "Anonymous" if name is unset or empty
echo ${name:="Anonymous"}     # Same, but also assign the default to name
echo ${name:+"has a name"}    # If name is set and non-empty, use "has a name"
echo ${name:?"name is required"}  # If name is unset or empty, print error and exit
```

String length:

```bash
path="/usr/local/bin"
echo ${#path}                 # 14
```

Substring removal:

```bash
file="archive.tar.gz"
echo ${file%.*}       # archive.tar  (remove shortest match from end)
echo ${file%%.*}      # archive      (remove longest match from end)
echo ${file#*.}       # tar.gz       (remove shortest match from start)
echo ${file##*.}      # gz           (remove longest match from start)
```

A handy mnemonic: `#` is on the left side of `$` on the keyboard (removes from the left), `%` is on the right (removes from the right).

String replacement:

```bash
text="hello world hello"
echo ${text/hello/goodbye}    # goodbye world hello  (first match)
echo ${text//hello/goodbye}   # goodbye world goodbye (all matches)
```

Substring extraction:

```bash
str="Hello World"
echo ${str:6}       # World       (from position 6 to end)
echo ${str:0:5}     # Hello       (from position 0, length 5)
```

Case modification (bash 4+):

```bash
name="hello world"
echo ${name^}       # Hello world  (capitalize first character)
echo ${name^^}      # HELLO WORLD  (capitalize all)

upper="HELLO"
echo ${upper,}      # hELLO        (lowercase first character)
echo ${upper,,}     # hello         (lowercase all)
```

### Arithmetic Expansion

**Arithmetic expansion** evaluates mathematical expressions:

```bash
echo $(( 5 + 3 ))       # 8
echo $(( 10 / 3 ))      # 3 (integer division)
echo $(( 10 % 3 ))      # 1 (modulo)
echo $(( 2 ** 10 ))     # 1024 (exponentiation)

count=5
echo $(( count + 1 ))   # 6 (no $ needed inside $(( )))
(( count++ ))            # increment count
```

### Command Substitution

**Command substitution** captures the output of a command and inserts it into the command line:

```bash
today=$(date +%Y-%m-%d)
echo "Today is $today"

# Backtick syntax (older, harder to nest - prefer $())
today=`date +%Y-%m-%d`
```

Command substitutions can be nested:

```bash
echo "Files in $(basename $(pwd)): $(ls | wc -l)"
```

### Pathname Expansion (Globbing)

**Pathname expansion** matches filenames using wildcard patterns:

| Pattern | Matches |
|---------|---------|
| `*` | Any string of characters (including empty) |
| `?` | Any single character |
| `[abc]` | Any one of `a`, `b`, or `c` |
| `[a-z]` | Any character in the range `a` through `z` |
| `[^abc]` or `[!abc]` | Any character NOT `a`, `b`, or `c` |

```bash
ls *.txt          # all .txt files
ls file?.log      # file1.log, fileA.log, etc.
ls [Mm]akefile    # Makefile or makefile
ls log[0-9].txt   # log0.txt through log9.txt
```

Globbing only matches filenames that exist. If no files match, the pattern is passed through literally (unless `failglob` or `nullglob` is set).

Hidden files (starting with `.`) are not matched by `*` unless you enable `dotglob`:

```bash
shopt -s dotglob    # now * matches hidden files too
```

Extended globbing (enabled with `shopt -s extglob`):

```bash
shopt -s extglob
ls !(*.log)          # everything except .log files
ls *(pattern)        # zero or more matches
ls +(pattern)        # one or more matches
ls ?(pattern)        # zero or one match
ls @(pat1|pat2)      # exactly one of the patterns
```

Extended globs are most useful for selecting everything *except* certain files. For example, to delete everything in a directory except `.conf` files:

```bash
shopt -s extglob
rm !(*.conf)
```

Or match multiple extensions at once:

```bash
ls *.@(jpg|png|gif)    # all image files
cp !(*.log|*.tmp) /backup/    # copy everything except logs and temp files
```

Without extglob, you'd need `find` with `-not` flags to achieve the same thing.

---

## Further Reading

- [Bash Reference Manual](https://www.gnu.org/software/bash/manual/) - comprehensive guide to bash syntax, builtins, and behavior
- [Zsh Documentation](https://www.zsh.org/) - official zsh project and manual
- [POSIX Shell Command Language](https://pubs.opengroup.org/onlinepubs/9799919799/) - the portable shell specification
- [dash](http://gondor.apana.org.au/~herbert/dash/) - Debian Almquist Shell project page

---

**Next:** [Streams and Redirection](streams-and-redirection.md) | [Back to Index](README.md)
