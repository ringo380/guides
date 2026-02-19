# Configuring Git

Git is deeply configurable. Every aspect of its behavior - from how it displays output to how it handles line endings - can be tuned through configuration. Understanding the configuration system lets you build a Git setup that matches your workflow, your editor, and your team's conventions.

---

## Configuration Levels

Git reads configuration from four levels, each overriding the previous:

| Level | Flag | Location | Scope |
|-------|------|----------|-------|
| **System** | `--system` | `/etc/gitconfig` | Every user on the machine |
| **Global** | `--global` | `~/.gitconfig` or `~/.config/git/config` | Your user account |
| **Local** | `--local` | `.git/config` in the repo | One repository |
| **Worktree** | `--worktree` | `.git/config.worktree` | One worktree (Git 2.20+) |

A setting at a more specific level overrides the same setting at a broader level. Local overrides global, global overrides system.

```bash
# See all settings and where they come from
git config --list --show-origin

# See just global settings
git config --global --list

# See just local (repo) settings
git config --local --list
```

```quiz
question: "If user.email is set to 'personal@example.com' in --global and 'work@company.com' in --local, which email is used for commits in that repository?"
type: multiple-choice
options:
  - text: "personal@example.com (global always wins)"
    feedback: "Global is the default, but local settings override global ones. More specific levels take priority."
  - text: "work@company.com (local overrides global)"
    correct: true
    feedback: "Correct! Local (repository) settings override global (user) settings. This is how you can use one email for work repos and another for personal projects, without changing global config."
  - text: "Whichever was set most recently"
    feedback: "Git doesn't track when settings were set. Priority is determined by scope level: local overrides global overrides system."
  - text: "Git prompts you to choose"
    feedback: "Git never prompts for configuration choices. It follows the precedence hierarchy: local > global > system."
```

---

## Reading and Writing Configuration

### Setting Values

```bash
# Set a value
git config --global user.name "Jane Developer"

# Set with a specific scope
git config --local core.autocrlf input

# Set a boolean
git config --global color.ui true
```

### Reading Values

```bash
# Get a specific value
git config user.name

# Get with scope
git config --global user.email

# Get showing the origin
git config --show-origin user.name
```

### Removing and Editing

```bash
# Remove a specific key
git config --global --unset core.editor

# Remove a section
git config --global --remove-section alias

# Open config in editor
git config --global --edit
```

```command-builder
title: "git config Command Builder"
description: "Build a git config command for reading and writing settings."
base: "git config"
groups:
  - name: "Scope"
    options:
      - flag: "--global"
        description: "User-level config (~/.gitconfig)"
      - flag: "--local"
        description: "Repository-level config (.git/config)"
      - flag: "--system"
        description: "System-wide config (/etc/gitconfig)"
  - name: "Action"
    options:
      - flag: "--list"
        description: "List all settings at this scope"
      - flag: "--show-origin"
        description: "Show which file each setting comes from"
      - flag: "--get <key>"
        description: "Read a specific setting"
      - flag: "--unset <key>"
        description: "Remove a specific setting"
      - flag: "--edit"
        description: "Open the config file in your editor"
  - name: "Common Settings"
    options:
      - flag: "user.name 'Your Name'"
        description: "Set your name for commits"
      - flag: "user.email 'you@example.com'"
        description: "Set your email for commits"
      - flag: "core.editor 'vim'"
        description: "Set the default text editor"
      - flag: "init.defaultBranch main"
        description: "Set the default branch name for new repos"
```

---

## Aliases

Aliases let you create shortcuts for Git commands you use frequently. They range from simple abbreviations to complex shell commands.

### Simple Aliases

```bash
git config --global alias.st status
git config --global alias.co checkout
git config --global alias.br branch
git config --global alias.ci commit
git config --global alias.sw switch
```

Now `git st` runs `git status`, `git co main` runs `git checkout main`, and so on.

### Compound Aliases

```bash
# Compact log with graph
git config --global alias.lg "log --oneline --graph --all --decorate"

# Unstage files
git config --global alias.unstage "reset HEAD --"

# Show last commit
git config --global alias.last "log -1 HEAD --stat"

# Diff of staged changes
git config --global alias.staged "diff --staged"

# List branches sorted by last commit date
git config --global alias.recent "branch --sort=-committerdate --format='%(committerdate:relative)%09%(refname:short)'"
```

### Shell Command Aliases

Prefix with `!` to run arbitrary shell commands:

