# AI Guidelines

This file provides guidance to Claude Code (claude.ai/code), Junie, and other AI agents when working with code in this repository.

## Project Overview

A collection of open-access technical guides written in Markdown, covering system administration and development topics. Content may be outdated and should be verified — this is stated explicitly in the README. Dual-licensed: written content under CC BY-NC-ND 4.0, code under MIT.

## Repository Structure

```
guides/
├── Databases/          # Comprehensive database course (17 guides, fundamentals to operations)
├── Dev Zero/           # Introduction to Perl and Python development
├── DNS Administration/ # DNS management for sysadmins
├── Docker/             # Container fundamentals and orchestration
├── Git/                # Comprehensive Git course (17 guides, basics to internals)
├── Linux Essentials/   # Comprehensive CLI guides (README.md is the index)
├── Nginx/              # Web server and reverse proxy configuration
├── Security/           # TLS/SSL, certificate management, and PKI basics
├── .github/ISSUE_TEMPLATE/  # Issue form templates (new-guide, content, bug, feature)
├── .github/PULL_REQUEST_TEMPLATE.md
├── .github/workflows/  # GitHub Actions (MkDocs deploy)
├── assets/              # Logo, favicon, custom CSS, interactive JS/CSS
├── hooks/               # MkDocs Python hooks (interactive fence parser)
├── overrides/           # MkDocs template overrides (landing page, comments partial)
├── mkdocs.yml          # MkDocs Material configuration
├── setup-docs.sh       # Creates docs/ symlink tree for MkDocs
├── requirements.txt    # Python deps (mkdocs-material, mkdocs-open-in-new-tab, pillow, cairosvg)
├── CONTRIBUTING.md     # Contributor guide (style, components, PR process)
├── CODE_OF_CONDUCT.md  # Contributor Covenant v2.1
├── LICENSE             # Dual-license overview (CC BY-NC-ND 4.0 + MIT)
├── LICENSE-CONTENT     # CC BY-NC-ND 4.0 (written content)
├── LICENSE-CODE        # MIT (code)
└── README.md
```

Each topic directory contains one or more `.md` files.

## MkDocs Site

