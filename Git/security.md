# Git Security

Git's cryptographic design provides integrity (every object is hashed), but it doesn't provide authentication or secrecy on its own. This guide covers signing commits to prove authorship, managing credentials safely, detecting and removing secrets from repositories, and securing your Git workflow end to end.

---

## Why Sign Commits?

Anyone can set `user.name` and `user.email` to any value. Without signing, there's no proof that a commit was actually written by the person it claims. **Signed commits** use cryptographic signatures to prove that the committer holds a specific private key, and platforms like GitHub and GitLab display a "Verified" badge.

Two signing methods are available:

| Method | Key type | Git version | Platform support |
|--------|----------|------------|-----------------|
| GPG signing | GPG key pair | Any | GitHub, GitLab, Bitbucket |
| SSH signing | SSH key pair | 2.34+ | GitHub, GitLab |

---

## GPG Signing

### Setting Up GPG

```bash
# Generate a GPG key (choose RSA 4096 or Ed25519)
gpg --full-generate-key

# List your keys
gpg --list-secret-keys --keyid-format=long

# Output:
# sec   ed25519/ABC123DEF456 2024-01-15 [SC]
#       ABCDEF1234567890ABCDEF1234567890ABC123DE
# uid           [ultimate] Jane Developer <jane@example.com>
```

The key ID after the algorithm (`ABC123DEF456`) is what you configure Git with:

```bash
# Tell Git which key to use
git config --global user.signingkey ABC123DEF456

# Sign all commits by default
git config --global commit.gpgsign true

# Sign all tags by default
git config --global tag.gpgsign true
```

### Adding Your Key to a Platform

Export the public key and paste it into your platform's settings:

```bash
# Export public key
gpg --armor --export ABC123DEF456
```

Copy the output (starting with `-----BEGIN PGP PUBLIC KEY BLOCK-----`) to:
- **GitHub:** Settings > SSH and GPG keys > New GPG key
- **GitLab:** User Settings > GPG Keys

### Making Signed Commits

```bash
# Sign a single commit
git commit -S -m "Add signed authentication module"

# With commit.gpgsign = true, all commits are signed automatically
git commit -m "This is signed automatically"

# Create a signed tag
git tag -s v1.0 -m "Signed release 1.0"
```

---

## SSH Signing (Git 2.34+)

SSH signing uses your existing SSH key - no GPG required. This is simpler if you already have SSH keys for authentication.

```bash
# Configure SSH signing
git config --global gpg.format ssh
git config --global user.signingkey ~/.ssh/id_ed25519.pub

# Sign all commits
git config --global commit.gpgsign true
```

### Allowed Signers File

For verifying SSH signatures locally, Git needs a list of trusted keys:

```bash
# Create an allowed signers file
echo "jane@example.com ssh-ed25519 AAAAC3NzaC1lZDI1NTE5AAAAIG8r..." > ~/.config/git/allowed_signers

# Tell Git about it
git config --global gpg.ssh.allowedSignersFile ~/.config/git/allowed_signers
```

```terminal
title: Setting Up GPG Signing
steps:
  - command: "gpg --list-secret-keys --keyid-format=long"
    output: |
      /home/user/.gnupg/pubring.kbx
      ----------------------------
      sec   ed25519/ABC123DEF456 2024-01-15 [SC]
            ABCDEF1234567890ABCDEF1234567890ABC123DE
      uid           [ultimate] Jane Developer <jane@example.com>
    narration: "List your GPG keys. The key ID (ABC123DEF456) is what Git uses. If you don't have one, run gpg --full-generate-key first."
  - command: "git config --global user.signingkey ABC123DEF456 && git config --global commit.gpgsign true"
    output: ""
    narration: "Configure Git to use this key and sign all commits automatically."
  - command: "echo 'signed code' > signed.py && git add signed.py && git commit -m 'Add signed module'"
    output: "[main a1b2c3d] Add signed module"
    narration: "Commit as normal. With commit.gpgsign = true, Git signs automatically."
  - command: "git log --show-signature -1"
    output: |
      commit a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0
      gpg: Signature made Mon Jan 15 10:30:00 2024 EST
      gpg:                using EDDSA key ABCDEF1234567890ABCDEF1234567890ABC123DE
      gpg: Good signature from "Jane Developer <jane@example.com>" [ultimate]
      Author: Jane Developer <jane@example.com>
      Date:   Mon Jan 15 10:30:00 2024 -0500

          Add signed module
    narration: "git log --show-signature verifies and displays the signature. 'Good signature' means the key checks out."
```

