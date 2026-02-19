# Introduction: Why Git, and Why Version Control

Before you type your first `git` command, it helps to understand the problem Git solves and the decades of tools that failed to solve it as well. Version control is one of those ideas that sounds obvious in hindsight - of course you should track changes to your code - but the path from "save a backup copy" to a distributed system that manages the Linux kernel involved some hard lessons and a few legendary arguments.

---

## The Problem: Tracking Changes

Every programmer eventually learns the hard way that code changes need tracking. Without version control, you end up with directories full of files named `project-final.zip`, `project-final-REALLY-final.zip`, and `project-final-v2-fixed-bug-DONT-DELETE.zip`. You lose track of what changed, when, and why. Collaboration becomes a nightmare of emailing files back and forth and manually merging edits.

**Version control systems** (VCS) solve this by recording every change to every file over time, letting you recall specific versions, compare changes, and work in parallel with other developers without stepping on each other.

---

## A Brief History of Version Control

### Local Version Control: RCS

The earliest approach was simple: keep a local database of changes to files. [**RCS**](https://www.gnu.org/software/rcs/) (Revision Control System), released in 1982, stored patch sets (differences between file versions) in a special format on disk. You could roll any file back to any previous state by applying patches in sequence.

RCS worked for a single developer on a single machine. It tracked individual files, not projects. If you needed to coordinate with other people, you were out of luck.

### Centralized Version Control: CVS and SVN

The next generation moved the version database to a central server. [**CVS**](https://cvs.nongnu.org/) (Concurrent Versions System, 1990) and its successor [**SVN**](https://subversion.apache.org/) (Subversion, 2000) let multiple developers check out files from one server, make changes, and commit them back.

This was a huge improvement. Teams could collaborate. You could see who changed what. But centralized systems had a critical weakness: the server was a single point of failure. If the server went down, nobody could commit. If the server's disk failed and backups were stale, you could lose the entire project history. Every operation - viewing logs, comparing versions, committing - required a network connection to the server.

SVN also modeled versions as directory snapshots with linear revision numbers. Branching existed but was implemented as a cheap copy of the directory tree, which made merging painful. Developers avoided branches because merging them back was error-prone and tedious.

### Distributed Version Control: BitKeeper, Mercurial, and Git

**Distributed version control systems** (DVCS) changed the model entirely. Instead of checking out a working copy from a central server, every developer **clones** the entire repository - every file, every version, the complete history. Your local copy is a full repository. You can commit, branch, view history, and diff entirely offline. Synchronization happens when you choose to push or pull changes.

[**BitKeeper**](https://www.bitkeeper.org/) was the first DVCS to gain major traction. The Linux kernel team used it from 2002 to 2005 under a free (as in beer) license for open-source projects. When that license was revoked after a developer reverse-engineered the protocol, Linus Torvalds had a problem - and a very specific idea of what the replacement should look like.

```quiz
question: "What is the fundamental difference between centralized and distributed version control?"
type: multiple-choice
options:
  - text: "Distributed systems are faster because they use a better algorithm"
    feedback: "Speed is a benefit, but the fundamental difference is architectural. Distributed systems clone the entire repository, not just the latest files."
  - text: "Every developer has a full copy of the repository, not just a working copy from a central server"
    correct: true
    feedback: "Correct! In a DVCS, every clone is a complete repository with full history. You can commit, branch, and view logs entirely offline. Centralized systems require a server connection for most operations."
  - text: "Distributed systems don't need a server at all"
    feedback: "Distributed systems can work without a central server, but in practice teams still use one (GitHub, GitLab) as a coordination point. The key difference is that every clone is a full repository."
  - text: "Centralized systems can't handle branches"
    feedback: "Centralized systems like SVN do support branches, though merging was historically painful. The core difference is whether each developer has the full history or just a working copy."
```

---

## The Birth of Git

In April 2005, Linus Torvalds started writing Git. The Linux kernel had 6.7 million lines of code and thousands of contributors. Linus had specific requirements based on his experience with BitKeeper and the kernel's scale:

- **Speed.** The kernel generates massive diffs and has thousands of files. Operations had to be fast.
- **Strong integrity.** Every object is checksummed with SHA-1. Corruption is detectable. You cannot change file contents, commit messages, or any part of history without changing the hash of everything that depends on it.
- **Support for non-linear development.** The kernel uses a workflow with thousands of parallel branches. Branching and merging had to be cheap and fast.
- **Fully distributed.** No central point of failure. Every developer has the complete history.
- **Scalable to massive projects.** The Linux kernel was (and remains) one of the largest open-source projects in existence.

Git's first commit was on April 7, 2005. By April 29, Git could track itself. By June 16, Linux kernel 2.6.12 was released using Git. The entire development took about two months.

!!! tip "Why the name?"
    Linus described the name choice: "I'm an egotistical bastard, and I name all my projects after myself. First 'Linux', now 'git'." The word "git" is British slang for an unpleasant person. The README in the original source code also offers: "Global Information Tracker" when you're in a good mood, or "Conditions of Conditions of Bad Conditions" (a rough translation from the slang) when it breaks.

### What Made Git Different

Git's design broke from every previous VCS in a fundamental way: it treats your project as a **content-addressable filesystem** that happens to track file history. Most VCS tools store a list of file changes (deltas). Git stores snapshots of your entire project at each commit and uses SHA-1 hashes to identify everything - files, directories, commits. If two files have identical content, Git stores one copy and references it from both locations.

This snapshot model, combined with the content-addressable storage, makes branching and merging nearly instantaneous. Creating a branch is writing 41 bytes to a file (a 40-character SHA-1 hash plus a newline). Merging compares tree structures rather than replaying individual file patches.

You don't need to understand the object model to use Git (that comes in a [later guide](object-model.md)), but knowing that Git thinks in snapshots rather than diffs helps explain why some operations that were painful in SVN are trivial in Git.

```quiz
question: "How does Git store project history differently from most earlier version control systems?"
type: multiple-choice
options:
  - text: "Git stores complete snapshots of the project at each commit, not file-by-file diffs"
    correct: true
    feedback: "Correct! Git takes a snapshot of all your files at each commit and stores a reference to that snapshot. If a file hasn't changed, Git stores a link to the previous identical file rather than a duplicate. This snapshot approach makes branching and merging much faster than delta-based systems."
  - text: "Git compresses files more efficiently than other systems"
    feedback: "Git does compress objects efficiently (using packfiles with delta compression for storage), but the fundamental design difference is that it stores snapshots rather than tracking changes file by file."
  - text: "Git only stores the files that changed in each commit"
    feedback: "That's closer to how delta-based systems like SVN work. Git stores a snapshot of the entire project tree at each commit, using references to unchanged files to avoid duplication."
  - text: "Git uses a different file format than SVN"
    feedback: "While the storage format is different, the key design difference is conceptual: snapshots of the whole project vs. per-file change tracking."
```

---

## Installing Git

Git runs on Linux, macOS, Windows, and most Unix-like systems. Here's how to get it installed.

### Linux

Most distributions include Git in their package manager:

```bash
# Debian/Ubuntu
sudo apt update && sudo apt install git

# Fedora
sudo dnf install git

# Arch Linux
sudo pacman -S git

# RHEL/CentOS (EPEL may be needed for newer versions)
sudo yum install git
```

For the latest version on Debian/Ubuntu, the Git maintainers provide a PPA:

```bash
sudo add-apt-repository ppa:git-core/ppa
sudo apt update && sudo apt install git
```

### macOS

macOS ships with a version of Git as part of the Xcode Command Line Tools. Open a terminal and run:

```bash
git --version
```

If Git isn't installed, macOS prompts you to install the Command Line Tools. For a newer version, use [**Homebrew**](https://brew.sh/):

```bash
brew install git
```

### Windows

Download the installer from [**git-scm.com**](https://git-scm.com/download/win). The installer includes Git Bash (a MSYS2-based terminal that provides a Unix-like shell) and optionally integrates with the Windows command prompt and PowerShell.

Alternatively, if you use [**winget**](https://learn.microsoft.com/en-us/windows/package-manager/):

```bash
winget install Git.Git
```

Or with [**Chocolatey**](https://chocolatey.org/):

```bash
choco install git
```

### Verifying Your Installation

After installing, verify it works:

```bash
git --version
```

You should see something like `git version 2.47.1`. The exact version depends on your platform and package manager.

```terminal
title: Installing and Verifying Git
steps:
  - command: "git --version"
    output: "git version 2.47.1"
    narration: "Verify Git is installed and check the version number. Any 2.x version is fine for this course, though some features (like git switch) require 2.23+."
  - command: "which git"
    output: "/usr/bin/git"
    narration: "The which command shows where the git binary lives. On macOS with Homebrew, this might be /usr/local/bin/git or /opt/homebrew/bin/git instead."
  - command: "git help -a | head -20"
    output: |
      usage: git [-v | --version] [-h | --help] [-C <path>] [-c <name>=<value>]
                 [--exec-path[=<path>]] [--html-path] [--man-path] [--info-path]
                 [-p | --paginate | -P | --no-pager] [--no-replace-objects] [--no-lazy-fetch]
                 [--no-optional-locks] [--no-advice] [--bare] [--git-dir=<path>]
                 [--work-tree=<path>] [--namespace=<name>] [--config-env=<name>=<envvar>]
                 <command> [<args>]

      available git commands in '/usr/libexec/git-core'

         add                             merge-file
         am                              merge-index
         annotate                        merge-octopus
         apply                           merge-one-file
         archive                         merge-ours
         bisect                          merge-recursive
         blame                           merge-recursive-ours
         branch                          merge-recursive-theirs
         bundle                          merge-resolve
         cat-file                        merge-subtree
    narration: "Git ships with a large number of commands. You won't use most of them directly - the everyday commands (add, commit, push, pull, branch, merge) are a small subset."
```

---

## First-Time Configuration

Git stores configuration at three levels, each overriding the previous:

| Level | Flag | File | Scope |
|-------|------|------|-------|
| System | `--system` | `/etc/gitconfig` | Every user on the machine |
| Global | `--global` | `~/.gitconfig` or `~/.config/git/config` | Your user account |
| Local | `--local` | `.git/config` in each repo | One specific repository |

For your initial setup, you need to set your identity. Every Git commit records an author name and email:

```bash
git config --global user.name "Your Name"
git config --global user.email "your.email@example.com"
```

Choose your text editor for commit messages (defaults to `vi` on most systems):

```bash
git config --global core.editor "nano"        # or vim, code --wait, etc.
```

Set the default branch name for new repositories (Git defaults to `master`, but many teams and platforms now use `main`):

```bash
git config --global init.defaultBranch main
```

Enable color output (usually on by default, but worth setting explicitly):

```bash
git config --global color.ui auto
```

Verify your configuration:

```bash
git config --list --show-origin
```

This shows every setting and which file it comes from, so you can see exactly what's set where.

!!! warning "Your identity matters"
    The name and email you configure are baked into every commit you make. If you contribute to open-source projects, the email you use here will be public. GitHub lets you use a no-reply email address (`username@users.noreply.github.com`) if you prefer to keep your real email private.

```code-walkthrough
title: Anatomy of a .gitconfig File
description: A typical global Git configuration file with the most common settings explained.
code: |
  [user]
      name = Jane Developer
      email = jane@example.com
      signingkey = ~/.ssh/id_ed25519.pub

  [core]
      editor = vim
      autocrlf = input
      pager = less -FRX
      whitespace = trailing-space,space-before-tab

  [init]
      defaultBranch = main

  [color]
      ui = auto

  [alias]
      st = status
      co = checkout
      br = branch
      ci = commit
      lg = log --oneline --graph --all --decorate
      unstage = reset HEAD --

  [pull]
      rebase = false

  [push]
      default = current
      autoSetupRemote = true

  [diff]
      tool = vimdiff

  [merge]
      tool = vimdiff
      conflictstyle = diff3
language: ini
annotations:
  - line: 1
    text: "The [user] section sets your identity for commits. Every commit records this name and email."
  - line: 4
    text: "The signingkey is optional - used for cryptographically signing commits. Covered in the Security guide."
  - line: 6
    text: "[core] controls fundamental Git behavior. editor sets what opens for commit messages."
  - line: 8
    text: "autocrlf = input converts CRLF to LF on commit but leaves files as-is on checkout. Essential for cross-platform teams."
  - line: 9
    text: "The pager controls how Git displays long output. less -FRX exits if output fits one screen, preserves color, and doesn't clear the screen on exit."
  - line: 12
    text: "[init] defaultBranch sets the name for the first branch in new repositories."
  - line: 19
    text: "Aliases save keystrokes for frequently used commands. 'git st' becomes 'git status'."
  - line: 23
    text: "The lg alias is widely used - it shows a compact, colored, graph-based log of all branches."
  - line: 24
    text: "'git unstage' is a readable alias for removing files from the staging area without losing changes."
  - line: 27
    text: "pull.rebase = false means git pull does a merge by default (not a rebase). This is the safe default."
  - line: 30
    text: "push.default = current pushes the current branch to a same-named remote branch. Less typing than specifying the remote branch every time."
  - line: 31
    text: "autoSetupRemote = true (Git 2.37+) automatically sets up tracking when you push a new branch. No more 'git push -u origin branch-name' on first push."
  - line: 33
    text: "[diff] and [merge] tool settings configure which external program opens for visual diffs and merge conflict resolution."
  - line: 38
    text: "conflictstyle = diff3 shows the original (base) version in merge conflicts alongside the two conflicting changes. Much easier to resolve conflicts when you can see what the code looked like before either change."
```

---

## Git's Mental Model: A Preview

Most guides jump straight into commands. Before you do that, it helps to have a high-level picture of what Git is actually doing.

Git manages your project through **three areas** (often called the "three trees"):

1. **Working directory** - the actual files on your filesystem that you edit
2. **Staging area** (also called the **index**) - a holding area where you prepare the next commit
3. **Repository** (the `.git` directory) - the complete history of committed snapshots

When you work with Git, you're moving file changes between these three areas:

```
Edit files ──→ Stage changes ──→ Commit snapshot
(working dir)    (index)          (repository)
```

This three-stage workflow is deliberate. The staging area lets you control exactly which changes go into each commit, even if you've modified ten files. You can stage three of them, commit those with a focused message, then stage and commit the rest separately. This produces a clean, meaningful history rather than giant "changed a bunch of stuff" commits.

Beyond these three areas, Git's entire storage model is built on four types of objects - blobs, trees, commits, and tags - all identified by SHA-1 hashes. This **content-addressable** design means Git can instantly tell if two files are identical, deduplicates storage automatically, and guarantees that any corruption is immediately detectable. The [Object Model](object-model.md) guide covers this in depth.

For now, the key insight is: Git doesn't track files. It tracks content. A file's name and location are stored in tree objects, while the file's content is stored in blob objects. Rename a file and Git knows it's the same content with a new name.

---

## What's Ahead

This course is organized in five phases:

**Foundations** (guides 1-4) cover the three trees, commits, branches, and merging - everything you need for solo work.

**Core Workflows** (guides 5-8) add remotes, history rewriting, stashing, and configuration - everything for working with others.

**Git Internals** (guides 9-11) open up the object model, references, the DAG, and transfer protocols - how Git actually works under the hood.

**Platform Collaboration** (guides 12-13) cover workflow models and platform-specific features across GitHub, GitLab, and Bitbucket.

**Advanced Operations** (guides 14-17) cover hooks, security, scaling to monorepos, and troubleshooting when things go wrong.

Each guide includes interactive quizzes, terminal simulations, hands-on exercises, and code walkthroughs. The quizzes test understanding, the terminals demonstrate commands in action, and the exercises give you practice in a real Git environment.

---

## Further Reading

- [Pro Git (2nd ed.) - Chapter 1: Getting Started](https://git-scm.com/book/en/v2/Getting-Started-About-Version-Control) - comprehensive coverage of VCS history and Git installation
- [Official Git Documentation](https://git-scm.com/doc) - reference manual, videos, and external links
- [A Short History of Git](https://git-scm.com/book/en/v2/Getting-Started-A-Short-History-of-Git) - the BitKeeper story and Git's design goals
- [Git's First Commit (Linus Torvalds, April 2005)](https://github.com/git/git/commit/e83c5163316f89bfbde7d9ab23ca2e25604af290) - the initial commit of Git itself

---

**Next:** [The Three Trees: Working Directory, Index, and Repository](three-trees.md) | [Back to Index](README.md)
