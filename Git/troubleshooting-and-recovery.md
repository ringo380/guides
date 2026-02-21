# Troubleshooting and Recovery

Things go wrong with Git. Commits end up on the wrong branch, force pushes destroy history, secrets get committed, merge conflicts spiral out of control, and sometimes the repository itself gets corrupted. This guide is your recovery playbook - a reference for undoing every common mistake and diagnosing problems when Git behaves unexpectedly.

---

## The Recovery Decision Tree

Before reaching for a specific command, identify your situation:

<div class="diagram-container"><img src="../../assets/images/git/recovery-decision-tree.svg" alt="Git recovery decision tree showing paths through reflog, fsck, reset, and revert based on whether changes were pushed and how recently they occurred"></div>

| What happened | Recovery |
|---------------|----------|
| Bad commit message | `git commit --amend` (if unpushed) |
| Committed to wrong branch | `git cherry-pick` + `git reset` |
| Want to undo last commit (keep changes) | `git reset --soft HEAD~1` |
| Want to undo last commit (discard changes) | `git reset --hard HEAD~1` |
| Accidentally deleted a branch | `git reflog` + `git branch` |
| Bad merge | `git revert -m 1 <merge-commit>` (shared) or `git reset` (local) |
| Committed a secret | Revoke secret, then `git filter-repo` |
| Pushed something bad to shared branch | `git revert` (never force push shared branches) |
| Lost commits after rebase | `git reflog` + `git reset` |
| Repository corruption | `git fsck` + `git gc` |

```quiz
question: "Which recovery method should you use for each mistake?"
type: multiple-choice
options:
  - text: "Reflog for lost commits, revert for shared branch mistakes, filter-repo for secrets, reset for local-only mistakes"
    correct: true
    feedback: "Correct! The reflog helps recover lost commits (from reset, rebase, or deleted branches). Revert safely undoes changes on shared branches by creating new commits. filter-repo rewrites history for removing secrets. Reset rewrites local history when commits haven't been pushed."
  - text: "Always use git reset --hard to fix everything"
    feedback: "reset --hard is destructive and only works for local branches. It can't fix shared branch problems (use revert), recover deleted branches (use reflog), or remove secrets from history (use filter-repo)."
  - text: "Force push to fix any pushed mistake"
    feedback: "Force pushing rewrites shared history, which breaks other developers' work. Use git revert on shared branches instead. Force push is only acceptable for branches you exclusively own."
  - text: "Delete the repo and re-clone to fix any problem"
    feedback: "Re-cloning loses all local branches, stashes, and configuration. Most problems can be fixed in-place with the right commands. Only consider re-cloning as an absolute last resort."
```

---

## Recovering Lost Commits

### From the Reflog

The **reflog** records every HEAD movement. Even after `git reset --hard`, the old commits exist in the object database and appear in the reflog:

```bash
# See recent HEAD history
git reflog

# Find the commit you want
git reflog | grep "commit: Add user auth"

# Recover by resetting to that point
git reset --hard HEAD@{3}

# Or create a branch at that point (safer)
git branch recovery HEAD@{3}
```

### From `git fsck`

If reflog entries have expired (after 30+ days), use `git fsck`:

```bash
# Find unreachable (dangling) commits
git fsck --unreachable | grep commit

# Examine a dangling commit
git show <commit-hash>

# Recover it
git branch recovery <commit-hash>

# Or use --lost-found to dump all recoverable objects
git fsck --lost-found
ls .git/lost-found/commit/
```

