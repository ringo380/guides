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
- **Avail** - space remaining
- **Use%** - percentage used
- **Mounted on** - where the filesystem is accessible

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

`du` and `df` can show different numbers. `df` reports space from the filesystem's perspective (including space held by deleted-but-open files). `du` counts only visible files. If `df` shows full but `du` doesn't account for all the space, a process may be holding a deleted file open. Find it with:

```bash
lsof +D /var/log | grep deleted
```

---

## mount

**`mount`** attaches a filesystem to the directory tree.

### Viewing Mounts

```bash
mount                        # list all mounted filesystems
mount | grep ext4            # filter by type
findmnt                      # tree view of mounts (cleaner output)
findmnt -t ext4              # filter by filesystem type
```

### Mounting a Filesystem

```bash
mount /dev/sdb1 /mnt/data              # mount a partition
mount -t ext4 /dev/sdb1 /mnt/data      # specify filesystem type
mount -o ro /dev/sdb1 /mnt/data        # mount read-only
mount -o remount,rw /                   # remount root as read-write
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

Using UUIDs instead of device names (like `/dev/sdb1`) is safer because device names can change between boots:

```bash
blkid                  # show UUIDs of all block devices
```

After editing `/etc/fstab`, test it before rebooting:

```bash
mount -a    # mount everything in fstab that isn't already mounted
```

---

## lsblk - Block Devices

**`lsblk`** lists block devices (disks, partitions, loop devices) in a tree format.

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

---

## Partition Management

### fdisk

**`fdisk`** manages MBR partition tables (disks up to 2TB, max 4 primary partitions):

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

**`parted`** manages GPT partition tables (supports disks larger than 2TB):

```bash
parted -l                            # list all partitions
parted /dev/sdb print                # print partition table
parted /dev/sdb mklabel gpt         # create GPT partition table
parted /dev/sdb mkpart primary ext4 0% 100%   # create partition using full disk
```

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

---

## Filesystem Checks

**`fsck`** checks and repairs filesystems. Only run this on unmounted or read-only filesystems.

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

Running `fsck` on a mounted filesystem can cause data corruption. If you need to check the root filesystem, boot into single-user mode or use a live USB.

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
lsof +D /var | grep deleted
```

### Adding a New Disk

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
