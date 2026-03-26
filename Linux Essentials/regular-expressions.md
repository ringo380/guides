# Regular Expressions

Regular expressions are pattern-matching rules used to search, match, and manipulate text. On Linux, they're everywhere - `grep` uses them to search files, `sed` uses them for substitutions, `awk` uses them for pattern matching, `find` uses them for filename matching, and bash's `[[ ]]` supports them natively. The [Text Processing guide](text-processing.md) uses regex patterns throughout; this guide teaches the language itself.

---

## Metacharacters

Most characters in a regex match themselves literally. The character `a` matches the letter "a", `hello` matches the string "hello". But certain characters have special meaning:

```
.  ^  $  *  +  ?  {  }  [  ]  (  )  |  \
```

These are **metacharacters**. To match them literally, escape them with a backslash: `\.` matches an actual period, `\$` matches a dollar sign.

```bash
# Match lines containing a literal period
grep '\.' /etc/hosts

# Match lines containing a dollar sign
grep '\$' script.sh
```

---

## Anchors

Anchors match positions, not characters.

| Anchor | Matches |
|--------|---------|
| `^` | Start of line |
| `$` | End of line |
| `\b` | Word boundary (PCRE/ERE) |
| `\B` | Non-word boundary |

```bash
# Lines starting with "error"
grep '^error' /var/log/syslog

# Lines ending with a number
grep '[0-9]$' data.txt

# The word "port" (not "export" or "transport")
grep -w 'port' config.txt        # -w is shorthand for word boundaries
grep '\bport\b' config.txt       # equivalent with \b (requires -P or -E depending on tool)

# Empty lines
grep '^$' file.txt
```

---

## Character Classes

A character class matches any single character from a set.

### Basic Syntax

| Pattern | Matches |
|---------|---------|
| `[abc]` | a, b, or c |
| `[a-z]` | Any lowercase letter |
| `[A-Z]` | Any uppercase letter |
| `[0-9]` | Any digit |
| `[a-zA-Z0-9]` | Any alphanumeric character |
| `[^abc]` | Any character except a, b, or c |
| `[^0-9]` | Any non-digit |

The caret `^` at the start of a class negates it. A hyphen `-` between characters defines a range.

```bash
# Lines containing a digit
grep '[0-9]' file.txt

# Lines starting with a vowel
grep -i '^[aeiou]' words.txt

# Lines containing non-alphanumeric characters
grep '[^a-zA-Z0-9 ]' file.txt
```

### POSIX Character Classes

POSIX defines named character classes that work across locales:

| Class | Equivalent | Matches |
|-------|-----------|---------|
| `[:alpha:]` | `[a-zA-Z]` | Letters |
| `[:digit:]` | `[0-9]` | Digits |
| `[:alnum:]` | `[a-zA-Z0-9]` | Letters and digits |
| `[:upper:]` | `[A-Z]` | Uppercase letters |
| `[:lower:]` | `[a-z]` | Lowercase letters |
| `[:space:]` | `[ \t\n\r\f\v]` | Whitespace characters |
| `[:blank:]` | `[ \t]` | Space and tab only |
| `[:punct:]` | | Punctuation characters |
| `[:print:]` | | Printable characters (including space) |
| `[:graph:]` | | Printable characters (excluding space) |

POSIX classes go inside a character class: `[[:digit:]]` (the outer brackets are the character class, the inner `[:digit:]` is the named class).

```bash
# Lines containing only digits
grep '^[[:digit:]]*$' file.txt

# Lines starting with uppercase
grep '^[[:upper:]]' file.txt

# Lines containing punctuation
grep '[[:punct:]]' file.txt
```

### Shorthand Classes (PCRE)

When using `grep -P` (Perl-compatible regex), shorthand classes are available:

| Shorthand | Equivalent | Matches |
|-----------|-----------|---------|
| `\d` | `[0-9]` | Digit |
| `\D` | `[^0-9]` | Non-digit |
| `\w` | `[a-zA-Z0-9_]` | Word character |
| `\W` | `[^a-zA-Z0-9_]` | Non-word character |
| `\s` | `[ \t\n\r\f\v]` | Whitespace |
| `\S` | `[^ \t\n\r\f\v]` | Non-whitespace |

```bash
# Match IP-like patterns (PCRE shorthand)
grep -P '\d+\.\d+\.\d+\.\d+' access.log

# Match non-whitespace sequences
grep -P '\S+' file.txt
```

