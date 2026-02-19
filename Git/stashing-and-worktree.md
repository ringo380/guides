# Stashing and the Worktree

You're halfway through a feature when an urgent bug comes in. Your working directory has uncommitted changes that aren't ready for a commit. You need to switch context, fix the bug, and come back to where you left off. Git provides two tools for this: **stashing** saves changes temporarily and restores them later, and **worktrees** let you work on multiple branches simultaneously in separate directories.

---

## Git Stash

`git stash` takes your modified tracked files and staged changes, saves them on a stack, and reverts your working directory to match HEAD. You can then switch branches, do other work, and come back to apply the stashed changes.

### Basic Stash Workflow

```bash
# Save current changes to the stash
git stash

# Same as above, with a descriptive message
git stash push -m "WIP: user profile validation"

# List all stashes
git stash list

# Apply the most recent stash (keep it in the stack)
git stash apply

# Apply and remove the most recent stash
git stash pop

# Apply a specific stash
git stash apply stash@{2}
```

### What Gets Stashed

By default, `git stash` saves:

- Modified tracked files
- Staged changes

It does **not** stash:

- Untracked files (new files not yet added)
- Ignored files

Use flags to include those:

```bash
# Include untracked files
git stash push -u
# or
git stash push --include-untracked

# Include everything (untracked + ignored)
git stash push -a
# or
git stash push --all
```

### Inspecting Stashes

```bash
# List all stashes with their messages
git stash list
# stash@{0}: On feature/auth: WIP: user profile validation
# stash@{1}: WIP on main: a1b2c3d Fix login bug
# stash@{2}: On feature/search: search index prototype

# Show what a stash contains (as a diff)
git stash show
# src/auth.py | 12 ++++++------
# src/user.py |  8 ++++++++

# Show the full diff
git stash show -p

# Show a specific stash
git stash show -p stash@{1}
```

### Dropping Stashes

```bash
# Drop the most recent stash
git stash drop

# Drop a specific stash
git stash drop stash@{2}

# Clear all stashes
git stash clear
```

!!! warning "Stashes can be lost"
    `git stash drop` and `git stash clear` permanently remove stashes. Unlike commits, dropped stashes are difficult to recover (possible only through `git fsck --lost-found` if you act quickly). Don't use the stash as long-term storage - commit your work or create a branch.

### Creating a Branch from a Stash

If your stashed changes conflict with work done since stashing, or if you realize the stashed work deserves its own branch:

```bash
# Create a new branch from where you stashed, apply the stash, and drop it
git stash branch new-branch-name

# From a specific stash
git stash branch new-branch-name stash@{2}
```

This creates the branch at the commit where the stash was originally created, applies the stash, and drops it if the apply succeeds.

```terminal
title: Stash Workflow - Save, Switch Context, Restore
steps:
  - command: "git init stash-demo && cd stash-demo && echo 'initial' > app.py && git add app.py && git commit -m 'Initial commit'"
    output: "[main (root-commit) a1b2c3d] Initial commit"
    narration: "Set up a repository with an initial commit."
  - command: "echo 'feature work in progress' >> app.py && echo 'new helper' > utils.py"
    output: ""
    narration: "Start working on a feature: modify an existing file and create a new one."
  - command: "git status -s"
    output: |
       M app.py
      ?? utils.py
    narration: "app.py is modified (tracked), utils.py is untracked. A normal stash would only save app.py."
  - command: "git stash push -u -m 'WIP: feature with new helper'"
    output: "Saved working directory and index state On main: WIP: feature with new helper"
    narration: "Stash with -u to include the untracked utils.py. The -m flag adds a description so you can identify this stash later."
  - command: "git status -s"
    output: ""
    narration: "Working directory is clean. Both the modification and the new file are saved in the stash."
  - command: "echo 'hotfix' >> app.py && git add app.py && git commit -m 'Apply urgent hotfix'"
    output: "[main b2c3d4e] Apply urgent hotfix"
    narration: "Do the urgent work on a clean working directory. Commit the fix."
  - command: "git stash list"
    output: "stash@{0}: On main: WIP: feature with new helper"
    narration: "The stash is still there, waiting for you to come back."
  - command: "git stash pop"
    output: |
      On branch main
      Changes not staged for commit:
        modified:   app.py
      Untracked files:
        utils.py
      Dropped refs/stash@{0} (a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0)
    narration: "Pop restores your stashed changes and removes the stash from the stack. Both the modification to app.py and the new utils.py are back. You can continue where you left off."
  - command: "git stash list"
    output: ""
    narration: "The stash stack is empty after pop. If you used 'apply' instead, the stash would remain in the stack."
```

