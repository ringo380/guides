# GitHub, GitLab, and Bitbucket

Git is a distributed version control system. GitHub, GitLab, and Bitbucket are platforms built around Git that add collaboration features: pull/merge requests, CI/CD pipelines, issue tracking, code review, and project management. This guide covers the platform-specific features, CLIs, and CI/CD configuration for each.

---

## Platform Comparison

| Feature | GitHub | GitLab | Bitbucket |
|---------|--------|--------|-----------|
| **Code Review** | Pull Requests | Merge Requests | Pull Requests |
| **CI/CD** | GitHub Actions | GitLab CI/CD | Bitbucket Pipelines |
| **CI Config** | `.github/workflows/*.yml` | `.gitlab-ci.yml` | `bitbucket-pipelines.yml` |
| **CLI** | `gh` | `glab` | None (official) |
| **Container Registry** | GitHub Packages | Built-in | None (use Docker Hub) |
| **Issue Tracking** | Issues + Projects | Issues + Boards + Epics | Issues + Jira integration |
| **Self-Hosted** | GitHub Enterprise | GitLab CE/EE (free self-host) | Bitbucket Data Center |
| **Free Private Repos** | Unlimited | Unlimited | Unlimited (5 users) |
| **Unique Features** | Copilot, Codespaces, Discussions, Sponsors | Built-in DevSecOps, DORA metrics, Value Stream | Jira/Confluence integration |

```quiz
question: "Are Pull Requests (GitHub/Bitbucket) and Merge Requests (GitLab) the same thing?"
type: multiple-choice
options:
  - text: "Yes - they're the same concept with different names"
    correct: true
    feedback: "Correct! Pull Requests and Merge Requests are functionally identical: a request to merge one branch into another, with code review, discussion, and CI checks. The terminology differs by platform. GitHub and Bitbucket call them Pull Requests; GitLab calls them Merge Requests."
  - text: "No - Pull Requests use merge commits while Merge Requests use rebasing"
    feedback: "Both support multiple merge strategies (merge commit, squash, rebase). The merge strategy is configurable on all platforms. The name difference is purely terminological."
  - text: "No - Merge Requests include CI/CD but Pull Requests don't"
    feedback: "Both support CI/CD integration. GitHub Actions run on Pull Requests, GitLab CI runs on Merge Requests, and Bitbucket Pipelines run on Pull Requests. The name difference is just terminology."
  - text: "Pull Requests are a Git feature; Merge Requests are a GitLab feature"
    feedback: "Neither is a Git feature. Both are platform features built on top of Git's branching and merging. Git itself has no concept of pull requests or merge requests."
```

---

## GitHub

### The `gh` CLI