```bash
# Delete all merged branches except main/master
git config --global alias.cleanup '!git branch --merged | grep -v "main\|master\|\*" | xargs -r git branch -d'

# Show all aliases
git config --global alias.aliases '!git config --get-regexp ^alias\. | sed s/alias\.//'

# Open the repo in the browser (GitHub)
git config --global alias.browse '!open $(git remote get-url origin | sed "s/git@/https:\/\//" | sed "s/\.git$//" | sed "s/:/\//")'
```

```terminal
title: Setting Up Git Aliases
steps:
  - command: "git config --global alias.st status"
    output: ""
    narration: "Create a simple alias. Now 'git st' is the same as 'git status'."
  - command: "git config --global alias.lg 'log --oneline --graph --all --decorate'"
    output: ""
    narration: "Create a compound alias for the popular decorated graph log. 'git lg' produces a visual branch graph."
  - command: "git config --global alias.last 'log -1 HEAD --stat'"
    output: ""
    narration: "Quick way to see the most recent commit with file stats."
  - command: "git config --global --get-regexp ^alias"
    output: |
      alias.st status
      alias.lg log --oneline --graph --all --decorate
      alias.last log -1 HEAD --stat
    narration: "List all aliases using --get-regexp. Each alias is stored as alias.<name> in your git config."
  - command: "git st"
    output: |
      On branch main
      nothing to commit, working tree clean
    narration: "Use the alias. 'git st' runs 'git status'. Same output, fewer keystrokes."
```

---

## Custom Diff and Merge Tools

Git's built-in diff and merge output works in the terminal, but graphical tools can be easier for complex diffs and multi-file merge conflicts.

### Configuring a Diff Tool

```bash
# Use vimdiff
git config --global diff.tool vimdiff

# Use VS Code
git config --global diff.tool vscode
git config --global difftool.vscode.cmd 'code --wait --diff $LOCAL $REMOTE'

# Use meld (Linux)
git config --global diff.tool meld
```

Run the visual diff:

```bash
git difftool                    # Working dir vs staging
git difftool --staged           # Staging vs HEAD
git difftool main feature/auth  # Between branches
```

### Configuring a Merge Tool

```bash
# Use vimdiff
git config --global merge.tool vimdiff

# Use VS Code
git config --global merge.tool vscode
git config --global mergetool.vscode.cmd 'code --wait --merge $REMOTE $LOCAL $BASE $MERGED'

# Show the base version in conflicts (highly recommended)
git config --global merge.conflictstyle diff3
```

Run the merge tool during a conflict:

```bash
git merge feature/branch    # Conflict occurs
git mergetool               # Opens each conflicted file in the configured tool
```

!!! tip "diff3 conflict style"
    `merge.conflictstyle = diff3` adds a third section to conflict markers showing the **base** version (what the code looked like before either change). This makes it much easier to understand the intent of both changes. Set it globally - you'll wonder how you ever resolved conflicts without it.

```terminal
title: Configuring a Custom Diff and Merge Tool
steps:
  - command: "git config --global diff.tool vimdiff"
    output: ""
    narration: "Set vimdiff as the default diff tool. vimdiff opens two vertical panes in vim showing the old and new versions side by side."
  - command: "git config --global merge.tool vimdiff"
    output: ""
    narration: "Set vimdiff as the merge tool. During conflicts, 'git mergetool' opens a three-way view: local, remote, and the merged result."
  - command: "git config --global merge.conflictstyle diff3"
    output: ""
    narration: "Enable diff3 conflict markers. Conflicts now show three versions: HEAD, the incoming branch, and the common ancestor. This extra context makes resolution much easier."
  - command: "git config --global difftool.prompt false"
    output: ""
    narration: "Disable the 'Launch vimdiff?' prompt that appears for each file. With this set, git difftool opens files without asking."
  - command: "git config --global --get-regexp '(diff|merge)'"
    output: |
      diff.tool vimdiff
      merge.tool vimdiff
      merge.conflictstyle diff3
      difftool.prompt false
    narration: "Verify the configuration. These four settings give you a much better diff and merge experience."
```

---

## Conditional Includes

If you use Git for both work and personal projects, you need different identities (name, email, signing key) for each. **Conditional includes** (Git 2.13+) let you load different configuration files based on the repository's location:

```ini
# ~/.gitconfig

[user]
    name = Jane Developer
    email = jane@personal.com

[includeIf "gitdir:~/work/"]
    path = ~/.gitconfig-work

[includeIf "gitdir:~/opensource/"]
    path = ~/.gitconfig-opensource
```