---

## Quantifiers

Quantifiers specify how many times the preceding element must match.

| Quantifier | Meaning | Example |
|-----------|---------|---------|
| `*` | Zero or more | `ab*c` matches ac, abc, abbc, abbbc |
| `+` | One or more | `ab+c` matches abc, abbc, but not ac |
| `?` | Zero or one | `colou?r` matches color and colour |
| `{n}` | Exactly n | `a{3}` matches aaa |
| `{n,}` | n or more | `a{2,}` matches aa, aaa, aaaa |
| `{n,m}` | Between n and m | `a{2,4}` matches aa, aaa, aaaa |

```bash
# Lines with three or more consecutive digits
grep -E '[0-9]{3,}' file.txt

# Optional "s" for plural
grep -E 'files?' file.txt

# One or more whitespace characters
grep -E '[[:space:]]+' file.txt
```

### The Dot (.)

The dot matches **any single character** except newline:

```bash
# Three-letter words starting with "c" and ending with "t"
grep -E '\bc.t\b' /usr/share/dict/words
# Matches: cat, cot, cut, etc.

# Match any character between quotes
grep -E '".*"' file.txt
```

### Greedy vs Lazy Matching

By default, quantifiers are **greedy** - they match as much text as possible. Adding `?` after a quantifier makes it **lazy** (match as little as possible). Lazy quantifiers require PCRE (`grep -P`).

```bash
# Greedy: matches from first < to LAST >
echo '<b>bold</b> and <i>italic</i>' | grep -oP '<.*>'
# Output: <b>bold</b> and <i>italic</i>

# Lazy: matches from first < to NEXT >
echo '<b>bold</b> and <i>italic</i>' | grep -oP '<.*?>'
# Output: <b>
#         </b>
#         <i>
#         </i>
```

!!! tip "Greedy matching is the #1 regex surprise"
    When `.*` matches too much, the fix is usually one of: make it lazy (`.*?`), use a negated character class (`[^>]*` instead of `.*`), or be more specific about what you're matching. Negated character classes work in all regex flavors, not just PCRE.

---

## Alternation and Grouping

### Alternation

The pipe `|` matches either the pattern on the left or the right:

```bash
# Match "error" or "warning"
grep -E 'error|warning' /var/log/syslog

# Match file extensions
grep -E '\.(jpg|png|gif)$' filelist.txt
```

### Grouping

Parentheses `()` group patterns together. This is useful for applying quantifiers to multi-character sequences and for alternation scoping:

```bash
# Repeat a group: match "abcabc"
grep -E '(abc){2}' file.txt

# Scope alternation: "pre-" followed by "fix" or "set" or "view"
grep -E 'pre-(fix|set|view)' file.txt
# Without grouping, "pre-fix|set|view" matches "pre-fix" OR "set" OR "view"
```

### Capture Groups and Backreferences

Parentheses also capture the matched text for later use. Backreferences (`\1`, `\2`) refer to what the first, second, etc. group captured:

```bash
# Find repeated words ("the the", "is is")
grep -E '\b(\w+)\s+\1\b' document.txt

# Swap first and last names with sed (capture groups)
echo "Doe, Jane" | sed -E 's/(\w+), (\w+)/\2 \1/'
# Output: Jane Doe

# Match repeated characters (e.g., "aaa", "bbb")
grep -E '(.)\1{2}' file.txt

# Match HTML tags with matching close tag
grep -E '<([a-z]+)>.*</\1>' page.html
```

In `sed`, backreferences are `\1`, `\2`. In the replacement string, `&` refers to the entire match:

```bash
# Wrap each line in quotes
sed 's/.*/"&"/' file.txt

# Add "line: " prefix to lines containing numbers
sed -E 's/^(.*[0-9].*)$/line: \1/' file.txt
```

---

## BRE vs ERE vs PCRE

Linux uses three regex flavors. The differences are mainly about which metacharacters need escaping.

### Basic Regular Expressions (BRE)

Used by: `grep` (default), `sed` (default)

In BRE, several metacharacters are literal unless escaped:

| Character | BRE | ERE |
|-----------|-----|-----|
| `+` | Literal `+` | One or more |
| `?` | Literal `?` | Zero or one |
| `{` `}` | Literal `{` `}` | Quantifier |
| `(` `)` | Literal `(` `)` | Group |
| `\|` | Alternation | - |

