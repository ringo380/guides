# Disk and Filesystem

Understanding disk usage, partitions, and filesystem management is a core sysadmin skill. These tools help you monitor space, mount storage, and maintain filesystem health.

---

## df - Filesystem Usage

**`df`** (disk free) shows how much space is used and available on mounted filesystems.

```bash
df -h                    # human-readable sizes (K, M, G)
df -hT                   # include filesystem type
df -h /                  # specific filesystem
df -i                    # inode usage instead of block usage
```

Example output:

```
Filesystem      Size  Used Avail Use% Mounted on
/dev/sda1        50G   32G   16G  67% /
/dev/sda2       200G  150G   40G  79% /home
tmpfs           3.9G     0  3.9G   0% /dev/shm
```

Key columns:
- **Size** - total capacity
- **Used** - space consumed
- **Avail** - space remaining (may not equal Size minus Used due to reserved space for root)
- **Use%** - percentage used (calculated against non-reserved space)
- **Mounted on** - where the filesystem is accessible

!!! danger "A filesystem at 100% causes unpredictable application failures"

    When a filesystem fills up, applications don't get a clean "disk full" error - they crash, corrupt data, fail to write logs, or hang. Databases refuse writes, log rotation breaks, and even `ssh` may stop working if `/var` is full. Monitor `Use%` with alerts at 80% and 90% thresholds to avoid emergencies.

A filesystem at 100% causes applications to fail in unexpected ways. Keep an eye on `Use%`.

Running out of inodes (`df -i`) is a less common but equally disabling problem. It happens when you have a huge number of tiny files.

---

## du - Directory Sizes

**`du`** (disk usage) shows how much space files and directories consume.

```bash
du -sh /var/log              # total size of a directory
du -sh *                     # size of each item in current directory
du -sh /home/*               # size of each user's home directory
du -h --max-depth=1 /var     # one level deep
du -ah /var/log              # all files, not just directories
```

### Finding What's Using Space

```bash
# Top 10 largest directories under /var
du -h --max-depth=1 /var | sort -rh | head -10

# Largest files on the system
find / -type f -exec du -h {} + 2>/dev/null | sort -rh | head -20

# Quick check of current directory
du -sh * | sort -rh
```

### du vs df Discrepancy

!!! warning "df and du can show different numbers"

    **`df`** reports from the filesystem's perspective (including space held by deleted-but-open files). **`du`** only counts visible files. When `df` shows more usage than `du` can account for, a process is holding a deleted file open. Find it with `lsof +L1 | grep deleted`.

`du` and `df` can show different numbers. `df` reports space from the filesystem's perspective (including space held by deleted-but-open files). `du` counts only visible files. If `df` shows full but `du` doesn't account for all the space, a process may be holding a deleted file open. Find it with:

```bash
lsof +L1    # files with zero link count (deleted but still held open)
```

```quiz
question: "Why might df show a disk as 90% full while du -sh / shows only 70% used?"
type: multiple-choice
options:
  - text: "df is inaccurate and du should always be trusted"
    feedback: "Both tools are accurate but measure different things. df reports filesystem-level usage, du measures visible files."
  - text: "Deleted files still held open by processes consume space that df sees but du doesn't"
    correct: true
    feedback: "Correct! When a file is deleted but a process still has it open, the disk blocks aren't freed until the process closes the file. df counts these blocks (filesystem level), but du can't see the deleted file. Use lsof +D /path | grep deleted to find them."
  - text: "du counts symlinks as full files while df doesn't"
    feedback: "Symlinks consume negligible space. The discrepancy is typically caused by deleted-but-open files or filesystem reserved blocks."
  - text: "df includes the kernel's memory usage"
    feedback: "df only reports disk usage, not memory. The discrepancy is usually from deleted-but-open files consuming blocks that du can't see."
```

---

## mount

