# Archiving and Compression

Archiving bundles multiple files into one. Compression reduces file size. On Linux, these are usually separate operations (unlike zip, which does both). `tar` handles archiving and can invoke compression tools in a single command.

---

## tar

**`tar`** (tape archive) creates, extracts, and lists archives.

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

### Extracting

```bash
tar -xf archive.tar                         # extract (auto-detects compression)
tar -xf archive.tar.gz                      # works the same
tar -xf archive.tar.xz                      # works the same
tar -xf archive.tar -C /target/directory/   # extract to specific directory
```

Modern `tar` auto-detects the compression format, so you don't need `-z`, `-j`, or `-J` when extracting.

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
| `-f` | Specify filename (must be last flag before filename) |
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

---

## gzip / gunzip

**`gzip`** compresses individual files. It replaces the original file with a `.gz` version.

```bash
gzip file.txt                   # creates file.txt.gz, removes file.txt
gzip -k file.txt                # keep the original file
gzip -9 file.txt                # maximum compression (slower)
gzip -1 file.txt                # fastest compression (less compression)
gzip -d file.txt.gz             # decompress (same as gunzip)
```

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

**`bzip2`** compresses with a better ratio than gzip but is slower.

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

**`xz`** provides the best compression ratio of the three but is the slowest.

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

**`zip`** creates archives compatible with Windows and macOS. It handles both archiving and compression in one step.

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

---

## When to Use Which

| Format | Use When |
|--------|----------|
| `.tar.gz` | General purpose. Fast, good compression, universally supported on Linux. Default choice for most things. |
| `.tar.bz2` | You need better compression and can wait longer. Less common now that xz exists. |
| `.tar.xz` | Maximum compression matters (distributing software, long-term storage). Standard for Linux distro packages. |
| `.zip` | Sharing with Windows/macOS users, or when recipients might not have tar. |
| `.gz` (no tar) | Compressing a single file (like log rotation). |

### Compression Comparison

Rough comparison for a typical text file:

| Format | Compression | Speed | Decompression Speed |
|--------|------------|-------|---------------------|
| gzip | Good | Fast | Fast |
| bzip2 | Better | Slow | Moderate |
| xz | Best | Slowest | Fast |
| zip | Good | Fast | Fast |

For backup scripts, `.tar.gz` is usually the right default. For distributing software, `.tar.xz` is standard. For sharing with non-Linux users, `.zip` is safest.
