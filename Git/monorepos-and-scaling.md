# Monorepos and Scaling Git

Git was designed for the Linux kernel - a large project, but one with a relatively straightforward directory structure. When organizations put hundreds of projects, millions of files, and decades of history into a single repository, Git's default behavior starts to struggle. Clone times balloon, `git status` takes seconds, and CI builds trigger unnecessarily. This guide covers the tools and strategies for making Git perform at scale.

---

## When Monorepos Make Sense

A **monorepo** stores multiple projects, services, or packages in a single Git repository. Major organizations use them:

- **Google** - billions of lines of code in a single repository (custom VCS, not Git)
- **Meta** - millions of files, custom Mercurial extensions (migrating to a custom Git-like system)
- **Microsoft** - Windows codebase moved to Git using VFS for Git and later Scalar

| Advantage | Trade-off |
|-----------|-----------|
| Atomic cross-project changes | Clone and checkout take longer |
| Shared code without versioning overhead | `git status` is slower with many files |
| Unified CI/CD and tooling | CI must scope to affected code |
| Single source of truth | Access control is repository-wide |
| Easier refactoring across boundaries | Git wasn't designed for millions of files |

The challenges are real but solvable with the right configuration.

---

## Sparse Checkout

**Sparse checkout** tells Git to only materialize a subset of files in your working directory. The full history is available, but you only see the directories you need.

### Setting Up Sparse Checkout

```bash
# Clone with sparse checkout enabled
git clone --sparse https://github.com/org/monorepo.git
cd monorepo

# Check out specific directories
git sparse-checkout set services/auth services/api shared/utils

# Add more directories later
git sparse-checkout add services/web

# List current sparse checkout patterns
git sparse-checkout list

# Disable sparse checkout (check out everything)
git sparse-checkout disable
```

### Cone Mode vs Non-Cone Mode

Sparse checkout has two modes:

- **Cone mode** (default, recommended) - specifies directories. Fast because Git can skip entire subtrees without pattern matching.
- **Non-cone mode** - specifies file glob patterns. More flexible but slower.

```bash
# Cone mode (default) - specify directories
git sparse-checkout set services/auth tests/auth

# Non-cone mode - specify patterns
git sparse-checkout set --no-cone '!/*' '/README.md' '/services/auth/**'
```

Stick with cone mode unless you need file-level granularity.

```terminal
title: Setting Up Sparse Checkout
steps:
  - command: "git clone --sparse https://github.com/org/monorepo.git && cd monorepo"
    output: |
      Cloning into 'monorepo'...
      remote: Enumerating objects: 50000, done.
      Receiving objects: 100% (50000/50000), 25 MiB | 10 MiB/s, done.
      Resolving deltas: 100% (30000/30000), done.
    narration: "Clone with --sparse. Git downloads all objects but only checks out the root-level files. Subdirectories are not materialized."
  - command: "ls"
    output: |
      README.md
      package.json
      tsconfig.json
    narration: "Only root files are visible. The services/, packages/, and tools/ directories exist in the repo but aren't checked out."
  - command: "git sparse-checkout set services/auth shared/types"
    output: ""
    narration: "Tell Git which directories you want to work in. Only these paths are checked out."
  - command: "ls services/"
    output: "auth/"
    narration: "Only the auth service is visible under services/. Other services exist in the repository but are not in your working directory."
  - command: "git sparse-checkout list"
    output: |
      services/auth
      shared/types
    narration: "Confirm which paths are checked out. You can add more with git sparse-checkout add."
```

---

## Partial Clone

**Partial clone** (Git 2.22+) lets you clone a repository without downloading all objects. Git fetches missing objects on demand when you need them.

### Filter Options

```bash
# Blobless clone - skip file content, download on checkout
git clone --filter=blob:none https://github.com/org/monorepo.git

# Treeless clone - skip trees too (minimal download)
git clone --filter=tree:0 https://github.com/org/monorepo.git

# Size-limited - skip blobs larger than a threshold
git clone --filter=blob:limit=1m https://github.com/org/monorepo.git
```