```terminal
title: Recovering a Deleted Branch from the Reflog
steps:
  - command: "git init recovery-demo && cd recovery-demo && echo 'init' > app.py && git add app.py && git commit -m 'Initial commit'"
    output: "[main (root-commit) a1b2c3d] Initial commit"
    narration: "Create a repository with an initial commit."
  - command: "git switch -c feature/important-work"
    output: "Switched to a new branch 'feature/important-work'"
    narration: "Create a feature branch for some important work."
  - command: "echo 'critical code' > feature.py && git add feature.py && git commit -m 'Add critical feature'"
    output: "[feature/important-work b2c3d4e] Add critical feature"
    narration: "Make commits on the feature branch."
  - command: "echo 'more work' >> feature.py && git add feature.py && git commit -m 'Expand critical feature'"
    output: "[feature/important-work c3d4e5f] Expand critical feature"
    narration: "Two commits of important work on this branch."
  - command: "git switch main && git branch -D feature/important-work"
    output: "Switched to branch 'main'\nDeleted branch feature/important-work (was c3d4e5f)."
    narration: "Oops! Accidentally force-deleted the branch. The branch is gone, and the commits aren't on main."
  - command: "git log --oneline --all"
    output: "a1b2c3d (HEAD -> main) Initial commit"
    narration: "git log only shows the initial commit. The feature commits seem gone."
  - command: "git reflog | head -5"
    output: |
      a1b2c3d HEAD@{0}: checkout: moving from feature/important-work to main
      c3d4e5f HEAD@{1}: commit: Expand critical feature
      b2c3d4e HEAD@{2}: commit: Add critical feature
      a1b2c3d HEAD@{3}: checkout: moving from main to feature/important-work
      a1b2c3d HEAD@{4}: commit (initial): Initial commit
    narration: "The reflog remembers everything. HEAD@{1} is the tip of the deleted branch (c3d4e5f)."
  - command: "git branch feature/recovered c3d4e5f"
    output: ""
    narration: "Create a new branch at the lost commit. Both commits in the chain are recovered because c3d4e5f's parent (b2c3d4e) is automatically included."
  - command: "git log --oneline --all"
    output: |
      c3d4e5f (feature/recovered) Expand critical feature
      b2c3d4e Add critical feature
      a1b2c3d (HEAD -> main) Initial commit
    narration: "The full feature branch is recovered. Nothing was lost."
```

---

## Undoing Common Mistakes

### Wrong Commit Message

```bash
# Fix the last commit message (unpushed only)
git commit --amend -m "Corrected message"
```

### Committed to the Wrong Branch

```bash
# You committed to main instead of feature/auth
# Step 1: Note the commit hash
git log --oneline -1
# a1b2c3d Accidental commit on main

# Step 2: Move the commit to the right branch
git switch feature/auth
git cherry-pick a1b2c3d

# Step 3: Remove from main
git switch main
git reset --hard HEAD~1
```

### Undo the Last Commit (Keep Changes)

```bash
# Soft reset: uncommit but keep changes staged
git reset --soft HEAD~1

# Mixed reset: uncommit and unstage, changes in working dir
git reset HEAD~1
```

### Accidental `git reset --hard`

```bash
# Find where HEAD was before the reset
git reflog
# a1b2c3d HEAD@{1}: commit: Important work

# Recover
git reset --hard HEAD@{1}
```

### Bad Merge

```bash
# On a shared branch: create a revert commit
git revert -m 1 <merge-commit-hash>
# -m 1 keeps the mainline parent, reverting the merged branch's changes

# On a local branch: reset before the merge
git reset --hard HEAD~1
```

### Accidental `git add` (Staged Something Wrong)

```bash
# Unstage a specific file
git restore --staged secret.env

# Unstage everything
git restore --staged .
```

---

## Git LFS (Large File Storage)

Git isn't designed for large binary files. Each version of a large file is stored as a full blob, and the repository size grows linearly with each change. [**Git LFS**](https://git-lfs.com/) solves this by replacing large files with lightweight pointers in the repository and storing the actual file content on a separate server.

### Setup

```bash
# Install Git LFS
brew install git-lfs    # macOS
sudo apt install git-lfs  # Debian/Ubuntu

# Initialize LFS in a repository
git lfs install

# Track file patterns
git lfs track "*.psd"
git lfs track "*.zip"
git lfs track "assets/videos/**"

# Check what's tracked
git lfs track
cat .gitattributes
```

### How It Works

When you `git add` a tracked file, LFS replaces it with a pointer file:

```
version https://git-lfs.github.com/spec/v1
oid sha256:4d7a214614ab2935c943f9e0ff69d22eadbb8f32b1258daaa5e2ca24d17e2393
size 12345678
```

The actual file content is uploaded to the LFS server during `git push` and downloaded during `git pull` or `git checkout`.