```terminal
title: Setting Up SSH Signing (Git 2.34+)
steps:
  - command: "git config --global gpg.format ssh"
    output: ""
    narration: "Tell Git to use SSH keys for signing instead of GPG."
  - command: "git config --global user.signingkey ~/.ssh/id_ed25519.pub"
    output: ""
    narration: "Point to your SSH public key. Git uses the corresponding private key (without the .pub extension) to sign."
  - command: "git config --global commit.gpgsign true"
    output: ""
    narration: "Enable automatic signing for all commits."
  - command: "echo 'ssh signed' > ssh-signed.py && git add ssh-signed.py && git commit -m 'Add SSH-signed module'"
    output: "[main b2c3d4e] Add SSH-signed module"
    narration: "Commit as normal. Git uses your SSH key to sign."
  - command: "git log --show-signature -1"
    output: |
      commit b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1
      Good "git" signature for jane@example.com with ED25519 key SHA256:abcdef123456
      Author: Jane Developer <jane@example.com>
      Date:   Mon Jan 15 11:00:00 2024 -0500

          Add SSH-signed module
    narration: "The signature verification shows 'Good signature' with the SSH key fingerprint. No GPG required."
```

```quiz
question: "When should you use GPG signing vs SSH signing?"
type: multiple-choice
options:
  - text: "GPG for maximum platform compatibility; SSH for simplicity if your platform supports it"
    correct: true
    feedback: "Correct! GPG signing works with all major platforms and all Git versions. SSH signing (Git 2.34+) is simpler because you reuse your existing SSH key, but requires Git 2.34+ and currently only GitHub and GitLab support verification. Choose SSH for convenience, GPG for broader compatibility."
  - text: "GPG for commits, SSH for push authentication"
    feedback: "Both GPG and SSH can sign commits. SSH keys are also used for push authentication, but that's a separate function from commit signing."
  - text: "GPG is more secure than SSH"
    feedback: "Both provide strong cryptographic signatures. The security depends on the key algorithm and key management, not the signing framework. Ed25519 is strong in both GPG and SSH."
  - text: "SSH signing replaces GPG entirely"
    feedback: "SSH signing is a newer alternative but doesn't replace GPG. GPG has wider platform support and additional features (key revocation, web of trust). Both are valid choices."
```

### Verifying Signatures

```bash
# Verify a commit
git verify-commit HEAD

# Verify a tag
git verify-tag v1.0

# Show signatures in log
git log --show-signature

# Show signatures in one-line log
git log --oneline --format='%h %G? %s'
# %G? shows: G (good), B (bad), U (untrusted), N (no signature), E (expired)
```

---

## Credential Management

Storing credentials safely is essential. Typing passwords or tokens for every push is impractical, but hardcoding them is dangerous.

### Credential Helpers

Git's **credential helpers** cache or store authentication tokens:

```bash
# Cache in memory (default 15 minutes)
git config --global credential.helper cache
git config --global credential.helper 'cache --timeout=3600'  # 1 hour

# macOS Keychain
git config --global credential.helper osxkeychain

# Windows Credential Manager
git config --global credential.helper manager

# Linux libsecret (GNOME Keyring)
git config --global credential.helper /usr/lib/git-core/git-credential-libsecret
```

