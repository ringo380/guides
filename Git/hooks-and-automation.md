# Git Hooks and Automation

Git hooks are scripts that run automatically at specific points in the Git workflow - before a commit, after a merge, before a push. They let you enforce coding standards, run tests, validate commit messages, and automate repetitive tasks. This guide covers every hook, how to write them, hook management frameworks, and Git's built-in tools for debugging and forensic investigation.

---

## How Hooks Work

Hooks are executable scripts stored in `.git/hooks/`. When Git reaches a trigger point (like committing), it checks for a hook with the corresponding name and runs it if found.

- Hooks must be **executable** (`chmod +x .git/hooks/pre-commit`)
- They can be written in **any language** (bash, Python, Ruby, Node.js - as long as the shebang line is correct)
- **Client-side hooks** run on your machine. They're not pushed or shared through the repository (`.git/hooks/` is local).
- **Server-side hooks** run on the remote when receiving pushes.
- Hooks that exit with **non-zero** status abort the operation they guard.

!!! warning "Hooks are local"
    Client-side hooks live in `.git/hooks/`, which isn't tracked by Git. You can't enforce them through the repository alone. That's why hook frameworks (covered below) exist - they let you commit hook definitions that teammates install locally.

---

## Client-Side Hooks

### Pre-Commit Hooks

| Hook | Runs | Purpose |
|------|------|---------|
| `pre-commit` | Before commit message editor opens | Validate the code being committed |
| `prepare-commit-msg` | After default message is created, before editor opens | Modify the commit message template |
| `commit-msg` | After you write the message, before commit is created | Validate the commit message format |
| `post-commit` | After commit is created | Notifications, logging |

#### `pre-commit`

The most commonly used hook. It runs before the commit message editor opens. If it exits non-zero, the commit is aborted. Use it for linting, formatting checks, and preventing debug code from being committed.

```bash
#!/bin/bash
# .git/hooks/pre-commit - Check for debug statements

# Check staged Python files for debug prints
FILES=$(git diff --cached --name-only --diff-filter=ACM | grep '\.py$')

if [ -n "$FILES" ]; then
    if grep -n 'import pdb\|breakpoint()\|print(' $FILES; then
        echo "ERROR: Debug statements found in staged files."
        echo "Remove them before committing."
        exit 1
    fi
fi

exit 0
```

#### `commit-msg`

Receives the commit message file path as its argument. Use it to enforce message conventions:

```bash
#!/bin/bash
# .git/hooks/commit-msg - Enforce Conventional Commits format

MSG_FILE=$1
MSG=$(cat "$MSG_FILE")

# Check for conventional commit prefix
if ! echo "$MSG" | grep -qE '^(feat|fix|docs|refactor|test|chore|style|perf|ci|build|revert)(\(.+\))?: .+'; then
    echo "ERROR: Commit message must follow Conventional Commits format:"
    echo "  feat: add new feature"
    echo "  fix(auth): resolve login timeout"
    echo "  docs: update API guide"
    echo ""
    echo "Your message: $MSG"
    exit 1
fi

exit 0
```

```quiz
question: "Which hook runs before the commit message editor opens?"
type: multiple-choice
options:
  - text: "commit-msg"
    feedback: "commit-msg runs AFTER you write the message. It validates the message content. The hook that runs before the editor opens is pre-commit."
  - text: "pre-commit"
    correct: true
    feedback: "Correct! pre-commit runs before the commit message editor opens. It's typically used to check the code being committed (linting, formatting, debug statements). If it exits non-zero, the commit is aborted before you even write a message."
  - text: "prepare-commit-msg"
    feedback: "prepare-commit-msg runs after the default message is created but before the editor opens. It's used to modify the message template, not to validate code. pre-commit is the hook for code validation."
  - text: "post-commit"
    feedback: "post-commit runs after the commit is already created. It can't prevent the commit. pre-commit is the hook that runs before the editor and can abort the commit."
```

### Other Client-Side Hooks