```ini
# ~/.gitconfig-work

[user]
    email = jane.developer@company.com
    signingkey = ~/.ssh/work_ed25519.pub

[commit]
    gpgsign = true
```

Any repository under `~/work/` automatically uses the work email and signing key. Repositories elsewhere use the personal defaults.

The `gitdir:` condition matches the `.git` directory location. Other conditions:

| Condition | Matches |
|-----------|---------|
| `gitdir:~/work/` | Repos under `~/work/` |
| `gitdir/i:~/Work/` | Case-insensitive match (useful on macOS) |
| `onbranch:main` | When the `main` branch is checked out |
| `hasconfig:remote.*.url:*github.com*` | Repos with a GitHub remote (Git 2.36+) |

```exercise
title: Set Up Conditional Includes
difficulty: intermediate
scenario: |
  Configure Git to use different identities for work and personal projects.

  1. Create two directories: `~/work-demo/` and `~/personal-demo/`
  2. Edit your global gitconfig to set a personal default identity
  3. Create a conditional include for `~/work-demo/` that sets a work email
  4. Initialize a repo in each directory
  5. Make a commit in each and verify the author emails differ
hints:
  - "Use git config --global --edit to edit the global config directly"
  - "The includeIf path must end with / for directory matching"
  - "Use git log --format='%ae' -1 to check the author email of the last commit"
  - "The conditional include file needs a [user] section with the override email"
solution: |
  ```bash
  # Create directories
  mkdir -p ~/work-demo ~/personal-demo

  # Set global (personal) defaults
  git config --global user.name "Jane Developer"
  git config --global user.email "jane@personal.com"

  # Create work config file
  git config --file ~/.gitconfig-work user.email "jane@company.com"

  # Add conditional include to global config
  git config --global includeIf.gitdir:~/work-demo/.path ~/.gitconfig-work

  # Test in personal repo
  cd ~/personal-demo && git init
  echo "personal" > README.md && git add . && git commit -m "Personal project"
  git log --format="%ae" -1
  # jane@personal.com

  # Test in work repo
  cd ~/work-demo && git init
  echo "work" > README.md && git add . && git commit -m "Work project"
  git log --format="%ae" -1
  # jane@company.com
  ```
```

---

## Core Settings

The `core.*` namespace contains Git's most fundamental behavior settings.

### Line Endings

Line ending handling is critical for cross-platform teams. Windows uses CRLF (`\r\n`), Linux and macOS use LF (`\n`).

```bash
# On Linux/macOS: convert CRLF to LF on commit, no conversion on checkout
git config --global core.autocrlf input

# On Windows: convert LF to CRLF on checkout, CRLF to LF on commit
git config --global core.autocrlf true

# No conversion (if your team standardizes on LF and uses .gitattributes)
git config --global core.autocrlf false
```

!!! tip "Use .gitattributes for line endings"
    `core.autocrlf` is a per-user setting - it only works if everyone configures it. `.gitattributes` is committed to the repository and enforces line ending rules for the whole team. See the `.gitattributes` section below.

### Other Core Settings

```bash
# Set your editor (for commit messages, rebase, etc.)
git config --global core.editor "vim"
# git config --global core.editor "code --wait"
# git config --global core.editor "nano"

# Set the pager (for log, diff, etc.)
git config --global core.pager "less -FRX"

# Detect whitespace problems
git config --global core.whitespace trailing-space,space-before-tab

# Improve performance on large repos with filesystem monitor
git config --global core.fsmonitor true
```

---

## `.gitattributes`

While `.gitconfig` controls your personal Git behavior, `.gitattributes` is committed to the repository and controls per-file behavior for the whole team: line endings, diff drivers, merge strategies, and LFS tracking.

### Line Endings

```
# .gitattributes - normalize line endings

# Default: auto-detect
* text=auto

# Force LF for source files
*.py text eol=lf
*.js text eol=lf
*.css text eol=lf
*.html text eol=lf
*.md text eol=lf
*.yml text eol=lf
*.json text eol=lf

# Force CRLF for Windows-specific files
*.bat text eol=crlf
*.cmd text eol=crlf
*.ps1 text eol=crlf

# Binary files (no conversion, no diff)
*.png binary
*.jpg binary
*.gif binary
*.ico binary
*.zip binary
*.pdf binary
```