```code-walkthrough
title: Credential Helper Configuration
description: How Git credential helpers work and how to configure them.
code: |
  # ~/.gitconfig credential section

  [credential]
      helper = osxkeychain

  # Platform-specific overrides
  [credential "https://github.com"]
      helper = osxkeychain

  [credential "https://gitlab.company.com"]
      helper = store --file ~/.git-credentials-work

  # For SSH, credentials are managed by the SSH agent:
  # ssh-add ~/.ssh/id_ed25519         (add key to agent)
  # ssh-add -l                         (list loaded keys)
  # ssh-add -K ~/.ssh/id_ed25519      (macOS: add to Keychain)
language: ini
annotations:
  - line: 4
    text: "The default credential helper applies to all HTTPS Git operations. osxkeychain stores tokens in the macOS Keychain."
  - line: 7
    text: "You can set different helpers per host. This is useful for different platforms or work vs personal accounts."
  - line: 10
    text: "The 'store' helper saves credentials to a plaintext file. Only use this for non-sensitive or single-user systems."
  - line: 13
    text: "SSH authentication doesn't use Git's credential system. The SSH agent manages keys. ssh-add loads your key into the agent for the session."
```

### Personal Access Tokens

All major platforms require tokens (not passwords) for HTTPS Git operations:

- **GitHub:** Settings > Developer Settings > Personal access tokens > Tokens (classic) or Fine-grained tokens
- **GitLab:** User Settings > Access Tokens
- **Bitbucket:** Personal Settings > App passwords

Use the token as your password when Git prompts. The credential helper caches it.

!!! danger "Never commit tokens"
    Tokens in your repository history are permanent (even after removal, they exist in old commits). Platforms scan for accidentally committed tokens and may revoke them, but the exposure window can be enough for damage.

---

## Secret Scanning

Accidentally committing secrets (API keys, passwords, tokens, private keys) is one of the most common security mistakes. Prevention is far easier than cleanup.

### Pre-Commit Detection

Install hooks that scan for secrets before they enter the repository:

```bash
# Using the pre-commit framework
pip install pre-commit
```

```yaml
# .pre-commit-config.yaml
repos:
  - repo: https://github.com/gitleaks/gitleaks
    rev: v8.18.0
    hooks:
      - id: gitleaks
```

### Dedicated Scanning Tools

