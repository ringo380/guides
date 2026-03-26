# User and Group Management

Linux is a multi-user operating system. Every process runs as some user, every file is owned by some user, and access control decisions are made based on user and group identity. Whether you're creating accounts for team members, setting up service accounts for daemons, or configuring sudo access, user and group management is a daily sysadmin task.

---

## The Identity Model: UIDs and GIDs

Every user on a Linux system has a numeric **User ID** (UID) and belongs to at least one **Group ID** (GID). The kernel doesn't care about usernames - it works entirely with these numbers. Usernames are just a human-friendly mapping stored in configuration files.

| UID Range | Purpose |
|-----------|---------|
| 0 | Root (superuser) |
| 1-999 | System/service accounts (created by packages) |
| 1000+ | Regular user accounts |

The root user (UID 0) bypasses all permission checks. System accounts in the 1-999 range are used by services like `sshd`, `www-data`, and `postgres` - they typically have no login shell and no home directory.

---

## Understanding the Identity Files

Three files form the core of Linux's local user database.

### /etc/passwd

Every user account has a line in `/etc/passwd`:

```
jdoe:x:1001:1001:Jane Doe:/home/jdoe:/bin/bash
```

| Field | Value | Meaning |
|-------|-------|---------|
| 1 | `jdoe` | Username |
| 2 | `x` | Password placeholder (actual hash is in /etc/shadow) |
| 3 | `1001` | UID |
| 4 | `1001` | Primary GID |
| 5 | `Jane Doe` | GECOS field (full name, contact info) |
| 6 | `/home/jdoe` | Home directory |
| 7 | `/bin/bash` | Login shell |

This file is world-readable - every process on the system needs to map UIDs to usernames. That's why password hashes were moved out of it decades ago.

### /etc/shadow