[**`mount`**](https://github.com/util-linux/util-linux) attaches a filesystem to the directory tree.

### Viewing Mounts

```bash
mount                        # list all mounted filesystems
mount | grep ext4            # filter by type
findmnt                      # tree view of mounts (cleaner output)
findmnt -t ext4              # filter by filesystem type
```

!!! tip "Use findmnt for cleaner mount output"

    The plain **`mount`** command outputs a wall of text that's hard to parse. **`findmnt`** shows mounts as a tree with clean columns. Use `findmnt -t ext4,xfs` to filter by filesystem type, or `findmnt /data` to check a specific mount point. It's the modern replacement for `mount | grep`.

### Mounting a Filesystem

<div class="diagram-container">
<img src="../../assets/images/linux-essentials/filesystem-mount-hierarchy.svg" alt="Typical filesystem mount hierarchy showing root, boot, home, var, tmp, and mnt directories with their filesystem types">
</div>

```bash
mount /dev/sdb1 /mnt/data              # mount a partition
mount -t ext4 /dev/sdb1 /mnt/data      # specify filesystem type
mount -o ro /dev/sdb1 /mnt/data        # mount read-only
mount -o remount,rw /                   # remount root as read-write
```

```command-builder
base: mount
description: Build a mount command with common options
options:
  - flag: ""
    type: select
    label: "Device"
    explanation: "What to mount (UUID, device path, or network share)"
    choices:
      - ["/dev/sdb1", "Device path"]
      - ["UUID=xxxx-xxxx", "UUID"]
      - ["//server/share", "CIFS/SMB share"]
      - ["server:/export", "NFS share"]
  - flag: ""
    type: select
    label: "Mount point"
    explanation: "Where to mount it in the filesystem"
    choices:
      - ["/mnt", "/mnt"]
      - ["/data", "/data"]
      - ["/media/usb", "/media/usb"]
  - flag: "-t"
    type: select
    label: "Filesystem type"
    explanation: "Type of filesystem on the device"
    choices:
      - ["ext4", "ext4"]
      - ["xfs", "XFS"]
      - ["ntfs", "NTFS"]
      - ["cifs", "CIFS/SMB"]
      - ["nfs", "NFS"]
  - flag: "-o"
    type: select
    label: "Mount options"
    explanation: "Additional mount options"
    choices:
      - ["defaults", "Defaults"]
      - ["ro", "Read-only"]
      - ["noexec,nosuid", "Security hardened"]
      - ["noatime", "No access time updates (performance)"]
```

### Unmounting

```bash
umount /mnt/data                        # unmount by mount point
umount /dev/sdb1                        # unmount by device
```

If a filesystem is busy (files are open), `umount` will fail. Find what's using it:

```bash
lsof +D /mnt/data
fuser -vm /mnt/data
```

Then either close those files or force unmount (risky):

```bash
umount -l /mnt/data    # lazy unmount - detaches immediately, cleans up later
```

### /etc/fstab

The **`/etc/fstab`** file defines filesystems to mount at boot:

```
# <device>       <mount point>  <type>  <options>        <dump> <pass>
/dev/sda1        /              ext4    defaults         0      1
/dev/sda2        /home          ext4    defaults         0      2
UUID=abc123...   /data          xfs     defaults,noatime 0      2
/dev/sdb1        /mnt/backup    ext4    noauto,user      0      0
tmpfs            /tmp           tmpfs   defaults,size=2G 0      0
```

Fields:
- **device** - partition, UUID, or label
- **mount point** - where to mount
- **type** - filesystem type (ext4, xfs, tmpfs, etc.)
- **options** - mount options (comma-separated)
- **dump** - backup flag (usually 0)
- **pass** - fsck order (1 for root, 2 for others, 0 to skip)

```code-walkthrough
language: text
title: Understanding an fstab Entry
code: |
  UUID=b2c3d4e5-f6a7-8901-bcde-f12345678901  /  ext4  defaults,noatime  0  1
  UUID=d4e5f6a7-b8c9-0123-defa-234567890123  /data  xfs  defaults,nofail  0  2
  UUID=c3d4e5f6-a7b8-9012-cdef-123456789012  none  swap  sw  0  0
annotations:
  - line: 1
    text: "Root filesystem: UUID identifies the partition, / is the mount point, ext4 is the filesystem type, noatime skips access time updates for performance, 0 means no dump, 1 means fsck checks this first at boot."
  - line: 2
    text: "Data partition: mounted at /data, XFS filesystem, nofail prevents boot failure if this disk is missing (important for removable/secondary disks), fsck pass 2 means checked after root."
  - line: 3
    text: "Swap: 'none' for mount point (swap isn't mounted to a directory), 'sw' enables it as swap space, both dump and pass are 0 (no backup, no fsck - swap doesn't need either)."
```

```quiz
question: "In an fstab entry, what does the sixth field (fs_passno) control?"
type: multiple-choice
options:
  - text: "The password required to mount the filesystem"
    feedback: "fstab doesn't handle passwords. The sixth field controls the order of filesystem checks at boot."
  - text: "The number of times the filesystem can be mounted before requiring a check"
    feedback: "That's the mount count, configured with tune2fs. The sixth fstab field is about fsck order at boot."
  - text: "The order in which fsck checks filesystems at boot (0 means skip)"
    correct: true
    feedback: "Correct! 0 = don't check, 1 = check first (root filesystem), 2 = check after root. Setting this correctly prevents long boot times from serial fsck on multiple disks."
  - text: "The maximum number of mount passes before unmounting"
    feedback: "There's no such concept. The sixth field (pass number) tells fsck what order to check filesystems during boot."
```

Common options:
| Option | Meaning |
|--------|---------|
| `defaults` | rw, suid, dev, exec, auto, nouser, async |
| `noatime` | Don't update access time (improves performance) |
| `ro` | Read-only |
| `noexec` | Don't allow execution of binaries |
| `nosuid` | Ignore setuid/setgid bits |
| `noauto` | Don't mount at boot (mount manually) |
| `user` | Allow non-root users to mount |

Some options worth understanding:

!!! tip "noatime improves performance on SSDs"

    The **`noatime`** mount option stops the kernel from writing a new "last accessed" timestamp on every file read. On SSDs, this reduces unnecessary writes (extending drive life). On HDDs, it reduces I/O overhead. There's rarely a reason not to use it unless you have software that depends on access times.

- **`noatime`** stops the kernel from updating the 'last accessed' timestamp every time a file is read. On SSDs, this reduces unnecessary writes and improves performance. On HDDs with busy filesystems, it reduces I/O overhead. There's rarely a reason *not* to use `noatime` unless you have software that depends on access times.
- **`noexec`** prevents executing any binary on the filesystem. It's a security hardening measure commonly applied to `/tmp` - if an attacker writes a malicious binary to `/tmp`, they can't execute it directly. Note that it doesn't prevent `bash /tmp/script.sh` (which runs bash, not the script), so it's a layer of defense, not a complete solution.
- **`nosuid`** tells the kernel to ignore setuid and setgid bits on the filesystem. This is important for removable media and network mounts - you don't want someone plugging in a USB drive containing a setuid-root binary that could escalate privileges.

!!! tip "Use UUIDs in fstab instead of device names"

    Device names like `/dev/sdb1` can change between boots if disks are added, removed, or detected in a different order. **UUIDs** are stored on the filesystem itself and never change. Always use `UUID=...` in `/etc/fstab` instead of `/dev/sdX` paths. Run `blkid` to find UUIDs.

Using UUIDs instead of device names (like `/dev/sdb1`) is safer because device names can change between boots:

```bash
blkid                  # show UUIDs of all block devices
```

```quiz
question: "Why does fstab use UUIDs instead of device names like /dev/sdb1?"
type: multiple-choice
options:
  - text: "UUIDs are faster to look up than device names"
    feedback: "Performance isn't the reason. UUID lookup is actually slightly slower. The advantage is reliability."
  - text: "Device names can change between boots if disks are added or reordered"
    correct: true
    feedback: "Correct! Device names like /dev/sdb1 depend on detection order and can shift if you add, remove, or reorder disks. UUIDs are stored on the filesystem itself and never change, making mounts reliable regardless of hardware changes."
  - text: "UUIDs allow encryption of the device name"
    feedback: "UUIDs aren't about encryption. They're unique identifiers baked into the filesystem that don't change when hardware order changes."
  - text: "Modern kernels don't support device name mounting"
    feedback: "Device name mounting works fine. UUIDs are preferred because device names (/dev/sdX) can change if disk detection order changes."
```

After editing `/etc/fstab`, test it before rebooting:

```bash
mount -a    # mount everything in fstab that isn't already mounted
```

---

## lsblk - Block Devices

[**`lsblk`**](https://github.com/util-linux/util-linux) lists block devices (disks, partitions, loop devices) in a tree format.

```bash
lsblk                    # basic tree view
lsblk -f                 # include filesystem type, label, and UUID
lsblk -o NAME,SIZE,TYPE,MOUNTPOINT,FSTYPE    # custom columns
```

Example output:

```
NAME   MAJ:MIN RM   SIZE RO TYPE MOUNTPOINT
sda      8:0    0   500G  0 disk
├─sda1   8:1    0    50G  0 part /
├─sda2   8:2    0   200G  0 part /home
└─sda3   8:3    0   250G  0 part /data
sdb      8:16   0     1T  0 disk
└─sdb1   8:17   0     1T  0 part /mnt/backup
sr0     11:0    1  1024M  0 rom
```

```terminal
title: Viewing Disk Layout with lsblk
steps:
  - command: "lsblk"
    output: |
      NAME   MAJ:MIN RM   SIZE RO TYPE MOUNTPOINTS
      sda      8:0    0    50G  0 disk
      ├─sda1   8:1    0   512M  0 part /boot
      ├─sda2   8:2    0    45G  0 part /
      └─sda3   8:3    0   4.5G  0 part [SWAP]
      sdb      8:16   0   100G  0 disk
      └─sdb1   8:17   0   100G  0 part /data
    narration: "lsblk shows the block device hierarchy as a tree. sda has 3 partitions (boot, root, swap). sdb has one partition mounted at /data."
  - command: "lsblk -f"
    output: |
      NAME   FSTYPE FSVER LABEL UUID                                 MOUNTPOINTS
      sda
      ├─sda1 ext4   1.0         a1b2c3d4-e5f6-7890-abcd-ef1234567890 /boot
      ├─sda2 ext4   1.0         b2c3d4e5-f6a7-8901-bcde-f12345678901 /
      └─sda3 swap   1           c3d4e5f6-a7b8-9012-cdef-123456789012 [SWAP]
      sdb
      └─sdb1 xfs              d4e5f6a7-b8c9-0123-defa-234567890123 /data
    narration: "-f adds filesystem type, label, and UUID columns. These UUIDs are what fstab should use instead of device names like /dev/sda1."
  - command: "df -h"
    output: |
      Filesystem      Size  Used Avail Use% Mounted on
      /dev/sda2        45G   12G   31G  28% /
      /dev/sda1       488M  120M  333M  27% /boot
      /dev/sdb1        99G   45G   54G  46% /data
    narration: "df -h shows how much space is used on each mounted filesystem. -h gives human-readable sizes (G, M instead of blocks)."
```

---

## Partition Management

### fdisk

[**`fdisk`**](https://github.com/util-linux/util-linux) manages MBR partition tables (disks up to 2TB, max 4 primary partitions):

```bash
fdisk -l                   # list all partitions on all disks
fdisk -l /dev/sdb          # list partitions on a specific disk
fdisk /dev/sdb             # interactive partition editor
```

Inside `fdisk`:

| Command | Action |
|---------|--------|
| `p` | Print partition table |
| `n` | Create new partition |
| `d` | Delete partition |
| `t` | Change partition type |
| `w` | Write changes and exit |
| `q` | Quit without saving |

### parted

[**`parted`**](https://www.gnu.org/software/parted/) manages GPT partition tables (supports disks larger than 2TB):

```bash
parted -l                            # list all partitions
parted /dev/sdb print                # print partition table
parted /dev/sdb mklabel gpt         # create GPT partition table
parted /dev/sdb mkpart primary ext4 0% 100%   # create partition using full disk
```

**When to choose fdisk vs parted:** `fdisk` works with **MBR** (Master Boot Record) partition tables. MBR has a 2TB per-disk limit and supports a maximum of 4 primary partitions (or 3 primary + 1 extended partition containing logical partitions). `parted` works with **GPT** (GUID Partition Table), which supports disks larger than 2TB, up to 128 partitions by default, and is required for UEFI boot. For any new system with disks over 2TB or that uses UEFI, use `parted` with GPT. For older systems with MBR, or when modifying existing MBR layouts, use `fdisk`. Modern versions of `fdisk` can also handle GPT, but `parted` is the standard tool for it.

---

## Creating Filesystems

**`mkfs`** creates (formats) a filesystem on a partition:

```bash
mkfs.ext4 /dev/sdb1          # create ext4 filesystem
mkfs.xfs /dev/sdb1           # create XFS filesystem
mkfs.vfat /dev/sdb1          # create FAT32 filesystem (USB drives)
```

Options:

```bash
mkfs.ext4 -L "backups" /dev/sdb1         # set a label
mkfs.ext4 -m 1 /dev/sdb1                 # reserve only 1% for root (default is 5%)
```

!!! warning "XFS filesystems can be grown but not shrunk"

    Once you create an **XFS** filesystem, you can expand it with `xfs_growfs` but you can **never shrink** it. If you might need to resize partitions smaller in the future, choose **ext4** instead, which supports both growing (`resize2fs`) and shrinking. Plan your XFS partition sizes carefully.

**ext4 vs XFS:** **ext4** is the default choice on most Linux distributions. It's well-tested, has excellent tooling ([`e2fsck`](https://e2fsprogs.sourceforge.net/), `tune2fs`, `resize2fs`), and handles general workloads well. [**XFS**](https://xfs.wiki.kernel.org/) excels at handling large files and parallel I/O - it's the default on RHEL/CentOS and a strong choice for database servers, media storage, or any workload with many concurrent large writes. XFS can't be shrunk after creation (only grown), while ext4 can be both grown and shrunk. For most use cases, go with your distribution's default.

---

## Filesystem Checks

**`fsck`** checks and repairs filesystems. Only run this on unmounted or read-only filesystems.

!!! danger "Never run fsck on a mounted filesystem"

    Running **`fsck`** on a mounted filesystem can **corrupt data irreversibly**. The kernel's in-memory metadata cache and `fsck`'s direct disk writes will conflict, causing lost files, broken directories, or an unmountable filesystem. Always unmount first, or boot from a live USB to check the root partition.

```bash
fsck /dev/sdb1               # check and prompt for repairs
fsck -y /dev/sdb1            # automatically fix errors
fsck -n /dev/sdb1            # check only, don't fix anything
```

For ext4 specifically:

```bash
e2fsck -f /dev/sdb1          # force check even if clean
tune2fs -l /dev/sdb1         # show filesystem metadata (last check, mount count, etc.)
```

Running `fsck` on a mounted filesystem can cause data corruption. The reason is that the mounted kernel has its own in-memory view of the filesystem's metadata (which blocks belong to which files, free space maps, directory entries). When `fsck` reads and writes to the raw disk device, it modifies on-disk structures that the kernel doesn't know about. The kernel's cached metadata now disagrees with what's on disk, leading to corrupted files, lost data, or an unmountable filesystem. Always unmount first, or boot from a live USB to check the root filesystem.

---

## Practical Scenarios

### Disk Full - Finding the Cause

```bash
# 1. Check which filesystem is full
df -h

# 2. Find the largest directories
du -h --max-depth=1 /var | sort -rh | head

# 3. Find large files
find /var -type f -size +100M -exec ls -lh {} +

# 4. Check for deleted files still held open
lsof +L1
```

```exercise
title: Diagnose a Full Disk
difficulty: intermediate
scenario: |
  A server is reporting "No space left on device" errors. You need to diagnose the problem.
  The tricky part: du reports less usage than df shows, suggesting some space is consumed
  by deleted-but-open files.

  Find the largest directories, identify any deleted files still held open by processes,
  and free the space.
hints:
  - "Start with df -h to see which filesystem is full"
  - "Use du -sh /* | sort -rh | head -10 to find the largest top-level directories"
  - "Use lsof +L1 to find deleted files still held open (link count < 1)"
  - "To free space from deleted-but-open files, restart the process holding them open, or truncate with : > /proc/PID/fd/FD"
solution: |
  ```bash
  # Step 1: Which filesystem is full?
  df -h

  # Step 2: Find largest directories
  du -sh /* 2>/dev/null | sort -rh | head -10

  # Step 3: Drill down into the largest directory
  du -sh /var/* 2>/dev/null | sort -rh | head -10

  # Step 4: Find deleted-but-open files consuming space
  lsof +L1 | grep deleted

  # Step 5: If a large deleted file is found, either:
  # Option A: Restart the process
  systemctl restart service-name

  # Option B: Truncate the file descriptor (advanced)
  : > /proc/PID/fd/FD_NUMBER
  ```

  The lsof +L1 technique is crucial for the df/du discrepancy. A common
  culprit is a log file that was deleted while the application still has it open.
  The space isn't freed until the file descriptor is closed.
```

### Adding a New Disk

<div class="diagram-container">
<img src="../../assets/images/linux-essentials/new-disk-workflow.svg" alt="New disk workflow showing steps from lsblk through parted, mkfs, mkdir, mount, blkid, fstab, to mount -a">
</div>

```bash
# 1. Identify the new disk
lsblk

# 2. Create a partition
parted /dev/sdb mklabel gpt
parted /dev/sdb mkpart primary ext4 0% 100%

# 3. Create a filesystem
mkfs.ext4 /dev/sdb1

# 4. Create mount point and mount
mkdir -p /mnt/data
mount /dev/sdb1 /mnt/data

# 5. Add to fstab for persistence
blkid /dev/sdb1    # get UUID
echo 'UUID=your-uuid-here /mnt/data ext4 defaults 0 2' >> /etc/fstab

# 6. Verify
mount -a
df -h /mnt/data
```

---

## Further Reading

- [e2fsprogs](https://e2fsprogs.sourceforge.net/) - ext2/ext3/ext4 filesystem utilities including mkfs.ext4, e2fsck, and tune2fs
- [XFS Wiki](https://xfs.wiki.kernel.org/) - XFS filesystem documentation and administration guides
- [util-linux](https://github.com/util-linux/util-linux) - collection of system utilities including fdisk, lsblk, mount, and more
- [Linux Kernel Filesystem Documentation](https://www.kernel.org/doc/html/latest/) - kernel-level filesystem and block device documentation

---

**Previous:** [Scripting Fundamentals](scripting-fundamentals.md) | **Next:** [Networking](networking.md) | [Back to Index](README.md)