[**Gitleaks**](https://github.com/gitleaks/gitleaks) scans repositories for hardcoded secrets:

```bash
# Install
brew install gitleaks  # macOS

# Scan the current repo
gitleaks detect

# Scan with verbose output
gitleaks detect -v

# Scan specific commits
gitleaks detect --log-opts="HEAD~10..HEAD"
```

[**TruffleHog**](https://github.com/trufflesecurity/trufflehog) performs deep scanning including entropy analysis:

```bash
# Scan a repository
trufflehog git file://./

# Scan a remote repository
trufflehog github --repo https://github.com/user/repo
```

### Platform Secret Scanning

- **GitHub:** Automatic secret scanning for public repos (free) and private repos (Advanced Security license). Detects known token formats from 100+ providers.
- **GitLab:** Secret Detection CI component scans MR diffs automatically.

```quiz
question: "A secret was committed 5 commits ago and pushed to GitHub. What should you do?"
type: multiple-choice
options:
  - text: "Immediately revoke/rotate the secret, then remove it from history with git filter-repo"
    correct: true
    feedback: "Correct! Step 1: Revoke the compromised secret immediately (rotate API keys, change passwords). Even after removing from Git history, the secret was exposed on the remote and may have been cached, cloned, or scraped. Step 2: Remove from history using git filter-repo. Step 3: Force push the cleaned history. Step 4: Notify affected team members."
  - text: "Delete the file and commit the deletion - that removes the secret"
    feedback: "Deleting the file only removes it from the current commit. The secret still exists in the previous 5 commits. Anyone with clone access can see it in the history. You must rewrite history AND revoke the secret."
  - text: "Revert the commit that added the secret"
    feedback: "Reverting creates a new commit that undoes the changes, but the original commit with the secret remains in history. The secret is still visible in git log -p. You must rewrite history AND revoke the secret."
  - text: "Make the repository private"
    feedback: "Making the repo private prevents new access, but anyone who already cloned it has the secret. GitHub also caches content. You must revoke the secret AND clean the history."
```

---

## Removing Secrets from History

When a secret has been committed, you need to rewrite history to remove it from every commit.

### `git filter-repo` (Recommended)

[**git filter-repo**](https://github.com/newren/git-filter-repo) is the modern replacement for `git filter-branch`. It's faster, safer, and easier to use:

```bash
# Install
pip install git-filter-repo

# Remove a file from all history
git filter-repo --path secrets.env --invert-paths

# Replace specific strings in all files across all history
git filter-repo --replace-text expressions.txt
```

The `expressions.txt` file maps secrets to replacements:

```
literal:sk_live_abc123def456==>***REDACTED***
regex:password\s*=\s*['"].*?[']==>password = "***REDACTED***"
```

```terminal
title: Removing a Secret from History with git filter-repo
steps:
  - command: "git init secret-demo && cd secret-demo"
    output: "Initialized empty Git repository in /home/user/secret-demo/.git/"
    narration: "Create a demo repository."
  - command: "echo 'API_KEY=sk_live_abc123' > .env && echo 'app code' > app.py && git add . && git commit -m 'Initial commit'"
    output: "[main (root-commit) a1b2c3d] Initial commit"
    narration: "Oops - we committed a .env file with an API key."
  - command: "echo 'more code' >> app.py && git add app.py && git commit -m 'Add feature'"
    output: "[main b2c3d4e] Add feature"
    narration: "Continue development. The secret is in commit a1b2c3d's tree."
  - command: "git log --all --oneline -- .env"
    output: "a1b2c3d Initial commit"
    narration: "Confirm the .env file is in the history."
  - command: "git filter-repo --path .env --invert-paths --force"
    output: |
      Parsed 2 commits
      New history written in 0.01 seconds
    narration: "filter-repo rewrites every commit, excluding .env from all of them. --invert-paths means 'remove these paths' rather than 'keep only these paths'."
  - command: "git log --all --oneline -- .env"
    output: ""
    narration: "The .env file is completely gone from history. No commit references it anymore."
  - command: "git log --oneline"
    output: |
      c3d4e5f Add feature
      d4e5f6a Initial commit
    narration: "Both commits exist with new hashes (history was rewritten). The content of app.py is preserved; only .env was removed."
```

### BFG Repo-Cleaner

[**BFG**](https://reclaimtheremote.com/bfg-repo-cleaner/) is a simpler tool focused on common cleaning tasks:

```bash
# Remove a file by name
bfg --delete-files .env

# Replace strings
bfg --replace-text passwords.txt

# Remove large files
bfg --strip-blobs-bigger-than 100M
```

After either tool, force push the cleaned history:

```bash
git reflog expire --expire=now --all
git gc --prune=now --aggressive
git push --force --all
git push --force --tags
```

!!! danger "Force pushing after history rewrite"
    History rewriting changes every commit hash from the rewritten point onward. All collaborators must re-clone or carefully rebase their work. Coordinate with your team before force pushing. Notify everyone that the history has changed.

---

## Security-Focused `.gitignore`

Prevent secrets from being committed in the first place:

```bash
# Secrets and credentials
.env
.env.*
!.env.example
*.key
*.pem
*.p12
*.pfx
credentials.json
service-account.json
**/secrets/

# SSH keys (if stored in repo for some reason)
id_rsa
id_ed25519
*.pub

# Cloud provider configs
.aws/credentials
.gcp/
```

---

## Exercises

```exercise
title: Set Up Commit Signing and Verify
difficulty: intermediate
scenario: |
  Set up commit signing (GPG or SSH) and verify signed commits.

  1. Generate a signing key (GPG or SSH)
  2. Configure Git to use it
  3. Make a signed commit
  4. Verify the signature with git verify-commit
  5. View the signature in git log
  6. Make an unsigned commit (temporarily disable signing) and compare
hints:
  - "For SSH: git config --global gpg.format ssh && git config --global user.signingkey ~/.ssh/id_ed25519.pub"
  - "For GPG: gpg --full-generate-key, then git config --global user.signingkey <KEY-ID>"
  - "git commit.gpgsign = true enables automatic signing"
  - "git log --show-signature shows whether each commit is signed"
solution: |
  ```bash
  git init signing-demo && cd signing-demo

  # Option A: SSH signing (simpler, Git 2.34+)
  git config --local gpg.format ssh
  git config --local user.signingkey ~/.ssh/id_ed25519.pub
  git config --local commit.gpgsign true

  # Signed commit
  echo "signed" > file.txt
  git add file.txt
  git commit -m "Signed commit"

  # Verify
  git verify-commit HEAD
  git log --show-signature -1

  # Unsigned commit for comparison
  git config --local commit.gpgsign false
  echo "unsigned" >> file.txt
  git add file.txt
  git commit -m "Unsigned commit"

  # Compare
  git log --show-signature -2
  # First commit shows signature, second doesn't

  # Re-enable
  git config --local commit.gpgsign true
  ```
```

```exercise
title: Scan for Leaked Secrets
difficulty: beginner
scenario: |
  Practice detecting accidentally committed secrets using pre-commit hooks.

  1. Create a repository with a few code files
  2. "Accidentally" add a file with a hardcoded API key
  3. Install gitleaks as a pre-commit hook
  4. Attempt to commit - the hook should catch the secret
  5. Remove the secret and commit successfully
  6. Add the secret pattern to .gitignore to prevent future accidents
hints:
  - "Use a fake but realistic-looking key like AKIAIOSFODNN7EXAMPLE (AWS format)"
  - "pre-commit run --all-files tests hooks without committing"
  - "After removing the secret, add the file pattern to .gitignore"
  - "gitleaks detects common secret patterns like AWS keys, GitHub tokens, etc."
solution: |
  ```bash
  git init secret-scan-demo && cd secret-scan-demo
  pip install pre-commit

  # Set up pre-commit config with gitleaks
  cat > .pre-commit-config.yaml << 'EOF'
  repos:
    - repo: https://github.com/gitleaks/gitleaks
      rev: v8.18.0
      hooks:
        - id: gitleaks
  EOF

  pre-commit install

  # Create normal code
  echo "print('hello')" > app.py
  git add . && git commit -m "Initial commit"

  # "Accidentally" add a secret
  echo 'AWS_KEY="AKIAIOSFODNN7EXAMPLE"' > config.py
  git add config.py

  # Try to commit - gitleaks should block it
  git commit -m "Add config"  # Should fail

  # Fix: remove the secret
  echo 'AWS_KEY = os.environ["AWS_KEY"]' > config.py
  echo '.env' >> .gitignore
  git add . && git commit -m "Use environment variable for AWS key"
  ```
```

---

## Further Reading

- [Pro Git - Chapter 7.4: Signing Your Work](https://git-scm.com/book/en/v2/Git-Tools-Signing-Your-Work) - GPG signing commits and tags
- [GitHub: Signing Commits](https://docs.github.com/en/authentication/managing-commit-signature-verification) - setting up GPG and SSH signing on GitHub
- [GitLab: Signing Commits with GPG](https://docs.gitlab.com/ee/user/project/repository/signed_commits/gpg.html) - GitLab GPG verification
- [git-filter-repo Documentation](https://github.com/newren/git-filter-repo) - history rewriting tool
- [Gitleaks](https://github.com/gitleaks/gitleaks) - secret scanning tool
- [TruffleHog](https://github.com/trufflesecurity/trufflehog) - deep secret scanning
- [OWASP Secret Management Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Secrets_Management_Cheat_Sheet.html) - comprehensive secret management guidance

---

**Previous:** [Git Hooks and Automation](hooks-and-automation.md) | **Next:** [Monorepos and Scaling Git](monorepos-and-scaling.md) | [Back to Index](README.md)