```quiz
question: "What does Git LFS store in the Git repository vs on the LFS server?"
type: multiple-choice
options:
  - text: "Small pointer files in Git, actual file content on the LFS server"
    correct: true
    feedback: "Correct! Git LFS replaces large files in the repository with lightweight pointer files (~130 bytes). The actual file content is stored on a separate LFS server and downloaded on demand. This keeps the Git repository small even with large binaries."
  - text: "All files in Git, copies on the LFS server for backup"
    feedback: "LFS doesn't duplicate files. It replaces large files in Git with tiny pointers. Only the pointer is stored in Git; the content lives on the LFS server."
  - text: "File metadata in Git, file content split across both"
    feedback: "LFS doesn't split files. The Git repository contains only the pointer file. The LFS server stores the complete file content."
  - text: "Everything on the LFS server, nothing in Git"
    feedback: "LFS stores pointer files in Git (tracked normally through commits). The pointers reference content on the LFS server. Git still tracks the file's presence and version history through the pointers."
```

### Migrating Existing Files to LFS

```bash
# Migrate existing large files in history
git lfs migrate import --include="*.psd,*.zip" --everything

# Check which files are taking the most space
git lfs migrate info
```

!!! warning "LFS migration rewrites history"
    `git lfs migrate import` rewrites commit history to replace files with LFS pointers. This requires force pushing and coordination with your team. All collaborators must re-clone.

```terminal
title: Setting Up Git LFS
steps:
  - command: "git lfs install"
    output: "Updated git hooks.\nGit LFS initialized."
    narration: "Initialize Git LFS in your user configuration. This sets up the clean/smudge filters that handle pointer file conversion."
  - command: "git lfs track '*.psd' '*.zip'"
    output: |
      Tracking "*.psd"
      Tracking "*.zip"
    narration: "Tell LFS which file patterns to manage. This writes rules to .gitattributes."
  - command: "cat .gitattributes"
    output: |
      *.psd filter=lfs diff=lfs merge=lfs -text
      *.zip filter=lfs diff=lfs merge=lfs -text
    narration: "The .gitattributes entries configure Git to use LFS filters for these file types. filter=lfs handles the pointer conversion, diff=lfs shows LFS-aware diffs."
  - command: "git add .gitattributes && git commit -m 'Configure Git LFS tracking'"
    output: "[main a1b2c3d] Configure Git LFS tracking"
    narration: "Commit the .gitattributes file so the whole team uses LFS for these file types."
  - command: "cp ~/design.psd . && git add design.psd && git commit -m 'Add design mockup'"
    output: "[main b2c3d4e] Add design mockup"
    narration: "When you add a tracked file, LFS automatically replaces it with a pointer in the staging area. The actual content is stored in .git/lfs/objects/."
  - command: "git lfs ls-files"
    output: "b2c3d4e5f6 * design.psd"
    narration: "List files managed by LFS. The asterisk means the file content is stored locally. After pushing, it's also uploaded to the LFS server."
```

---

## History Rewriting at Scale

### `git filter-repo`

