# Commits and History

A **commit** is Git's fundamental unit of work - a permanent snapshot of your entire project at a specific point in time. Understanding what commits contain, how to write good commit messages, and how to navigate history with `git log` and `git diff` are essential skills you'll use every day.

---

## Anatomy of a Commit

<div class="diagram-container"><img src="../../assets/images/git/commit-anatomy.svg" alt="Git commit object anatomy showing tree, parent, author, committer fields and the parent chain with merge commits"></div>

Every commit in Git stores four pieces of information:

1. **Tree** - a reference to a tree object that captures the state of every file and directory at the moment of the commit
2. **Parent(s)** - a reference to the commit(s) that came immediately before. A root commit has no parent. A merge commit has two (or more) parents.
3. **Author** - who originally wrote the change (name, email, timestamp)
4. **Committer** - who applied the change to the repository (name, email, timestamp)

The author and committer are usually the same person. They differ when someone applies a patch written by another developer, or during cherry-picks and rebases.

A commit also has a **message** - the human-readable description of what changed and why.

Each commit is identified by a **SHA-1 hash** - a 40-character hexadecimal string computed from all of the above. Change any part of a commit (the files, the message, the parent, the author) and the hash changes. This makes Git's history tamper-evident: you cannot alter past commits without changing every subsequent hash in the chain.

```bash
git cat-file -p HEAD
```

```
tree 4b825dc642cb6eb9a060e54bf899d15f7e8c9c2f
parent a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0
author Jane Developer <jane@example.com> 1700000000 -0500
committer Jane Developer <jane@example.com> 1700000000 -0500

Add user authentication module
```

```quiz
question: "What information is stored in a Git commit object?"
type: multiple-choice
options:
  - text: "Only the files that changed since the last commit"
    feedback: "That's how delta-based systems work. Git stores a reference to a tree object that represents the complete snapshot of all files, not just the changes."
  - text: "A reference to a tree (full snapshot), parent commit(s), author, committer, and message"
    correct: true
    feedback: "Correct! A commit object contains a tree reference (the full project snapshot), zero or more parent references, author and committer identity with timestamps, and the commit message. The SHA-1 hash is computed from all of this."
  - text: "A diff of every file that was modified"
    feedback: "Git doesn't store diffs in commits. It stores a reference to a tree object - a complete snapshot. Diffs are computed on the fly when you ask for them with git diff or git log -p."
  - text: "The file names and their contents"
    feedback: "File names are stored in tree objects, and contents are stored in blob objects. The commit itself references a top-level tree object and includes parent references, identity information, and the message."
```

```code-walkthrough
title: Reading a Raw Commit Object
description: Using git cat-file to inspect what a commit actually contains at the object level.
code: |
  $ git cat-file -p HEAD

  tree 8fa3c9b1d2e4f5a6b7c8d9e0f1a2b3c4d5e6f7a8
  parent c4d5e6f7a8b9c0d1e2f3a4b5c6d7e8f9a0b1c2d3
  author Jane Developer <jane@example.com> 1700000000 -0500
  committer Jane Developer <jane@example.com> 1700000000 -0500

  Implement rate limiting for API endpoints

  Add token bucket algorithm to the middleware layer.
  Configurable per-route with defaults of 100 req/min
  for authenticated users, 20 req/min for anonymous.

  Closes #142
language: text
annotations:
  - line: 1
    text: "git cat-file -p pretty-prints any Git object. HEAD resolves to the current commit's SHA-1 hash."
  - line: 3
    text: "The tree line references a tree object containing the complete directory snapshot at this commit. You can inspect it with git cat-file -p 8fa3c9b..."
  - line: 4
    text: "The parent line points to the previous commit. This is how Git builds the history chain. A root commit has no parent line. A merge commit has two parent lines."
  - line: 5
    text: "The author is who wrote the change. The number is a Unix timestamp and the -0500 is the timezone offset."
  - line: 6
    text: "The committer is who applied the change. Usually the same as the author, but differs during cherry-picks, rebases, or when applying patches from others."
  - line: 7
    text: "A blank line separates the header from the message body."
  - line: 8
    text: "The first line is the subject - a short summary (ideally under 50 characters). This is what appears in git log --oneline."
  - line: 10
    text: "After a blank line, the body explains what changed and why. Wrap at 72 characters. The body is optional but valuable for non-trivial changes."
  - line: 14
    text: "Referencing issue numbers (Closes #142) lets platforms like GitHub automatically close the issue when this commit is merged."
```

