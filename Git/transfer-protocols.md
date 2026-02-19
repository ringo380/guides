# Transfer Protocols and Plumbing

When you run `git fetch` or `git push`, Git negotiates with a remote server to figure out which objects need to be transferred, packages them efficiently, and sends them over the wire. This guide covers how that transfer works at the protocol level, the different transport mechanisms, and clone strategies for large repositories.

---

## How Transfers Work

Every transfer between Git repositories follows the same basic pattern:

1. **Discovery** - the client and server exchange lists of refs (branches, tags) and their commit hashes
2. **Negotiation** - they compare what each side has to determine the minimal set of objects to transfer
3. **Transfer** - the sender packages the needed objects into a packfile and transmits it
4. **Update** - the receiver integrates the objects and updates its refs

The two processes involved are `git-upload-pack` (runs on the server during fetch) and `git-receive-pack` (runs on the server during push).

---

## Transport Protocols

### SSH Transport

The most common protocol for authenticated access. Git connects via SSH and runs `git-upload-pack` or `git-receive-pack` on the server:

```
git@github.com:user/repo.git
ssh://git@github.com/user/repo.git
```

SSH handles authentication (key-based or password) and encryption. Git just pipes data through the SSH channel.

### Smart HTTP

The standard for HTTPS access. The server runs a CGI program (or equivalent) that speaks Git's pack protocol over HTTP POST/GET:

```
https://github.com/user/repo.git
```

Smart HTTP supports both read and write, authentication via HTTP headers (tokens, Basic auth), and works through proxies and firewalls. Most hosting platforms default to this.

### Dumb HTTP

An older, read-only protocol where Git downloads objects individually over plain HTTP. It doesn't require any special server-side software - just a web server serving static files. Rarely used today because it's much slower (no pack negotiation).

### Native Git Protocol

```
git://github.com/user/repo.git
```

The `git://` protocol is unauthenticated and unencrypted. It was used for fast, read-only access to public repositories. Most platforms no longer support it due to security concerns.

---

## Pack Negotiation

The most interesting part of the transfer is **pack negotiation** - how the client and server figure out which objects to send. This is what makes `git fetch` fast even for large repositories.

### The Want/Have Exchange

During a fetch:

