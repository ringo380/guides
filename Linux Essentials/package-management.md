# Package Management

Every Linux distribution ships with a package manager - the tool responsible for installing, updating, and removing software. Understanding how packages work is fundamental to system administration because nearly everything on a Linux box, from the kernel to the smallest utility, arrived as a package.

---

## Why Package Managers Exist

Before package managers, installing software meant downloading tarballs, compiling from source, and manually tracking dependencies. If program A needed library B version 2.3, and library B needed library C, you chased those dependencies by hand. Removing software was even worse - you had to remember every file the build process scattered across the filesystem.

Package managers solve this by maintaining a database of installed software, their files, and their dependencies. When you install a package, the manager resolves the full dependency tree, downloads everything needed, and places files in the correct locations. When you remove a package, it knows exactly which files to delete and whether any other package still needs a shared dependency.

---

## Package Formats and Ecosystems

Linux distributions split into two major packaging families, plus a growing set of universal formats.

| Format | Extension | Distributions | High-level Tool | Low-level Tool |
|--------|-----------|---------------|-----------------|----------------|
| Debian | `.deb` | Debian, Ubuntu, Mint, Pop!_OS | `apt` | `dpkg` |
| RPM | `.rpm` | RHEL, Fedora, CentOS, Rocky, openSUSE | `dnf` (or `yum`) | `rpm` |
| Arch | `.pkg.tar.zst` | Arch, Manjaro | `pacman` | - |
| Universal | `.snap`, `.flatpak`, `.AppImage` | Cross-distribution | `snap`, `flatpak` | - |

The high-level tools handle dependency resolution, repository management, and downloading. The low-level tools operate on individual package files and know nothing about repositories.

!!! tip "High-level vs low-level"
    Think of `apt` and `dnf` as the tools you use 95% of the time. You only reach for `dpkg` or `rpm` when you need to install a local `.deb`/`.rpm` file directly, inspect package metadata, or troubleshoot.

---

## APT (Debian/Ubuntu)