| Hook | Runs | Purpose |
|------|------|---------|
| `pre-rebase` | Before rebase starts | Prevent rebasing certain branches |
| `pre-push` | Before push transmits data | Run tests before pushing |
| `post-checkout` | After `git checkout`/`git switch` | Set up environment, update dependencies |
| `post-merge` | After a successful merge | Install dependencies, rebuild |
| `pre-auto-gc` | Before automatic garbage collection | Notify or prevent GC |

The `pre-push` hook is particularly useful for running a quick test suite before pushing:

```bash
#!/bin/bash
# .git/hooks/pre-push - Run tests before push

echo "Running tests before push..."
npm test

if [ $? -ne 0 ]; then
    echo "Tests failed. Push aborted."
    exit 1
fi

exit 0
```

---

## Server-Side Hooks

Server-side hooks run on the remote repository when receiving pushes. They're managed by the server administrator, not individual developers.

| Hook | Runs | Purpose |
|------|------|---------|
| `pre-receive` | Before any refs are updated | Global policy enforcement |
| `update` | Once per branch being updated | Per-branch policy enforcement |
| `post-receive` | After all refs are updated | Notifications, CI triggers, deploys |

`pre-receive` is the enforcement point for server-side rules. If it exits non-zero, the entire push is rejected.

```quiz
question: "Where do client-side hooks run vs server-side hooks?"
type: multiple-choice
options:
  - text: "Client-side hooks run on your machine during local operations; server-side hooks run on the remote during push"
    correct: true
    feedback: "Correct! Client-side hooks (pre-commit, commit-msg, pre-push) execute on the developer's machine. Server-side hooks (pre-receive, update, post-receive) execute on the remote server when it receives a push. Client-side hooks can be bypassed with --no-verify; server-side hooks cannot be bypassed by the pusher."
  - text: "Both run on the server; client-side hooks are triggered by pull requests"
    feedback: "Client-side hooks run locally on your machine. They're not related to pull requests (which are platform features, not Git features)."
  - text: "Client-side hooks are in JavaScript; server-side hooks are in Python"
    feedback: "Both can be written in any language. The difference is where they execute: locally (client) or on the remote server (server)."
  - text: "They're the same hooks that can be configured to run in either location"
    feedback: "Client-side and server-side hooks are different hooks with different names and different trigger points. pre-commit is client-only; pre-receive is server-only."
```

```code-walkthrough
title: A commit-msg Hook Enforcing Conventional Commits
description: A hook script that validates commit messages against the Conventional Commits specification.
code: |
  #!/usr/bin/env bash
  set -euo pipefail

  MSG_FILE="$1"
  MSG=$(head -1 "$MSG_FILE")

  # Skip merge commits and fixup commits
  if echo "$MSG" | grep -qE '^(Merge|fixup!|squash!)'; then
      exit 0
  fi

  # Conventional Commits pattern:
  #   type(optional-scope): description
  PATTERN='^(feat|fix|docs|refactor|test|chore|style|perf|ci|build|revert)(\([a-z0-9-]+\))?: .{1,72}$'

  if ! echo "$MSG" | grep -qE "$PATTERN"; then
      echo "ERROR: Invalid commit message format."
      echo ""
      echo "Expected: <type>(<scope>): <description>"
      echo ""
      echo "Types: feat, fix, docs, refactor, test, chore, style, perf, ci, build, revert"
      echo "Scope: optional, lowercase, e.g., (auth), (api), (ui)"
      echo "Description: 1-72 characters, lowercase start"
      echo ""
      echo "Examples:"
      echo "  feat(auth): add OAuth2 login"
      echo "  fix: resolve null pointer in user lookup"
      echo "  docs(api): update authentication guide"
      echo ""
      echo "Your message: $MSG"
      exit 1
  fi

  exit 0
language: bash
annotations:
  - line: 1
    text: "Use env bash for portability across systems where bash may be in different locations."
  - line: 2
    text: "set -euo pipefail makes the script strict: exit on error, undefined variables, and pipe failures."
  - line: 5
    text: "Read only the first line (subject) of the commit message. The body isn't validated by this hook."
  - line: 8
    text: "Skip validation for merge commits and fixup/squash commits (generated by git merge, git commit --fixup, etc.)."
  - line: 14
    text: "The regex pattern matches: type, optional (scope), colon+space, description up to 72 characters."
  - line: 17
    text: "If the message doesn't match, show a helpful error with the expected format and examples."
  - line: 30
    text: "Show the user's actual message so they can see what needs fixing."
  - line: 31
    text: "Exit 1 aborts the commit. The user can fix the message and try again."
```