```command-builder
title: "git stash Command Builder"
description: "Build a git stash command for managing work-in-progress."
base: "git stash"
groups:
  - name: "Action"
    options:
      - flag: "push"
        description: "Save changes to a new stash entry (default action)"
      - flag: "pop"
        description: "Apply the latest stash and remove it from the stack"
      - flag: "apply"
        description: "Apply a stash but keep it in the stack"
      - flag: "list"
        description: "List all stash entries"
      - flag: "show -p"
        description: "Show the full diff of the latest stash"
      - flag: "drop"
        description: "Remove the latest stash from the stack"
      - flag: "branch <name>"
        description: "Create a new branch from the stash point and apply"
  - name: "Options (for push)"
    options:
      - flag: "-m 'description'"
        description: "Add a descriptive message to the stash"
      - flag: "-u"
        description: "Include untracked files in the stash"
      - flag: "-a"
        description: "Include untracked AND ignored files"
      - flag: "-p"
        description: "Interactively select hunks to stash"
```

---

## Git Worktree

Stashing works for quick context switches, but has limits. If you need to work on two branches simultaneously - reviewing a pull request while coding a feature, running tests on one branch while developing on another - you need separate working directories. That's what `git worktree` provides.

A **worktree** is an additional working directory linked to the same repository. Each worktree has its own checked-out branch, its own staging area, and its own working files, but they all share the same `.git` object database. Changes committed in any worktree are immediately available to all others.

### Creating a Worktree

```bash
# Create a worktree for an existing branch
git worktree add ../project-hotfix hotfix/urgent-fix

# Create a worktree with a new branch
git worktree add -b feature/new-search ../project-search

# Create a worktree at a specific commit (detached HEAD)
git worktree add ../project-review a1b2c3d
```

The first argument is the directory path for the new worktree. The second is the branch or commit to check out.

### Listing and Removing Worktrees

```bash
# List all worktrees
git worktree list
# /home/user/project         a1b2c3d [main]
# /home/user/project-hotfix  b2c3d4e [hotfix/urgent-fix]
# /home/user/project-search  c3d4e5f [feature/new-search]

# Remove a worktree (after you're done with it)
git worktree remove ../project-hotfix

# Clean up stale worktree references
git worktree prune
```

### Rules and Constraints

- Each branch can only be checked out in one worktree at a time
- The main worktree (the original clone) can't be removed with `git worktree remove`
- All worktrees share the same object database, refs, and config
- `git worktree lock` prevents a worktree from being pruned (useful for worktrees on removable drives)

