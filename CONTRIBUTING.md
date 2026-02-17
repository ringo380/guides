# Contributing to The Runbook

Thanks for your interest in contributing to [The Runbook](https://ringo380.github.io/guides/) - a collection of practical, open-access technical guides covering Linux, DNS, Git, databases, and development.

There are many ways to help: writing new guides, improving existing content, adding interactive components, fixing bugs, or reviewing pull requests. All skill levels are welcome.

---

## Getting Started

1. Fork and clone the repository:

```bash
git clone https://github.com/<your-username>/guides.git
cd guides
```

2. Set up local development:

```bash
pip install -r requirements.txt
./setup-docs.sh
mkdocs serve
```

3. Open [http://localhost:8000](http://localhost:8000) in your browser. MkDocs will hot-reload as you edit files.

!!! note
    `setup-docs.sh` creates a `docs/` directory with symlinks to your source content. The `docs/` and `site/` directories are gitignored build artifacts.

---

## Ways to Contribute

### Write New Guides

Have expertise in a sysadmin or development topic? Open an issue to propose a new guide, then write it in Markdown following the structure and style described below. New guide directories need updates to both `mkdocs.yml` (nav) and `setup-docs.sh` (symlink).

### Improve Existing Content

Some guides may be outdated, thin, or missing examples. Fix inaccuracies, expand incomplete sections, add practical code examples, or improve clarity.

### Add Interactive Components

Guides support quizzes, terminal simulations, exercises, command builders, and code walkthroughs - all authored as YAML inside Markdown fences. See the [Interactive Components](#interactive-components) section below.

### Fix Bugs

Broken links, build failures, rendering issues, or interactive component bugs. Run `./setup-docs.sh && mkdocs build --strict` to catch problems - strict mode flags broken links and missing files.

### Review Pull Requests

Read through open PRs, test changes locally, and leave constructive feedback on accuracy, style, and completeness.

---

## Writing Style Guide

These conventions keep the guides consistent across topics and contributors.

**Tone and voice:**

- Conversational and direct - speak to "you"
- Informative, educational tone aimed at practitioners (sysadmins, developers)
- No filler phrases: avoid "let's dive into", "let's take a look at", "it's worth noting that", "without further ado", and similar padding

**Formatting:**

- Regular hyphens only - no em-dashes or en-dashes
- **Bold** for key terms on first introduction
- `Backticks` for commands, code, file paths, and configuration values
- `---` horizontal rules between major sections
- Practical code block examples throughout

**Admonitions:**

Use [Material admonitions](https://squidfunk.github.io/mkdocs-material/reference/admonitions/) - not blockquote-with-emoji style:

```markdown
!!! tip
    This is a tip admonition.

!!! warning
    This is a warning admonition.

!!! danger
    This is a danger admonition.
```

**Citations and links:**

- Link tools and software to official docs on the **first bold mention** per guide: `[**tool**](url)` or `` [**`tool`**](url) ``
- No links on subsequent mentions in the same file

**Commit messages:**

- Use `docs:` or `docs(scope):` prefixes
- Examples: `docs: add DNS caching guide`, `docs(linux-essentials): fix grep examples`

---

## Guide Structure

Every guide should follow this general template:

```markdown
# Guide Title

Brief introduction to the topic - what it is and why it matters.

---

## First Section

Explanation with practical examples.

```bash
# Code example
command --flag argument
```

---

## Second Section

More content, tables, admonitions as needed.

---

## Further Reading

- [Official Documentation](https://example.com) - Brief description
- [Related Resource](https://example.com) - Brief description

---

**Previous:** [Previous Guide](previous-guide.md) | **Next:** [Next Guide](next-guide.md) | [Back to Index](README.md)
```

Key points:

- The `## Further Reading` section goes at the bottom, above the navigation footer
- Separate Further Reading and navigation footer with `---` horizontal rules
- Navigation footers are used in multi-guide series (like Linux Essentials)

---

## Interactive Components

The site supports five interactive component types, authored as YAML inside custom Markdown fences. These are processed at build time by `hooks/interactive.py` and rendered client-side by vanilla JavaScript.

Place interactive components **after** the content they reference - not in stub files that lack educational material.

**Accuracy matters.** Verify all technical claims in quiz answers, terminal narration, and exercise solutions before submitting.

### Quiz

Multiple-choice or true/false questions to test comprehension.

````markdown
```quiz
question: What does the -r flag do in cp?
type: multiple-choice
options:
  - text: "Copies files in reverse order"
    feedback: "The -r flag is not related to ordering."
  - text: "Copies directories recursively"
    correct: true
    feedback: "Correct! -r copies the directory and all its contents."
```
````

### Terminal

Simulated terminal sessions with step-by-step narration.

````markdown
```terminal
title: Checking Disk Usage
steps:
  - command: "df -h /"
    output: "/dev/sda1  50G  23G  25G  48% /"
    narration: "The -h flag shows sizes in human-readable format."
  - command: "du -sh /var/log"
    output: "1.2G    /var/log"
    narration: "du -sh gives a summary total for the specified directory."
```
````

### Exercise

Hands-on practice problems with hints and solutions.

````markdown
```exercise
title: Find Large Log Files
difficulty: beginner
scenario: |
  You need to find all log files over 100MB in /var/log.
hints:
  - "Use find with the -size flag"
  - "The + prefix means 'greater than'"
solution: |
  ```bash
  find /var/log -name "*.log" -size +100M
  ```
```
````

### Command Builder

Interactive command construction with selectable options. The `base:` field is **required** and must be non-empty.

````markdown
```command-builder
base: tar
description: Build a tar command to create or extract archives
options:
  - flag: ""
    type: select
    label: "Operation"
    choices:
      - ["-czf", "Create gzip archive"]
      - ["-xzf", "Extract gzip archive"]
```
````

### Code Walkthrough

Annotated code blocks with line-by-line explanations. Line numbers in annotations are **1-indexed** within the `code:` block - count blank lines when determining line numbers.

````markdown
```code-walkthrough
language: bash
title: A Simple Backup Script
code: |
  #!/bin/bash
  SRC="/var/www"
  DEST="/backup/$(date +%F)"
  mkdir -p "$DEST"
  rsync -a "$SRC/" "$DEST/"
annotations:
  - line: 1
    text: "The shebang line tells the system to use bash."
  - line: 3
    text: "date +%F outputs YYYY-MM-DD, creating a dated backup directory."
  - line: 5
    text: "rsync -a preserves permissions, timestamps, and symlinks."
```
````

---

## Submitting Changes

1. **Branch from `main`** using a descriptive branch name:
    - `feature/add-nginx-guide`
    - `fix/broken-dns-links`

2. **Write clear commits** with the `docs:` or `docs(scope):` prefix:

    ```
    docs(dns): add DNSSEC key rotation examples
    docs: fix broken link in README
    ```

3. **Verify the build passes** before pushing:

    ```bash
    ./setup-docs.sh && mkdocs build --strict
    ```

    Strict mode catches broken links, missing files, and configuration errors.

4. **Open a pull request** against `main` with a clear description of what you changed and why.

---

## Review Process

- Pull requests are reviewed for technical accuracy, style consistency, and build success
- Interactive components are tested manually in both light and dark modes
- You may be asked to revise content for clarity, accuracy, or style alignment
- Typical turnaround is a few days, though complex guides may take longer

---

## Licensing

This project is dual-licensed:

- **Written content** (`.md` files) is licensed under [CC BY-NC-ND 4.0](LICENSE-CONTENT), attributed to Ryan Thomas Robson / Robworks Software LLC.
- **Code** (`.js`, `.py`, `.css`, `.sh`, `.html`) is licensed under the [MIT License](LICENSE-CODE), copyright Robworks Software LLC.

By submitting a pull request, you grant Ryan Thomas Robson / Robworks Software LLC a perpetual, irrevocable, worldwide, royalty-free license to incorporate your contributions under the project's existing licenses.

---

## Code of Conduct

We are committed to providing a welcoming and inclusive experience. Please read our [Code of Conduct](CODE_OF_CONDUCT.md).

---

## Questions?

Open an issue on the [GitHub repository](https://github.com/ringo380/guides) if you have questions about contributing, need help with local setup, or want to discuss a guide idea before writing it.