```code-walkthrough
title: A pre-receive Hook Rejecting Force Pushes to Main
description: A server-side hook that prevents force pushes and branch deletion on protected branches.
code: |
  #!/usr/bin/env bash
  # pre-receive hook - protect main and release branches

  PROTECTED_BRANCHES="^(refs/heads/main|refs/heads/release/.*)$"

  while read oldrev newrev refname; do
      # Skip if not a protected branch
      if ! echo "$refname" | grep -qE "$PROTECTED_BRANCHES"; then
          continue
      fi

      # Reject branch deletion (newrev is all zeros)
      if [ "$newrev" = "0000000000000000000000000000000000000000" ]; then
          echo "ERROR: Deleting $refname is not allowed."
          exit 1
      fi

      # Reject non-fast-forward updates (force push)
      if [ "$oldrev" != "0000000000000000000000000000000000000000" ]; then
          MISSING=$(git rev-list "$newrev..$oldrev" | head -1)
          if [ -n "$MISSING" ]; then
              echo "ERROR: Force push to $refname is not allowed."
              echo "Old commits would be lost. Use a merge or rebase workflow."
              exit 1
          fi
      fi
  done

  exit 0
language: bash
annotations:
  - line: 4
    text: "Define which branches are protected using a regex. This protects main and any branch under release/."
  - line: 6
    text: "pre-receive reads lines from stdin. Each line has: old hash, new hash, ref name. Multiple refs can be updated in one push."
  - line: 13
    text: "An all-zeros newrev means the ref is being deleted. Block this for protected branches."
  - line: 19
    text: "For existing refs (oldrev is not all-zeros), check if the push would remove commits."
  - line: 20
    text: "rev-list newrev..oldrev shows commits reachable from oldrev but not from newrev. If any exist, this is a force push that would lose history."
```

---

## Hook Frameworks

Since hooks aren't committed to the repository, teams need a way to share and enforce them. Hook frameworks solve this.

### pre-commit (Python)