[**`/etc/shadow`**](https://man7.org/linux/man-pages/man5/shadow.5.html) stores the actual password hashes and aging information. It's readable only by root:

```
jdoe:$6$rounds=5000$salt$hash:19800:0:99999:7:::
```

| Field | Meaning |
|-------|---------|
| 1 | Username |
| 2 | Password hash (or `!`/`*` if locked) |
| 3 | Date of last password change (days since epoch) |
| 4 | Minimum days between password changes |
| 5 | Maximum days before password must be changed |
| 6 | Warning days before expiration |
| 7 | Days after expiration before account is disabled |
| 8 | Account expiration date |

A password field starting with `!` or `*` means the account is locked - no password login is possible. This is standard for system accounts.

!!! tip "Password hash prefixes"
    The hash format indicates the algorithm: `$1$` is MD5 (obsolete), `$5$` is SHA-256, `$6$` is SHA-512 (current default on most distributions), and `$y$` is yescrypt (newer, used by Fedora 39+).

### /etc/group

Group definitions live in `/etc/group`:

```
developers:x:1002:jdoe,asmith,bwilson
```

| Field | Meaning |
|-------|---------|
| 1 | Group name |
| 2 | Group password placeholder (rarely used) |
| 3 | GID |
| 4 | Comma-separated list of supplementary members |

A user's **primary group** is set in `/etc/passwd` (field 4). **Supplementary groups** are listed in `/etc/group` (field 4). A user can belong to many supplementary groups simultaneously.

```quiz
question: "In /etc/passwd, the line reads: sshd:x:74:74:Privilege-separated SSH:/usr/share/empty.sshd:/sbin/nologin. What does /sbin/nologin in the last field mean?"
type: multiple-choice
options:
  - text: "The account cannot be used for interactive login - any login attempt is rejected with a polite message"
    correct: true
    feedback: "Correct. /sbin/nologin is a shell replacement that prints 'This account is currently not available' and exits. It's standard for service accounts that should never have interactive shell access."
  - text: "The user's password has expired and they need to reset it"
    feedback: "Password expiration is tracked in /etc/shadow, not by the login shell field."
  - text: "The account is deleted but the entry hasn't been cleaned up yet"
    feedback: "A /sbin/nologin shell is intentional - it's how service accounts are configured for security."
  - text: "The user can only log in via SSH, not from the console"
    feedback: "/sbin/nologin blocks all interactive login methods, including SSH. SSH to such an account would also be rejected."
```

---

## Creating and Managing Users

### useradd

[**`useradd`**](https://man7.org/linux/man-pages/man8/useradd.8.html) creates new user accounts:

```bash
# Create a user with default settings
sudo useradd jdoe

# Create a user with home directory, shell, and comment
sudo useradd -m -s /bin/bash -c "Jane Doe" jdoe

# Create a system account (no home dir, no login shell)
sudo useradd -r -s /sbin/nologin myservice

# Create a user with a specific UID and primary group
sudo useradd -u 1500 -g developers jdoe

# Create a user with supplementary groups
sudo useradd -m -s /bin/bash -G sudo,docker jdoe
```

| Flag | Purpose |
|------|---------|
| `-m` | Create the home directory (copies files from `/etc/skel`) |
| `-s` | Set the login shell |
| `-c` | Set the GECOS comment (usually full name) |
| `-r` | Create a system account (UID below 1000) |
| `-u` | Specify the UID |
| `-g` | Set the primary group (name or GID) |
| `-G` | Set supplementary groups (comma-separated) |
| `-d` | Set the home directory path |
| `-e` | Set account expiration date (YYYY-MM-DD) |

The `-m` flag is important - without it on many distributions, the home directory isn't created. The home directory is populated from `/etc/skel/`, which typically contains default `.bashrc`, `.profile`, and `.bash_logout` files.

!!! warning "useradd vs adduser"
    On Debian/Ubuntu, `adduser` is a higher-level wrapper that interactively prompts for a password and details. On RHEL, `adduser` is just a symlink to `useradd`. For scripts and automation, always use `useradd` for consistent behavior across distributions.

### Setting Passwords

`useradd` doesn't set a password. Use `passwd` afterward:

```bash
# Set or change a user's password (interactive)
sudo passwd jdoe

# Lock an account (prefix the hash with !)
sudo passwd -l jdoe

# Unlock an account
sudo passwd -u jdoe

# Force password change on next login
sudo passwd -e jdoe

# Check password status
sudo passwd -S jdoe
```

### usermod

[**`usermod`**](https://man7.org/linux/man-pages/man8/usermod.8.html) modifies existing accounts:

```bash
# Change the login shell
sudo usermod -s /bin/zsh jdoe

# Change the home directory (and move files)
sudo usermod -d /home/newdir -m jdoe

# Add to supplementary groups (KEEP existing groups with -a)
sudo usermod -aG docker jdoe

# Change the username
sudo usermod -l newname oldname

# Lock the account
sudo usermod -L jdoe

# Set an account expiration date
sudo usermod -e 2026-12-31 jdoe
```

!!! danger "The -aG trap"
    `sudo usermod -G docker jdoe` without `-a` REPLACES all supplementary groups with just `docker`. Always use `-aG` (append) to add a user to a group without removing them from existing groups. This mistake has locked people out of sudo access.

### userdel

```bash
# Remove a user (keeps home directory)
sudo userdel jdoe

# Remove a user and their home directory
sudo userdel -r jdoe
```

```terminal
title: "Creating a User and Managing Group Membership"
steps:
  - command: "sudo useradd -m -s /bin/bash -c 'Jane Doe' jdoe"
    output: ""
    narration: "Create a new user with a home directory (-m), bash shell (-s), and full name comment (-c). No output on success - Linux convention."
  - command: "sudo passwd jdoe"
    output: "New password:\nRetype new password:\npasswd: password updated successfully"
    narration: "Set the password interactively. In a script, you'd use chpasswd instead: echo 'jdoe:password' | sudo chpasswd"
  - command: "id jdoe"
    output: "uid=1001(jdoe) gid=1001(jdoe) groups=1001(jdoe)"
    narration: "id shows the user's UID, primary GID, and all group memberships. Right now jdoe is only in their own default group."
  - command: "sudo usermod -aG sudo,docker jdoe"
    output: ""
    narration: "Add jdoe to the sudo and docker groups. The -a flag is critical - without it, usermod replaces all supplementary groups instead of appending."
  - command: "id jdoe"
    output: "uid=1001(jdoe) gid=1001(jdoe) groups=1001(jdoe),27(sudo),998(docker)"
    narration: "Now jdoe belongs to three groups: their own primary group, sudo (for administrative access), and docker (for container management)."
  - command: "getent passwd jdoe"
    output: "jdoe:x:1001:1001:Jane Doe:/home/jdoe:/bin/bash"
    narration: "getent queries the name service switch, which includes /etc/passwd plus any configured directory services (LDAP, SSSD). It's the reliable way to look up user information."
  - command: "ls -la /home/jdoe/"
    output: "total 20\ndrwxr-x--- 2 jdoe jdoe 4096 Mar 25 14:00 .\ndrwxr-xr-x 5 root root 4096 Mar 25 14:00 ..\n-rw-r--r-- 1 jdoe jdoe  220 Mar 25 14:00 .bash_logout\n-rw-r--r-- 1 jdoe jdoe 3771 Mar 25 14:00 .bashrc\n-rw-r--r-- 1 jdoe jdoe  807 Mar 25 14:00 .profile"
    narration: "The home directory was created by useradd -m and populated from /etc/skel. These default dotfiles give the user a working bash environment."
```

---

## Creating and Managing Groups

### Group Commands

```bash
# Create a new group
sudo groupadd developers

# Create a group with a specific GID
sudo groupadd -g 2000 developers

# Rename a group
sudo groupmod -n dev-team developers

# Delete a group (fails if it's any user's primary group)
sudo groupdel dev-team

# Add a user to a group (alternative to usermod -aG)
sudo gpasswd -a jdoe developers

# Remove a user from a group
sudo gpasswd -d jdoe developers

# List members of a group
getent group developers
```

### Primary vs Supplementary Groups

Every user has exactly one **primary group** (set in `/etc/passwd`). When that user creates a file, it's owned by their primary group by default. **Supplementary groups** provide additional access without changing file creation defaults.

```bash
# Check a user's groups
groups jdoe

# Temporarily switch primary group for the current session
newgrp developers
```

After running `newgrp developers`, new files created in that session will be owned by the `developers` group instead of the user's default primary group.

---

## The sudo System

[**`sudo`**](https://www.sudo.ws/docs/man/sudo.man/) allows authorized users to run commands as root (or another user) without sharing the root password. Configuration lives in `/etc/sudoers`.

### Viewing Your Privileges

```bash
# List what sudo commands you can run
sudo -l

# Run a command as another user
sudo -u postgres psql

# Open a root shell
sudo -i

# Run a command with another user's environment
sudo -u deploy -i -- /opt/app/deploy.sh
```

### Editing sudoers Safely

Never edit `/etc/sudoers` directly - a syntax error can lock you out of sudo entirely. Always use `visudo`:

```bash
# Edit the main sudoers file
sudo visudo

# Edit a drop-in file (preferred for custom rules)
sudo visudo -f /etc/sudoers.d/developers
```

`visudo` validates the syntax before saving. If there's an error, it gives you the option to re-edit instead of saving a broken file.

### sudoers Syntax

```bash
# User jdoe can run any command as any user on any host
jdoe    ALL=(ALL:ALL) ALL

# Members of the sudo group can run any command
%sudo   ALL=(ALL:ALL) ALL

# Members of developers can restart nginx without a password
%developers ALL=(ALL) NOPASSWD: /usr/bin/systemctl restart nginx

# User deploy can run specific deployment commands as www-data
deploy  ALL=(www-data) NOPASSWD: /opt/app/deploy.sh, /usr/bin/systemctl restart myapp
```

The format is: `who host=(runas_user:runas_group) commands`

| Field | Meaning |
|-------|---------|
| `who` | Username or `%groupname` |
| `host` | Hostname this rule applies on (usually `ALL`) |
| `(runas)` | Which user/group to run as (`ALL` = any) |
| `commands` | Comma-separated list of allowed commands (full paths) |

```code-walkthrough
language: bash
title: Anatomy of a sudoers Entry
code: |
  %developers ALL=(ALL) NOPASSWD: /usr/bin/systemctl restart nginx, \
                                  /usr/bin/systemctl restart myapp, \
                                  /usr/bin/systemctl status *
annotations:
  - line: 1
    text: "The % prefix means this rule applies to a group, not a user. %developers matches all members of the 'developers' group. Without %, it would match a user named 'developers'."
  - line: 1
    text: "The first ALL is the host field. ALL means this rule applies on any host. In multi-server environments with shared sudoers (via LDAP/SSSD), you can restrict rules to specific hostnames."
  - line: 1
    text: "(ALL) is the runas specification - which user the commands run as. (ALL) means any user, including root. (www-data) would restrict to only running commands as www-data."
  - line: 1
    text: "NOPASSWD: means these commands run without prompting for the user's password. Remove it to require password confirmation. NOPASSWD should only be used for specific commands, not broad access."
  - line: 1
    text: "/usr/bin/systemctl restart nginx is a fully qualified command path. sudoers requires absolute paths - 'systemctl' alone would not work. This restricts the rule to exactly this command with these arguments."
  - line: 2
    text: "The backslash continues the rule onto the next line. Multiple commands are separated by commas. Each command must include its full path."
  - line: 3
    text: "The * wildcard in 'systemctl status *' allows any argument after 'status'. Members can check the status of any service, but can only restart nginx and myapp specifically."
```

### Drop-in Files

Rather than modifying the main `/etc/sudoers` file, use drop-in files in `/etc/sudoers.d/`:

```bash
# Create a rule for the developers group
sudo visudo -f /etc/sudoers.d/developers
```

```bash
# /etc/sudoers.d/developers
%developers ALL=(ALL) NOPASSWD: /usr/bin/systemctl restart nginx, \
                                /usr/bin/systemctl restart myapp, \
                                /usr/bin/systemctl status *
```

!!! warning "NOPASSWD and security"
    `NOPASSWD` is convenient for automation and specific service management commands, but giving broad `NOPASSWD: ALL` access is effectively the same as giving away the root password. Limit `NOPASSWD` to specific commands that need to run non-interactively.

Drop-in files must have no `.` or `~` in the filename (sudoers ignores files with those characters) and must have mode `0440`.

```quiz
question: "You add a user to the sudo group with usermod -aG sudo jdoe, but when jdoe runs sudo, they get 'jdoe is not in the sudoers file'. The user confirmed they logged out and back in. What's most likely wrong?"
type: multiple-choice
options:
  - text: "The system uses a wheel group instead of sudo for admin access (common on RHEL/Fedora)"
    correct: true
    feedback: "Correct. Debian/Ubuntu use the 'sudo' group for admin access, while RHEL/Fedora/CentOS use the 'wheel' group. The /etc/sudoers file has a rule for whichever group that distribution uses by default."
  - text: "The -aG flag doesn't work for the sudo group specifically"
    feedback: "The -aG flag works the same for all groups, including sudo. The issue is which group the sudoers file grants access to."
  - text: "usermod changes don't take effect until the system reboots"
    feedback: "Group changes take effect on the next login, not on reboot. Since the user logged out and back in, the group membership is active."
  - text: "The user needs to run sudo passwd first to activate sudo access"
    feedback: "sudo access is controlled by the sudoers file and group membership, not by running sudo passwd."
```

---

## Switching Users

### su (Switch User)

```bash
# Switch to root (starts a shell as root, keeps current environment)
su

# Switch to root with a login shell (loads root's environment)
su -

# Switch to another user with a login shell
su - jdoe

# Run a single command as another user
su - jdoe -c "whoami"
```

The difference between `su` and `su -` matters. Plain `su` keeps your current environment variables (`PATH`, `HOME`, etc.), which can cause confusing behavior when commands resolve differently. `su -` simulates a full login, loading the target user's shell profile and environment.

### sudo -i vs sudo su

Both give you a root shell, but they work differently:

| Command | Mechanism | Logging |
|---------|-----------|---------|
| `sudo -i` | sudo opens a login shell directly | Logged in auth.log/secure with your username |
| `sudo su -` | sudo runs su, which opens a shell | Logged as "sudo su" - less specific |
| `su -` | su authenticates with root's password | Requires the root password |

`sudo -i` is preferred on modern systems because it uses your own password (verified against sudoers), logs your identity, and doesn't require sharing the root password.

---

## PAM Basics

The **Pluggable Authentication Modules** ([**PAM**](https://www.linux-pam.org/)) framework controls how authentication works on Linux. Every program that needs to verify a user's identity - `login`, `sshd`, `sudo`, `su` - goes through PAM.

### How PAM Works

PAM configuration files in `/etc/pam.d/` define a stack of modules that run in sequence for each authentication event. Each file corresponds to a service (e.g., `/etc/pam.d/sshd`, `/etc/pam.d/sudo`).

A typical PAM configuration line:

```
auth    required    pam_unix.so    nullok
```

| Field | Meaning |
|-------|---------|
| `auth` | Module type (what this rule checks) |
| `required` | Control flag (what happens if this module fails) |
| `pam_unix.so` | The module to run |
| `nullok` | Module-specific options |

### Module Types

| Type | Purpose |
|------|---------|
| `auth` | Verify the user's identity (password check) |
| `account` | Check account restrictions (expiration, time-of-day access) |
| `password` | Handle password changes |
| `session` | Set up/tear down the user session (mount home dir, set limits) |

### Control Flags

| Flag | Meaning |
|------|---------|
| `required` | Must succeed, but continue checking other modules |
| `requisite` | Must succeed - fail immediately if it doesn't |
| `sufficient` | If this succeeds, skip remaining modules of this type |
| `optional` | Result is ignored unless it's the only module |

### Common PAM Modules

| Module | Purpose |
|--------|---------|
| `pam_unix.so` | Standard password authentication against /etc/shadow |
| `pam_wheel.so` | Restrict `su` to members of the `wheel` group |
| `pam_limits.so` | Apply resource limits from `/etc/security/limits.conf` |
| `pam_faillock.so` | Lock accounts after repeated failed login attempts |
| `pam_pwquality.so` | Enforce password complexity requirements |
| `pam_google_authenticator.so` | Two-factor authentication via TOTP |

### Practical Example: Restricting su to wheel Group

Edit `/etc/pam.d/su` and uncomment or add:

```
auth    required    pam_wheel.so
```

Now only members of the `wheel` group can use `su` to switch to root. This is a standard hardening measure.

### Practical Example: Account Lockout

Configure `/etc/security/faillock.conf`:

```ini
deny = 5
unlock_time = 600
fail_interval = 900
```

This locks an account for 10 minutes after 5 failed login attempts within 15 minutes. The `pam_faillock.so` module (already in the default PAM stack on most distributions) reads this configuration.

!!! tip "Be careful with PAM"
    PAM misconfiguration can lock everyone - including root - out of a system. Always keep a separate root session open when editing PAM files, and test changes in a second terminal before closing your safety session.

```command-builder
base: useradd
description: Build a useradd command to create a new Linux user
options:
  - flag: ""
    type: select
    label: "Home directory"
    explanation: "Create a home directory populated from /etc/skel"
    choices:
      - ["-m", "Create home directory (-m)"]
      - ["", "No home directory"]
      - ["-m -d /opt/appuser", "Custom home path (-m -d /opt/appuser)"]
  - flag: ""
    type: select
    label: "Login shell"
    explanation: "Set the user's default shell"
    choices:
      - ["-s /bin/bash", "Bash (-s /bin/bash)"]
      - ["-s /bin/zsh", "Zsh (-s /bin/zsh)"]
      - ["-s /sbin/nologin", "No login shell (-s /sbin/nologin)"]
  - flag: ""
    type: select
    label: "Account type"
    explanation: "Regular user or system/service account"
    choices:
      - ["", "Regular user (UID 1000+)"]
      - ["-r", "System account (-r, UID below 1000)"]
  - flag: ""
    type: text
    label: "Supplementary groups"
    placeholder: "sudo,docker"
    explanation: "Comma-separated groups to add the user to (-G)"
  - flag: ""
    type: text
    label: "Comment (full name)"
    placeholder: "Jane Doe"
    explanation: "GECOS field, usually the user's full name (-c)"
  - flag: ""
    type: text
    label: "Username"
    placeholder: "jdoe"
    explanation: "The login name for the new account"
```

---

## Auditing Users

```bash
# Show current user's UID, GID, and groups
id

# Show another user's identity
id jdoe

# Show just the username
whoami

# Show who is currently logged in
who

# Show who is logged in and what they're doing
w

# Show recent login history
last

# Show last login time for all users
lastlog

# Query the name service (works with LDAP/SSSD too)
getent passwd jdoe
getent group developers

# Find all files owned by a user
find / -user jdoe -type f 2>/dev/null

# Find processes running as a user
ps -u jdoe
```

The `getent` command is more reliable than reading `/etc/passwd` directly because it queries all configured name sources, including LDAP and SSSD. If your organization uses centralized directory services, `getent` shows the full picture while `cat /etc/passwd` only shows local accounts.

```exercise
title: Set Up a Development Team
difficulty: intermediate
scenario: |
  You're setting up a new development server. Complete these tasks:

  1. Create a group called `devops` with GID 2000
  2. Create a user `alice` with a home directory, bash shell, full name "Alice Chen", and `devops` as a supplementary group
  3. Create a user `bob` with the same setup, full name "Bob Park"
  4. Give the `devops` group passwordless sudo access to restart nginx and view systemctl status for any service
  5. Verify both users' group memberships
  6. Check that the sudo rule works by listing alice's sudo privileges
hints:
  - "Use groupadd -g to specify the GID"
  - "Use useradd -m -s /bin/bash -c 'Full Name' -G devops username"
  - "Create the sudo rule in /etc/sudoers.d/devops using visudo -f"
  - "The sudo rule needs NOPASSWD and full paths to commands"
  - "sudo -l -U username shows another user's sudo privileges"
solution: |
  ```bash
  # Step 1: Create the group
  sudo groupadd -g 2000 devops

  # Step 2: Create alice
  sudo useradd -m -s /bin/bash -c "Alice Chen" -G devops alice
  sudo passwd alice

  # Step 3: Create bob
  sudo useradd -m -s /bin/bash -c "Bob Park" -G devops bob
  sudo passwd bob

  # Step 4: Create sudo rules
  sudo visudo -f /etc/sudoers.d/devops
  # Add this line:
  # %devops ALL=(ALL) NOPASSWD: /usr/bin/systemctl restart nginx, /usr/bin/systemctl status *

  # Step 5: Verify group memberships
  id alice
  # uid=1001(alice) gid=1001(alice) groups=1001(alice),2000(devops)
  id bob
  # uid=1002(bob) gid=1002(bob) groups=1002(bob),2000(devops)

  # Step 6: Check sudo privileges
  sudo -l -U alice
  # User alice may run the following commands:
  #     (ALL) NOPASSWD: /usr/bin/systemctl restart nginx, /usr/bin/systemctl status *
  ```

  The sudoers.d file should have mode 0440 and no `.` or `~` in the filename.
  Use `visudo -f` instead of a regular editor to get syntax validation.
```

---

## Further Reading

- [useradd man page](https://man7.org/linux/man-pages/man8/useradd.8.html) - user account creation reference
- [usermod man page](https://man7.org/linux/man-pages/man8/usermod.8.html) - user account modification reference
- [shadow(5) man page](https://man7.org/linux/man-pages/man5/shadow.5.html) - /etc/shadow file format
- [sudoers man page](https://www.sudo.ws/docs/man/sudoers.man/) - sudo configuration reference
- [Linux-PAM Documentation](https://www.linux-pam.org/) - PAM module reference and guides
- [Arch Wiki: Users and groups](https://wiki.archlinux.org/title/Users_and_groups) - comprehensive practical reference
- [NIST Password Guidelines (SP 800-63B)](https://pages.nist.gov/800-63-3/sp800-63b.html) - modern password policy recommendations

---

**Previous:** [System Services](system-services.md) | **Next:** [SSH Configuration](ssh-configuration.md) | [Back to Index](README.md)
