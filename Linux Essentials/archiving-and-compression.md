# Archiving and Compression

**Archiving** and **compression** are two different operations that are often combined. Archiving bundles multiple files and directories into a single file, preserving directory structure, permissions, timestamps, and ownership - but without reducing size. Compression reduces file size by encoding redundant data more efficiently, but operates on a single file. On Linux, these are usually separate steps (unlike zip, which does both at once): `tar` creates the archive, then a compression tool like `gzip` or `xz` shrinks it. The `tar` command can invoke compression tools in a single command for convenience.

---

## tar

[**`tar`**](https://www.gnu.org/software/tar/manual/) (tape archive) creates, extracts, and lists archives.

### Creating Archives

```bash
tar -cf archive.tar file1.txt file2.txt     # create archive
tar -cf archive.tar directory/              # archive a directory
tar -cf archive.tar *.log                   # archive matching files
```

### Creating Compressed Archives

Add a compression flag:

```bash
tar -czf archive.tar.gz directory/          # gzip compression
tar -cjf archive.tar.bz2 directory/         # bzip2 compression
tar -cJf archive.tar.xz directory/          # xz compression
```

| Flag | Compression | Extension | Speed | Ratio |
|------|------------|-----------|-------|-------|
| `-z` | gzip | `.tar.gz` or `.tgz` | Fast | Good |
| `-j` | bzip2 | `.tar.bz2` | Slow | Better |
| `-J` | xz | `.tar.xz` | Slowest | Best |

```quiz
question: "What is the difference between tar -czf and tar -cJf?"
type: multiple-choice
options:
  - text: "-czf creates a zip file; -cJf creates a jar file"
    feedback: "Neither creates zip or jar files. tar with -z uses gzip compression, -J uses xz compression."
  - text: "-czf uses gzip compression; -cJf uses xz compression"
    correct: true
    feedback: "Correct! -z = gzip (.tar.gz), -j = bzip2 (.tar.bz2), -J = xz (.tar.xz). xz produces smaller files but takes longer to compress. gzip is the most common and fastest."
  - text: "-czf compresses files; -cJf compresses directories"
    feedback: "Both compress whatever you give them (files or directories). The difference is the compression algorithm: gzip (-z) vs xz (-J)."
  - text: "-cJf is the newer replacement for -czf"
    feedback: "Both are current and widely used. gzip (-z) is faster; xz (-J) produces smaller files. Choose based on your speed/size trade-off."
```

### Extracting

```bash
tar -xf archive.tar                         # extract (auto-detects compression)
tar -xf archive.tar.gz                      # works the same
tar -xf archive.tar.xz                      # works the same
tar -xf archive.tar -C /target/directory/   # extract to specific directory
```

Modern `tar` auto-detects the compression format, so you don't need `-z`, `-j`, or `-J` when extracting.

```quiz
question: "When extracting with modern tar, do you need to specify -z, -j, or -J?"
type: multiple-choice
options:
  - text: "Yes, you must always specify the correct decompression flag"
    feedback: "Modern GNU tar (and BSD tar) can auto-detect the compression format when extracting. The flags are optional for extraction."
  - text: "No, modern tar auto-detects the compression format during extraction"
    correct: true
    feedback: "Correct! tar xf archive.tar.gz works without -z because tar detects gzip automatically. This works for all common formats. The flags are still needed when creating archives (tar needs to know which compressor to use)."
  - text: "Only if the file extension is non-standard"
    feedback: "tar doesn't rely on file extensions for detection - it reads magic bytes at the start of the file. Auto-detection works regardless of the filename."
  - text: "You must specify for gzip but not for xz"
    feedback: "Auto-detection works for all common compression formats (gzip, bzip2, xz, zstd). No flags needed when extracting."
```

### Listing Contents

```bash
tar -tf archive.tar.gz                      # list files without extracting
tar -tvf archive.tar.gz                     # verbose listing (like ls -l)
```

### Common Options

| Option | Meaning |
|--------|---------|
| `-c` | Create archive |
| `-x` | Extract archive |
| `-t` | List contents |
| `-f` | Specify archive filename (put `-f` last when combining flags, e.g., `-czf` not `-cfz`) |
| `-v` | Verbose output |
| `-C` | Change to directory before extracting |
| `--exclude` | Exclude files matching pattern |
| `-p` | Preserve permissions |

### Practical Examples

```bash
# Archive excluding certain patterns
tar -czf backup.tar.gz --exclude='*.log' --exclude='.git' project/

# Extract a single file from an archive
tar -xf archive.tar.gz path/to/specific/file.txt

# Create an archive with a date in the filename
tar -czf "backup_$(date +%Y%m%d).tar.gz" /var/www

# Append files to an existing (uncompressed) archive
tar -rf archive.tar newfile.txt

# Compare archive against filesystem
tar -df archive.tar
```

```exercise
title: Create a Tar Archive with Exclusions
difficulty: beginner
scenario: |
  You need to create a compressed backup of your project directory `/srv/myapp`.
  The archive should:

  1. Use gzip compression
  2. Exclude the `node_modules/` directory (it's huge and regeneratable)
  3. Exclude all `.log` files
  4. Exclude the `.git/` directory
  5. Be named `myapp-backup-YYYY-MM-DD.tar.gz` with today's date

  Then, verify the archive contents by listing files without extracting.
  Finally, extract just the `config/` directory from the archive.
hints:
  - "Use --exclude=PATTERN to skip files/directories"
  - "Multiple --exclude flags can be chained"
  - "Use $(date +%Y-%m-%d) to insert today's date in the filename"
  - "tar tf lists contents; tar xf with a path extracts just that path"
solution: |
  ```bash
  # Create the archive with exclusions
  tar czf "myapp-backup-$(date +%Y-%m-%d).tar.gz" \
      --exclude='node_modules' \
      --exclude='*.log' \
      --exclude='.git' \
      /srv/myapp

  # List contents to verify
  tar tf "myapp-backup-$(date +%Y-%m-%d).tar.gz" | head -20

  # Extract only the config directory
  tar xf "myapp-backup-$(date +%Y-%m-%d).tar.gz" srv/myapp/config/
  ```

  Note: When extracting specific paths, use the path as it appears in the archive
  listing (from `tar tf`), including any leading directories.
```

```command-builder
base: tar
description: Build a tar command for creating or extracting archives
options:
  - flag: ""
    type: select
    label: "Operation"
    explanation: "Create a new archive or extract from an existing one"
    choices:
      - ["-cf", "Create archive"]
      - ["-xf", "Extract archive"]
      - ["-tf", "List contents"]
  - flag: ""
    type: select
    label: "Compression"
    explanation: "Compression algorithm to use"
    choices:
      - ["-z", "gzip (.tar.gz) - fast, good compression"]
      - ["-j", "bzip2 (.tar.bz2) - slower, better compression"]
      - ["-J", "xz (.tar.xz) - slowest, best compression"]
      - ["", "None (.tar) - no compression"]
  - flag: ""
    type: select
    label: "Verbose"
    explanation: "Show files as they're processed"
    choices:
      - ["", "Quiet (default)"]
      - ["-v", "Verbose (list files)"]
  - flag: ""
    type: select
    label: "Exclusions"
    explanation: "Patterns to exclude from the archive"
    choices:
      - ["", "No exclusions"]
      - ["--exclude='*.log'", "Exclude log files"]
      - ["--exclude='node_modules' --exclude='.git'", "Exclude node_modules and .git"]
      - ["--exclude-from=exclude.txt", "Exclude patterns from file"]
```

---

## gzip / gunzip

[**`gzip`**](https://www.gnu.org/software/gzip/manual/) compresses individual files. It replaces the original file with a `.gz` version.

```bash
gzip file.txt                   # creates file.txt.gz, removes file.txt
gzip -k file.txt                # keep the original file
gzip -9 file.txt                # maximum compression (slower)
gzip -1 file.txt                # fastest compression (less compression)
gzip -d file.txt.gz             # decompress (same as gunzip)
```

```quiz
question: "What happens to the original file when you run gzip file.txt?"
type: multiple-choice
options:
  - text: "The original file is kept and file.txt.gz is created alongside it"
    feedback: "By default, gzip replaces the original. Use gzip -k (keep) to preserve the original file alongside the compressed one."
  - text: "The original file is replaced by file.txt.gz"
    correct: true
    feedback: "Correct! gzip replaces the original file by default. Use gzip -k to keep the original, or gzip -c file.txt > file.txt.gz to write to stdout without touching the original."
  - text: "The file is compressed in-place without changing the filename"
    feedback: "gzip always adds a .gz extension. The original file is replaced, not modified in-place."
  - text: "gzip only works on tar archives, not regular files"
    feedback: "gzip works on any file. It's often paired with tar, but you can gzip any file directly."
```

Compression levels from `-1` to `-9` control the tradeoff between speed and compression ratio. Lower numbers use less CPU time and memory but produce larger files. Higher numbers spend more CPU and memory searching for better ways to encode the data. The difference in file size between `-1` and `-9` is often modest (5-15% on typical files), so the default level (`-6` for gzip) is usually the right choice. Use `-1` when speed matters (compressing data in a pipeline or on a slow machine) and `-9` only when you're compressing once and distributing many times (like software releases).

**`gunzip`** decompresses:

```bash
gunzip file.txt.gz              # creates file.txt, removes file.txt.gz
```

**`zcat`** reads compressed files without decompressing:

```bash
zcat file.txt.gz                # print contents to STDOUT
zcat file.txt.gz | grep "error" # search compressed file
```

Also available: `zless`, `zgrep` for working with gzip files directly.

---

## bzip2 / bunzip2

[**`bzip2`**](https://sourceware.org/bzip2/) compresses with a better ratio than gzip but is slower.

```bash
bzip2 file.txt                  # creates file.txt.bz2
bzip2 -k file.txt               # keep original
bzip2 -d file.txt.bz2           # decompress (same as bunzip2)
```

**`bunzip2`** decompresses:

```bash
bunzip2 file.txt.bz2
```

**`bzcat`** reads compressed files:

```bash
bzcat file.txt.bz2
```

---

## xz / unxz

[**`xz`**](https://tukaani.org/xz/) provides the best compression ratio of the three but is the slowest.

```bash
xz file.txt                    # creates file.txt.xz
xz -k file.txt                 # keep original
xz -9 file.txt                 # maximum compression
xz -d file.txt.xz              # decompress (same as unxz)
xz -T 0 file.txt               # use all CPU cores (much faster)
```

**`unxz`** decompresses:

```bash
unxz file.txt.xz
```

**`xzcat`** reads compressed files:

```bash
xzcat file.txt.xz
```

---

## zip / unzip

[**`zip`**](https://infozip.sourceforge.net/) creates archives compatible with Windows and macOS. It handles both archiving and compression in one step.

```bash
zip archive.zip file1.txt file2.txt        # create zip with files
zip -r archive.zip directory/              # recursive (include directories)
zip -e archive.zip sensitive.txt           # encrypt with password
zip -u archive.zip newfile.txt             # add/update files in existing zip
```

**`unzip`** extracts:

```bash
unzip archive.zip                          # extract to current directory
unzip archive.zip -d /target/directory/    # extract to specific directory
unzip -l archive.zip                       # list contents
unzip -o archive.zip                       # overwrite without prompting
```

### zip Limitations

Classic zip has a few limitations to be aware of. It doesn't preserve Unix file permissions by default - extracted files get default permissions based on your umask, which can break scripts that need to be executable. The original zip format has a **4GB limit** for individual files and a **4GB limit** for the total archive size. Modern implementations support zip64 extensions to overcome this, but not all unzip tools handle zip64 correctly. For Unix-to-Unix transfers where you need to preserve permissions, ownership, and symlinks, `tar` archives are the better choice.

---

## When to Use Which

| Format | Use When |
|--------|----------|
| `.tar.gz` | General purpose. Fast, good compression, universally supported on Linux. Default choice for most things. |
| `.tar.bz2` | You need better compression and can wait longer. Less common now that xz exists. |
| `.tar.xz` | Maximum compression matters (distributing software, long-term storage). Standard for Linux distro packages. |
| `.zip` | Sharing with Windows/macOS users, or when recipients might not have tar. |
| `.gz` (no tar) | Compressing a single file (like log rotation). |

**Concrete scenarios:**

- **Distributing software** - `.tar.xz` is the standard. Users download once, the slow compression time is paid by the developer, and the small size saves bandwidth.
- **Log rotation** - `.gz` (single file, no tar needed). logrotate uses gzip by default because the fast compression/decompression cycle matters when rotating logs on a busy server.
- **Backups** - `.tar.gz` balances compression with speed. For large backup jobs, the time difference between gzip and xz can be hours.
- **Sharing with non-Linux users** - `.zip` is universally supported on Windows and macOS without extra software.
- **Archiving for long-term storage** - `.tar.xz` gives the best size reduction. If the data won't be accessed frequently, the slow compression is worth it.

### Compression Comparison

Approximate results for a typical 100MB text file (actual results vary with content):

| Format | Compressed Size | Compression Time | Decompression Time |
|--------|----------------|------------------|--------------------|
| gzip | ~30MB (~70% reduction) | ~2 seconds | ~1 second |
| bzip2 | ~25MB (~75% reduction) | ~8 seconds | ~4 seconds |
| xz | ~20MB (~80% reduction) | ~30 seconds | ~2 seconds |
| zip | ~30MB (~70% reduction) | ~2 seconds | ~1 second |

Notable: xz decompresses much faster than it compresses, making it a good choice when you compress once and decompress many times (like software distribution). Binary files and already-compressed data (images, video) will see much smaller reductions.

```terminal
title: Compression Algorithm Comparison
steps:
  - command: "ls -lh testdata.txt"
    output: "-rw-r--r-- 1 user user 50M Jan 15 10:00 testdata.txt"
    narration: "Starting with a 50MB text file. Comparing how different algorithms handle it."
  - command: "time gzip -k testdata.txt && ls -lh testdata.txt.gz"
    output: |
      real    0m0.82s
      -rw-r--r-- 1 user user 12M Jan 15 10:00 testdata.txt.gz
    narration: "gzip: 50MB → 12MB (76% reduction) in 0.82 seconds. Fast compression with good results. -k keeps the original."
  - command: "time bzip2 -k testdata.txt && ls -lh testdata.txt.bz2"
    output: |
      real    0m2.45s
      -rw-r--r-- 1 user user 9.2M Jan 15 10:00 testdata.txt.bz2
    narration: "bzip2: 50MB → 9.2MB (82% reduction) in 2.45 seconds. Better compression than gzip, but 3x slower."
  - command: "time xz -k testdata.txt && ls -lh testdata.txt.xz"
    output: |
      real    0m6.10s
      -rw-r--r-- 1 user user 7.1M Jan 15 10:00 testdata.txt.xz
    narration: "xz: 50MB → 7.1MB (86% reduction) in 6.1 seconds. Best compression, but 7x slower than gzip. Worth it for archives you create once and download many times."
```

---

## Further Reading

- [GNU Tar Manual](https://www.gnu.org/software/tar/manual/) - archiving utility documentation
- [GNU Gzip Manual](https://www.gnu.org/software/gzip/manual/) - compression utility reference
- [bzip2](https://sourceware.org/bzip2/) - block-sorting file compressor
- [XZ Utils](https://tukaani.org/xz/) - LZMA/LZMA2 compression tools
- [Info-ZIP](https://infozip.sourceforge.net/) - zip and unzip utilities

---

**Previous:** [System Information](system-information.md) | **Next:** [Best Practices](best-practices.md) | [Back to Index](README.md)