```bash
# BRE: need to escape +, ?, {}, ()
grep 'ab\+c' file.txt          # one or more b
grep 'colou\?r' file.txt       # optional u
grep '\(abc\)\{2\}' file.txt   # group + quantifier

# BRE: pipe needs backslash
grep 'error\|warning' file.txt
```

### Extended Regular Expressions (ERE)

Used by: `grep -E` (or `egrep`), `sed -E`, `awk`

In ERE, metacharacters work without escaping:

```bash
# ERE: no escaping needed
grep -E 'ab+c' file.txt
grep -E 'colou?r' file.txt
grep -E '(abc){2}' file.txt
grep -E 'error|warning' file.txt
```

### Perl-Compatible Regular Expressions (PCRE)

Used by: `grep -P`, Perl, Python, PHP, JavaScript (mostly compatible)

PCRE adds features not available in BRE/ERE:

- Shorthand classes (`\d`, `\w`, `\s`)
- Lazy quantifiers (`*?`, `+?`)
- Lookahead and lookbehind
- Non-capturing groups `(?:...)`
- Named groups `(?P<name>...)`

```bash
# Only works with grep -P
grep -P '\d{3}-\d{3}-\d{4}' contacts.txt     # phone numbers
grep -P '(?<=price: )\d+' catalog.txt          # lookbehind
```

### Quick Reference

| Feature | BRE | ERE | PCRE |
|---------|-----|-----|------|
| `.` `*` `^` `$` `[]` | Yes | Yes | Yes |
| `+` `?` | `\+` `\?` | `+` `?` | `+` `?` |
| `{n,m}` | `\{n,m\}` | `{n,m}` | `{n,m}` |
| `()` groups | `\(\)` | `()` | `()` |
| `\|` alternation | `\|` | `\|` | `\|` |
| `\d` `\w` `\s` | No | No | Yes |
| Lazy quantifiers | No | No | Yes |
| Lookahead/behind | No | No | Yes |
| Backreferences | `\1` | `\1` | `\1` or `$1` |
| **grep flag** | (default) | `-E` | `-P` |
| **sed flag** | (default) | `-E` | N/A |

!!! warning "ERE is the practical default"
    Unless you have a specific reason to use BRE, use `grep -E` and `sed -E` for everything. The unescaped syntax is cleaner and less error-prone. Use `grep -P` when you need PCRE-only features like `\d`, lazy quantifiers, or lookaround.

```command-builder
base: grep
description: Build a grep command to search file contents with regex
options:
  - flag: ""
    type: select
    label: "Regex mode"
    explanation: "Basic (BRE) is the default; Extended (ERE) avoids escaping +, ?, {}, (); PCRE adds \\d, lookaround, and lazy quantifiers. -P requires GNU grep and is unavailable on macOS or Alpine Linux"
    choices:
      - ["", "Basic regex (default BRE)"]
      - ["-E", "Extended regex (-E)"]
      - ["-P", "Perl-compatible regex (-P, GNU grep only)"]
  - flag: ""
    type: select
    label: "Match options"
    explanation: "Modify how patterns are matched"
    choices:
      - ["", "Default matching"]
      - ["-i", "Case insensitive (-i)"]
      - ["-w", "Match whole words only (-w)"]
      - ["-x", "Match whole lines only (-x)"]
  - flag: ""
    type: select
    label: "Output mode"
    explanation: "Control what appears in the output"
    choices:
      - ["", "Print matching lines (default)"]
      - ["-o", "Print only the matched part (-o)"]
      - ["-c", "Print count of matching lines (-c)"]
      - ["-l", "Print only filenames with matches (-l)"]
      - ["-n", "Prefix line numbers (-n)"]
  - flag: ""
    type: select
    label: "Invert or context"
    explanation: "Exclude matches or show surrounding lines"
    choices:
      - ["", "Normal matching"]
      - ["-v", "Invert match - show non-matching lines (-v)"]
      - ["-C 3", "Show 3 lines of context around matches (-C 3)"]
      - ["-A 5", "Show 5 lines after each match (-A 5)"]
      - ["-B 5", "Show 5 lines before each match (-B 5)"]
  - flag: ""
    type: select
    label: "Recursive search"
    explanation: "Search through directory trees"
    choices:
      - ["", "Single file or stdin"]
      - ["-r", "Recursive search (-r)"]
      - ["-r --include='*.log'", "Recursive, only .log files (-r --include='*.log')"]
  - flag: ""
    type: text
    label: "Pattern"
    placeholder: "error|warning"
    explanation: "The regex pattern to search for"
  - flag: ""
    type: text
    label: "File"
    placeholder: "/var/log/syslog"
    explanation: "The file or directory to search"
```

