# Git

A comprehensive course on Git - from your first commit through the internals of the object model, collaboration workflows across platforms, and advanced operations at scale. These guides take you from "I know I should use version control" to understanding Git deeply enough to debug, optimize, and architect workflows around it.

Each guide is self-contained, but the order below follows a natural learning path.

---

## Foundations

### [Introduction: Why Git, and Why Version Control](introduction.md)

The history of version control from RCS through SVN to distributed systems, and why Linus Torvalds built Git for the Linux kernel. Covers installing Git on every platform, first-time configuration, and a mental model preview of Git as a content-addressable filesystem.

### [The Three Trees: Working Directory, Index, and Repository](three-trees.md)

Git's core mental model - the working tree, staging area, and committed history. Covers the complete file lifecycle from untracked through committed, the `.gitignore` pattern syntax, and a first look inside the `.git` directory.

### [Commits and History](commits-and-history.md)

What a commit actually stores and how to explore history. Covers commit object anatomy, writing effective messages, `git log` formatting and filtering in depth, `git diff` across the three trees, and amending commits.

### [Branches and Merging](branches-and-merging.md)

Branches as movable pointers, not copies. Covers creating, switching, and managing branches, fast-forward vs three-way merges, conflict resolution strategies, and the difference between `git switch` and `git checkout`.

---

## Core Workflows

### [Remote Repositories](remote-repositories.md)

Working with code that lives somewhere else. Covers `clone`, `fetch` vs `pull`, `push` and rejection handling, tracking branches, multiple remotes for fork workflows, and SSH vs HTTPS authentication setup.

### [Rewriting History](rewriting-history.md)

When and how to clean up your commit history. Covers `commit --amend`, interactive rebase (squash, fixup, reorder, edit), `cherry-pick`, `revert` vs `reset` with all three modes, and the reflog as your safety net.

### [Stashing and the Worktree](stashing-and-worktree.md)

Interrupting work without losing it. Covers `git stash` in depth (push, pop, apply, branch), stashing untracked and ignored files, multiple working trees with `git worktree`, and `git clean` for resetting your workspace.

### [Configuring Git](configuring-git.md)

Making Git work the way you want. Covers configuration levels and precedence, aliases, custom diff/merge tools, conditional includes for work vs personal, `.gitattributes` for line endings and diff drivers, and environment variables.

---

## Git Internals

### [The Object Model](object-model.md)

Git as a content-addressable filesystem. Covers the four object types (blobs, trees, commits, annotated tags), SHA-1 hashing, the `.git/objects` directory, and building a commit entirely with plumbing commands.

### [Refs, the Reflog, and the DAG](refs-reflog-dag.md)

How Git names things and connects them. Covers references, symbolic refs like HEAD, the directed acyclic graph, garbage collection, the reflog's per-ref change history, and how packfiles compress objects with delta encoding.

### [Transfer Protocols and Plumbing](transfer-protocols.md)

How `fetch` and `push` work at the protocol level. Covers smart HTTP, SSH, and native transports, pack negotiation, shallow and partial clones, sparse checkout, `git bundle` for offline transfer, and protocol v2 improvements.

---

## Platform Collaboration

### [Collaboration Workflows](collaboration-workflows.md)

Choosing how your team works with Git. Covers centralized, feature branch, Gitflow, trunk-based, and forking workflows, plus pull request best practices, branch protection, and release management with semantic versioning.

### [GitHub, GitLab, and Bitbucket](platforms.md)

Platform-specific features and tooling. Covers PRs vs MRs, CI/CD configuration (Actions, `.gitlab-ci.yml`, Pipelines), `gh` and `glab` CLIs, code owners, and migrating between platforms.

---

## Advanced Operations

### [Git Hooks and Automation](hooks-and-automation.md)

Automating quality checks and workflows. Covers every client-side and server-side hook, hook frameworks (Husky, pre-commit, Lefthook), `git bisect` for binary search debugging, `git blame`, and smudge/clean filters.

### [Git Security](security.md)

Signing, credentials, and secret management. Covers GPG and SSH commit signing, credential helpers, secret scanning tools, removing secrets from history with `git filter-repo`, and verified commits on platforms.

### [Monorepos and Scaling Git](monorepos-and-scaling.md)

Git at enterprise scale. Covers sparse checkout, partial clones, the commit graph file, `git maintenance`, Scalar, filesystem monitors, submodules vs subtrees, and build system integration.

### [Troubleshooting and Recovery](troubleshooting-and-recovery.md)

The "oh no" recovery guide. Covers recovering lost commits from the reflog, undoing every common mistake, Git LFS for large files, history rewriting at scale, performance diagnosis, and repository corruption repair.
