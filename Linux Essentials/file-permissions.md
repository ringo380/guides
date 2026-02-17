# File Permissions

Every file and directory on a Linux system has an owner, a group, and a set of permission bits that control who can read, write, and execute it. Understanding this model is essential for system administration and security.

---

## The Permission Model

Linux uses three levels of access:

| Level | Meaning |
|-------|---------|
| **User (u)** | The file's owner |
| **Group (g)** | Members of the file's group |
| **Other (o)** | Everyone else |

Each level has three permissions:

| Permission | Files | Directories |
|-----------|-------|-------------|
| **Read (r)** | View file contents | List directory contents |
| **Write (w)** | Modify file contents | Create, delete, rename files in directory |
| **Execute (x)** | Run as a program | Enter (cd into) the directory |

---

## Reading ls -l Output

```bash
$ ls -l
-rwxr-xr-- 1 ryan developers 4096 Jan 15 10:30 deploy.sh
drwxrwxr-x 3 ryan developers 4096 Jan 15 10:30 scripts/
lrwxrwxrwx 1 ryan developers   12 Jan 15 10:30 link -> target
```

Breaking down `-rwxr-xr--`:

| Position | Meaning | Value |
|----------|---------|-------|
| 1 | File type | `-` regular, `d` directory, `l` symlink |
| 2-4 | User permissions | `rwx` (read, write, execute) |
| 5-7 | Group permissions | `r-x` (read, execute) |
| 8-10 | Other permissions | `r--` (read only) |

The remaining columns show: link count, owner, group, size, modification time, and name.

---

## [chmod](https://www.gnu.org/software/coreutils/manual/) - Changing Permissions

### Symbolic Mode

Symbolic mode uses letters to add, remove, or set permissions:

```bash
chmod u+x script.sh        # add execute for user
chmod g+rw file.txt         # add read and write for group
chmod o-w file.txt          # remove write for others
chmod a+r file.txt          # add read for all (user, group, other)
chmod go-rwx secret.txt     # remove all permissions for group and others
chmod u+x,g+r file.txt     # multiple changes at once
chmod u=rwx,g=rx,o=r file   # set exact permissions
```

The operators:
- `+` adds permissions
- `-` removes permissions
- `=` sets exact permissions (removes anything not specified)

### Octal Mode

Each permission has a numeric value:

| Permission | Value |
|-----------|-------|
| Read (r) | 4 |
| Write (w) | 2 |
| Execute (x) | 1 |

Add the values together for each level. Three digits represent user, group, and other:

| Octal | Symbolic | Meaning |
|-------|----------|---------|
| `755` | `rwxr-xr-x` | Owner full, others read/execute |
| `644` | `rw-r--r--` | Owner read/write, others read only |
| `700` | `rwx------` | Owner full, others nothing |
| `600` | `rw-------` | Owner read/write, others nothing |
| `775` | `rwxrwxr-x` | Owner/group full, others read/execute |
| `666` | `rw-rw-rw-` | Everyone read/write (usually a bad idea) |

To calculate octal permissions from a symbolic string like `rwxr-xr-x`, work through each group of three:

- **User `rwx`**: r(4) + w(2) + x(1) = **7**
- **Group `r-x`**: r(4) + 0 + x(1) = **5**
- **Other `r-x`**: r(4) + 0 + x(1) = **5**

Result: **755**. Going the other direction, if someone tells you to `chmod 640`, break it down: 6 = r+w, 4 = r, 0 = nothing. So `640` means `rw-r-----` - the owner can read and write, the group can read, and others have no access.

```bash
chmod 755 script.sh
chmod 644 config.txt
chmod 600 id_rsa
```

### Recursive

```bash
chmod -R 755 directory/     # apply to directory and all contents
```

Be careful with recursive chmod. You usually don't want the same permissions on files and directories (files shouldn't be executable unless they're scripts). A common pattern:

```bash
# Set directories to 755, files to 644
find /var/www -type d -exec chmod 755 {} +
find /var/www -type f -exec chmod 644 {} +
```

---

## [chown](https://www.gnu.org/software/coreutils/manual/) and chgrp

### chown - Change Owner

```bash
chown ryan file.txt              # change owner
chown ryan:developers file.txt   # change owner and group
chown :developers file.txt       # change group only
chown -R ryan:developers dir/    # recursive
```

### chgrp - Change Group

```bash
chgrp developers file.txt        # change group
chgrp -R developers dir/         # recursive
```

Only root can change a file's owner. Regular users can change the group to any group they belong to.

The reason only root can change file ownership is to prevent two abuses. First, **quota bypass**: if users could give their files to other users, they could evade disk quotas by assigning large files to someone else's account. Second, **setuid abuse**: if a user could create a program, set the setuid bit, then change ownership to root, they'd have a root-owned setuid binary - an instant privilege escalation. Restricting `chown` to root prevents both scenarios.

---

## umask

The **`umask`** sets the default permissions for newly created files and directories. It works by masking (removing) permissions from the maximum defaults.

The maximum defaults are:
- Files: `666` (no execute by default)
- Directories: `777`