[**git filter-repo**](https://github.com/newren/git-filter-repo) is the recommended tool for large-scale history rewriting. It's faster and safer than the older `git filter-branch`:

```bash
# Remove a directory from all history
git filter-repo --path old-vendor/ --invert-paths

# Remove files by pattern
git filter-repo --path-glob '*.log' --invert-paths

# Change author email across all history
git filter-repo --email-callback 'return email.replace(b"old@email.com", b"new@email.com")'

# Reduce to only a subdirectory (extract a project from a monorepo)
git filter-repo --subdirectory-filter services/auth
```

### BFG Repo-Cleaner

[**BFG**](https://reclaimtheremote.com/bfg-repo-cleaner/) is simpler for common tasks:

```bash
# Remove all files larger than 100MB from history
bfg --strip-blobs-bigger-than 100M

# Remove specific files
bfg --delete-files passwords.txt

# Replace sensitive strings
bfg --replace-text replacements.txt
```

After any history rewriting:

```bash
git reflog expire --expire=now --all
git gc --prune=now --aggressive
git push --force --all
git push --force --tags
```

---

## Performance Diagnosis

When Git feels slow, these tools help identify the bottleneck:

### Trace Environment Variables

```bash
# General trace (shows internal commands)
GIT_TRACE=1 git status

# Performance timing per operation
GIT_TRACE_PERFORMANCE=1 git status

# Pack protocol traces (for fetch/push)
GIT_TRACE_PACKET=1 git fetch

# HTTP request details
GIT_CURL_VERBOSE=1 git fetch
```

```terminal
title: Diagnosing Performance with GIT_TRACE_PERFORMANCE
steps:
  - command: "GIT_TRACE_PERFORMANCE=1 git status 2>&1 | head -15"
    output: |
      10:30:01.123 trace.c:480 performance: 0.000 s: git command: git status
      10:30:01.124 read-cache.c:2323 performance: 0.012 s: read cache .git/index
      10:30:01.136 preload-index.c:140 performance: 0.008 s: preload index
      10:30:01.144 read-cache.c:1827 performance: 0.045 s: refresh index
      10:30:01.189 diff-lib.c:565 performance: 0.003 s: diff-files
      10:30:01.192 diff-lib.c:671 performance: 0.001 s: diff-index
      10:30:01.193 trace.c:480 performance: 0.070 s: git command: git status
    narration: "GIT_TRACE_PERFORMANCE shows timing for each internal operation. Here, 'refresh index' takes 45ms - this is where Git stats every tracked file to check for changes. On large repos, this is the bottleneck that fsmonitor fixes."
  - command: "git count-objects -v"
    output: |
      count: 42
      size: 168
      in-pack: 15234
      packs: 3
      size-pack: 4821
      prune-packable: 0
      garbage: 0
      size-garbage: 0
    narration: "count-objects shows repository storage statistics. 42 loose objects, 15234 packed objects across 3 packfiles. If 'count' is very high, running git gc would help."
```

### Common Performance Fixes

| Symptom | Likely cause | Fix |
|---------|-------------|-----|
| `git status` slow | Large working directory | Enable `core.fsmonitor` |
| `git log` slow | Large history without commit graph | `git commit-graph write` |
| `git clone` slow | Large repository | Partial clone + sparse checkout |
| `git push/fetch` slow | Many packfiles | `git repack -a -d` |
| `git gc` slow | Too many loose objects | Already running GC, just wait |

---

## Common Error Messages Decoded

| Error | Meaning | Fix |
|-------|---------|-----|
| `fatal: not a git repository` | No `.git` directory in this or parent directories | `cd` to a repo or `git init` |
| `error: failed to push some refs` | Remote has commits you don't have | `git pull` then `git push` |
| `CONFLICT (content): Merge conflict` | Both branches changed the same lines | Edit files, remove markers, `git add`, `git commit` |
| `detached HEAD` | HEAD points to a commit, not a branch | `git switch main` or `git switch -c new-branch` |
| `fatal: refusing to merge unrelated histories` | Two repos with no common ancestor | `git pull --allow-unrelated-histories` |
| `error: Your local changes would be overwritten` | Uncommitted changes conflict with the operation | `git stash` then retry |
| `warning: LF will be replaced by CRLF` | Line ending conversion happening | Check `core.autocrlf` and `.gitattributes` |
| `fatal: bad object HEAD` | Corrupted HEAD reference | Check `.git/HEAD`, may need to rewrite it |

---

## Repository Corruption and Repair

Corruption is rare but can happen from disk failures, interrupted operations, or filesystem bugs.

### Detecting Corruption

```bash
# Full integrity check
git fsck --full

# Common output:
# broken link from commit abc123 to tree def456
# dangling commit 789abc
# missing blob fed321
```

### Repair Strategies

1. **Missing objects:** If you have a remote, fetch the missing objects:
   ```bash
   git fetch origin
   ```

2. **Corrupted index:** Delete and rebuild:
   ```bash
   rm .git/index
   git reset
   ```

3. **Corrupted HEAD:** Manually fix the reference:
   ```bash
   echo "ref: refs/heads/main" > .git/HEAD
   ```

4. **Corrupted packfile:** Remove and re-fetch:
   ```bash
   mv .git/objects/pack/pack-*.pack /tmp/backup/
   mv .git/objects/pack/pack-*.idx /tmp/backup/
   git fetch origin
   ```

5. **Last resort:** Clone fresh and copy local branches:
   ```bash
   git clone origin-url fresh-clone
   cd fresh-clone
   git remote add broken ../broken-repo
   git fetch broken    # Salvage what you can
   ```

---

## Exercises

```exercise
title: Create Disasters and Recover
difficulty: intermediate
scenario: |
  Practice recovering from common Git mistakes.

  1. Create a repository with 5 commits on main
  2. Disaster 1: Reset --hard back 3 commits, then recover all commits using the reflog
  3. Disaster 2: Delete a branch with unique commits, then recover it
  4. Disaster 3: Make a commit on main that should have been on a feature branch - move it
  5. Disaster 4: Merge a branch, then revert the merge
  6. Verify each recovery was successful before moving to the next disaster
hints:
  - "git reflog shows every HEAD movement - your safety net for reset and delete"
  - "git cherry-pick copies a specific commit to your current branch"
  - "git revert -m 1 <merge-hash> reverts a merge commit keeping the mainline parent"
  - "Always check git log --oneline --all --graph after recovery to verify"
solution: |
  ```bash
  git init disaster-demo && cd disaster-demo
  for i in 1 2 3 4 5; do
    echo "commit $i" > file.txt
    git add file.txt && git commit -m "Commit $i"
  done

  # Disaster 1: Reset --hard
  git reset --hard HEAD~3
  git log --oneline  # Only commits 1 and 2
  git reflog
  git reset --hard HEAD@{1}  # Back to commit 5
  git log --oneline  # All 5 commits restored

  # Disaster 2: Delete branch
  git switch -c feature/test
  echo "feature" > feat.txt && git add feat.txt && git commit -m "Feature commit"
  FEAT_HASH=$(git rev-parse HEAD)
  git switch main
  git branch -D feature/test
  git branch feature/recovered $FEAT_HASH
  git log --oneline --all  # Feature commit recovered

  # Disaster 3: Wrong branch commit
  echo "should be on feature" > wrong.txt
  git add wrong.txt && git commit -m "Wrong branch commit"
  WRONG_HASH=$(git rev-parse HEAD)
  git switch -c feature/correct
  git cherry-pick $WRONG_HASH
  git switch main
  git reset --hard HEAD~1
  git log --oneline --all  # Commit moved to feature/correct

  # Disaster 4: Bad merge
  git switch -c feature/bad
  echo "bad feature" > bad.txt && git add bad.txt && git commit -m "Bad feature"
  git switch main
  git merge feature/bad
  git revert -m 1 HEAD  # Revert the merge
  git log --oneline --graph  # Merge and revert both visible
  ```
```

```exercise
title: Migrate a Repository to Git LFS
difficulty: intermediate
scenario: |
  Practice setting up Git LFS and migrating existing large files.

  1. Create a repository with a mix of code files and "large" binary files
  2. Make several commits that modify both code and binary files
  3. Check the repository size with git count-objects
  4. Install and configure Git LFS for the binary file types
  5. Migrate existing history to use LFS pointers
  6. Verify the migration with git lfs ls-files
  7. Check the repository size again (should be smaller)
hints:
  - "Create fake 'large' files with dd if=/dev/urandom bs=1024 count=100 > file.bin"
  - "git lfs install initializes LFS, git lfs track configures patterns"
  - "git lfs migrate import --include='*.bin' --everything rewrites history"
  - "git count-objects -v shows size before and after"
solution: |
  ```bash
  git init lfs-demo && cd lfs-demo

  # Create mixed files
  echo "source code" > app.py
  dd if=/dev/urandom bs=1024 count=100 > image.bin 2>/dev/null
  git add . && git commit -m "Initial files"

  echo "updated code" > app.py
  dd if=/dev/urandom bs=1024 count=200 > image.bin 2>/dev/null
  git add . && git commit -m "Update files"

  echo "more code" >> app.py
  dd if=/dev/urandom bs=1024 count=300 > image.bin 2>/dev/null
  git add . && git commit -m "More updates"

  # Check size before
  git count-objects -v

  # Set up LFS
  git lfs install
  git lfs track "*.bin"
  git add .gitattributes && git commit -m "Configure LFS"

  # Migrate existing history
  git lfs migrate import --include="*.bin" --everything

  # Verify
  git lfs ls-files
  git count-objects -v  # Git objects should be smaller

  git log --oneline
  ```
```

---

## Further Reading

- [Pro Git - Chapter 7: Git Tools](https://git-scm.com/book/en/v2/Git-Tools-Revision-Selection) - stashing, searching, rewriting, debugging
- [Git LFS Documentation](https://git-lfs.com/) - large file storage setup and usage
- [git-filter-repo Documentation](https://github.com/newren/git-filter-repo) - history rewriting tool
- [BFG Repo-Cleaner Documentation](https://reclaimtheremote.com/bfg-repo-cleaner/) - simple history cleaning
- [Official git-fsck documentation](https://git-scm.com/docs/git-fsck) - repository integrity verification

---

**Previous:** [Monorepos and Scaling Git](monorepos-and-scaling.md) | [Back to Index](README.md)