```quiz
question: "You run grep '(error|warning)' logfile and get no results, but you know the file contains both words. What's wrong?"
type: multiple-choice
options:
  - text: "grep uses BRE by default, where ( ) and | are literal characters. Use grep -E or escape them."
    correct: true
    feedback: "Correct. In BRE, parentheses and pipe are literal. You need either grep -E '(error|warning)' or grep '\\(error\\|warning\\)' for it to work as alternation."
  - text: "The pipe character needs double escaping in bash"
    feedback: "The pattern is in single quotes, so bash doesn't interpret the pipe. The issue is the regex flavor, not shell escaping."
  - text: "grep doesn't support alternation at all"
    feedback: "grep supports alternation in all three modes (BRE with \\|, ERE with |, PCRE with |)."
  - text: "Parentheses aren't allowed in grep patterns"
    feedback: "Parentheses work in all grep modes - they just need escaping in BRE mode."
```

---

## Lookahead and Lookbehind

Lookaround assertions match a position based on what's ahead or behind, without consuming characters. They require PCRE (`grep -P`).

| Syntax | Name | Matches |
|--------|------|---------|
| `(?=...)` | Positive lookahead | Position followed by pattern |
| `(?!...)` | Negative lookahead | Position NOT followed by pattern |
| `(?<=...)` | Positive lookbehind | Position preceded by pattern |
| `(?<!...)` | Negative lookbehind | Position NOT preceded by pattern |

```bash
# Extract numbers that are followed by "GB"
grep -oP '\d+(?=GB)' disk-report.txt
# Input: "500GB" -> Output: "500"

# Extract numbers NOT followed by "MB"
grep -oP '\d+(?!MB)' report.txt

# Extract values after "price: "
grep -oP '(?<=price: )\d+\.\d{2}' catalog.txt
# Input: "price: 49.99" -> Output: "49.99"

# Extract words NOT preceded by "un"
grep -oP '(?<!un)happy' text.txt
# Matches "happy" but not "unhappy"
```

Lookaround is especially useful with `-o` (print only the matching part), because the lookaround context isn't included in the output.

---

## Practical Patterns

### IP Addresses

```bash
# Basic IP pattern (matches 0-999 per octet - good enough for log extraction)
grep -E '[0-9]+\.[0-9]+\.[0-9]+\.[0-9]+' access.log

# Strict IP pattern (0-255 per octet, PCRE)
grep -P '\b(?:(?:25[0-5]|2[0-4]\d|[01]?\d\d?)\.){3}(?:25[0-5]|2[0-4]\d|[01]?\d\d?)\b' access.log

# Extract IPs with -o
grep -oE '[0-9]+\.[0-9]+\.[0-9]+\.[0-9]+' access.log
```

### Email Addresses

```bash
# Simple email pattern
grep -E '[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}' contacts.txt
```

### Dates

```bash
# YYYY-MM-DD
grep -E '[0-9]{4}-[0-9]{2}-[0-9]{2}' logfile.txt

# MM/DD/YYYY or DD/MM/YYYY
grep -E '[0-9]{2}/[0-9]{2}/[0-9]{4}' logfile.txt

# Syslog date format (Mar 25 14:30:01)
grep -E '^[A-Z][a-z]{2} [0-9 ][0-9] [0-9]{2}:[0-9]{2}:[0-9]{2}' /var/log/syslog
```

### Log Lines

```bash
# Extract HTTP status codes from access logs
grep -oE 'HTTP/[0-9.]+" [0-9]{3}' access.log

# Find 5xx errors
grep -E '" 5[0-9]{2} ' access.log

# Extract key=value pairs
grep -oP '\w+=\S+' config.log
```