### Combining Partial Clone and Sparse Checkout

The power combo for monorepos:

```bash
# Clone with partial objects and sparse checkout
git clone --filter=blob:none --sparse https://github.com/org/monorepo.git
cd monorepo

# Check out only what you need
git sparse-checkout set services/my-service tests/my-service

# Git fetches blobs only for files in your sparse checkout
```

This gives you:

- Full commit history (for `git log`, `git blame`)
- Minimal disk usage (only blobs for your directories)
- Fast initial clone

```quiz
question: "What does a partial clone with --filter=blob:none exclude?"
type: multiple-choice
options:
  - text: "All file content (blobs) - they're downloaded on demand when accessed"
    correct: true
    feedback: "Correct! --filter=blob:none downloads commits and trees (directory structure) but skips all blobs (file content). When you checkout a file or run git diff, Git fetches the needed blobs transparently. This dramatically reduces initial clone size while maintaining full history."
  - text: "All commit history beyond a certain depth"
    feedback: "That's what --depth (shallow clone) does. Partial clone with blob:none keeps full commit history but defers downloading file content."
  - text: "All branches except the default"
    feedback: "That's --single-branch. Partial clone with blob:none keeps all branches and history but defers downloading file content."
  - text: "All metadata, keeping only file content"
    feedback: "It's the opposite - partial clone with blob:none keeps all metadata (commits, trees) but defers downloading file content (blobs)."
```

---

## The Commit Graph File

The **commit graph** file (`.git/objects/info/commit-graph`) is a pre-computed index of the commit DAG. It stores commit hashes, parent hashes, root tree hashes, commit dates, and generation numbers in a compact binary format.

Without the commit graph file, Git must decompress and parse individual commit objects to traverse history. With it, operations like `git log --graph`, `git merge-base`, and reachability queries are significantly faster.

```bash
# Generate/update the commit graph
git commit-graph write

# Verify the commit graph
git commit-graph verify

# It's also maintained by git maintenance
git maintenance run --task=commit-graph
```

```quiz
question: "What does the commit graph file speed up?"
type: multiple-choice
options:
  - text: "History traversal operations like git log, merge-base computation, and reachability queries"
    correct: true
    feedback: "Correct! The commit graph file pre-computes the commit DAG structure, storing parent links, dates, and generation numbers in a compact binary format. This avoids decompressing individual commit objects during log traversal, merge-base computation, and reachability checks."
  - text: "File checkout speed"
    feedback: "Checkout speed depends on blob decompression and filesystem operations, not commit graph traversal. The commit graph file optimizes history navigation, not working directory operations."
  - text: "Push and fetch transfer speed"
    feedback: "Transfer speed depends on network and pack negotiation. The commit graph file is a local optimization for history traversal operations."
  - text: "Staging and committing speed"
    feedback: "Staging depends on index operations and committing creates new objects. The commit graph file optimizes reading existing commit history, not creating new commits."
```

---

## `git maintenance` - Background Optimization

Git 2.29+ includes `git maintenance` for scheduling automatic optimization:

```bash
# Register this repo for background maintenance
git maintenance register

# Run all tasks now
git maintenance run

# Start the scheduler (uses system scheduler: launchd/cron/systemd)
git maintenance start

# Stop the scheduler
git maintenance stop
```

### Maintenance Tasks

| Task | Frequency | What it does |
|------|-----------|--------------|
| `commit-graph` | Hourly | Updates the commit graph file |
| `prefetch` | Hourly | Background fetch from remotes (no merge) |
| `loose-objects` | Daily | Packs loose objects |
| `incremental-repack` | Daily | Consolidates packfiles |
| `gc` | Weekly | Full garbage collection |