The umask is *bitwise masked* from these maximums. You can think of it as subtraction for common values, but it's technically a bitwise AND NOT operation:

| umask | File permissions | Directory permissions |
|-------|-----------------|----------------------|
| `022` | `644` (rw-r--r--) | `755` (rwxr-xr-x) |
| `027` | `640` (rw-r-----) | `750` (rwxr-x---) |
| `077` | `600` (rw-------) | `700` (rwx------) |
| `002` | `664` (rw-rw-r--) | `775` (rwxrwxr-x) |

Here's how the mask works concretely. With a umask of `027`:

- **Files**: start with `666`, mask off `027`. The result is `640` (`rw-r-----`). The owner keeps read/write, the group keeps read, and others get nothing.
- **Directories**: start with `777`, mask off `027`. The result is `750` (`rwxr-x---`). The owner gets full access, the group can read and enter, others are locked out.

Technically, the umask is a bitwise AND NOT operation (`default AND (NOT umask)`), but thinking of it as 'subtract these permissions' gives the right answer for all common values. To make the umask permanent, add it to your `~/.bashrc` or `~/.profile`:

```bash
umask 027
```

In scripts, setting a restrictive umask at the top ensures any files the script creates are protected by default.

```bash
umask            # display current umask
umask 022        # set umask
umask -S         # display in symbolic form (u=rwx,g=rx,o=rx)
```

The typical default is `022`, which gives the owner full access and everyone else read access.

---

## Special Permission Bits

Three additional permission bits exist beyond the standard read/write/execute.

### Setuid (4)

When set on an executable, the program runs with the permissions of the **file's owner** instead of the user who launched it.

```bash
ls -l /usr/bin/passwd
-rwsr-xr-x 1 root root 68208 Mar 14 11:31 /usr/bin/passwd
```

The `s` in the user execute position means setuid is set. This is why regular users can run `passwd` to change their password - it needs to write to `/etc/shadow`, which is owned by root.

```bash
chmod u+s program          # set setuid
chmod 4755 program         # set setuid with octal (note the leading 4)
```

### Setgid (2)

On executables, the program runs with the **file's group** permissions.

On directories, new files created inside inherit the directory's group instead of the creating user's primary group. This is useful for shared directories.

```bash
ls -l
drwxrwsr-x 2 ryan developers 4096 Jan 15 10:30 shared/
```

The `s` in the group execute position indicates setgid.

```bash
chmod g+s directory/       # set setgid on directory
chmod 2775 directory/      # set setgid with octal (note the leading 2)
```

### Sticky Bit (1)

When set on a directory, only the file's owner (or root) can delete or rename files within it. Other users can create files but can't delete each other's files.

The classic example is `/tmp`:

```bash
ls -ld /tmp
drwxrwxrwt 15 root root 4096 Jan 15 10:30 /tmp/
```

The `t` in the other execute position indicates the sticky bit.

```bash
chmod +t directory/        # set sticky bit
chmod 1777 directory/      # set sticky bit with octal (note the leading 1)
```

### Special Bits Summary

| Bit | Octal | On Files | On Directories |
|-----|-------|----------|----------------|
| Setuid | 4 | Run as file owner | No effect |
| Setgid | 2 | Run as file group | New files inherit directory group |
| Sticky | 1 | No effect | Only owner can delete files |

### Combined

The leading digit in octal mode sets all three:

```bash
chmod 4755 program      # setuid + rwxr-xr-x
chmod 2775 shared/      # setgid + rwxrwxr-x
chmod 1777 /tmp         # sticky + rwxrwxrwx
```

---

## Practical Examples

### Securing SSH Keys

```bash
chmod 700 ~/.ssh
chmod 600 ~/.ssh/id_rsa          # private key - owner read/write only
chmod 644 ~/.ssh/id_rsa.pub      # public key - readable by all
chmod 600 ~/.ssh/authorized_keys
```

### Web Server Directory

```bash
chown -R www-data:www-data /var/www/html
find /var/www/html -type d -exec chmod 755 {} +
find /var/www/html -type f -exec chmod 644 {} +
```

### Shared Project Directory

```bash
mkdir /opt/project
chown root:developers /opt/project
chmod 2775 /opt/project    # setgid so new files belong to 'developers' group
```

### Finding Permission Issues

```bash
# Find world-writable files
find / -type f -perm -002 2>/dev/null

# Find setuid programs
find / -type f -perm -4000 2>/dev/null

# Find files not owned by any user
find / -nouser 2>/dev/null
```

---

## Further Reading

- [GNU Coreutils Manual](https://www.gnu.org/software/coreutils/manual/) - official documentation for chmod, chown, and other file utilities
- [POSIX File Permissions](https://pubs.opengroup.org/onlinepubs/9799919799/) - portable specification for file permission semantics
- [Linux man-pages Project](https://man7.org/linux/man-pages/) - manual pages for chmod(1), chown(1), and related system calls

---

**Previous:** [Finding Files](finding-files.md) | **Next:** [Job Control](job-control.md) | [Back to Index](README.md)
