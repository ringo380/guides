# Text Processing

Linux provides a rich set of tools for searching, transforming, and analyzing text. These commands are designed to work with streams and pipelines, making them composable building blocks for data processing.

---

## grep

[**`grep`**](https://www.gnu.org/software/grep/manual/) searches for lines matching a pattern. It's one of the most frequently used commands on any Linux system.

### Basic Usage

```bash
grep "error" /var/log/syslog           # lines containing "error"
grep "error" file1.txt file2.txt       # search multiple files
grep "error" *.log                     # search files matching a glob
```

### Common Options

| Option | Effect |
|--------|--------|
| `-i` | Case-insensitive search |
| `-v` | Invert match (lines that don't contain the pattern) |
| `-c` | Print count of matching lines instead of the lines |
| `-n` | Show line numbers |
| `-l` | Print only filenames containing a match |
| `-L` | Print only filenames NOT containing a match |
| `-o` | Print only the matched portion of each line |
| `-w` | Match whole words only |
| `-x` | Match whole lines only |
| `-r` | Recursive search through directories |
| `-F` | Treat pattern as a fixed string (no regex) |
| `-E` | Use extended regular expressions |
| `-P` | Use Perl-compatible regular expressions |

The most used flags in practice: **`-r`** to search an entire project tree, **`-l`** when you just need to know *which files* contain something (not the matching lines themselves), **`-o`** to extract just the matched text (useful for pulling values out of structured data), **`-c`** to count matches per file without seeing the actual lines, **`-F`** when your search string contains regex metacharacters like `.` or `*` and you want to search for them literally, and **`-P`** when you need advanced features like lookahead or non-greedy matching that basic and extended regex can't do.

### Context Lines

Show lines surrounding each match:

```bash
grep -A 3 "error" log.txt     # 3 lines After each match
grep -B 2 "error" log.txt     # 2 lines Before each match
grep -C 2 "error" log.txt     # 2 lines of Context (before and after)
```

### Recursive Search

```bash
grep -r "TODO" src/                    # search all files under src/
grep -rn "TODO" src/                   # same, with line numbers
grep -r --include="*.py" "import" .    # only search .py files
grep -r --exclude-dir=".git" "pattern" .  # skip .git directory
```

### Practical Examples

```bash
# Count occurrences in each file
grep -c "function" *.js

# Find files that contain a pattern
grep -rl "deprecated" src/

# Extract email addresses
grep -oE '[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}' contacts.txt

# Show processes matching a name (excluding the grep itself)
ps aux | grep "[n]ginx"
```

---

## Regular Expressions

**Regular expressions** (regex) describe search patterns. grep supports three flavors.

### Basic Regular Expressions (BRE)

This is grep's default mode. Some metacharacters require backslash escaping.

| Pattern | Matches |
|---------|---------|
| `.` | Any single character |
| `^` | Start of line |
| `$` | End of line |
| `*` | Zero or more of the preceding element |
| `\+` | One or more of the preceding element |
| `\?` | Zero or one of the preceding element |
| `\{n\}` | Exactly n of the preceding element |
| `\{n,m\}` | Between n and m of the preceding element |
| `[abc]` | Any one character in the set |
| `[^abc]` | Any one character NOT in the set |
| `[a-z]` | Any character in the range |
| `\(group\)` | Capture group |
| `\1` | Backreference to first group |

### Extended Regular Expressions (ERE)

Use `grep -E`. Metacharacters work without backslashes. (`egrep` is deprecated - use `grep -E` instead.)

| Pattern | Matches |
|---------|---------|
| `+` | One or more |
| `?` | Zero or one |
| `{n,m}` | Repetition |
| `(group)` | Capture group |
| `\|` | Alternation (no backslash needed in ERE) |

```bash
# BRE
grep 'error\|warning' log.txt

# ERE (cleaner)
grep -E 'error|warning' log.txt
```

### POSIX Character Classes

These work inside bracket expressions and are locale-aware:

| Class | Equivalent | Matches |
|-------|-----------|---------|
| `[:digit:]` | `[0-9]` | Digits |
| `[:alpha:]` | `[a-zA-Z]` | Letters |
| `[:alnum:]` | `[a-zA-Z0-9]` | Letters and digits |
| `[:upper:]` | `[A-Z]` | Uppercase letters |
| `[:lower:]` | `[a-z]` | Lowercase letters |
| `[:space:]` | `[ \t\n\r\f\v]` | Whitespace |
| `[:blank:]` | `[ \t]` | Space and tab |
| `[:punct:]` | | Punctuation characters |

Note the double brackets - the outer `[]` is the bracket expression, the inner `[:class:]` is the class name:

```bash
grep '[[:digit:]]\{3\}-[[:digit:]]\{4\}' phones.txt    # matches 555-1234
```

POSIX character classes exist because of **locale awareness**. The range `[a-z]` doesn't always mean what you'd expect - in some locales (like `en_US.UTF-8`), the sort order interleaves upper and lowercase, so `[a-z]` can match uppercase letters too. `[:lower:]` always means 'lowercase letters in the current locale,' regardless of sorting rules. If you're writing scripts that will run on systems with different locale settings, POSIX classes are the safe choice. For quick interactive use where you know your locale, `[a-z]` is fine.

### Backreferences

Capture a group and match it again later:

```bash
# Find repeated words (GNU grep - \b, \w, and \1 in ERE are GNU extensions)
grep -E '\b(\w+)\s+\1\b' document.txt

# Find lines where first and last word match (GNU grep - \w is a GNU extension)
grep '^\([[:alpha:]]\+\).*\1$' file.txt
```

### Perl-Compatible Regular Expressions

Use `grep -P` for Perl-compatible regex (PCRE), which adds shorthand classes and advanced features not available in BRE or ERE:

```bash
# Shorthand character classes
grep -P '\d{3}-\d{4}' phones.txt          # \d = digit (like [0-9])
grep -P '\bword\b' file.txt               # \b = word boundary
grep -P '\s+' file.txt                    # \s = whitespace

# Lookahead and lookbehind
grep -P '(?<=price: )\d+' catalog.txt     # match digits preceded by "price: "
grep -P '\d+(?= dollars)' catalog.txt     # match digits followed by " dollars"

# Non-greedy matching
grep -oP '".*?"' data.json                # match shortest quoted strings
```

`-P` is a GNU grep extension and may not be available on all systems (notably macOS, where you can install GNU grep via Homebrew as `ggrep`).

---

## sed

[**`sed`**](https://www.gnu.org/software/sed/manual/) (stream editor) transforms text line by line. It reads input, applies editing commands, and writes the result.

### Substitute

The most common sed operation is substitution:

```bash
sed 's/old/new/' file.txt        # replace first occurrence on each line
sed 's/old/new/g' file.txt       # replace all occurrences on each line
sed 's/old/new/gI' file.txt      # case-insensitive, all occurrences (GNU sed only)
sed 's/old/new/3' file.txt       # replace only the 3rd occurrence on each line
```

The delimiter doesn't have to be `/`. Use any character to avoid escaping:

```bash
sed 's|/usr/local|/opt|g' config.txt
sed 's#http://#https://#g' urls.txt
```

### Addresses

Sed commands can target specific lines:

```bash
sed '5s/old/new/' file.txt           # only line 5
sed '1,10s/old/new/' file.txt        # lines 1 through 10
sed '/pattern/s/old/new/' file.txt   # lines matching pattern
sed '1,/END/s/old/new/' file.txt     # line 1 through first line matching END
```

### Delete

```bash
sed '5d' file.txt                # delete line 5
sed '/^#/d' file.txt             # delete comment lines
sed '/^$/d' file.txt             # delete empty lines
sed '1,5d' file.txt              # delete lines 1-5
```

### Insert and Append

```bash
sed '3i\New line before line 3' file.txt    # insert before line 3
sed '3a\New line after line 3' file.txt     # append after line 3
sed '/pattern/a\Added after matching line' file.txt
```

### Print

```bash
sed -n '5p' file.txt             # print only line 5
sed -n '10,20p' file.txt         # print lines 10-20
sed -n '/start/,/end/p' file.txt # print between patterns (inclusive)
```

The `-n` flag suppresses default output, so only explicitly printed lines appear.

### In-Place Editing

```bash
sed -i 's/old/new/g' file.txt           # edit file directly (GNU sed)
sed -i '' 's/old/new/g' file.txt        # macOS sed (requires empty string for backup)
sed -i.bak 's/old/new/g' file.txt       # create backup before editing
```

### Extended Regex

Use `-E` for extended regex (same as `grep -E`):

```bash
sed -E 's/[0-9]{3}-[0-9]{4}/XXX-XXXX/g' data.txt
```

### Multiple Commands

```bash
sed -e 's/foo/bar/g' -e 's/baz/qux/g' file.txt

# Or use a semicolon
sed 's/foo/bar/g; s/baz/qux/g' file.txt
```

### Practical Examples

```bash
# Remove trailing whitespace
sed 's/[[:space:]]*$//' file.txt

# Add a prefix to every line
sed 's/^/PREFIX: /' file.txt

# Extract text between markers
sed -n '/BEGIN/,/END/p' file.txt

# Replace the 2nd line
sed '2c\This replaces the second line' file.txt

# Number all non-empty lines
sed '/./=' file.txt | sed 'N; s/\n/ /'
```

---

## awk

[**`awk`**](https://www.gnu.org/software/gawk/manual/) is a pattern-scanning and text-processing language. It excels at working with structured, column-based data.

### Basic Structure

An awk program is a series of **pattern-action** pairs:

```bash
awk 'pattern { action }' file
```

If no pattern is given, the action runs on every line. If no action is given, the matching line is printed.

### Fields

Awk automatically splits each line into fields. By default, the separator is whitespace.

| Variable | Meaning |
|----------|---------|
| `$0` | The entire line |
| `$1`, `$2`, ... | Individual fields |
| `$NF` | The last field |
| `NF` | Number of fields on the current line |
| `NR` | Current line number (across all files) |
| `FNR` | Line number in the current file |

```bash
# Print the second column
awk '{ print $2 }' data.txt

# Print the last column
awk '{ print $NF }' data.txt

# Print line number and first field
awk '{ print NR, $1 }' data.txt
```

### Field Separator

Use `-F` to set the field separator:

```bash
awk -F: '{ print $1, $7 }' /etc/passwd          # username and shell
awk -F, '{ print $2 }' data.csv                  # second column of CSV
awk -F'\t' '{ print $3 }' data.tsv               # tab-separated
```

### Patterns

```bash
# Lines matching a regex
awk '/error/' log.txt

# Lines where a field matches
awk '$3 > 100' data.txt

# Lines where a specific field matches a pattern
awk '$1 ~ /^server/' config.txt

# Lines where a field does NOT match
awk '$1 !~ /^#/' config.txt

# Range patterns
awk '/START/,/END/' file.txt
```

### BEGIN and END

**`BEGIN`** runs before processing any input. **`END`** runs after all input is processed.

```bash
awk 'BEGIN { print "Name\tScore" } { print $1, $2 } END { print "---done---" }' data.txt
```

### Built-in Functions and printf

```bash
# String length
awk '{ print length($0) }' file.txt

# Substring
awk '{ print substr($1, 1, 3) }' file.txt

# Formatted output
awk '{ printf "%-20s %10.2f\n", $1, $3 }' data.txt
```

### Variables and Arithmetic

```bash
# Sum a column
awk '{ sum += $3 } END { print sum }' data.txt

# Average
awk '{ sum += $3; count++ } END { print sum/count }' data.txt

# Track maximum
awk '$3 > max { max = $3; line = $0 } END { print line }' data.txt
```

### Practical Examples

```bash
# Print lines longer than 80 characters
awk 'length > 80' file.txt

# Print unique values in column 1
awk '!seen[$1]++' data.txt

# Swap first two columns
awk '{ temp = $1; $1 = $2; $2 = temp; print }' data.txt

# Sum file sizes from ls -l
ls -l | awk 'NR > 1 { sum += $5 } END { print sum }'

# Process /etc/passwd: list users with bash shell
awk -F: '$7 == "/bin/bash" { print $1 }' /etc/passwd

# Print every other line
awk 'NR % 2 == 1' file.txt
```

---

## cut

[**`cut`**](https://www.gnu.org/software/coreutils/manual/) extracts specific columns or character positions from each line.

### By Field

```bash
cut -f1 data.tsv                # first field (tab-delimited by default)
cut -f1,3 data.tsv              # first and third fields
cut -f2- data.tsv               # second field through end
cut -d',' -f1,3 data.csv        # comma-delimited, fields 1 and 3
cut -d: -f1,7 /etc/passwd       # colon-delimited, fields 1 and 7
```

### By Character Position

```bash
cut -c1-10 file.txt             # first 10 characters
cut -c5- file.txt               # from character 5 to end
```

`cut` is fast but limited. For complex field extraction, use `awk`.

**When to use `cut` vs `awk`:** `cut` is simpler and faster for extracting fixed-position fields from cleanly delimited data. Use `awk` when you need conditional logic, multiple delimiters, or field reordering. One gotcha: `cut` defaults to tab as its delimiter, not spaces. If your data is space-separated, you need `-d' '`, but `cut` can't handle multiple consecutive spaces as a single delimiter the way `awk` does. Also, `cut` has no way to handle quoted CSV fields - a field containing a comma inside quotes will be split incorrectly. For anything beyond simple TSV or single-character-delimited data, use `awk`.

---

## sort

[**`sort`**](https://www.gnu.org/software/coreutils/manual/) orders lines of text.

```bash
sort file.txt                # alphabetical sort
sort -n file.txt             # numeric sort
sort -r file.txt             # reverse order
sort -u file.txt             # remove duplicate lines
sort -k2 file.txt            # sort by second field
sort -k2,2n file.txt         # sort by second field, numerically
sort -k3,3 -k1,1 file.txt   # sort by field 3, then field 1 as tiebreaker
sort -t, -k2 data.csv        # comma-delimited, sort by field 2
sort -s -k2 file.txt         # stable sort (preserves original order for equal elements)
sort -h file.txt             # human-numeric sort (handles 1K, 2M, 3G)
```

### Practical Examples

```bash
# Sort du output by size
du -sh * | sort -h

# Sort /etc/passwd by UID
sort -t: -k3 -n /etc/passwd

# Find the 10 largest files
du -a /var/log | sort -rn | head -10
```

The **`-s`** (stable sort) flag preserves the original order of lines that compare as equal. This matters when sorting by multiple keys in separate passes - without stable sort, the second sort might scramble the ordering you established in the first. For example, to sort a list of employees by department and then by name within each department, a stable sort on name followed by a stable sort on department gives you the right result.

**Human-numeric sort** (`-h`) understands unit suffixes, which makes it essential for sorting `du` output:

```bash
du -sh /var/* | sort -h
```

Without `-h`, `sort -n` would rank '2M' below '100K' because it only looks at the leading digit. With `-h`, it correctly understands that 2M is larger than 100K.

---

## uniq

[**`uniq`**](https://www.gnu.org/software/coreutils/manual/) filters adjacent duplicate lines. Input must be sorted first (or use `sort -u` instead).

```bash
sort file.txt | uniq           # remove duplicates
sort file.txt | uniq -c        # count occurrences
sort file.txt | uniq -d        # show only duplicated lines
sort file.txt | uniq -u        # show only unique lines (no duplicates)
```

### Practical Examples

```bash
# Top 10 most common lines
sort access.log | uniq -c | sort -rn | head -10

# Count unique IP addresses
awk '{ print $1 }' access.log | sort | uniq -c | sort -rn
```

**Why must input be sorted?** `uniq` only compares each line against the one directly before it. If duplicate lines appear in different parts of the file with other lines between them, `uniq` won't detect them. Sorting brings identical lines together so `uniq` can find them. If sorting would destroy meaningful ordering, use `sort -u` (which deduplicates as it sorts) or `awk '!seen[$0]++'` (which deduplicates while preserving original order).

---

## tr

[**`tr`**](https://www.gnu.org/software/coreutils/manual/) translates, squeezes, or deletes characters. It reads from STDIN only (no file arguments).

### Translate

```bash
echo "hello" | tr 'a-z' 'A-Z'          # HELLO
echo "hello" | tr 'aeiou' '*'          # h*ll*
cat file.txt | tr '\t' ' '             # tabs to spaces
```

### Squeeze

Replace repeated characters with a single instance:

```bash
echo "too    many    spaces" | tr -s ' '     # too many spaces
```

### Delete

```bash
echo "Hello, World! 123" | tr -d '[:digit:]'    # Hello, World!
echo "Hello, World! 123" | tr -d '[:punct:]'    # Hello World 123
```

### Character Classes

```bash
tr '[:lower:]' '[:upper:]' < file.txt    # uppercase everything
tr -d '[:space:]' < file.txt             # remove all whitespace
tr -dc '[:print:]' < file.txt            # keep only printable characters
```

`tr` works on a **one-to-one character mapping** model. Each character in SET1 maps to the character at the same position in SET2. If SET1 is longer than SET2, the last character of SET2 is repeated to fill the gap. That's why `tr 'aeiou' '*'` replaces all five vowels with `*` - the single `*` gets repeated for each remaining position.

### Practical Examples

```bash
# Convert Windows line endings to Unix
tr -d '\r' < windows.txt > unix.txt

# Generate a random password
tr -dc 'A-Za-z0-9' < /dev/urandom | head -c 32; echo

# Remove all non-alphanumeric characters
tr -dc '[:alnum:]\n' < file.txt
```

---

## wc

[**`wc`**](https://www.gnu.org/software/coreutils/manual/) (word count) counts lines, words, and characters.

```bash
wc file.txt           # lines, words, characters (all three)
wc -l file.txt        # line count only
wc -w file.txt        # word count only
wc -c file.txt        # byte count
wc -m file.txt        # character count (handles multibyte)
```

```bash
# Count files in a directory
ls | wc -l

# Count matching lines
grep -c "error" log.txt    # more efficient than grep | wc -l
```

The difference between **`-c`** (bytes) and **`-m`** (characters) matters with multibyte encodings like **UTF-8**. An ASCII file will show the same count for both, but a file containing non-ASCII characters (accented letters, emoji, CJK characters) will have more bytes than characters. Use `-c` when you care about file size on disk, and `-m` when you care about the number of human-readable characters.

---

## head and tail

### head

[**`head`**](https://www.gnu.org/software/coreutils/manual/) prints the first N lines of a file (default 10):

```bash
head file.txt            # first 10 lines
head -n 5 file.txt       # first 5 lines
head -n -5 file.txt      # all lines EXCEPT the last 5
head -c 100 file.txt     # first 100 bytes
```

### tail

[**`tail`**](https://www.gnu.org/software/coreutils/manual/) prints the last N lines (default 10):

```bash
tail file.txt            # last 10 lines
tail -n 5 file.txt       # last 5 lines
tail -n +5 file.txt      # from line 5 to end
```

The `+` prefix reverses `tail`'s logic. Instead of 'show the last N lines,' `tail -n +N` means 'start from line N.' This is useful for skipping headers: `tail -n +2 data.csv` gives you everything except the first line.

```bash
tail -c 100 file.txt     # last 100 bytes
```

### Following Files

`tail -f` watches a file for new content in real time:

```bash
tail -f /var/log/syslog                     # follow log updates
tail -f /var/log/syslog | grep "error"      # follow with filtering
tail -F /var/log/syslog                     # follow even if file is rotated
```

`-F` is like `-f` but handles log rotation (file is deleted and recreated).

---

## tee

`tee` is covered in [Streams and Redirection](streams-and-redirection.md#tee). In brief, it reads from STDIN and writes to both STDOUT and one or more files, making it useful for saving intermediate pipeline results while still passing data to the next stage.

---

## Combining Tools

The real power of text processing tools comes from combining them in pipelines.

```bash
# Top 10 most common words in a file
tr -s '[:space:]' '\n' < file.txt | tr '[:upper:]' '[:lower:]' | sort | uniq -c | sort -rn | head -10

# Extract and count HTTP status codes from access logs
awk '{ print $9 }' access.log | sort | uniq -c | sort -rn

# Find all unique file extensions in a directory tree
find . -type f | sed 's/.*\.//' | sort -u

# Compare two sorted CSV columns
diff <(cut -d, -f1 old.csv | sort) <(cut -d, -f1 new.csv | sort)

# Sum numbers from a file, one per line
paste -sd+ numbers.txt | bc

# Convert CSV to a formatted table
column -t -s, data.csv
```

### Breaking Down Pipelines

Here's how to read these pipelines stage by stage.

**Top 10 most common words in a file:**

```bash
tr -s '[:space:]' '\n' < file.txt | tr '[:upper:]' '[:lower:]' | sort | uniq -c | sort -rn | head -10
```

1. `tr -s '[:space:]' '\n'` - split text into one word per line by converting all whitespace (spaces, tabs, newlines) to newlines, squeezing consecutive whitespace into one
2. `tr '[:upper:]' '[:lower:]'` - lowercase everything so 'The' and 'the' count as the same word
3. `sort` - sort alphabetically so identical words are adjacent (required for `uniq`)
4. `uniq -c` - collapse adjacent identical lines and prefix each with its count
5. `sort -rn` - sort numerically in reverse so the highest counts come first
6. `head -10` - show only the first 10 results

**Extract and count HTTP status codes:**

```bash
awk '{ print $9 }' access.log | sort | uniq -c | sort -rn
```

1. `awk '{ print $9 }'` - pull the 9th whitespace-delimited field from each line (the HTTP status code in standard access log format)
2. `sort` - sort the status codes so identical ones are adjacent
3. `uniq -c` - count consecutive identical lines
4. `sort -rn` - show most frequent codes first

---

## Further Reading

- [GNU Grep Manual](https://www.gnu.org/software/grep/manual/) - pattern matching with regular expressions
- [GNU Sed Manual](https://www.gnu.org/software/sed/manual/) - stream editing reference
- [GAWK Manual](https://www.gnu.org/software/gawk/manual/) - the GNU awk programming language
- [GNU Coreutils Manual](https://www.gnu.org/software/coreutils/manual/) - documentation for sort, cut, uniq, tr, wc, head, tail, and other core utilities
- [Linux man-pages Project](https://man7.org/linux/man-pages/) - comprehensive manual pages for Linux commands and system calls
- [regular-expressions.info](https://www.regular-expressions.info/) - regex tutorial and reference across flavors

---

**Previous:** [Streams and Redirection](streams-and-redirection.md) | **Next:** [Finding Files](finding-files.md) | [Back to Index](README.md)