[**pre-commit**](https://pre-commit.com/) is a framework that manages hook installation from a shared config file:

```bash
# Install
pip install pre-commit

# Create .pre-commit-config.yaml in your repo
# Install hooks based on the config
pre-commit install
```

```yaml
# .pre-commit-config.yaml
repos:
  - repo: https://github.com/pre-commit/pre-commit-hooks
    rev: v4.5.0
    hooks:
      - id: trailing-whitespace
      - id: end-of-file-fixer
      - id: check-yaml
      - id: check-added-large-files
        args: ['--maxkb=500']

  - repo: https://github.com/astral-sh/ruff-pre-commit
    rev: v0.3.0
    hooks:
      - id: ruff
        args: ['--fix']
      - id: ruff-format
```

### Husky (Node.js)

[**Husky**](https://typicode.github.io/husky/) integrates with npm/yarn projects:

```bash
npx husky init
echo "npm test" > .husky/pre-commit
echo "npx commitlint --edit \$1" > .husky/commit-msg
```

### Lefthook

[**Lefthook**](https://github.com/evilmartians/lefthook) is a fast, polyglot hook manager:

```yaml
# lefthook.yml
pre-commit:
  parallel: true
  commands:
    lint:
      glob: "*.{js,ts}"
      run: npx eslint {staged_files}
    format:
      glob: "*.py"
      run: ruff format --check {staged_files}
```

---

## Git Bisect: Binary Search for Bugs

`git bisect` performs a binary search through commit history to find which commit introduced a bug. Instead of checking every commit, it cuts the search space in half each step.

### Manual Bisect

```bash
# Start bisecting
git bisect start

# Mark the current commit as bad (has the bug)
git bisect bad

# Mark an older commit as good (doesn't have the bug)
git bisect good v1.0

# Git checks out a commit halfway between good and bad
# Test it, then mark:
git bisect good    # if this commit doesn't have the bug
git bisect bad     # if this commit has the bug

# Git narrows the range and checks out the next midpoint
# Repeat until the first bad commit is found

# When done
git bisect reset
```

### Automated Bisect

If you have a script that returns 0 for good and non-zero for bad:

```bash
git bisect start HEAD v1.0
git bisect run npm test
# or
git bisect run python -m pytest tests/test_auth.py
```

Git runs the script at each step automatically and reports the first bad commit.

```terminal
title: Using git bisect to Find a Bug
steps:
  - command: "git bisect start"
    output: ""
    narration: "Start the bisect session. Git enters bisect mode."
  - command: "git bisect bad HEAD"
    output: ""
    narration: "Mark the current commit as bad - it has the bug."
  - command: "git bisect good HEAD~10"
    output: "Bisecting: 4 revisions left to test after this (roughly 3 steps)\n[c3d4e5f] Add caching layer"
    narration: "Mark a known-good commit (10 commits ago). Git calculates the midpoint and checks it out. With 10 commits, it only needs about 3-4 steps instead of checking all 10."
  - command: "npm test"
    output: "Tests: 42 passed, 0 failed"
    narration: "Run your tests at this midpoint. Tests pass, so this commit is good."
  - command: "git bisect good"
    output: "Bisecting: 2 revisions left to test after this (roughly 1 step)\n[e5f6a7b] Refactor auth module"
    narration: "Mark this commit as good. Git moves to the midpoint of the remaining range."
  - command: "npm test"
    output: "Tests: 40 passed, 2 failed"
    narration: "Tests fail at this commit. The bug exists here."
  - command: "git bisect bad"
    output: "Bisecting: 0 revisions left to test after this (roughly 1 step)\n[d4e5f6a] Update session handler"
    narration: "Mark as bad. One more step to narrow it down."
  - command: "npm test && git bisect good"
    output: "d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2e3 is the first bad commit\ncommit d4e5f6a...\nAuthor: Bob Smith\nDate: Mon Jan 15 10:30:00 2024\n\n    Update session handler"
    narration: "Git identifies the exact commit that introduced the bug. Out of 10 commits, bisect found it in 3 steps (log2(10) ≈ 3.3). You can now examine this specific commit's diff to understand what broke."
  - command: "git bisect reset"
    output: "Previous HEAD position was d4e5f6a Update session handler\nSwitched to branch 'main'"
    narration: "End the bisect session. Git returns to the branch you were on before bisecting."
```

---

## Git Blame and Forensic Investigation

### `git blame`

`git blame` annotates each line of a file with the commit that last modified it:

```bash
# Blame a file
git blame src/auth.py

# Ignore whitespace changes
git blame -w src/auth.py

# Show original author even after move/copy
git blame -C src/auth.py

# Blame a specific range of lines
git blame -L 10,20 src/auth.py

# Show blame at a specific commit (before a refactor)
git blame v1.0 -- src/auth.py
```

### Code Search with `git log`

```bash
# Find commits where a string was added/removed (pickaxe)
git log -S "authenticate" --oneline

# Find commits where a regex was added/removed in the diff
git log -G "def authenticate\(" --oneline

# Search with patch output to see the actual changes
git log -S "authenticate" -p

# Combine with file path
git log -S "authenticate" -- src/auth.py
```

---

## Exercises

```exercise
title: Set Up a Pre-Commit Framework
difficulty: intermediate
scenario: |
  Configure a pre-commit hook framework for a Python project.

  1. Create a new repository with a Python file that has some style issues
  2. Install the pre-commit framework (pip install pre-commit)
  3. Create a .pre-commit-config.yaml that:
     - Checks for trailing whitespace
     - Ensures files end with a newline
     - Runs a Python linter
  4. Install the hooks with `pre-commit install`
  5. Try to commit the file with style issues (the hook should block it)
  6. Fix the issues and commit successfully
hints:
  - "pip install pre-commit installs the framework"
  - "pre-commit install creates the .git/hooks/pre-commit script"
  - "pre-commit run --all-files tests hooks against all files without committing"
  - "The hook will auto-fix some issues (trailing whitespace) and report others"
solution: |
  ```bash
  git init precommit-demo && cd precommit-demo

  # Create a file with style issues
  printf "def hello():\n    print('hello')   \n\ndef unused():  \n    pass" > app.py
  git add app.py

  # Install pre-commit
  pip install pre-commit

  # Create config
  cat > .pre-commit-config.yaml << 'EOF'
  repos:
    - repo: https://github.com/pre-commit/pre-commit-hooks
      rev: v4.5.0
      hooks:
        - id: trailing-whitespace
        - id: end-of-file-fixer
        - id: check-yaml
  EOF

  git add .pre-commit-config.yaml

  # Install hooks
  pre-commit install

  # Try to commit (will fail on trailing whitespace)
  git commit -m "Initial commit"
  # hooks auto-fix whitespace, you need to re-add

  git add -A
  git commit -m "Initial commit with clean formatting"
  ```
```

```exercise
title: Use git bisect to Find a Regression
difficulty: intermediate
scenario: |
  Simulate a repository where a bug was introduced partway through development,
  then use git bisect with a test script to automatically find it.

  1. Create a repository with a `calc.py` file that has an `add(a, b)` function
  2. Create a `test.py` that tests `add(2, 3) == 5`
  3. Make 8 commits, each adding a small change. In commit 5, "accidentally" break the add function
  4. Verify the test fails on the latest commit
  5. Use `git bisect run python test.py` to automatically find the bad commit
  6. Verify bisect identifies commit 5
hints:
  - "Create a test that exits 0 on success and 1 on failure"
  - "git bisect start HEAD <good-commit> begins the search"
  - "git bisect run <script> automates the good/bad marking"
  - "After bisect finds the bad commit, examine its diff with git show"
solution: |
  ```bash
  git init bisect-demo && cd bisect-demo

  # Commit 1: initial calc
  cat > calc.py << 'EOF'
  def add(a, b):
      return a + b
  EOF
  cat > test.py << 'EOF'
  import sys
  from calc import add
  result = add(2, 3)
  sys.exit(0 if result == 5 else 1)
  EOF
  git add . && git commit -m "Commit 1: initial calculator"

  # Commits 2-4: safe changes
  echo "# version 2" >> calc.py && git add . && git commit -m "Commit 2: add comment"
  echo "def sub(a,b): return a-b" >> calc.py && git add . && git commit -m "Commit 3: add subtract"
  echo "def mul(a,b): return a*b" >> calc.py && git add . && git commit -m "Commit 4: add multiply"

  # Commit 5: BREAK the add function
  sed -i '' 's/return a + b/return a - b/' calc.py
  git add . && git commit -m "Commit 5: refactor add function"

  # Commits 6-8: more changes
  echo "def div(a,b): return a/b" >> calc.py && git add . && git commit -m "Commit 6: add divide"
  echo "# math utils" >> calc.py && git add . && git commit -m "Commit 7: add header"
  echo "def mod(a,b): return a%b" >> calc.py && git add . && git commit -m "Commit 8: add modulo"

  # Verify test fails
  python test.py || echo "Test fails (expected)"

  # Bisect
  GOOD=$(git log --oneline | tail -1 | cut -d' ' -f1)
  git bisect start HEAD $GOOD
  git bisect run python test.py

  # Shows "Commit 5" as the first bad commit
  git bisect reset
  ```
```

---

## Further Reading

- [Pro Git - Chapter 8.3: Git Hooks](https://git-scm.com/book/en/v2/Customizing-Git-Git-Hooks) - comprehensive hook documentation
- [Official githooks documentation](https://git-scm.com/docs/githooks) - complete reference for all hook types
- [pre-commit.com](https://pre-commit.com/) - Python-based hook framework
- [Husky Documentation](https://typicode.github.io/husky/) - Node.js hook management
- [Lefthook Documentation](https://github.com/evilmartians/lefthook) - polyglot hook manager
- [Official git-bisect documentation](https://git-scm.com/docs/git-bisect) - binary search debugging
- [Official git-blame documentation](https://git-scm.com/docs/git-blame) - line-level authorship annotation

---

**Previous:** [GitHub, GitLab, and Bitbucket](platforms.md) | **Next:** [Git Security](security.md) | [Back to Index](README.md)