### Custom Diff Drivers

```
# Show meaningful diffs for specific file types
*.md diff=markdown
*.py diff=python
*.rb diff=ruby
```

These tell Git to use language-aware diff heuristics - better function/class detection in diff headers.

### Linguist Overrides

```
# Exclude from GitHub language statistics
docs/* linguist-documentation
vendor/* linguist-vendored
*.min.js linguist-generated
```

```code-walkthrough
title: A Well-Organized .gitconfig
description: A production-ready global Git configuration file with sections explained.
code: |
  [user]
      name = Jane Developer
      email = jane@personal.com

  [core]
      editor = vim
      pager = less -FRX
      autocrlf = input
      whitespace = trailing-space,space-before-tab
      excludesFile = ~/.gitignore_global

  [init]
      defaultBranch = main

  [color]
      ui = auto

  [alias]
      st = status
      co = checkout
      sw = switch
      br = branch
      ci = commit
      lg = log --oneline --graph --all --decorate
      unstage = reset HEAD --
      last = log -1 HEAD --stat
      recent = branch --sort=-committerdate --format='%(committerdate:relative)\t%(refname:short)'
      amend = commit --amend --no-edit

  [pull]
      rebase = false

  [push]
      default = current
      autoSetupRemote = true

  [fetch]
      prune = true

  [diff]
      tool = vimdiff
      colorMoved = default

  [merge]
      tool = vimdiff
      conflictstyle = diff3

  [rebase]
      autoSquash = true
      autoStash = true

  [rerere]
      enabled = true

  [includeIf "gitdir:~/work/"]
      path = ~/.gitconfig-work
language: ini
annotations:
  - line: 1
    text: "Identity section - used in every commit. Override in local config or conditional includes for different contexts."
  - line: 5
    text: "Core settings control fundamental behavior. editor is used for commit messages, interactive rebase, and git config --edit."
  - line: 7
    text: "The pager less -FRX quits if output fits on screen (-F), preserves colors (-R), and doesn't clear the screen on exit (-X)."
  - line: 8
    text: "autocrlf = input converts CRLF to LF on commit but doesn't touch files on checkout. Standard for Linux/macOS developers."
  - line: 10
    text: "excludesFile points to a global gitignore for OS/editor patterns (.DS_Store, *.swp, .idea/) that shouldn't be in per-repo .gitignore files."
  - line: 27
    text: "push.default = current pushes the current branch to a same-named branch on the remote. Less typing than specifying remote and branch every time."
  - line: 28
    text: "autoSetupRemote (Git 2.37+) automatically configures tracking when you push a new branch. No more git push -u origin branch-name."
  - line: 30
    text: "fetch.prune automatically removes remote-tracking branches that no longer exist on the remote. Keeps your branch list clean."
  - line: 33
    text: "diff.colorMoved highlights lines that were moved (not just added/removed) in a different color. Helpful when refactoring."
  - line: 39
    text: "rebase.autoSquash automatically reorders fixup! and squash! commits during interactive rebase."
  - line: 40
    text: "rebase.autoStash automatically stashes uncommitted changes before rebase and reapplies them after. No more 'cannot rebase: you have unstaged changes' errors."
  - line: 42
    text: "rerere (REuse REcorded REsolution) remembers how you resolved merge conflicts. If the same conflict appears again (common during rebases), Git resolves it automatically."
  - line: 45
    text: "Conditional include loads work-specific settings (different email, signing key) for repositories under ~/work/."
```