- Mermaid diagrams enabled via `pymdownx.superfences` with custom mermaid fence in `mkdocs.yml`
- **Do not hardcode colors in Mermaid diagrams** (no `classDef`, `style`, or `:::class` directives) — MkDocs Material auto-themes for light/dark mode; hardcoded fills break contrast in one or both schemes
- **Do not use `<br/>` in Mermaid sequence diagram participants** — GitHub's Mermaid renderer can't parse it (use parentheses or shorter labels instead); `<br/>` in flowchart nodes is fine
- Static diagram images (SVGs) live in `assets/images/dns/` (or `assets/images/<topic>/`); referenced from guides as `../assets/images/<topic>/filename.svg`
- SVG diagrams use `@media (prefers-color-scheme: dark)` for light/dark theming — reference pattern: `assets/images/perl/perl-context-flowchart.svg`
- SVG color palette: light `#f5f5f5`/`#ccc`/`#1a1a1a`, dark `rgba(255,255,255,0.07)`/`rgba(255,255,255,0.15)`/`#e0e0e0`, accent `#009485` (light) / `#4db6ac` (dark)
- SVG text sizing: at 10px bold `system-ui`, proportional chars average ~5-6px wide — size boxes to fit longest label with ≥10px total padding
- Embed SVGs in Markdown: `<div class="diagram-container"><img src="../../assets/images/<topic>/filename.svg" alt="description"></div>`
- Verify with `./setup-docs.sh && mkdocs build --strict` — strict mode catches broken links and missing files
- Static site built with MkDocs Material, deployed to GitHub Pages via `.github/workflows/deploy.yml`
- `docs_dir: docs` in `mkdocs.yml` — MkDocs forbids `docs_dir: .` when config is in the same directory
- HTML `<img>` paths resolve relative to the rendered page URL (e.g., `Databases/database-fundamentals/`), not the source `.md` file — use `../../` to reach site root from a guide page when `use_directory_urls` is enabled
- `setup-docs.sh` creates a `docs/` directory with symlinks to source content (no files are moved)
- Local preview: `./setup-docs.sh && pip install -r requirements.txt && mkdocs serve`
- `docs/`, `site/`, and `.cache/` are gitignored build artifacts
- Adding a new guide directory requires updating: `mkdocs.yml` (nav), `setup-docs.sh` (symlink), `assets/javascripts/lib/topics.js` (topic and guide list), `.github/ISSUE_TEMPLATE/content-improvement.yml` (guide dropdown), and `README.md` (topic list)
- Adding a new guide file to an existing directory requires updating: `mkdocs.yml` (nav), `assets/javascripts/lib/topics.js` (guide list for the topic), the section `README.md` (add topic card with `data-guide` and `data-topic` attributes), `.github/ISSUE_TEMPLATE/content-improvement.yml` (guide dropdown), the previous guide's nav footer (add Next link), and YAML frontmatter in the new guide (difficulty, time_estimate, prerequisites, learning_outcomes, tags)
- When inserting a guide between two existing guides, update BOTH adjacent guides' nav footers (previous guide's Next link AND next guide's Previous link)
- `overrides/` contains custom MkDocs templates (e.g., `home.html` for the landing page hero); `custom_dir` is relative to `mkdocs.yml`, no symlink needed
- `assets/` contains logo, favicon, and custom CSS; symlinked into `docs/` by `setup-docs.sh`
- `README.md` has YAML front matter (`template: home.html`) for the MkDocs landing page; GitHub strips it automatically
- Site branding: "The Runbook" - teal primary, amber accent, document+play logo
- `social` plugin generates OG card images; requires `pillow`, `cairosvg`, and system `libcairo2-dev` + `libffi-dev`
- Deploy workflow must run `apt-get update` before `apt-get install` (Ubuntu runner mirrors go stale)
- Giscus comments via `overrides/partials/comments.html` — included by Material's `partials/content.html`, excluded from homepage via `{% if not page.is_homepage %}`
- `assets/javascripts/giscus-theme.js` syncs Giscus iframe theme with Material's light/dark toggle
- `assets/javascripts/lightbox.js` adds click-to-enlarge modals for images in `.diagram-container` and `.photo-frame`; uses same MutationObserver pattern as `interactive.js` for instant navigation
- Images that should link externally instead of zooming need `data-no-lightbox="true"` on the `<img>` tag to bypass lightbox click interception
- `photo-frame` figures: alternate `photo-left`/`photo-right` when using multiple images in a section; add `<div style="clear: both;"></div>` between floated sections to prevent stacking and overflow into unrelated content
- GA4 analytics and page feedback widget configured in `extra.analytics` — property ID: `G-56L2QXTFGR`
- Custom GA4 events track interactive component engagement (`quiz_answer`, `exercise_complete`, `terminal_step`, `command_copy`, `walkthrough_step`, `code_copy`, etc.) via `assets/javascripts/lib/analytics.js`
- GitHub Discussions enabled; issue template config has contact links routing to Discussions
- `.github/workflows/deploy.yml` runs `mkdocs build --strict` before deploying; uses pip caching
- Deploy uses `upload-pages-artifact@v3` + `deploy-pages@v4` with `pages: write` + `id-token: write` permissions (not legacy `mkdocs gh-deploy`)
- `.github/workflows/pr-check.yml` validates PRs: Python tests, JS tests, and strict MkDocs build
- Guides have YAML frontmatter: `difficulty`, `time_estimate`, `prerequisites`, `learning_outcomes`, `tags` — `hooks/metadata.py` injects a metadata banner below the `# title` on each guide page
- `hooks/metadata.py` injects raw HTML (not Markdown) — links in the banner must use rendered URL paths (`../slug/`), not `.md` references, because MkDocs does not resolve hrefs inside injected HTML

## Interactive Components