```terminal
title: Using Worktrees for Parallel Development
steps:
  - command: "git init worktree-demo && cd worktree-demo && echo 'v1' > app.py && git add app.py && git commit -m 'Initial commit'"
    output: "[main (root-commit) a1b2c3d] Initial commit"
    narration: "Create a repository. This is your main worktree."
  - command: "git switch -c feature/api && echo 'api code' > api.py && git add api.py && git commit -m 'Start API feature'"
    output: "[feature/api b2c3d4e] Start API feature"
    narration: "Start working on a feature branch. You're in the middle of API development."
  - command: "git worktree add ../worktree-demo-hotfix main"
    output: "Preparing worktree (checking out 'main')\nHEAD is now at a1b2c3d Initial commit"
    narration: "Create a separate worktree directory checked out to main. Now you have two working directories: one on feature/api and one on main."
  - command: "git worktree list"
    output: |
      /home/user/worktree-demo          b2c3d4e [feature/api]
      /home/user/worktree-demo-hotfix   a1b2c3d [main]
    narration: "Two worktrees, each on a different branch. You can cd between them and work on both simultaneously."
  - command: "cd ../worktree-demo-hotfix && echo 'hotfix' >> app.py && git add app.py && git commit -m 'Apply critical hotfix'"
    output: "[main c3d4e5f] Apply critical hotfix"
    narration: "In the hotfix worktree, fix the bug on main and commit. Your feature branch work is untouched in the other directory."
  - command: "cd ../worktree-demo && git log --oneline --all"
    output: |
      c3d4e5f (main) Apply critical hotfix
      b2c3d4e (HEAD -> feature/api) Start API feature
      a1b2c3d Initial commit
    narration: "Back in the original worktree, the hotfix commit is visible because both worktrees share the same repository. You can merge it into your feature branch whenever you're ready."
  - command: "git worktree remove ../worktree-demo-hotfix"
    output: ""
    narration: "Remove the hotfix worktree when you're done. The directory is deleted but all commits remain in the shared repository."
```

---

## Stash vs Worktree: When to Use Which

| Situation | Use Stash | Use Worktree |
|-----------|-----------|--------------|
| Quick context switch (minutes) | Yes | Overkill |
| Working on two branches simultaneously | No | Yes |
| Reviewing a PR while developing | No | Yes |
| Running long tests on one branch while coding on another | No | Yes |
| Saving work-in-progress before pulling | Yes | No |
| Need separate build artifacts per branch | No | Yes |
| One-off "save and restore" | Yes | Overkill |

```quiz
question: "When should you use git worktree instead of git stash?"
type: multiple-choice
options:
  - text: "When you want to save changes for later"
    feedback: "That's the primary use case for git stash - saving work-in-progress temporarily. Worktrees solve a different problem."
  - text: "When you need to work on multiple branches simultaneously in separate directories"
    correct: true
    feedback: "Correct! Worktrees give you separate working directories, each on a different branch, sharing the same repository. This lets you work on a feature in one directory while reviewing code or running tests in another. Stashing only works for sequential context switching."
  - text: "When your stash stack is full"
    feedback: "The stash stack has no practical size limit. Worktrees solve a different problem - parallel work across branches - not stash capacity."
  - text: "When you want to delete your changes permanently"
    feedback: "Neither stash nor worktree deletes changes. Use git restore or git reset --hard to discard changes. Worktrees provide parallel working directories."
```

---

## Git Clean

`git clean` removes untracked files from your working directory. It's useful for resetting to a pristine state - removing build artifacts, generated files, or other clutter that isn't tracked by Git.

```bash
# Dry run - show what would be removed (always do this first)
git clean -n

# Remove untracked files
git clean -f

# Remove untracked files and directories
git clean -fd

# Remove untracked and ignored files (full reset)
git clean -fdx

# Interactive mode - choose what to remove
git clean -i
```

!!! danger "git clean is irreversible"
    `git clean -f` permanently deletes files. There's no undo, no stash, no reflog for untracked files. Always run `git clean -n` (dry run) first to see what will be removed.

The flags:

| Flag | Effect |
|------|--------|
| `-n` | Dry run (show what would be removed) |
| `-f` | Force (required for actual deletion) |
| `-d` | Include untracked directories |
| `-x` | Also remove ignored files (build artifacts, etc.) |
| `-X` | Remove only ignored files (keep untracked) |
| `-i` | Interactive mode |

`git clean -fdx` is the nuclear option - it removes everything not tracked by Git, including files in `.gitignore`. Useful for getting a completely clean slate before a release build.