[**`apt`**](https://manpages.debian.org/stable/apt/apt.8.en.html) is the standard package management interface on Debian-based systems. It replaced the older `apt-get` and `apt-cache` commands with a single, more user-friendly tool.

### Updating the Package Index

Before installing anything, update the local cache of available packages:

```bash
sudo apt update
```

This downloads the latest package lists from every repository configured in `/etc/apt/sources.list` and `/etc/apt/sources.list.d/`. It does not install or upgrade anything - it just refreshes your local view of what's available.

### Searching and Inspecting

```bash
# Search for packages by name or description
apt search nginx

# Show detailed information about a specific package
apt show nginx

# List all installed packages
apt list --installed

# List packages that have updates available
apt list --upgradable
```

### Installing and Removing

```bash
# Install a package (resolves and installs dependencies automatically)
sudo apt install nginx

# Install a specific version
sudo apt install nginx=1.24.0-1ubuntu1

# Remove a package (keeps configuration files)
sudo apt remove nginx

# Remove a package and its configuration files
sudo apt purge nginx

# Remove packages that were installed as dependencies but are no longer needed
sudo apt autoremove
```

### Upgrading

```bash
# Upgrade all installed packages (won't remove packages or install new ones)
sudo apt upgrade

# Upgrade with smarter conflict resolution (may remove or install packages)
sudo apt full-upgrade
```

The difference matters during major version bumps. `apt upgrade` is conservative - it skips any upgrade that would require removing an existing package. `apt full-upgrade` (formerly `apt-get dist-upgrade`) handles those cases.

### Holding Packages

Sometimes you need to prevent a package from being upgraded - for example, if a newer version introduces a breaking change in production:

```bash
# Hold a package at its current version
sudo apt-mark hold nginx

# Show all held packages
apt-mark showhold

# Release the hold
sudo apt-mark unhold nginx
```

Held packages are skipped during `apt upgrade` and `apt full-upgrade`.

```terminal
title: "Installing and Inspecting a Package with APT"
steps:
  - command: "sudo apt update"
    output: "Hit:1 http://archive.ubuntu.com/ubuntu noble InRelease\nGet:2 http://archive.ubuntu.com/ubuntu noble-updates InRelease [126 kB]\nGet:3 http://security.ubuntu.com/ubuntu noble-security InRelease [126 kB]\nFetched 252 kB in 1s (201 kB/s)\nReading package lists... Done\nBuilding dependency tree... Done\n25 packages can be upgraded. Run 'apt list --upgradable' to see them."
    narration: "Always update the package index first. This fetches the latest metadata from your configured repositories so apt knows what versions are available."
  - command: "apt search tree | head -5"
    output: "Sorting... Done\nFull Text Search... Done\ntree/noble 2.1.1-1 amd64\n  displays an indented directory tree, in color\n"
    narration: "Searching finds packages matching your query by name or description. The tree utility is a simple tool that displays directory structures - useful for the examples that follow."
  - command: "apt show tree"
    output: "Package: tree\nVersion: 2.1.1-1\nPriority: optional\nSection: utils\nMaintainer: Ubuntu Developers <ubuntu-devel-discuss@lists.ubuntu.com>\nInstalled-Size: 118 kB\nDepends: libc6 (>= 2.34)\nDownload-Size: 47.9 kB\nDescription: displays an indented directory tree, in color"
    narration: "apt show reveals the package version, size, dependencies, and description. Here tree depends only on libc6, so it's lightweight with no extra dependencies to pull in."
  - command: "sudo apt install tree"
    output: "Reading package lists... Done\nBuilding dependency tree... Done\nThe following NEW packages will be installed:\n  tree\n0 upgraded, 1 newly installed, 0 to remove and 25 not upgraded.\nNeed to get 47.9 kB of archives.\nGet:1 http://archive.ubuntu.com/ubuntu noble/universe amd64 tree amd64 2.1.1-1 [47.9 kB]\nFetched 47.9 kB in 0s (155 kB/s)\nSelecting previously unselected package tree.\nSetting up tree (2.1.1-1) ...\nProcessing triggers for man-db (2.12.0-4build2) ..."
    narration: "apt resolves dependencies, downloads the package, and installs it. The output shows exactly what will be installed and how much space it takes."
  - command: "dpkg -L tree | head -10"
    output: "/.\n/usr\n/usr/bin\n/usr/bin/tree\n/usr/share\n/usr/share/doc\n/usr/share/doc/tree\n/usr/share/doc/tree/changelog.Debian.gz\n/usr/share/doc/tree/copyright\n/usr/share/man"
    narration: "dpkg -L lists every file installed by a package. This is useful for finding where a package put its binaries, config files, or documentation."
  - command: "dpkg -S /usr/bin/tree"
    output: "tree: /usr/bin/tree"
    narration: "dpkg -S does the reverse lookup - given a file path, it tells you which package owns it. Essential for figuring out where a file came from."
```

```quiz
question: "You installed nginx on Ubuntu and want to prevent it from being upgraded during the next apt upgrade. Which command achieves this?"
type: multiple-choice
options:
  - text: "sudo apt-mark hold nginx"
    correct: true
    feedback: "Correct. apt-mark hold prevents a package from being upgraded until you release the hold with apt-mark unhold."
  - text: "sudo apt lock nginx"
    feedback: "There is no apt lock command. The correct tool is apt-mark hold."
  - text: "sudo dpkg --hold nginx"
    feedback: "While dpkg does have a hold state (set via dpkg --set-selections), the standard approach is apt-mark hold, which sets the same underlying flag."
  - text: "sudo apt pin nginx"
    feedback: "APT pinning is a related but different mechanism configured in /etc/apt/preferences.d/. For simply holding a package at its current version, apt-mark hold is the right tool."
```

---

## DNF (RHEL/Fedora)

[**`dnf`**](https://dnf.readthedocs.io/en/latest/) is the default package manager on Fedora, RHEL 8+, CentOS Stream, Rocky Linux, and AlmaLinux. It replaced `yum`, though `yum` still works as an alias on most systems.

### Core Operations

```bash
# Update the package metadata cache
sudo dnf check-update

# Search for packages
dnf search nginx

# Show package details
dnf info nginx

# Install a package
sudo dnf install nginx

# Remove a package
sudo dnf remove nginx

# Upgrade all packages
sudo dnf upgrade

# Remove unneeded dependencies
sudo dnf autoremove
```

### Version Locking

DNF uses a plugin for version locking (the `dnf-plugins-core` package):

```bash
# Install the versionlock plugin if not present
sudo dnf install dnf-plugins-core

# Lock a package at its current version
sudo dnf versionlock add nginx

# List locked packages
dnf versionlock list

# Remove a lock
sudo dnf versionlock delete nginx
```

### Transaction History

One of DNF's most useful features is its transaction history:

```bash
# View recent transactions
dnf history

# Show details of a specific transaction
dnf history info 15

# Undo a transaction (reverse all changes it made)
sudo dnf history undo 15
```

This is invaluable when an upgrade breaks something - you can undo the exact transaction that caused the problem.

### Repository Management

Repositories are configured in `/etc/yum.repos.d/` as `.repo` files:

```bash
# List all configured repositories
dnf repolist --all

# Enable a disabled repository
sudo dnf config-manager --set-enabled crb

# Add a new repository
sudo dnf config-manager --add-repo https://example.com/repo.repo
```

!!! warning "Third-party repositories"
    Adding external repositories means trusting their maintainers with root-level access to your system. Every package installed from a repo runs scripts as root during installation. Only add repositories from sources you trust, and prefer official repositories when possible.

```command-builder
base: apt
description: Build an apt package management command
options:
  - flag: ""
    type: select
    label: "Action"
    explanation: "The package operation to perform"
    choices:
      - ["install", "Install a package (install)"]
      - ["remove", "Remove a package, keep config (remove)"]
      - ["purge", "Remove package and config files (purge)"]
      - ["search", "Search for packages (search)"]
      - ["show", "Show package details (show)"]
      - ["update", "Refresh package index (update)"]
      - ["upgrade", "Upgrade all packages (upgrade)"]
      - ["full-upgrade", "Upgrade with conflict resolution (full-upgrade)"]
      - ["autoremove", "Remove orphaned dependencies (autoremove)"]
  - flag: ""
    type: text
    label: "Package name"
    placeholder: "nginx"
    explanation: "The package to act on (not needed for update, upgrade, or autoremove)"
  - flag: ""
    type: select
    label: "Options"
    explanation: "Additional flags to modify behavior"
    choices:
      - ["", "None"]
      - ["-y", "Assume yes to prompts (-y)"]
      - ["--dry-run", "Simulate without making changes (--dry-run)"]
      - ["--no-install-recommends", "Skip recommended packages (--no-install-recommends)"]
```

---

## Low-level Tools: dpkg and rpm

The high-level tools (`apt`, `dnf`) call these under the hood. You use them directly when working with local package files or querying the package database.

### dpkg (Debian)

```bash
# Install a local .deb file (does NOT resolve dependencies)
sudo dpkg -i package.deb

# If dpkg fails due to missing dependencies, fix them with apt
sudo apt install -f

# List all installed packages
dpkg -l

# List files installed by a package
dpkg -L nginx

# Find which package owns a file
dpkg -S /usr/bin/curl

# Show package status and metadata
dpkg -s nginx
```

### rpm (Red Hat)

```bash
# Install a local .rpm file
sudo rpm -ivh package.rpm

# Upgrade (install or upgrade) a local .rpm file
sudo rpm -Uvh package.rpm

# Query all installed packages
rpm -qa

# Query information about an installed package
rpm -qi nginx

# List files in an installed package
rpm -ql nginx

# Find which package owns a file
rpm -qf /usr/bin/curl

# Query an uninstalled .rpm file
rpm -qpi package.rpm
```

```quiz
question: "You downloaded a .deb file and installed it with dpkg -i, but it failed because of missing dependencies. What command fixes this?"
type: multiple-choice
options:
  - text: "sudo apt install -f"
    correct: true
    feedback: "Correct. apt install -f (fix-broken) reads the dpkg database, finds packages with unmet dependencies, and installs whatever is missing from the repositories."
  - text: "sudo dpkg --fix-depends"
    feedback: "This flag doesn't exist. dpkg has no dependency resolution - that's what apt is for."
  - text: "sudo apt update"
    feedback: "apt update refreshes the package index but doesn't install anything. You need apt install -f to resolve the broken dependencies."
  - text: "sudo dpkg --configure -a"
    feedback: "dpkg --configure -a finishes configuring packages that were unpacked but not yet configured. It won't resolve missing dependencies from repositories."
```

---

## Repository Management

### APT Repositories

APT repositories are configured in `/etc/apt/sources.list` and individual files under `/etc/apt/sources.list.d/`. Modern Ubuntu systems use the DEB822 format in `.sources` files:

```bash
# Traditional one-line format (sources.list)
deb http://archive.ubuntu.com/ubuntu noble main restricted universe multiverse

# DEB822 format (sources.list.d/ubuntu.sources)
Types: deb
URIs: http://archive.ubuntu.com/ubuntu
Suites: noble noble-updates
Components: main restricted universe multiverse
```

```code-walkthrough
language: bash
title: Understanding APT Source Definitions
code: |
  deb [signed-by=/usr/share/keyrings/example.gpg] https://example.com/repo stable main

  Types: deb
  URIs: http://archive.ubuntu.com/ubuntu
  Suites: noble noble-updates
  Components: main restricted universe multiverse
annotations:
  - line: 1
    text: "'deb' marks this as a binary package source. Use 'deb-src' for source packages (needed for apt source and apt build-dep)."
  - line: 1
    text: "[signed-by=...] ties a specific GPG key to this repository. APT verifies all packages from this repo against this key, preventing unsigned or tampered packages."
  - line: 1
    text: "The URL points to the repository root. APT appends the suite and component to form the full path to package lists."
  - line: 1
    text: "'stable' is the suite (release codename or class). Ubuntu uses codenames like 'noble'; Debian uses both codenames and classes like 'stable'."
  - line: 1
    text: "'main' is the component. Ubuntu splits packages into main (Canonical-supported), restricted (proprietary drivers), universe (community), and multiverse (non-free)."
  - line: 3
    text: "This is the newer DEB822 format used in .sources files. It's more readable and supports multiple values per field."
  - line: 4
    text: "URIs accepts one or more repository URLs. APT tries them in order, falling back if the first is unavailable."
  - line: 5
    text: "Multiple suites on one line: 'noble' is the base release, 'noble-updates' includes post-release bug fixes and security patches."
  - line: 6
    text: "Components list which sections to enable. Listing all four gives access to the full Ubuntu package archive."
```

Adding a third-party repository typically involves importing a GPG key and creating a sources file:

```bash
# Download and add the repository GPG key
curl -fsSL https://example.com/repo-key.gpg | sudo gpg --dearmor -o /usr/share/keyrings/example.gpg

# Add the repository with the key reference
echo "deb [signed-by=/usr/share/keyrings/example.gpg] https://example.com/repo stable main" | \
  sudo tee /etc/apt/sources.list.d/example.list

# Refresh package index to include the new repo
sudo apt update
```

!!! tip "GPG key management"
    The `signed-by` field in the repository definition ties a specific GPG key to a specific repository. This prevents a compromised third-party repo from injecting packages that look like they come from the official Ubuntu archives.

### DNF Repositories

DNF repos are individual `.repo` files in `/etc/yum.repos.d/`:

```ini
[example-repo]
name=Example Repository
baseurl=https://example.com/repo/el9/$basearch
enabled=1
gpgcheck=1
gpgkey=https://example.com/repo-key.gpg
```

```bash
# Import a GPG key manually
sudo rpm --import https://example.com/repo-key.gpg

# Verify a repo's GPG key is imported
rpm -qa gpg-pubkey*
```

---

## Universal Package Managers

Traditional packages are tied to their distribution's ecosystem. Universal formats aim to work across distributions.

### Snap

[**Snap**](https://snapcraft.io/docs) packages are developed by Canonical and come pre-installed on Ubuntu. Each snap runs in a sandboxed environment with its own bundled dependencies:

```bash
# Search for a snap
snap find vlc

# Install a snap
sudo snap install vlc

# List installed snaps
snap list

# Update all snaps
sudo snap refresh

# Remove a snap
sudo snap remove vlc
```

### Flatpak

[**Flatpak**](https://flatpak.org/setup/) is distribution-neutral and uses the Flathub repository as its primary app store:

```bash
# Add the Flathub repository (one-time setup)
flatpak remote-add --if-not-exists flathub https://dl.flathub.org/repo/flathub.flatpakrepo

# Search for an app
flatpak search gimp

# Install an app
flatpak install flathub org.gimp.GIMP

# Run a flatpak app
flatpak run org.gimp.GIMP

# List installed flatpak apps
flatpak list

# Update all flatpak apps
flatpak update

# Remove an app
flatpak uninstall org.gimp.GIMP
```

### AppImage

[**AppImage**](https://appimage.org/) files are self-contained executables - no installation required:

```bash
# Download an AppImage
wget https://example.com/app.AppImage

# Make it executable and run it
chmod +x app.AppImage
./app.AppImage
```

### Tradeoffs

| Aspect | Native (apt/dnf) | Snap | Flatpak | AppImage |
|--------|-------------------|------|---------|----------|
| Dependency sharing | Shared system libraries | Bundled per snap | Shared runtimes | Fully self-contained |
| Disk usage | Lowest | Higher | Moderate | Highest per app |
| Sandboxing | None by default | Strict by default | Configurable | None |
| Update mechanism | System package manager | `snap refresh` (auto) | `flatpak update` | Manual re-download |
| System integration | Full | Limited (strict confinement) | Good | Varies |
| Startup speed | Fastest | Slower (first launch) | Moderate | Moderate |

For servers, native packages are almost always the right choice - they're smaller, faster, and integrate with the system's update and security infrastructure. Universal formats are primarily useful for desktop applications that need to run across multiple distributions.

---

## Auditing and Maintenance

Regular package maintenance keeps systems secure and avoids disk bloat.

### Checking What's Installed

```bash
# Debian/Ubuntu: list all installed packages
dpkg -l | grep ^ii

# RHEL/Fedora: list all installed packages
rpm -qa --qf '%{NAME}-%{VERSION}-%{RELEASE}.%{ARCH}\n' | sort

# Find which package a file belongs to
dpkg -S /usr/bin/curl    # Debian
rpm -qf /usr/bin/curl    # RHEL
```

### Security Updates

```bash
# Debian/Ubuntu: list security updates
apt list --upgradable 2>/dev/null | grep -i security

# RHEL/Fedora: list security updates
dnf updateinfo list security

# RHEL/Fedora: install only security updates
sudo dnf upgrade --security
```

### Cleaning Up

```bash
# Debian/Ubuntu
sudo apt autoremove        # Remove orphaned dependencies
sudo apt autoclean         # Remove old cached .deb files
sudo apt clean             # Remove ALL cached .deb files

# RHEL/Fedora
sudo dnf autoremove        # Remove orphaned dependencies
sudo dnf clean all         # Remove all cached data
```

### Unattended Upgrades

For production servers, automatic security updates reduce the window of vulnerability:

```bash
# Debian/Ubuntu: install and enable unattended-upgrades
sudo apt install unattended-upgrades
sudo dpkg-reconfigure -plow unattended-upgrades
```

The configuration lives in `/etc/apt/apt.conf.d/50unattended-upgrades`. By default it applies security updates only, which is the safest setting for production.

On RHEL/Fedora, `dnf-automatic` provides similar functionality:

```bash
sudo dnf install dnf-automatic
sudo systemctl enable --now dnf-automatic-install.timer
```

!!! danger "Automatic updates in production"
    Unattended upgrades are a tradeoff. They keep security patches current, but an update can occasionally break a running service. For critical production systems, many teams apply updates to a staging environment first, then promote to production after verification. At minimum, configure email notifications so you know what changed.

```exercise
title: Package Management Operations
difficulty: intermediate
scenario: |
  You're setting up a new Ubuntu server. Complete these tasks:

  1. Update the package index
  2. Search for and install the `htop` process viewer
  3. Verify what files htop installed and find its binary location
  4. Hold htop at its current version to prevent upgrades
  5. Check for any packages that can be cleaned up
  6. List all held packages to confirm htop is held
hints:
  - "Start with sudo apt update to refresh the package cache"
  - "Use apt search or apt show to find package details before installing"
  - "dpkg -L lists files for an installed package"
  - "apt-mark hold prevents a package from upgrading"
  - "apt autoremove shows orphaned packages; apt clean removes cached downloads"
solution: |
  ```bash
  # Step 1: Update package index
  sudo apt update

  # Step 2: Install htop
  apt search htop
  sudo apt install htop

  # Step 3: Find installed files and binary
  dpkg -L htop
  which htop    # /usr/bin/htop

  # Step 4: Hold the package
  sudo apt-mark hold htop

  # Step 5: Clean up
  sudo apt autoremove
  sudo apt autoclean

  # Step 6: Verify the hold
  apt-mark showhold
  ```

  The hold prevents `apt upgrade` and `apt full-upgrade` from touching htop.
  When you're ready to allow upgrades again, run `sudo apt-mark unhold htop`.
```

---

## Further Reading

- [APT man page](https://manpages.debian.org/stable/apt/apt.8.en.html) - official apt command reference
- [DNF Documentation](https://dnf.readthedocs.io/en/latest/) - comprehensive DNF command and plugin reference
- [dpkg man page](https://man7.org/linux/man-pages/man1/dpkg.1.html) - low-level Debian package tool reference
- [rpm man page](https://man7.org/linux/man-pages/man8/rpm.8.html) - low-level RPM package tool reference
- [Snapcraft Documentation](https://snapcraft.io/docs) - snap package format and usage
- [Flatpak Documentation](https://docs.flatpak.org/) - flatpak setup, usage, and app distribution
- [Debian Wiki: Secure APT](https://wiki.debian.org/SecureApt) - how APT verifies package authenticity with GPG
- [Fedora DNF System Upgrade](https://docs.fedoraproject.org/en-US/quick-docs/upgrading-fedora-offline/) - upgrading between Fedora releases

---

**Previous:** [Disk and Filesystem](disk-and-filesystem.md) | **Next:** [System Services](system-services.md) | [Back to Index](README.md)
