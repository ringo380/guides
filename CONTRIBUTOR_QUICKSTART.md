# Contributor Quick-Start Guide

Welcome! This guide will help you write your first guide in 15 minutes.

---

## Quick Setup

```bash
# 1. Fork and clone
git clone https://github.com/<your-username>/guides.git
cd guides

# 2. Install dependencies
pip install -r requirements.txt

# 3. Start local server
./setup-docs.sh
mkdocs serve
```

Open [http://localhost:8000](http://localhost:8000) to preview your changes.

---

## Write Your First Guide

### Step 1: Create the File

Create a new `.md` file in the appropriate directory:

```bash
# Example: Create a guide about process management
touch "Linux Essentials/process-management.md"
```

### Step 2: Use the Template

Copy this template into your new file:

```markdown
# Your Guide Title

Brief introduction - what this guide covers and why it matters (2-3 sentences).

---

## Overview

Explain the core concept. Include practical examples.

```bash
# Example command
command --option argument
```

---

## Common Tasks

### Task One

Step-by-step instructions with code examples.

### Task Two

More practical examples.

---

## Troubleshooting

Address common issues and solutions.

---

## Further Reading

- [Official Documentation](https://example.com) - Brief description
- [Related Resource](https://example.com) - Brief description

---

**Previous:** [Previous Guide](previous.md) | **Next:** [Next Guide](next.md) | [Back to Index](README.md)
```

### Step 3: Update Navigation

Add your guide to `mkdocs.yml`:

```yaml
nav:
  - Linux Essentials:
    - ...existing guides...
    - Process Management: Linux Essentials/process-management.md
```

### Step 4: Preview and Test

```bash
mkdocs serve
# Open http://localhost:8000
# Click around to verify links work
```

---

## Style Essentials

| Element | Format |
|---------|--------|
| Commands | `` `backticks` `` |
| Key terms | **Bold** on first use |
| File paths | `` `/path/to/file` `` |
| Sections | `## Heading` + `---` separator |

### Use Admonitions

```markdown
!!! tip
    Helpful advice here.

!!! warning
    Potential pitfall here.

!!! danger
    Critical warning here.
```

---

## Add Interactive Components

### Quick Quiz Example

```markdown
```quiz
question: Your question here?
type: multiple-choice
options:
  - text: "Wrong answer"
    feedback: "Why it's wrong."
  - text: "Correct answer"
    correct: true
    feedback: "Why it's correct."
```
```

### Terminal Simulation Example

```markdown
```terminal
title: Demo Title
steps:
  - command: "your-command"
    output: "expected output"
    narration: "Explain what happened."
```
```

---

## Submit Your Guide

1. **Test the build:**
   ```bash
   mkdocs build --strict
   ```

2. **Commit with proper prefix:**
   ```bash
   git add .
   git commit -m "docs: add process management guide"
   ```

3. **Push and open PR:**
   ```bash
   git push origin your-branch-name
   ```

4. **Open pull request** on GitHub with:
   - Clear title describing your change
   - Brief description of what you added/fixed

---

## Checklist Before Submitting

- [ ] File follows the guide template
- [ ] Added to `mkdocs.yml` navigation
- [ ] Code examples tested and working
- [ ] Links verified (run `mkdocs build --strict`)
- [ ] Commit message starts with `docs:`

---

## Need Help?

- Check [CONTRIBUTING.md](CONTRIBUTING.md) for detailed guidelines
- Open an [issue](https://github.com/ringo380/guides/issues) for questions
- Review existing guides for examples

---

**You're ready!** Start writing and submit your first pull request.