- `exercise` config schema: `{ title, difficulty?, scenario, hints, solution }` — the component renders `scenario` for the exercise body; `description` and `requirements` keys are silently ignored
- `command-builder` config schema: `{ base, description?, options: [{ flag, type, label, placeholder?, explanation?, choices? }] }` — options must be a flat array, not nested under `groups`
- Custom fences (` ```quiz `, ` ```terminal `, ` ```exercise `, ` ```command-builder `, ` ```code-walkthrough `) are authored as YAML-in-Markdown
- `hooks/interactive.py` converts fences to `<div class="interactive-*" data-config="...">` HTML during build
- `assets/javascripts/interactive.js` discovers divs and lazy-loads component scripts from `assets/javascripts/components/`
- `assets/javascripts/lib/storage.js` wraps localStorage for progress/quiz/exercise tracking
- `assets/javascripts/lib/analytics.js` wraps GA4 `gtag()` for event tracking — all interactive components call `RunbookAnalytics.track(eventName, params)` at interaction points; new components must add tracking calls
- `interactive.js` load chain: `storage.js` → `analytics.js` → component scripts — analytics must load before components
- `window.__md_scope` (set by MkDocs Material per page) resolves to the site root URL; use it as the base for `new URL()` asset resolution — `document.baseURI` returns the current page URL (no `<base>` tag is set) and breaks on nested pages
- MkDocs Material 9.x copy buttons use `.md-code__button[data-md-type="copy"]`, **not** the legacy `.md-clipboard` class
- `assets/javascripts/components/topic-cards.js` enhances topic README cards with completion overlays from localStorage; loaded unconditionally by `interactive.js` (like `progress.js`)
- Self-initializing components (loaded outside the `.interactive-*` discovery loop) must still be registered in `COMPONENT_SCRIPTS` in `interactive.js`
- `assets/stylesheets/interactive.css` uses Material CSS custom properties for light/dark theming
- `interactive.css` defines semantic color tokens (`--rb-color-correct`, `--rb-color-correct-bg`, `--rb-color-correct-bg-strong`, `--rb-color-incorrect-*`, `--rb-color-warning-*`) — new CSS files must reuse these instead of hardcoding hex values
- Hooks are resolved relative to `mkdocs.yml`, not `docs_dir` — `hooks/` does NOT need a symlink in `setup-docs.sh`
- No production build toolchain — all vanilla JS, class-based components; Node/npm used only for testing (Vitest + jsdom)
- `code-walkthrough` annotations: `line:` numbers are 1-indexed within the `code:` block — count blank lines; verify every annotation hits the intended line
- `command-builder` requires a non-empty `base:` field — the JS falls back to literal `"command"` if base is empty/falsy
- `command-builder` flag behavior: for `type: select`, set `flag: ""` when choice values already contain the full flag string (e.g., `["-p tcp", "TCP"]`); for `type: text`, set `flag:` to the actual prefix (e.g., `"-G"`) since the user types only the value — the JS concatenates `flag + value`
- YAML `|` block scalars: if a content line is indented less than the first content line, YAML exits the block — `*` at lower indent is parsed as an alias anchor; use inline strings with `\n` for output containing `*` at varying indentation (e.g., `git branch` output)
- Quizzes/exercises must be placed after the content they test, not in stub files lacking educational material
- Exercises in the same guide should test distinct skills — avoid adjacent exercises that follow the same pattern (e.g., two "read config, call API, save results" exercises); vary the file I/O, data processing, or output format
- Factual accuracy is critical in quiz answers, terminal narration, and exercise solutions — verify technical claims (permissions, DNS behavior, command flags) before writing
- Command examples and interactive components must note platform/distro constraints: GNU-only flags (e.g., `grep -P`), version-gated features (e.g., `ssh -J` requires OpenSSH 7.3+), and legacy alternatives (e.g., `iptables -m state` vs `-m conntrack`)
- Terminal blocks must be consistent with any static code blocks or command output already on the same page — match scripts, filenames, flags, and tool output exactly; if the terminal's scenario differs, it must use distinct filenames to avoid contradicting established examples
- Terminal blocks with hardcoded dates (certificate expiry, log timestamps) should use dates at least 1 year in the future to avoid appearing expired in rendered guides
- ARIA accessibility: quiz options use `role="radiogroup"`/`role="radio"` with `aria-checked` (not `aria-pressed`, which is for toggles); `role="log"` implicitly carries `aria-live="polite"` (don't add both); `aria-live` regions must not be updated multiple times per user action to avoid duplicate screen reader announcements
- ARIA accessibility (continued): all interactive components use `role="region"` + `aria-label` as landmark wrapper; toggle buttons (hints, solutions) use `aria-expanded` + `aria-controls`; disabled buttons must sync both `disabled` property and `aria-disabled` attribute
- Lightbox modal uses `role="dialog"` + `aria-modal="true"` with focus trap and return-focus; lightbox-ready images have `tabindex="0"` + `role="button"` for keyboard access
- Decorative SVGs (home page icons) must have `aria-hidden="true"`
- `assets/stylesheets/interactive.css` contains `.sr-only` utility class for visually-hidden live regions
- Hero typing animation (`overrides/home.html`) checks `prefers-reduced-motion` and shows static text if reduced; animated text elements use `aria-hidden="true"` with a separate `aria-live` span for screen reader announcements
- `@media (prefers-reduced-motion: reduce)` blocks in `interactive.css`, `lightbox.css`, `extra.css`, and `metadata.css` disable all animations and transitions
- Focus styles: all interactive buttons must have `:focus-visible` rules using `outline: 2px solid var(--md-accent-fg-color); outline-offset: -1px`
- Keyboard handlers: `preventDefault()` on arrow keys must be inside the navigation guard (not outside) to avoid blocking page scroll when no action occurs

## Testing

- Python tests: `python -m pytest tests/` — covers `hooks/interactive.py` and `hooks/metadata.py`
- JS tests: `npx vitest run` — covers all components in `assets/javascripts/components/` and `lib/storage.js`
- Test deps: `pip install -r requirements-test.txt` (Python), `npm ci` (JS)
- JS test helpers: `tests/js/helpers.js` provides `mockStorage()`, `mockAnalytics()`, `loadComponent(name)`, `cleanup()` — all component tests use these shared mocks
- Both test suites run in CI via `.github/workflows/pr-check.yml`

## Conventions

- Guides are organized into directories by topic
- Each guide is a standalone Markdown file with headers, code blocks, and tables
- Guides use informative, educational tone aimed at practitioners (sysadmins, developers)
- Callouts use Material admonitions (`!!! tip`, `!!! warning`, `!!! danger`, etc.) — not blockquote-with-emoji style; never place admonitions consecutively (2-3 paragraphs apart minimum); never in opening paragraph
- Perl guides have `**Version:**` / `**Year:**` metadata below the subtitle — bump version on content changes, keep year current
- Do not use trailing `\` for Markdown line breaks — Python-Markdown renders them as literal backslashes; use `<br>` or separate paragraphs instead
- Do not indent children of HTML block elements (`<figure>`, `<div>`) in Markdown — Python-Markdown treats indented HTML children as code blocks, causing them to vanish from rendered output
- Prefer creating content over removing it — if a guide is a stub, write educational material rather than deleting components that reference missing content
- Topic README pages use `<div class="topic-progression">` with `<a class="topic-card" data-guide="slug" data-topic="Topic Name">` HTML cards — not flat `### [Title](file.md)` link lists

## Writing Style

- Conversational, direct, speaks to "you"
- Regular hyphens only (no em-dashes or en-dashes)
- No filler phrases ("let's dive into", "let's compare", "it's worth noting that") — applies to all user-facing text including interactive component narration/scenarios
- Bold for key terms on first introduction, backticks for commands/code/paths
- `---` horizontal rules between major sections
- Practical code block examples throughout
- Use `README.md` as directory index when a topic has multiple sub-guides

## Citations

- Link tools/software to official docs on **first bold mention** per guide: `[**tool**](url)` or `` [**`tool`**](url) ``
- No links on subsequent mentions in the same file
- Each guide has a "Further Reading" section at the bottom, above the navigation footer
- Structure: `---` then `## Further Reading` then entries then `---` then nav footer
- Multi-guide topics have navigation footers: `**Previous:** ... | **Next:** ... | [Back to Index](README.md)`

## GitHub Project

- GitHub Project board: "The Runbook Development" (#20) at `https://github.com/users/ringo380/projects/20`
- Closed milestones: v1.0 Foundation, v1.1 Content Quality, v1.2 Interactive Coverage, v2.0 New Topics
- Active milestones: v2.1 Expand Thin Topics (Q2), v2.2 Python Parity & Polish (Q3), v2.3 New Topic Areas (Q4), v3.0 Platform Maturity (2027)
- 26 custom labels: 6 type, 12 topic, 3 priority, 3 effort, 2 contributor (`good first issue`, `help wanted`)
- Latest release: v2.0.0 (2026-03-26)
- Adding a new guide also requires updating the guide dropdown in `.github/ISSUE_TEMPLATE/content-improvement.yml`
- This repo is owned by `ringo380` — verify `gh auth status` shows `ringo380` as active before any `gh` commands; switch with `gh auth switch --user ringo380` if needed
- Use `gh` CLI for issue/label/milestone/project operations
- `gh` has no `milestone` subcommand — use `gh api repos/ringo380/guides/milestones` for milestone CRUD
- Project board item status updates require GraphQL mutations via `gh api graphql` (project ID: `PVT_kwHOAA7T9M4BPdWz`, status field: `PVTSSF_lAHOAA7T9M4BPdWzzg93IfQ`)
- `gh issue list` defaults to 30 results — use `--limit 100` for full counts

## Commit Style

- Prefix: `docs:` or `docs(scope):` (e.g., `docs(linux-essentials):`)