```code-walkthrough
title: ".gitattributes for a Polyglot Repository"
description: A .gitattributes file for a project with mixed languages, showing line ending normalization, custom diffs, binary handling, and GitHub linguist overrides.
code: |
  # Default: auto-detect text files, normalize line endings
  * text=auto

  # Source code - force LF
  *.py text eol=lf diff=python
  *.js text eol=lf
  *.ts text eol=lf
  *.jsx text eol=lf
  *.tsx text eol=lf
  *.css text eol=lf
  *.html text eol=lf
  *.sql text eol=lf

  # Config files - force LF
  *.yml text eol=lf
  *.yaml text eol=lf
  *.json text eol=lf
  *.toml text eol=lf
  *.cfg text eol=lf
  *.ini text eol=lf

  # Shell scripts - force LF (critical for execution)
  *.sh text eol=lf
  *.bash text eol=lf

  # Documentation - force LF
  *.md text eol=lf diff=markdown
  *.txt text eol=lf
  LICENSE text eol=lf

  # Windows scripts - force CRLF
  *.bat text eol=crlf
  *.cmd text eol=crlf
  *.ps1 text eol=crlf

  # Binary files - no conversion, no diff
  *.png binary
  *.jpg binary
  *.jpeg binary
  *.gif binary
  *.ico binary
  *.woff binary
  *.woff2 binary
  *.ttf binary
  *.eot binary
  *.zip binary
  *.tar.gz binary
  *.pdf binary

  # Git LFS tracked files
  *.psd filter=lfs diff=lfs merge=lfs -text
  *.ai filter=lfs diff=lfs merge=lfs -text

  # GitHub linguist overrides
  docs/** linguist-documentation
  vendor/** linguist-vendored
  *.min.js linguist-generated
  *.min.css linguist-generated
  migrations/** linguist-generated
language: gitattributes
annotations:
  - line: 2
    text: "The wildcard * with text=auto tells Git to detect text files automatically and normalize their line endings to LF in the repository."
  - line: 5
    text: "diff=python tells Git to use Python-aware diff heuristics. Diff headers will show function and class names instead of generic line numbers."
  - line: 22
    text: "Shell scripts MUST have LF endings. A script with CRLF endings will fail on Linux/macOS with a confusing '/bin/bash^M: bad interpreter' error."
  - line: 26
    text: "diff=markdown makes Git understand Markdown structure in diffs, showing section headings in diff context lines."
  - line: 30
    text: "Windows batch files need CRLF. This ensures they work correctly even when cloned on a Linux system."
  - line: 34
    text: "The binary attribute means: don't normalize line endings, don't attempt textual diff, don't try to merge. Binary files are stored as-is."
  - line: 47
    text: "Git LFS entries redirect large files to LFS storage. The filter=lfs handles clean/smudge, diff=lfs shows LFS-aware diffs, -text prevents line ending conversion."
  - line: 51
    text: "Linguist overrides tell GitHub's language statistics to exclude these paths. Documentation, vendored code, and generated files don't represent your project's actual language composition."
```

---

## Environment Variables

Git reads several environment variables that override configuration:

| Variable | Overrides | Use case |
|----------|-----------|----------|
| `GIT_AUTHOR_NAME` | `user.name` | Set author for the current command |
| `GIT_AUTHOR_EMAIL` | `user.email` | Set author email for the current command |
| `GIT_COMMITTER_NAME` | `user.name` | Set committer identity |
| `GIT_COMMITTER_EMAIL` | `user.email` | Set committer email |
| `GIT_DIR` | default `.git` | Path to the `.git` directory |
| `GIT_WORK_TREE` | default parent of `.git` | Path to the working tree |
| `GIT_EDITOR` | `core.editor` | Editor for commit messages |
| `GIT_PAGER` | `core.pager` | Pager for output |
| `GIT_SSH_COMMAND` | `core.sshCommand` | Custom SSH command |

```bash
# One-off commit with a different author
GIT_AUTHOR_NAME="Pair Partner" GIT_AUTHOR_EMAIL="pair@example.com" git commit -m "Paired on auth fix"

# Use a different SSH key for one command
GIT_SSH_COMMAND="ssh -i ~/.ssh/deploy_key" git push
```

---

## `.mailmap`: Author Normalization

Over time, contributors may use different names or emails across commits. `.mailmap` normalizes these for `git log` and `git shortlog`:

```
# .mailmap
Jane Developer <jane@current.com> <jane.dev@oldcompany.com>
Jane Developer <jane@current.com> <jdev@personal.com>
Bob Smith <bob@company.com> Bobby <bobby@typo.com>
```

Now `git shortlog -sne` shows unified author counts instead of splitting the same person across multiple entries.

---

## Further Reading

- [Pro Git - Chapter 8.1: Customizing Git Configuration](https://git-scm.com/book/en/v2/Customizing-Git-Git-Configuration) - comprehensive coverage of configuration options
- [Official git-config documentation](https://git-scm.com/docs/git-config) - complete reference for all settings
- [Official gitattributes documentation](https://git-scm.com/docs/gitattributes) - line endings, diff drivers, merge strategies, LFS
- [Official gitignore documentation](https://git-scm.com/docs/gitignore) - pattern syntax and precedence

---

**Previous:** [Stashing and the Worktree](stashing-and-worktree.md) | **Next:** [The Object Model](object-model.md) | [Back to Index](README.md)
