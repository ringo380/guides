---
description: "Write and submit your first Runbook guide in about 15 minutes: local setup, file layout, style conventions, and the pull request checklist."
---
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

````markdown
---
difficulty: beginner
time_estimate: 20 minutes
prerequisites:
  - Basic command line familiarity
learning_outcomes:
  - What the reader will be able to do after reading
tags:
  - linux
  - process-management
---

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

**Previous:** [Previous Guide](previous-guide.md) | **Next:** [Next Guide](next-guide.md) | [Back to Index](README.md)
````

### Step 3: Wire It Up

A new guide needs more than a nav entry. Update all of these, or the guide will
render without its metadata banner and stay invisible to the topic index:

1. `mkdocs.yml` - add it to `nav`:

```yaml
nav:
  - Linux Essentials:
    - ...existing guides...
    - Process Management: Linux Essentials/process-management.md
```

2. `assets/javascripts/lib/topics.js` - add it to the topic's guide list.
3. The section `README.md` - add a topic card with `data-guide` and `data-topic` attributes.
4. `.github/ISSUE_TEMPLATE/content-improvement.yml` - add it to the guide dropdown.
5. The previous guide's nav footer - add the **Next:** link pointing at your guide.

!!! tip
    Inserting a guide *between* two existing ones? Update both neighbours - the
    previous guide's **Next:** link and the next guide's **Previous:** link.

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

Place these after the content they test, not before it.

### Quick Quiz Example

````markdown
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
````

### Terminal Simulation Example

````markdown
```terminal
title: Demo Title
steps:
  - command: "your-command"
    output: "expected output"
    narration: "Explain what happened."
```
````

---

## Submit Your Guide

1. **Run the check:**
   ```bash
   ./verify.sh
   ```

   This is the same gate CI runs. For a docs-only change, the build step alone
   is enough:

   ```bash
   ./setup-docs.sh && mkdocs build --strict
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

- [ ] File follows the guide template, including the YAML frontmatter
- [ ] All five wiring steps done (nav, `topics.js`, section README, issue template, neighbour footers)
- [ ] Code examples tested and working
- [ ] `./verify.sh` passes
- [ ] Commit message starts with `docs:`

---

## Need Help?

- Check [CONTRIBUTING.md](https://github.com/ringo380/guides/blob/main/CONTRIBUTING.md) for the
  full style guide, the interactive component reference, and licensing details
- Open an [issue](https://github.com/ringo380/guides/issues) for questions
- Review existing guides for examples

---

**You're ready!** Start writing and submit your first pull request.