```code-walkthrough
language: bash
title: Dissecting an IP Address Validation Regex
code: |
  grep -P '\b(?:(?:25[0-5]|2[0-4]\d|[01]?\d\d?)\.){3}(?:25[0-5]|2[0-4]\d|[01]?\d\d?)\b' access.log
annotations:
  - line: 1
    text: "-P enables Perl-Compatible Regular Expressions (PCRE), required for \\d (digit shorthand) and non-capturing groups (?:...)."
  - line: 1
    text: "\\b is a word boundary anchor. It ensures the match starts and ends at a word boundary, preventing partial matches inside longer numbers like '12345.67.89.01'."
  - line: 1
    text: "(?:...) is a non-capturing group. It groups the pattern for repetition without storing the match in a backreference. More efficient than capturing groups when you don't need \\1."
  - line: 1
    text: "25[0-5] matches 250-255. This is the first alternative for the highest valid octet range."
  - line: 1
    text: "2[0-4]\\d matches 200-249. The second alternative covers the rest of the 200s."
  - line: 1
    text: "[01]?\\d\\d? matches 0-199. The optional [01] handles the hundreds digit, and the second \\d? makes the tens digit optional, covering single-digit values like 5 and double-digit values like 42."
  - line: 1
    text: "\\. matches a literal dot between octets. Without the backslash, . matches any character."
  - line: 1
    text: "{3} repeats the octet-dot group exactly three times, matching the first three octets and their trailing dots (e.g., '192.168.1.')."
  - line: 1
    text: "The final octet group repeats the same 0-255 pattern without a trailing dot, completing the four-octet IP address."
```

---

## Testing and Debugging Regex

### Build Patterns Incrementally

Start simple and add complexity one piece at a time:

```bash
# Step 1: Find lines with "error"
grep -i 'error' logfile.txt

# Step 2: Add a timestamp pattern before it
grep -E '[0-9]{2}:[0-9]{2}:[0-9]{2}.*error' logfile.txt

# Step 3: Capture the timestamp and error message
grep -oE '[0-9]{2}:[0-9]{2}:[0-9]{2}.*error[^"]*' logfile.txt
```

### Use Color Highlighting

```bash
# Highlight matches in the terminal
grep --color=auto -E 'pattern' file.txt

# Make it permanent
alias grep='grep --color=auto'
```

### Common Mistakes

| Mistake | Problem | Fix |
|---------|---------|-----|
| `grep 'a+b'` | BRE treats `+` as literal | `grep -E 'a+b'` |
| `grep -E '1.2.3.4'` | Dots match any character | `grep -E '1\.2\.3\.4'` |
| `grep -E '<.*>'` | Greedy match spans too far | `grep -P '<.*?>'` or `grep -E '<[^>]*>'` |
| `grep -E '[0-9]+' <<< "abc"` | No match but exit code 1 | Expected - no digits in input |
| `sed 's/old/new/'` | Only replaces first match | `sed 's/old/new/g'` for global |

```terminal
title: "Building a Regex Pattern to Extract Data"
steps:
  - command: "echo '2026-03-25 14:32:01 ERROR [auth] Failed login from 203.0.113.42 for user admin' | grep --color -E 'ERROR'"
    output: "2026-03-25 14:32:01 \033[01;31mERROR\033[0m [auth] Failed login from 203.0.113.42 for user admin"
    narration: "Start with the simplest pattern that identifies the lines you want. ERROR matches the literal string."
  - command: "echo '2026-03-25 14:32:01 ERROR [auth] Failed login from 203.0.113.42 for user admin' | grep -oE '[0-9]+\\.[0-9]+\\.[0-9]+\\.[0-9]+'"
    output: "203.0.113.42"
    narration: "Extract IP addresses with -o (only print the match). The pattern matches one or more digits separated by literal dots. The dots are escaped because unescaped dots match any character."
  - command: "echo '2026-03-25 14:32:01 ERROR [auth] Failed login from 203.0.113.42 for user admin' | grep -oP '(?<=from )\\S+'"
    output: "203.0.113.42"
    narration: "PCRE lookbehind is cleaner for this case. (?<=from ) means 'preceded by from-space' and \\S+ matches non-whitespace. The lookbehind isn't included in the output."
  - command: "echo '2026-03-25 14:32:01 ERROR [auth] Failed login from 203.0.113.42 for user admin' | grep -oP 'user \\K\\w+'"
    output: "admin"
    narration: "\\K is a PCRE shortcut that resets the match start. Everything before \\K is required to match but isn't included in the output. Simpler than lookbehind for prefix extraction."
  - command: "echo '2026-03-25 14:32:01 ERROR [auth] Failed login from 203.0.113.42 for user admin' | sed -E 's/.*from ([0-9.]+) for user (\\w+)/IP: \\1 User: \\2/'"
    output: "IP: 203.0.113.42 User: admin"
    narration: "sed capture groups extract both the IP and username in a single substitution. \\1 and \\2 refer to the first and second parenthesized groups."
```

