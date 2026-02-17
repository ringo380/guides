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

---

## Further Reading

- [GNU Tar Manual](https://www.gnu.org/software/tar/manual/) - archiving utility documentation
- [GNU Gzip Manual](https://www.gnu.org/software/gzip/manual/) - compression utility reference
- [bzip2](https://sourceware.org/bzip2/) - block-sorting file compressor
- [XZ Utils](https://tukaani.org/xz/) - LZMA/LZMA2 compression tools
- [Info-ZIP](https://infozip.sourceforge.net/) - zip and unzip utilities

---

**Previous:** [System Information](system-information.md) | **Next:** [Best Practices](best-practices.md) | [Back to Index](README.md)