```terminal
title: Configuring git maintenance
steps:
  - command: "git maintenance register"
    output: ""
    narration: "Register the current repository for maintenance. Git adds it to the list of repos the scheduler operates on."
  - command: "git maintenance start"
    output: ""
    narration: "Start the background scheduler. On macOS this creates a launchd plist; on Linux it uses cron or systemd timers."
  - command: "git config --global --get-regexp maintenance"
    output: |
      maintenance.repo /home/user/monorepo
      maintenance.auto false
    narration: "The configuration shows which repos are registered and that automatic GC (maintenance.auto) is disabled in favor of scheduled maintenance."
  - command: "git maintenance run --task=commit-graph --task=loose-objects"
    output: ""
    narration: "Run specific tasks on demand. Useful after importing many commits or receiving a large fetch."
```

---

## Scalar

[**Scalar**](https://github.com/microsoft/scalar) is Microsoft's tool for optimizing large Git repositories. Since Git 2.38, a subset of Scalar is built into Git itself:

```bash
# Initialize a repo with Scalar optimizations
scalar clone https://github.com/org/large-repo.git

# Register an existing repo for Scalar management
scalar register

# Scalar automatically configures:
# - Sparse checkout
# - Partial clone (blob:none)
# - Commit graph
# - Multi-pack index
# - File system monitor (fsmonitor)
# - Background maintenance
```

Scalar is essentially a convenience wrapper that enables all the individual optimizations covered in this guide in one command.

---

## File System Monitor

`git status` needs to check every tracked file for changes. On large repositories, this filesystem scan is the bottleneck. The **file system monitor** (`fsmonitor`) uses OS-level file change notifications to skip files that haven't changed.

```bash
# Enable the built-in fsmonitor daemon (Git 2.37+)
git config core.fsmonitor true

# Or use Watchman (Facebook's file watcher)
git config core.fsmonitor "$(which watchman)"
```

The built-in `fsmonitor--daemon` (Git 2.37+) watches for filesystem events and tells Git which files have changed since the last query. This can make `git status` near-instantaneous on repos with hundreds of thousands of files.

---

## Submodules vs Subtrees

For projects that need to include code from other repositories, Git offers two mechanisms:

### Submodules

A **submodule** is a pointer to a specific commit in another repository:

```bash
# Add a submodule
git submodule add https://github.com/lib/awesome-lib.git vendor/awesome-lib

# Clone a repo with submodules
git clone --recurse-submodules https://github.com/org/project.git

# Update submodules to their tracked commits
git submodule update --init --recursive

# Update submodules to the latest remote commit
git submodule update --remote
```

Submodules are simple in concept but have notorious UX issues: detached HEAD state inside the submodule, forgetting to init/update after clone, and confusing merge conflicts.

### Subtrees

A **subtree** merges another repository's content directly into a subdirectory:

```bash
# Add a subtree
git subtree add --prefix=vendor/awesome-lib https://github.com/lib/awesome-lib.git main --squash

# Pull updates
git subtree pull --prefix=vendor/awesome-lib https://github.com/lib/awesome-lib.git main --squash

# Push changes back upstream
git subtree push --prefix=vendor/awesome-lib https://github.com/lib/awesome-lib.git main
```

Subtrees are simpler for consumers (no special init commands), but the history can be messy and push-back workflows are less intuitive.

| | Submodules | Subtrees |
|--|-----------|----------|
| **Storage** | Pointer to external commit | Content merged into repo |
| **Clone experience** | Requires `--recurse-submodules` | Works with normal clone |
| **Updating** | `submodule update --remote` | `subtree pull` |
| **History** | Separate (external repo) | Mixed into your repo |
| **Push changes back** | cd into submodule, commit, push | `subtree push` |

---

## Build System Integration

Large monorepos need build systems that understand which projects are affected by a change:

- [**Bazel**](https://bazel.build/) - Google's build system, tracks dependencies explicitly
- [**Nx**](https://nx.dev/) - smart monorepo build system for JavaScript/TypeScript
- [**Turborepo**](https://turbo.build/) - incremental build system for JS monorepos
- [**Pants**](https://www.pantsbuild.org/) - scalable build system for Python, Go, Java

These tools use the Git commit graph to determine which packages changed and only build/test those, making CI feasible for large monorepos.

```command-builder
title: "Clone Strategies for Large Repos"
description: "Build an optimized clone command for a large repository."
base: "git clone"
groups:
  - name: "Object Filtering"
    options:
      - flag: "--filter=blob:none"
        description: "Blobless: skip file content, fetch on demand"
      - flag: "--filter=blob:limit=1m"
        description: "Skip blobs larger than 1MB"
      - flag: "--filter=tree:0"
        description: "Treeless: skip trees too (ultra minimal)"
  - name: "Checkout Scope"
    options:
      - flag: "--sparse"
        description: "Only check out root files (use sparse-checkout to add dirs)"
      - flag: "--no-checkout"
        description: "Don't check out any files"
  - name: "History Depth"
    options:
      - flag: "--depth 1"
        description: "Shallow: only latest commit"
      - flag: "--single-branch"
        description: "Only the default branch"
```

---

## Exercise

```exercise
title: Configure Sparse Checkout and Partial Clone
difficulty: intermediate
scenario: |
  Simulate working with a monorepo by configuring sparse checkout and partial clone.

  1. Create a "monorepo" with multiple service directories: services/auth, services/api, services/web, shared/types, shared/utils
  2. Add files and commits to each directory
  3. Clone it with --filter=blob:none --sparse
  4. Set sparse checkout to only include services/auth and shared/types
  5. Verify only those directories are checked out
  6. Run git log to confirm full history is available
  7. Add services/api to sparse checkout
  8. Enable git maintenance for background optimization
hints:
  - "Create the monorepo structure with mkdir -p and multiple commits"
  - "git clone --filter=blob:none --sparse <path> for optimized clone"
  - "git sparse-checkout set services/auth shared/types"
  - "git maintenance register && git maintenance start"
solution: |
  ```bash
  # Create the monorepo
  git init monorepo-source && cd monorepo-source

  mkdir -p services/auth services/api services/web shared/types shared/utils

  echo "auth service" > services/auth/index.js
  echo "api service" > services/api/index.js
  echo "web service" > services/web/index.js
  echo "type defs" > shared/types/index.ts
  echo "util funcs" > shared/utils/index.ts
  echo "# Monorepo" > README.md

  git add . && git commit -m "Initial monorepo structure"

  echo "auth v2" > services/auth/index.js
  git add . && git commit -m "Update auth service"

  echo "api v2" > services/api/index.js
  git add . && git commit -m "Update API service"

  cd ..

  # Clone with optimizations
  git clone --filter=blob:none --sparse monorepo-source monorepo-work
  cd monorepo-work

  # Only root files are visible
  ls

  # Set sparse checkout
  git sparse-checkout set services/auth shared/types

  # Verify
  ls services/          # Only auth/
  ls shared/            # Only types/

  # Full history is available
  git log --oneline     # All 3 commits

  # Add more directories as needed
  git sparse-checkout add services/api

  # Enable maintenance
  git maintenance register
  ```
```

---

## Further Reading

- [Pro Git - Chapter 7.11: Submodules](https://git-scm.com/book/en/v2/Git-Tools-Submodules) - submodule setup and workflow
- [Official git-sparse-checkout documentation](https://git-scm.com/docs/git-sparse-checkout) - sparse checkout modes and patterns
- [Official git-maintenance documentation](https://git-scm.com/docs/git-maintenance) - background optimization tasks
- [Scalar Documentation](https://github.com/microsoft/scalar) - Microsoft's monorepo optimization tool
- [Git at Scale (Microsoft DevOps Blog)](https://devblogs.microsoft.com/devops/introducing-scalar/) - Scalar and VFS for Git
- [Partial Clone Documentation](https://git-scm.com/docs/partial-clone) - filtering objects during clone

---

**Previous:** [Git Security](security.md) | **Next:** [Troubleshooting and Recovery](troubleshooting-and-recovery.md) | [Back to Index](README.md)