```quiz
question: "What does the regex pattern ^[^#].* match?"
type: multiple-choice
options:
  - text: "Lines that start with any character except #, followed by anything"
    correct: true
    feedback: "Correct. ^ anchors to the start of line, [^#] is a negated character class matching any character except #, and .* matches the rest of the line. This is commonly used to find non-comment lines in config files."
  - text: "Lines that don't contain the # character"
    feedback: "Close, but [^#] only applies to the first character. A line like 'hello # comment' would still match because it starts with 'h', not '#'."
  - text: "Lines that start with a caret followed by a hash"
    feedback: "Inside square brackets, ^ means negation, not a literal caret. Outside brackets, ^ is the start-of-line anchor."
  - text: "Empty lines"
    feedback: "Empty lines have nothing after ^, so [^#] (which requires one character) can't match. ^$ matches empty lines."
```

```exercise
title: Write Regex Patterns for Real Scenarios
difficulty: intermediate
scenario: |
  Write regex patterns for each of these tasks. Test them with grep against the
  sample data provided.

  Sample data (save as sample.txt):
  ```
  john.doe@example.com - Login successful
  192.168.1.100 - GET /api/users HTTP/1.1 200
  ERROR 2026-03-25T14:30:00 disk usage at 92%
  jane_smith@company.org - Login failed
  10.0.0.50 - POST /api/login HTTP/1.1 401
  WARNING 2026-03-25T14:31:00 memory usage at 85%
  invalid-email@.com - Login failed
  172.16.0.1 - GET /index.html HTTP/1.1 301
  ```

  1. Extract all email addresses
  2. Find lines with HTTP status codes 4xx or 5xx (client/server errors)
  3. Extract the percentage values from ERROR and WARNING lines
  4. Find lines containing valid-looking IP addresses
  5. Extract just the HTTP methods (GET, POST, etc.)
hints:
  - "Email pattern: look for word characters, dots, and special chars before @, then domain after"
  - "HTTP status codes appear after HTTP/1.1 - match the space then 4 or 5 followed by two digits"
  - "Percentages are digits followed by % - use grep -oP with a lookbehind or \\K"
  - "IP addresses: four groups of 1-3 digits separated by dots"
  - "HTTP methods are uppercase words before a space and slash"
solution: |
  ```bash
  # 1. Extract email addresses
  grep -oE '[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}' sample.txt

  # 2. Lines with 4xx or 5xx status codes
  grep -E 'HTTP/[0-9.]+" [45][0-9]{2}' sample.txt
  # Simpler if status is always after HTTP/1.1:
  grep -E ' [45][0-9]{2}$' sample.txt

  # 3. Extract percentage values
  grep -oP '\d+(?=%)' sample.txt
  # Output: 92
  #         85

  # 4. Lines with IP addresses
  grep -E '\b[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\b' sample.txt

  # 5. Extract HTTP methods
  grep -oE '(GET|POST|PUT|DELETE|PATCH|HEAD)' sample.txt
  # Or more generally:
  grep -oP '(?<= )[A-Z]+(?= /)' sample.txt
  ```
```

---

## Further Reading

- [regex101.com](https://regex101.com/) - interactive regex tester with explanation of each token
- [Regular-Expressions.info](https://www.regular-expressions.info/) - comprehensive tutorial covering all regex flavors
- [grep man page](https://man7.org/linux/man-pages/man1/grep.1.html) - grep options and regex support reference
- [POSIX Regular Expressions](https://pubs.opengroup.org/onlinepubs/9699919799/basedefs/V1_chap09.html) - official BRE and ERE specification
- [perlre man page](https://perldoc.perl.org/perlre) - Perl regex reference (the basis for PCRE)
- [Arch Wiki: Regular Expressions](https://wiki.archlinux.org/title/Regular_expression) - practical quick reference

---

**Previous:** [Text Processing](text-processing.md) | **Next:** [Finding Files](finding-files.md) | [Back to Index](README.md)