1. The server sends a list of all its refs and their hashes
2. The client identifies which commits it **wants** (remote refs it doesn't have)
3. The client sends **have** lines - commits it already has
4. The server uses the have list to find the **common ancestor** - the newest commit both sides share
5. The server sends a packfile containing all objects reachable from the wanted commits but not from the common ancestors

```
CLIENT                          SERVER
                                refs: main=abc123, feature=def456
want abc123
want def456
have 789fed
have 456abc
                                ACK 456abc (common ancestor found)
                                <sends packfile>
done
```

The negotiation is optimized with **multi-ack**: the server can acknowledge multiple common ancestors, allowing it to send a more precisely targeted packfile.

### Protocol v2

Git protocol v2 (default since Git 2.26) improves on v1 with:

- **Ref filtering** - the server only sends refs the client asks about, not the entire ref list (huge improvement for repos with thousands of branches)
- **Server capabilities** - structured capability negotiation
- **Stateless mode** - better for HTTP-based transports

```bash
# Force protocol v2
git config --global protocol.version 2

# See protocol exchange
GIT_TRACE=1 GIT_TRACE_PACKET=1 git fetch origin 2>&1 | head -40
```

```quiz
question: "What happens during pack negotiation?"
type: multiple-choice
options:
  - text: "The client downloads the entire repository from the server"
    feedback: "That would be incredibly wasteful for an incremental fetch. Pack negotiation identifies the common ancestors between client and server, so only new objects are transferred."
  - text: "The client and server exchange want/have lines to find common ancestors, then only missing objects are sent"
    correct: true
    feedback: "Correct! The client tells the server which commits it wants and which it already has. The server finds the boundary (common ancestors) and sends a packfile containing only objects reachable from the wanted commits but not from the common ones."
  - text: "The server compares file timestamps to determine what changed"
    feedback: "Git doesn't use timestamps for transfer decisions. It uses commit hashes and the want/have negotiation to determine exactly which objects are needed."
  - text: "The client sends its entire history so the server can compute a diff"
    feedback: "The client sends only commit hashes (have lines), not the full history. The server uses these to find common ancestors and sends only the missing objects."
```

---

## Watching the Protocol

You can observe Git's transfer protocol in action using trace environment variables:

```bash
# General trace output
GIT_TRACE=1 git fetch origin

# Packet-level protocol exchange
GIT_TRACE_PACKET=1 git fetch origin

# HTTP request/response details
GIT_CURL_VERBOSE=1 git fetch origin

# Performance timing for each operation
GIT_TRACE_PERFORMANCE=1 git fetch origin

# Combine multiple traces
GIT_TRACE=1 GIT_TRACE_PACKET=1 git fetch origin 2>&1 | less
```

```terminal
title: Watching Protocol Exchange with GIT_TRACE
steps:
  - command: "GIT_TRACE=1 git ls-remote origin 2>&1 | head -15"
    output: |
      10:30:01.123456 git.c:460               trace: built-in: git ls-remote origin
      10:30:01.234567 run-command.c:655        trace: run_command: ssh git@github.com 'git-upload-pack '\''user/repo.git'\'''
      10:30:01.456789 pkt-line.c:80            packet:     upload-pack> version 2
      10:30:01.456790 pkt-line.c:80            packet:     upload-pack> agent=git/2.43.0
      10:30:01.456791 pkt-line.c:80            packet:     upload-pack> ls-refs=unborn
      10:30:01.456792 pkt-line.c:80            packet:     upload-pack> fetch=shallow wait-for-done
      10:30:01.456793 pkt-line.c:80            packet:     upload-pack> server-option
      10:30:01.456794 pkt-line.c:80            packet:     upload-pack> object-format=sha1
      e4f5a6b7c8d9e0f1a2b3c4d5e6f7a8b9c0d1e2f3  refs/heads/main
      a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0  refs/heads/develop
    narration: "GIT_TRACE shows the internal operations. Git connects via SSH and runs git-upload-pack on the server. The server advertises protocol v2 capabilities, then sends its ref list."
  - command: "GIT_TRACE_PERFORMANCE=1 git fetch origin 2>&1 | grep 'performance'"
    output: |
      10:30:02.123456 trace.c:480 performance: 0.003 s: git command: git-remote-https origin https://github.com/user/repo.git
      10:30:02.345678 trace.c:480 performance: 0.125 s: git command: rev-list
      10:30:02.456789 trace.c:480 performance: 0.042 s: git command: index-pack
      10:30:02.567890 trace.c:480 performance: 0.234 s: git command: fetch
    narration: "GIT_TRACE_PERFORMANCE shows timing for each operation. The rev-list (negotiation) took 125ms, index-pack (receiving and indexing objects) took 42ms, and the total fetch was 234ms."
```

---

## Clone Strategies for Large Repositories

Not every clone needs the entire history. Git provides several strategies for faster clones of large repositories.

### Shallow Clone

Downloads only recent history, not the full commit chain:

```bash
# Only the most recent commit
git clone --depth 1 https://github.com/user/large-repo.git

# Last 10 commits
git clone --depth 10 https://github.com/user/large-repo.git

# Deepen a shallow clone later
git fetch --deepen=50

# Convert shallow to full clone
git fetch --unshallow
```

Shallow clones are fast but limited. Some operations (like `git log` and `git blame`) only show the shallow history. You can't push from a shallow clone in some configurations.

### Partial Clone

Downloads commits and trees but skips large blobs until you actually need them (Git 2.22+):

```bash
# Skip all blobs (download on demand when you checkout)
git clone --filter=blob:none https://github.com/user/large-repo.git

# Skip blobs larger than 1MB
git clone --filter=blob:limit=1m https://github.com/user/large-repo.git

# Skip all trees (extremely minimal, mainly for CI)
git clone --filter=tree:0 https://github.com/user/large-repo.git
```

Partial clones maintain full history (all commits) but defer downloading file content until checkout or diff. Git fetches missing blobs transparently when needed. This is ideal for large repositories where you don't need every file's content upfront.

### Single-Branch Clone

Only downloads one branch:

```bash
git clone --single-branch https://github.com/user/repo.git
git clone --single-branch --branch develop https://github.com/user/repo.git
```

### Sparse Checkout

After cloning, check out only a subset of files:

```bash
git clone --filter=blob:none --sparse https://github.com/user/monorepo.git
cd monorepo
git sparse-checkout set src/my-service tests/my-service
```

This combination (partial clone + sparse checkout) is the fastest way to work with a large monorepo when you only need a few directories.

```quiz
question: "What is the difference between a shallow clone and a partial clone?"
type: multiple-choice
options:
  - text: "Shallow clones skip recent commits; partial clones skip old commits"
    feedback: "It's the opposite for shallow clones - they skip OLD commits and keep recent ones. Partial clones keep all commits but skip large file content (blobs)."
  - text: "Shallow clones limit commit history depth; partial clones defer downloading large blobs while keeping full history"
    correct: true
    feedback: "Correct! Shallow clones (--depth N) only download N commits of history. Partial clones (--filter=blob:none) download all commits and trees but defer blob downloads until you actually need them. Partial clones maintain full git log and blame history."
  - text: "Shallow clones are for SSH; partial clones are for HTTPS"
    feedback: "Both clone types work with both protocols. The difference is what gets downloaded: shallow limits history depth, partial limits which object types are downloaded eagerly."
  - text: "They're the same thing with different syntax"
    feedback: "They solve different problems. Shallow clones reduce history depth (fewer commits). Partial clones reduce data by deferring blob downloads while keeping full commit history."
```

```command-builder
title: "Clone Strategies for Large Repositories"
description: "Build a git clone command optimized for large repositories."
base: "git clone"
groups:
  - name: "History Depth"
    options:
      - flag: "--depth 1"
        description: "Shallow clone: only the most recent commit"
      - flag: "--depth 10"
        description: "Shallow clone: last 10 commits"
  - name: "Partial Clone"
    options:
      - flag: "--filter=blob:none"
        description: "Skip all blobs, download on demand"
      - flag: "--filter=blob:limit=1m"
        description: "Skip blobs larger than 1MB"
      - flag: "--filter=tree:0"
        description: "Skip trees too (ultra-minimal)"
  - name: "Branch Scope"
    options:
      - flag: "--single-branch"
        description: "Only download the default branch"
      - flag: "--single-branch --branch develop"
        description: "Only download the develop branch"
  - name: "Checkout"
    options:
      - flag: "--sparse"
        description: "Enable sparse checkout (combine with --filter)"
      - flag: "--no-checkout"
        description: "Clone without checking out files"
```

---

## Git Bundle

`git bundle` creates a file containing Git objects and refs - a portable repository snapshot that can be transferred offline (USB drive, email, sneakernet). Useful when network access to a remote isn't available.

### Creating a Bundle

```bash
# Bundle the entire repository
git bundle create repo.bundle --all

# Bundle a specific branch
git bundle create feature.bundle main

# Bundle only new commits since a known point
git bundle create update.bundle main ^v1.0
```

### Using a Bundle

```bash
# Verify a bundle file
git bundle verify repo.bundle

# Clone from a bundle
git clone repo.bundle my-repo

# Fetch from a bundle into an existing repo
git fetch repo.bundle main:refs/remotes/bundle/main
```

```terminal
title: Creating and Restoring a Git Bundle
steps:
  - command: "git init bundle-source && cd bundle-source"
    output: "Initialized empty Git repository in /home/user/bundle-source/.git/"
    narration: "Create a source repository to bundle."
  - command: "for i in 1 2 3; do echo \"commit $i\" > file.txt && git add file.txt && git commit -m \"Commit $i\"; done"
    output: |
      [main (root-commit) a1b2c3d] Commit 1
      [main b2c3d4e] Commit 2
      [main c3d4e5f] Commit 3
    narration: "Add three commits to the repository."
  - command: "git bundle create ../repo.bundle --all"
    output: "Enumerating objects: 9, done.\nCounting objects: 100% (9/9), done.\nTotal 9 (delta 0), reused 0 (delta 0), pack-reused 0\n"
    narration: "Create a bundle file containing all objects and refs. The bundle file is a portable binary file you can transfer however you like."
  - command: "git bundle verify ../repo.bundle"
    output: |
      The bundle contains this ref:
      c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2 refs/heads/main
      The bundle records a complete history.
      ../repo.bundle is okay
    narration: "Verify the bundle is valid and contains what we expect. It reports the refs included and whether it has a complete history."
  - command: "cd .. && git clone repo.bundle bundle-clone && cd bundle-clone && git log --oneline"
    output: |
      c3d4e5f (HEAD -> main, origin/main, origin/HEAD) Commit 3
      b2c3d4e Commit 2
      a1b2c3d Commit 1
    narration: "Clone from the bundle just like cloning from any other remote. The full history is preserved. The origin remote points to the bundle file."
```

---

## `git archive` - Export Without `.git`

`git archive` creates a tar or zip archive of a tree without the `.git` directory - useful for creating release tarballs:

```bash
# Create a tar.gz of the current HEAD
git archive --format=tar.gz --prefix=project-v1.0/ HEAD > project-v1.0.tar.gz

# Create a zip of a specific tag
git archive --format=zip v1.0 > project-v1.0.zip

# Archive a specific directory
git archive HEAD src/ > src-only.tar
```

The `--prefix` option adds a directory prefix so the archive extracts into a named directory rather than the current directory.

---

## Exercise

```exercise
title: Bundle and Unbundle a Repository
difficulty: beginner
scenario: |
  Practice transferring a repository offline using git bundle.

  1. Create a repository with at least 3 commits on main and 2 commits on a feature branch
  2. Create a full bundle of the repository
  3. Verify the bundle
  4. Clone from the bundle into a new directory
  5. Verify the clone has all branches and full history
  6. Make 2 new commits in the original repo
  7. Create an incremental bundle with only the new commits
  8. Fetch the incremental bundle into the clone
hints:
  - "git bundle create file.bundle --all bundles everything"
  - "For incremental bundles, use git bundle create file.bundle main ^<old-tip>"
  - "git fetch bundle-file.bundle main:refs/remotes/bundle/main"
  - "git bundle verify checks if a bundle is valid and if the receiver has the prerequisite objects"
solution: |
  ```bash
  # Create source repo
  git init bundle-exercise && cd bundle-exercise
  echo "v1" > file.txt && git add file.txt && git commit -m "Commit 1"
  echo "v2" > file.txt && git add file.txt && git commit -m "Commit 2"
  git switch -c feature
  echo "feature" > feature.txt && git add feature.txt && git commit -m "Feature 1"
  echo "feature v2" > feature.txt && git add feature.txt && git commit -m "Feature 2"
  git switch main
  echo "v3" > file.txt && git add file.txt && git commit -m "Commit 3"

  # Full bundle
  git bundle create ../full.bundle --all
  git bundle verify ../full.bundle

  # Clone from bundle
  cd .. && git clone full.bundle bundle-receiver
  cd bundle-receiver && git log --oneline --all --graph

  # Back to source: add new commits
  cd ../bundle-exercise
  OLD_TIP=$(git rev-parse main)
  echo "v4" > file.txt && git add file.txt && git commit -m "Commit 4"
  echo "v5" > file.txt && git add file.txt && git commit -m "Commit 5"

  # Incremental bundle
  git bundle create ../incremental.bundle main ^$OLD_TIP

  # Fetch incremental into clone
  cd ../bundle-receiver
  git fetch ../incremental.bundle main:refs/remotes/origin/main
  git merge origin/main
  git log --oneline
  ```
```

---

## Further Reading

- [Pro Git - Chapter 10.6: Transfer Protocols](https://git-scm.com/book/en/v2/Git-Internals-Transfer-Protocols) - how fetch and push work at the protocol level
- [Git Protocol v2 Documentation](https://git-scm.com/docs/protocol-v2) - improvements over protocol v1
- [Official git-bundle documentation](https://git-scm.com/docs/git-bundle) - offline transfers
- [Official git-archive documentation](https://git-scm.com/docs/git-archive) - creating release tarballs
- [Partial Clone Documentation](https://git-scm.com/docs/partial-clone) - filtering objects during clone and fetch

---

**Previous:** [Refs, the Reflog, and the DAG](refs-reflog-dag.md) | **Next:** [Collaboration Workflows](collaboration-workflows.md) | [Back to Index](README.md)