---

## Exercises

```exercise
title: Interrupt Work with a Stash
difficulty: beginner
scenario: |
  You're working on a feature when a bug report comes in. Practice the stash workflow.

  1. Create a repository and make an initial commit
  2. Start working on a feature: create a new file and modify an existing file
  3. Stash your work with a descriptive message (include untracked files)
  4. Fix the bug on a clean working directory and commit
  5. Restore your stashed work
  6. Verify both the bug fix commit and your restored changes exist
hints:
  - "Use git stash push -u -m 'message' to include untracked files"
  - "Use git stash pop to restore and remove the stash"
  - "Check git status after each step to see the state changes"
  - "After popping, you'll have both the bug fix commit and your uncommitted feature work"
solution: |
  ```bash
  git init stash-exercise && cd stash-exercise
  echo "app v1" > app.py && git add app.py && git commit -m "Initial app"

  # Start feature work
  echo "app v1 + feature" > app.py
  echo "helper functions" > helpers.py

  # Stash everything (including untracked helpers.py)
  git stash push -u -m "WIP: feature with helpers"

  # Fix the bug
  echo "app v1 + bugfix" > app.py
  git add app.py && git commit -m "Fix critical bug"

  # Restore feature work
  git stash pop

  # Verify: bug fix is committed, feature work is in working directory
  git log --oneline
  git status
  ```
```

```exercise
title: Parallel Work with Worktrees
difficulty: intermediate
scenario: |
  Set up worktrees for reviewing a PR while continuing feature development.

  1. Create a repository with several commits on main
  2. Create a feature branch and make commits on it
  3. Create a second branch simulating a teammate's PR
  4. Set up a worktree for the PR branch in a sibling directory
  5. In the PR worktree, review the code and add a commit
  6. Back in the main worktree, continue feature development
  7. List all worktrees and verify both branches have their commits
  8. Remove the PR worktree when done
hints:
  - "git worktree add <path> <branch> creates a worktree"
  - "cd between directories to switch context"
  - "git worktree list shows all active worktrees"
  - "git log --oneline --all shows commits across all branches"
solution: |
  ```bash
  git init worktree-exercise && cd worktree-exercise
  echo "main code" > main.py && git add main.py && git commit -m "Initial commit"

  # Create feature branch
  git switch -c feature/dashboard
  echo "dashboard" > dashboard.py && git add dashboard.py && git commit -m "Add dashboard"

  # Create PR branch (simulating teammate's work)
  git switch main
  git switch -c pr/teammate-fix
  echo "fix" > bugfix.py && git add bugfix.py && git commit -m "Teammate's bug fix"

  # Switch back to feature work
  git switch feature/dashboard

  # Create worktree for PR review
  git worktree add ../worktree-exercise-review pr/teammate-fix

  # Review in the PR worktree
  cd ../worktree-exercise-review
  echo "reviewed" >> bugfix.py && git add bugfix.py && git commit -m "Add review feedback"

  # Continue feature work
  cd ../worktree-exercise
  echo "more dashboard" >> dashboard.py && git add dashboard.py && git commit -m "Expand dashboard"

  # List worktrees
  git worktree list

  # Cleanup
  git worktree remove ../worktree-exercise-review
  ```
```

---

## Further Reading

- [Pro Git - Chapter 7.3: Stashing and Cleaning](https://git-scm.com/book/en/v2/Git-Tools-Stashing-and-Cleaning) - comprehensive stash coverage
- [Official git-stash documentation](https://git-scm.com/docs/git-stash) - complete reference for all stash subcommands
- [Official git-worktree documentation](https://git-scm.com/docs/git-worktree) - worktree creation, management, and pruning
- [Official git-clean documentation](https://git-scm.com/docs/git-clean) - cleaning untracked files

---

**Previous:** [Rewriting History](rewriting-history.md) | **Next:** [Configuring Git](configuring-git.md) | [Back to Index](README.md)