---

## Writing Good Commit Messages

Commit messages are documentation. Six months from now, when someone (including you) runs `git log` to understand why a change was made, the commit message is the primary source of context.

### The Format

```
Short summary of the change (50 chars or less)

More detailed explanation if needed. Wrap at 72 characters.
Explain what changed and why, not how (the diff shows how).

Reference issue tracker IDs if applicable.
```

### The Rules

**Subject line:**

- Keep it under 50 characters (hard limit: 72)
- Use imperative mood: "Add feature" not "Added feature" or "Adds feature"
- Capitalize the first word
- No period at the end
- Make it specific: "Fix null pointer in user lookup" not "Fix bug"

**Body (optional but recommended for non-trivial changes):**

- Separate from subject with a blank line
- Wrap at 72 characters
- Explain **what** changed and **why**, not how (the diff shows how)
- Reference issue numbers, related commits, or design decisions

### Conventional Commits

Many teams use the [**Conventional Commits**](https://www.conventionalcommits.org/) format, which adds structured prefixes:

```
feat: add email notification for failed builds
fix: correct timezone handling in scheduler
docs: update API authentication guide
refactor: extract validation into shared module
test: add integration tests for payment flow
chore: upgrade dependencies to latest patch versions
```

The prefix tells you at a glance what kind of change this is. Some tools use these prefixes to automatically generate changelogs and determine version bumps.

```quiz
question: "Which commit message follows best practices?"
type: multiple-choice
options:
  - text: "Fixed stuff"
    feedback: "Too vague. What was fixed? Where? A commit message should be specific enough that someone can understand the change without reading the diff."
  - text: "fix: resolve race condition in session cleanup that caused duplicate logout events"
    correct: true
    feedback: "Correct! This message uses imperative mood, has a conventional commit prefix, is specific about what was fixed (race condition), where (session cleanup), and what the symptom was (duplicate logout events)."
  - text: "I updated the login page to fix the bug where users couldn't log in when their password contained special characters, and also refactored some CSS."
    feedback: "This mixes two unrelated changes (bug fix and CSS refactor) in one commit. Each logical change should be its own commit. The message is also too long for a subject line and uses first person."
  - text: "Changes."
    feedback: "This tells you nothing. A commit message should explain what changed and ideally why, so future readers can understand the history."
```

---

## Viewing History: `git log`

`git log` is your primary tool for exploring commit history. It's deeply configurable - you can filter, format, search, and graph the output in dozens of ways.

### Basic Usage

```bash
# Full log (press q to exit, space to page)
git log

# Compact one-line format
git log --oneline

# Show the last 5 commits
git log -5

# Show graph with branch structure
git log --oneline --graph --all

# Show graph with decorations (branch/tag names)
git log --oneline --graph --all --decorate
```

### Filtering by Date

```bash
# Commits from the last week
git log --since="1 week ago"

# Commits between two dates
git log --after="2024-01-01" --before="2024-02-01"

# Relative date display
git log --oneline --date=relative
```

### Filtering by Author

```bash
# Commits by a specific author (partial match)
git log --author="Jane"

# Commits by multiple authors
git log --author="Jane\|Bob"
```

### Searching Commit Messages

```bash
# Search commit messages for a string
git log --grep="authentication"

# Case-insensitive search
git log --grep="auth" -i

# Commits matching ALL grep patterns (not just any)
git log --grep="fix" --grep="login" --all-match
```

### Searching Code Changes

```bash
# Find commits that added or removed the string "TODO"  (pickaxe)
git log -S "TODO"

# Find commits where the number of occurrences of "TODO" changed
git log -S "TODO" --diff-filter=M

# Search with regex in code changes
git log -G "function\s+authenticate"
```

`-S` (the **pickaxe**) finds commits where the number of occurrences of a string changed. `-G` finds commits where a line matching a regex was added or removed. The pickaxe is faster for exact strings; `-G` handles patterns.

### Formatting Output

```bash
# Custom format
git log --format="%h %an %ar %s"

# Format with colors
git log --format="%C(yellow)%h%C(reset) %C(blue)%an%C(reset) %C(green)%ar%C(reset) %s"
```

Common format placeholders:

| Placeholder | Output |
|-------------|--------|
| `%H` | Full commit hash |
| `%h` | Abbreviated hash |
| `%an` | Author name |
| `%ae` | Author email |
| `%ar` | Author date, relative |
| `%ai` | Author date, ISO format |
| `%s` | Subject line |
| `%b` | Body |
| `%d` | Ref names (branches, tags) |

### Following File History

```bash
# History of a specific file
git log -- path/to/file.py

# Follow renames (track file across renames)
git log --follow -- path/to/file.py

# Show the patch (actual diff) for each commit
git log -p -- path/to/file.py

# Show stats (files changed, insertions, deletions)
git log --stat
```

```terminal
title: Exploring History with git log
steps:
  - command: "git log --oneline -10"
    output: |
      e4f5a6b (HEAD -> main) Add rate limiting middleware
      c3d4e5f Implement user session management
      b2c3d4e Add database migration for users table
      a1b2c3d Fix CSS grid layout on mobile
      9f8e7d6 Add responsive navigation component
      8e7d6c5 Configure ESLint and Prettier
      7d6c5b4 Add Express server with basic routing
      6c5b4a3 Initialize project structure
      5b4a392 Add package.json and dependencies
      4a39281 Initial commit
    narration: "The --oneline flag compresses each commit to a single line: abbreviated hash and subject. The -10 limits output to the 10 most recent commits."
  - command: "git log --oneline --graph --all --decorate"
    output: |
      * e4f5a6b (HEAD -> main) Add rate limiting middleware
      * c3d4e5f Implement user session management
      *   b2c3d4e Merge branch 'feature/auth'
      |\
      | * a1b2c3d Add login page styles
      | * 9f8e7d6 Add authentication routes
      |/
      * 8e7d6c5 Configure ESLint and Prettier
      * 7d6c5b4 Add Express server with basic routing
    narration: "Adding --graph draws the branch structure with ASCII art. The merge commit b2c3d4e has two parents - one from each branch. --all shows all branches, not just the current one."
  - command: "git log --since='2 weeks ago' --author='Jane' --oneline"
    output: |
      e4f5a6b Add rate limiting middleware
      c3d4e5f Implement user session management
    narration: "Combine filters to narrow results. This shows only Jane's commits from the last two weeks."
  - command: "git log -S 'rateLimit' --oneline"
    output: |
      e4f5a6b Add rate limiting middleware
    narration: "The -S flag (pickaxe) searches for commits where the string 'rateLimit' was added or removed from the codebase. Useful for finding when a function or variable was introduced."
  - command: "git log --format='%h %an %ar %s' -5"
    output: |
      e4f5a6b Jane Developer 2 hours ago Add rate limiting middleware
      c3d4e5f Jane Developer 5 hours ago Implement user session management
      b2c3d4e Bob Smith 1 day ago Merge branch 'feature/auth'
      a1b2c3d Bob Smith 2 days ago Add login page styles
      9f8e7d6 Bob Smith 2 days ago Add authentication routes
    narration: "Custom format strings let you control exactly what information appears. %h is the short hash, %an is the author name, %ar is the relative date, and %s is the subject line."
```

```command-builder
title: "git log Command Builder"
description: "Build a git log command with formatting and filtering options."
base: "git log"
groups:
  - name: "Display Format"
    options:
      - flag: "--oneline"
        description: "Compact one-line format (short hash + subject)"
      - flag: "--graph"
        description: "Draw branch/merge graph with ASCII art"
      - flag: "--all"
        description: "Show all branches, not just the current one"
      - flag: "--decorate"
        description: "Show branch and tag names next to commits"
      - flag: "--stat"
        description: "Show file change statistics per commit"
      - flag: "-p"
        description: "Show the full diff (patch) for each commit"
  - name: "Filtering"
    options:
      - flag: "-5"
        description: "Limit to last 5 commits"
      - flag: "--since='1 week ago'"
        description: "Only commits from the last week"
      - flag: "--author='name'"
        description: "Filter by author name (partial match)"
      - flag: "--grep='search term'"
        description: "Search commit messages"
      - flag: "-S 'string'"
        description: "Pickaxe: find commits that add/remove a string"
  - name: "File Scope"
    options:
      - flag: "-- path/to/file"
        description: "Show only commits affecting this file"
      - flag: "--follow -- path/to/file"
        description: "Track file through renames"
```

---

## Comparing Changes: `git diff`

While `git log` shows you what happened, `git diff` shows you exactly what changed. It compares content between any two of the three trees, or between any two commits.

### The Three Comparisons

```bash
# Working directory vs staging area (unstaged changes)
git diff

# Staging area vs last commit (what will be committed)
git diff --staged    # or --cached (identical)

# Working directory vs last commit (all uncommitted changes)
git diff HEAD
```

### Comparing Commits

```bash
# Difference between two commits
git diff a1b2c3d e4f5a6b

# Difference between current commit and two commits ago
git diff HEAD~2 HEAD

# Difference between two branches
git diff main feature/auth

# Only show which files changed (not the content)
git diff --name-only main feature/auth

# Show stats (like git log --stat)
git diff --stat HEAD~3 HEAD
```

### Scoping Diffs to Files

```bash
# Diff for a specific file
git diff -- src/auth.py

# Diff for a directory
git diff -- src/

# Staged changes for a specific file
git diff --staged -- src/auth.py
```

### Reading Diff Output

```diff
diff --git a/src/auth.py b/src/auth.py
index 4a39281..e4f5a6b 100644
--- a/src/auth.py
+++ b/src/auth.py
@@ -12,7 +12,9 @@ def authenticate(username, password):
     user = db.find_user(username)
     if not user:
         return None
-    if user.check_password(password):
+    if not user.is_active:
+        raise AccountDisabledError(username)
+    if user.check_password(password) and user.is_active:
         return create_session(user)
     return None
```

The header shows which file changed. Lines starting with `-` were removed, lines starting with `+` were added. The `@@` line shows the location in the file (starting at line 12, showing 7 lines of context in the old file, 9 in the new).

```terminal
title: Using git diff Across the Three Trees
steps:
  - command: "echo 'line 1' > demo.txt && git add demo.txt && git commit -m 'Add demo file'"
    output: "[main a1b2c3d] Add demo file"
    narration: "Start with a committed file. All three trees (working directory, staging area, repository) have identical content."
  - command: "echo 'line 2' >> demo.txt && git diff"
    output: |
      diff --git a/demo.txt b/demo.txt
      index 89b2e88..2b2f92e 100644
      --- a/demo.txt
      +++ b/demo.txt
      @@ -1 +1,2 @@
       line 1
      +line 2
    narration: "git diff (no flags) compares working directory to staging area. The file was modified but not staged, so the diff shows the new line."
  - command: "git add demo.txt && git diff"
    output: ""
    narration: "After staging, git diff shows nothing - the working directory and staging area are now identical."
  - command: "git diff --staged"
    output: |
      diff --git a/demo.txt b/demo.txt
      index 89b2e88..2b2f92e 100644
      --- a/demo.txt
      +++ b/demo.txt
      @@ -1 +1,2 @@
       line 1
      +line 2
    narration: "git diff --staged compares the staging area to the last commit. This shows what will go into your next commit."
  - command: "echo 'line 3' >> demo.txt"
    output: ""
    narration: "Now modify the file again without staging. The working directory has 3 lines, the staging area has 2, and the repository has 1."
  - command: "git diff"
    output: |
      diff --git a/demo.txt b/demo.txt
      index 2b2f92e..01e79c3 100644
      --- a/demo.txt
      +++ b/demo.txt
      @@ -1,2 +1,3 @@
       line 1
       line 2
      +line 3
    narration: "git diff shows the unstaged change (line 3). The staged change (line 2) doesn't appear here - it's already in the staging area."
  - command: "git diff HEAD"
    output: |
      diff --git a/demo.txt b/demo.txt
      index 89b2e88..01e79c3 100644
      --- a/demo.txt
      +++ b/demo.txt
      @@ -1 +1,3 @@
       line 1
      +line 2
      +line 3
    narration: "git diff HEAD compares the working directory directly to the last commit, showing ALL uncommitted changes - both staged and unstaged."
```

---

## Inspecting a Single Commit: `git show`

`git show` displays the details of a specific commit - the message, author, date, and the full diff:

```bash
# Show the most recent commit
git show

# Show a specific commit
git show a1b2c3d

# Show only the stat (no diff)
git show --stat a1b2c3d

# Show a specific file as it was in a commit
git show a1b2c3d:src/auth.py
```

The `commit:path` syntax is useful for viewing a file at any point in history without checking it out.

---

## Amending the Most Recent Commit

Made a typo in your commit message? Forgot to add a file? `git commit --amend` lets you modify the most recent commit:

```bash
# Fix the commit message
git commit --amend -m "Corrected commit message"

# Add a forgotten file to the last commit
git add forgotten-file.py
git commit --amend --no-edit    # Keep the same message
```

`--amend` doesn't actually modify the old commit. It creates a new commit with a new hash and moves the branch pointer to it. The old commit becomes unreachable (but can still be found via the reflog for a while).

!!! danger "Only amend unpushed commits"
    If you've already pushed a commit to a shared branch, amending it rewrites history. Other developers who pulled the original commit will have a diverged history. Amend freely on local branches; use `git revert` on shared branches instead. The [Rewriting History](rewriting-history.md) guide covers this in depth.

---

## Commit References

Git provides several ways to reference commits without typing full SHA-1 hashes:

| Reference | Meaning |
|-----------|---------|
| `HEAD` | The current commit |
| `HEAD~1` or `HEAD~` | One commit before HEAD (first parent) |
| `HEAD~3` | Three commits before HEAD |
| `HEAD^` | First parent of HEAD (same as `HEAD~1` for non-merge commits) |
| `HEAD^2` | Second parent of HEAD (only meaningful for merge commits) |
| `main` | The commit that the `main` branch points to |
| `v1.0` | The commit that the `v1.0` tag points to |
| `@{2}` | Where HEAD was two moves ago (from the reflog) |

The `~` operator follows first parents (the "main line"). The `^` operator selects among multiple parents (relevant for merge commits). For linear history, `HEAD~1` and `HEAD^` are identical.

---

## Practical Exercise

```exercise
title: Exploring History with log and diff
difficulty: beginner
scenario: |
  Create a small repository with meaningful commits, then use git log and git diff
  to find specific information. This exercises the skills you'll use daily.

  1. Create a new repository with an initial commit containing `app.py` with a simple function
  2. Add a second commit that adds a `utils.py` file
  3. Add a third commit that modifies `app.py` to import from `utils.py`
  4. Add a fourth commit that adds a `README.md`
  5. Use `git log --oneline` to see the history
  6. Use `git log --stat` to see which files each commit touched
  7. Use `git log -S "import"` to find which commit added the import statement
  8. Use `git diff HEAD~2 HEAD` to see what changed in the last two commits
  9. Use `git show HEAD~1:app.py` to view app.py as it was before the latest change
  10. Amend the last commit to fix the README content
hints:
  - "Write small, focused functions so each commit has a clear purpose"
  - "git log -S searches for commits where a string was added or removed"
  - "HEAD~2 means 'two commits before HEAD' - so HEAD~2..HEAD covers the last two commits"
  - "git show commit:path displays a file as it existed at that commit"
solution: |
  ```bash
  # Setup
  git init history-demo && cd history-demo

  # Commit 1: Initial app
  cat > app.py << 'EOF'
  def main():
      print("Hello, World!")

  if __name__ == "__main__":
      main()
  EOF
  git add app.py && git commit -m "Add main application entry point"

  # Commit 2: Add utils
  cat > utils.py << 'EOF'
  def format_greeting(name):
      return f"Hello, {name}!"
  EOF
  git add utils.py && git commit -m "Add utility functions module"

  # Commit 3: Wire them together
  cat > app.py << 'EOF'
  from utils import format_greeting

  def main():
      print(format_greeting("World"))

  if __name__ == "__main__":
      main()
  EOF
  git add app.py && git commit -m "Use format_greeting from utils module"

  # Commit 4: Add README
  echo "# History Demo" > README.md
  git add README.md && git commit -m "Add project README"

  # Explore history
  git log --oneline
  git log --stat
  git log -S "import" --oneline    # Finds commit 3
  git diff HEAD~2 HEAD             # Changes across last 2 commits
  git show HEAD~1:app.py           # app.py before README commit

  # Amend the last commit
  echo -e "# History Demo\n\nA sample project for practicing git log." > README.md
  git add README.md
  git commit --amend --no-edit
  ```
```

---

## Further Reading

- [Pro Git - Chapter 2.3: Viewing the Commit History](https://git-scm.com/book/en/v2/Git-Basics-Viewing-the-Commit-History) - comprehensive coverage of `git log` options
- [Official git-log documentation](https://git-scm.com/docs/git-log) - complete reference for all flags and format placeholders
- [Official git-diff documentation](https://git-scm.com/docs/git-diff) - complete reference for diff modes
- [Conventional Commits](https://www.conventionalcommits.org/) - structured commit message specification
- [A Note About Git Commit Messages (Tim Pope)](https://tbaggery.com/2008/04/19/a-note-about-git-commit-messages.html) - the classic post on commit message formatting

---

**Previous:** [The Three Trees](three-trees.md) | **Next:** [Branches and Merging](branches-and-merging.md) | [Back to Index](README.md)