[**`gh`**](https://cli.github.com/) is GitHub's official CLI. It handles pull requests, issues, releases, actions, and more without leaving the terminal.

```bash
# Install
brew install gh          # macOS
sudo apt install gh      # Debian/Ubuntu
winget install GitHub.cli  # Windows

# Authenticate
gh auth login
```

#### Pull Request Operations

```bash
# Create a PR
gh pr create --title "Add user search" --body "Implements search with elasticsearch"

# Create a draft PR
gh pr create --draft --title "WIP: Add user search"

# List open PRs
gh pr list

# View PR details
gh pr view 42

# Check out a PR locally
gh pr checkout 42

# Review a PR
gh pr review 42 --approve
gh pr review 42 --request-changes --body "Need tests for edge cases"

# Merge a PR
gh pr merge 42 --squash --delete-branch
```

#### Issue Operations

```bash
# Create an issue
gh issue create --title "Search results missing pagination" --label "bug"

# List issues
gh issue list --label "bug"

# Close an issue
gh issue close 15
```

#### Other Operations

```bash
# View repository
gh repo view

# Create a release
gh release create v1.0.0 --title "Version 1.0.0" --notes "First stable release"

# View Actions workflow runs
gh run list
gh run view 12345

# Clone a repo
gh repo clone user/repo
```

```terminal
title: Using gh CLI for Pull Request Workflow
steps:
  - command: "gh auth status"
    output: |
      github.com
        ✓ Logged in to github.com as janedeveloper
        ✓ Git operations for github.com configured to use ssh protocol
        ✓ Token: gho_************************************
    narration: "Verify you're authenticated. gh auth login handles OAuth or token-based authentication."
  - command: "git switch -c feature/notifications && echo 'notify module' > notify.py && git add notify.py && git commit -m 'Add notification module'"
    output: "[feature/notifications a1b2c3d] Add notification module"
    narration: "Create a feature branch with a commit, ready for a pull request."
  - command: "gh pr create --title 'Add notification module' --body 'Adds email and push notification support.\n\nCloses #23'"
    output: |
      Creating pull request for feature/notifications into main in user/project

      https://github.com/user/project/pull/42
    narration: "Create a PR directly from the CLI. The --body supports markdown and issue references. GitHub will auto-push the branch if needed."
  - command: "gh pr view 42"
    output: |
      Add notification module #42
      Open • janedeveloper wants to merge 1 commit into main from feature/notifications

      Closes #23

        Checks passing - 2/2 checks OK
        Review required - Waiting for review from bobsmith

      View this pull request on GitHub: https://github.com/user/project/pull/42
    narration: "View PR status: CI checks, review status, and a link to the web interface."
  - command: "gh pr merge 42 --squash --delete-branch"
    output: |
      ✓ Squashed and merged pull request #42 (Add notification module)
      ✓ Deleted branch feature/notifications and switched to branch main
    narration: "Squash merge the PR (combines all commits into one), delete the feature branch locally and remotely, and switch to main."
```

### GitHub Actions

GitHub Actions is GitHub's CI/CD platform. Workflows are YAML files in `.github/workflows/`:

```code-walkthrough
title: GitHub Actions Workflow
description: A CI workflow that runs tests on pull requests and pushes to main.
code: |
  name: CI

  on:
    push:
      branches: [main]
    pull_request:
      branches: [main]

  jobs:
    test:
      runs-on: ubuntu-latest

      strategy:
        matrix:
          python-version: ['3.10', '3.11', '3.12']

      steps:
        - uses: actions/checkout@v4

        - name: Set up Python ${{ matrix.python-version }}
          uses: actions/setup-python@v5
          with:
            python-version: ${{ matrix.python-version }}

        - name: Install dependencies
          run: |
            python -m pip install --upgrade pip
            pip install -r requirements.txt

        - name: Run tests
          run: pytest --verbose

        - name: Run linter
          run: ruff check .
language: yaml
annotations:
  - line: 1
    text: "Workflow name - appears in the Actions tab on GitHub."
  - line: 3
    text: "Trigger events. This workflow runs on pushes to main AND on pull requests targeting main."
  - line: 10
    text: "Jobs define what runs. Each job gets a fresh virtual machine."
  - line: 11
    text: "runs-on specifies the runner OS. ubuntu-latest is the most common. macos-latest and windows-latest are also available."
  - line: 13
    text: "Strategy matrix runs the job multiple times with different configurations. This tests against three Python versions."
  - line: 18
    text: "actions/checkout@v4 clones your repository into the runner. Nearly every workflow starts with this step."
  - line: 20
    text: "Actions from the marketplace handle common tasks. actions/setup-python installs and configures a specific Python version."
  - line: 25
    text: "The run key executes shell commands. Multi-line commands use the pipe (|) syntax."
  - line: 29
    text: "Each step runs in sequence. If any step fails, the job fails and subsequent steps are skipped (by default)."
```

### Code Owners

`.github/CODEOWNERS` assigns reviewers automatically based on file paths:

```
# These owners are requested for review when someone opens a PR
# that modifies files matching the pattern

*.py        @backend-team
*.js *.ts   @frontend-team
/docs/      @tech-writers
/infra/     @devops-team @security-team
```

---

## GitLab

### The `glab` CLI

[**`glab`**](https://gitlab.com/gitlab-org/cli) is GitLab's official CLI, modeled after `gh`:

```bash
# Install
brew install glab       # macOS
sudo apt install glab   # Debian/Ubuntu

# Authenticate
glab auth login
```

#### Merge Request Operations

```bash
# Create an MR
glab mr create --title "Add user search" --description "Elasticsearch integration"

# List open MRs
glab mr list

# View an MR
glab mr view 42

# Approve an MR
glab mr approve 42

# Merge an MR
glab mr merge 42 --squash
```

### GitLab CI/CD

GitLab CI/CD is configured with `.gitlab-ci.yml` in the repository root:

```code-walkthrough
title: GitLab CI/CD Pipeline
description: A multi-stage pipeline with test, build, and deploy jobs.
code: |
  stages:
    - test
    - build
    - deploy

  variables:
    PIP_CACHE_DIR: "$CI_PROJECT_DIR/.cache/pip"

  cache:
    paths:
      - .cache/pip

  test:
    stage: test
    image: python:3.12
    script:
      - pip install -r requirements.txt
      - pytest --verbose --junitxml=report.xml
    artifacts:
      reports:
        junit: report.xml

  build:
    stage: build
    image: docker:24.0
    services:
      - docker:24.0-dind
    script:
      - docker build -t $CI_REGISTRY_IMAGE:$CI_COMMIT_SHA .
      - docker push $CI_REGISTRY_IMAGE:$CI_COMMIT_SHA

  deploy:
    stage: deploy
    image: alpine:latest
    script:
      - echo "Deploying version $CI_COMMIT_SHA"
    environment:
      name: production
      url: https://app.example.com
    when: manual
    only:
      - main
language: yaml
annotations:
  - line: 1
    text: "Stages define the pipeline order. Jobs in the same stage run in parallel; stages run sequentially."
  - line: 6
    text: "Variables set environment variables available to all jobs. CI_PROJECT_DIR is a built-in GitLab variable."
  - line: 9
    text: "Cache persists directories between pipeline runs, speeding up dependency installation."
  - line: 13
    text: "Jobs are named freely. This job runs in the 'test' stage."
  - line: 15
    text: "image specifies the Docker image for this job. Each job can use a different image."
  - line: 17
    text: "script contains the commands to run. They execute sequentially in the job's container."
  - line: 19
    text: "Artifacts persist files between stages and are downloadable from the GitLab UI. JUnit XML reports appear as test results in the MR."
  - line: 23
    text: "The build job uses Docker-in-Docker (dind) to build container images within the CI pipeline."
  - line: 28
    text: "CI_REGISTRY_IMAGE and CI_COMMIT_SHA are built-in variables. GitLab provides dozens of predefined variables for CI."
  - line: 34
    text: "environment connects this job to a deployment environment. GitLab tracks deployment history per environment."
  - line: 37
    text: "'when: manual' means this job doesn't run automatically - someone must click 'Play' in the UI."
  - line: 39
    text: "'only: main' restricts this job to the main branch. Feature branch pipelines won't include the deploy job."
```

### GitLab-Specific Features

- **Epics** - group related issues across projects
- **Merge trains** - queue MRs for sequential merging with CI verification
- **DORA metrics** - built-in DevOps performance tracking
- **Environments** - track deployments with rollback support
- **Protected environments** - require approval before deployment

---

## Bitbucket

Bitbucket focuses on Atlassian ecosystem integration - tight coupling with Jira and Confluence.

### Bitbucket Pipelines

CI/CD is configured with `bitbucket-pipelines.yml`:

```yaml
image: python:3.12

pipelines:
  default:
    - step:
        name: Test
        caches:
          - pip
        script:
          - pip install -r requirements.txt
          - pytest --verbose

  branches:
    main:
      - step:
          name: Test
          script:
            - pip install -r requirements.txt
            - pytest
      - step:
          name: Deploy
          deployment: production
          script:
            - echo "Deploying to production"
          trigger: manual

  pull-requests:
    '**':
      - step:
          name: Test PR
          script:
            - pip install -r requirements.txt
            - pytest --verbose
```

### Bitbucket-Specific Features

- **Jira integration** - commits and PRs link to Jira issues automatically (include the issue key like `PROJ-123` in branch names or commit messages)
- **Deployment permissions** - require Jira approval before deploying
- **Pipes** - pre-built CI/CD integrations (similar to GitHub Actions marketplace)
- **Merge checks** - enforce minimum approvals, passing builds, and resolved tasks

---

## Platform Feature Mapping

```quiz
question: "Which platform feature maps to which?"
type: multiple-choice
options:
  - text: "GitHub Actions = GitLab CI/CD = Bitbucket Pipelines (CI/CD); CODEOWNERS = GitLab CODEOWNERS (review assignment)"
    correct: true
    feedback: "Correct! All three platforms offer CI/CD (Actions, GitLab CI, Pipelines) and code ownership files. The CI/CD config file names differ (.github/workflows/*.yml, .gitlab-ci.yml, bitbucket-pipelines.yml), but the concepts are equivalent."
  - text: "GitHub Discussions = GitLab Merge Requests = Bitbucket Comments"
    feedback: "These aren't equivalent. GitHub Discussions is a forum feature. GitLab MRs and Bitbucket PRs are code review features (equivalent to GitHub PRs)."
  - text: "GitHub Codespaces = GitLab Runners = Bitbucket Pipes"
    feedback: "These are different features. Codespaces are cloud dev environments. Runners are CI execution agents. Pipes are pre-built CI integrations."
  - text: "All three platforms have identical feature sets with different UIs"
    feedback: "While they overlap significantly, each has unique features: GitHub has Copilot and Sponsors, GitLab has built-in DORA metrics and merge trains, Bitbucket has native Jira integration."
```

---

## Setting Up CI for Each Platform

```exercise
title: Write a Basic CI Pipeline Config
difficulty: intermediate
scenario: |
  Write CI configuration files for a Node.js project that:
  - Runs on pushes to main and on pull/merge requests
  - Installs dependencies with npm ci
  - Runs linting with npm run lint
  - Runs tests with npm test

  Create all three config files:
  1. `.github/workflows/ci.yml` for GitHub Actions
  2. `.gitlab-ci.yml` for GitLab CI
  3. `bitbucket-pipelines.yml` for Bitbucket Pipelines
hints:
  - "GitHub Actions uses 'on: push/pull_request' triggers and 'runs-on: ubuntu-latest'"
  - "GitLab CI uses 'image: node:20' and 'stages: [test]'"
  - "Bitbucket Pipelines uses 'image: node:20' and 'pipelines: default/pull-requests'"
  - "All three use npm ci for reproducible installs and npm test/npm run lint for checks"
solution: |
  ```yaml
  # .github/workflows/ci.yml
  name: CI
  on:
    push:
      branches: [main]
    pull_request:
      branches: [main]
  jobs:
    test:
      runs-on: ubuntu-latest
      steps:
        - uses: actions/checkout@v4
        - uses: actions/setup-node@v4
          with:
            node-version: 20
            cache: npm
        - run: npm ci
        - run: npm run lint
        - run: npm test
  ```

  ```yaml
  # .gitlab-ci.yml
  image: node:20
  cache:
    paths:
      - node_modules/
  stages:
    - test
  lint-and-test:
    stage: test
    script:
      - npm ci
      - npm run lint
      - npm test
  ```

  ```yaml
  # bitbucket-pipelines.yml
  image: node:20
  pipelines:
    default:
      - step:
          name: Lint and Test
          caches:
            - node
          script:
            - npm ci
            - npm run lint
            - npm test
    pull-requests:
      '**':
        - step:
            name: Lint and Test
            caches:
              - node
            script:
              - npm ci
              - npm run lint
              - npm test
  ```
```

---

## Migrating Between Platforms

Since all three platforms use standard Git, migration is straightforward:

```bash
# Clone from the old platform
git clone --mirror git@old-platform.com:user/repo.git
cd repo.git

# Push to the new platform (create the empty repo there first)
git push --mirror git@new-platform.com:user/repo.git
```

`--mirror` copies all refs (branches, tags), all objects, and the complete history. You'll need to recreate platform-specific configuration (CI files, webhooks, branch protection) manually.

Things that don't migrate automatically:

- Pull requests / merge requests and their comments
- Issues and project boards
- CI/CD configuration (different YAML formats)
- Webhooks and integrations
- Wiki content (if using platform wikis)

Some tools help migrate issues and PRs ([GitHub Importer](https://docs.github.com/en/migrations), [GitLab import](https://docs.gitlab.com/ee/user/project/import/)), but review is needed to ensure nothing is lost.

---

## Further Reading

- [GitHub Docs](https://docs.github.com) - comprehensive documentation for all GitHub features
- [GitHub Actions Reference](https://docs.github.com/en/actions) - workflow syntax, events, and runner details
- [GitHub CLI Manual](https://cli.github.com/manual/) - complete `gh` command reference
- [GitLab Docs](https://docs.gitlab.com) - CI/CD, MRs, administration, and DevOps features
- [GitLab CI/CD Reference](https://docs.gitlab.com/ee/ci/yaml/) - `.gitlab-ci.yml` keyword reference
- [glab CLI Documentation](https://gitlab.com/gitlab-org/cli) - GitLab CLI usage
- [Bitbucket Docs](https://support.atlassian.com/bitbucket-cloud/) - Pipelines, PRs, and Jira integration
- [Bitbucket Pipelines Reference](https://support.atlassian.com/bitbucket-cloud/docs/configure-bitbucket-pipelinesyml/) - pipeline YAML syntax

---

**Previous:** [Collaboration Workflows](collaboration-workflows.md) | **Next:** [Git Hooks and Automation](hooks-and-automation.md) | [Back to Index](README.md)
