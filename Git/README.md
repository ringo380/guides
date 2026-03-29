# Git

A comprehensive course on Git - from your first commit through the internals of the object model, collaboration workflows across platforms, and advanced operations at scale. These guides take you from "I know I should use version control" to understanding Git deeply enough to debug, optimize, and architect workflows around it.

Each guide is self-contained, but the order below follows a natural learning path.

---

## Guides

<div class="topic-progression">
<h3>Foundations</h3>
<a class="topic-card" href="introduction/" data-guide="introduction" data-topic="Git">
<span class="topic-card__number">1</span>
<span class="topic-card__badge">Start Here</span>
<div class="topic-card__body">
<div class="topic-card__title">Introduction: Why Git, and Why Version Control</div>
<div class="topic-card__meta">
<span class="meta-difficulty meta-difficulty--beginner">Beginner</span>
<span class="meta-time">30 min</span>
</div>
<p class="topic-card__description">The history of version control from RCS through SVN to distributed systems, and why Linus Torvalds built Git for the Linux kernel.</p>
</div>
<span class="topic-card__check" aria-hidden="true">&#10003;</span>
</a>
<a class="topic-card" href="three-trees/" data-guide="three-trees" data-topic="Git">
<span class="topic-card__number">2</span>
<div class="topic-card__body">
<div class="topic-card__title">The Three Trees: Working Directory, Index, and Repository</div>
<div class="topic-card__meta">
<span class="meta-difficulty meta-difficulty--beginner">Beginner</span>
<span class="meta-time">35 min</span>
</div>
<p class="topic-card__description">Git's core mental model - the working tree, staging area, and committed history. Covers the file lifecycle, .gitignore syntax, and the .git directory.</p>
</div>
<span class="topic-card__check" aria-hidden="true">&#10003;</span>
</a>
<a class="topic-card" href="commits-and-history/" data-guide="commits-and-history" data-topic="Git">
<span class="topic-card__number">3</span>
<div class="topic-card__body">
<div class="topic-card__title">Commits and History</div>
<div class="topic-card__meta">
<span class="meta-difficulty meta-difficulty--beginner">Beginner</span>
<span class="meta-time">40 min</span>
</div>
<p class="topic-card__description">What a commit actually stores and how to explore history. Covers commit anatomy, effective messages, git log formatting, and git diff.</p>
</div>
<span class="topic-card__check" aria-hidden="true">&#10003;</span>
</a>
<a class="topic-card" href="branches-and-merging/" data-guide="branches-and-merging" data-topic="Git">
<span class="topic-card__number">4</span>
<div class="topic-card__body">
<div class="topic-card__title">Branches and Merging</div>
<div class="topic-card__meta">
<span class="meta-difficulty meta-difficulty--intermediate">Intermediate</span>
<span class="meta-time">40 min</span>
</div>
<p class="topic-card__description">Branches as movable pointers, not copies. Covers fast-forward vs three-way merges, conflict resolution, and git switch vs git checkout.</p>
</div>
<span class="topic-card__check" aria-hidden="true">&#10003;</span>
</a>
<h3>Core Workflows</h3>
<a class="topic-card" href="remote-repositories/" data-guide="remote-repositories" data-topic="Git">
<span class="topic-card__number">5</span>
<div class="topic-card__body">
<div class="topic-card__title">Remote Repositories</div>
<div class="topic-card__meta">
<span class="meta-difficulty meta-difficulty--intermediate">Intermediate</span>
<span class="meta-time">35 min</span>
</div>
<p class="topic-card__description">Working with code that lives somewhere else. Covers clone, fetch vs pull, push, tracking branches, and SSH vs HTTPS authentication.</p>
</div>
<span class="topic-card__check" aria-hidden="true">&#10003;</span>
</a>
<a class="topic-card" href="rewriting-history/" data-guide="rewriting-history" data-topic="Git">
<span class="topic-card__number">6</span>
<div class="topic-card__body">
<div class="topic-card__title">Rewriting History</div>
<div class="topic-card__meta">
<span class="meta-difficulty meta-difficulty--intermediate">Intermediate</span>
<span class="meta-time">40 min</span>
</div>
<p class="topic-card__description">When and how to clean up commit history. Covers amend, interactive rebase, cherry-pick, revert vs reset, and the reflog as a safety net.</p>
</div>
<span class="topic-card__check" aria-hidden="true">&#10003;</span>
</a>
<a class="topic-card" href="stashing-and-worktree/" data-guide="stashing-and-worktree" data-topic="Git">
<span class="topic-card__number">7</span>
<div class="topic-card__body">
<div class="topic-card__title">Stashing and the Worktree</div>
<div class="topic-card__meta">
<span class="meta-difficulty meta-difficulty--intermediate">Intermediate</span>
<span class="meta-time">30 min</span>
</div>
<p class="topic-card__description">Interrupting work without losing it. Covers git stash, multiple working trees with git worktree, and git clean.</p>
</div>
<span class="topic-card__check" aria-hidden="true">&#10003;</span>
</a>
<a class="topic-card" href="configuring-git/" data-guide="configuring-git" data-topic="Git">
<span class="topic-card__number">8</span>
<div class="topic-card__body">
<div class="topic-card__title">Configuring Git</div>
<div class="topic-card__meta">
<span class="meta-difficulty meta-difficulty--intermediate">Intermediate</span>
<span class="meta-time">35 min</span>
</div>
<p class="topic-card__description">Making Git work the way you want. Covers configuration levels, aliases, diff/merge tools, conditional includes, and .gitattributes.</p>
</div>
<span class="topic-card__check" aria-hidden="true">&#10003;</span>
</a>
<h3>Git Internals</h3>
<a class="topic-card" href="object-model/" data-guide="object-model" data-topic="Git">
<span class="topic-card__number">9</span>
<div class="topic-card__body">
<div class="topic-card__title">The Object Model</div>
<div class="topic-card__meta">
<span class="meta-difficulty meta-difficulty--advanced">Advanced</span>
<span class="meta-time">45 min</span>
</div>
<p class="topic-card__description">Git as a content-addressable filesystem. Covers blobs, trees, commits, annotated tags, SHA-1 hashing, and building commits with plumbing commands.</p>
</div>
<span class="topic-card__check" aria-hidden="true">&#10003;</span>
</a>
<a class="topic-card" href="refs-reflog-dag/" data-guide="refs-reflog-dag" data-topic="Git">
<span class="topic-card__number">10</span>
<div class="topic-card__body">
<div class="topic-card__title">Refs, the Reflog, and the DAG</div>
<div class="topic-card__meta">
<span class="meta-difficulty meta-difficulty--advanced">Advanced</span>
<span class="meta-time">40 min</span>
</div>
<p class="topic-card__description">How Git names things and connects them. Covers references, symbolic refs, the directed acyclic graph, garbage collection, and packfiles.</p>
</div>
<span class="topic-card__check" aria-hidden="true">&#10003;</span>
</a>
<a class="topic-card" href="transfer-protocols/" data-guide="transfer-protocols" data-topic="Git">
<span class="topic-card__number">11</span>
<div class="topic-card__body">
<div class="topic-card__title">Transfer Protocols and Plumbing</div>
<div class="topic-card__meta">
<span class="meta-difficulty meta-difficulty--advanced">Advanced</span>
<span class="meta-time">40 min</span>
</div>
<p class="topic-card__description">How fetch and push work at the protocol level. Covers SSH, smart HTTP, pack negotiation, shallow clones, and git bundle.</p>
</div>
<span class="topic-card__check" aria-hidden="true">&#10003;</span>
</a>
<h3>Platform Collaboration</h3>
<a class="topic-card" href="collaboration-workflows/" data-guide="collaboration-workflows" data-topic="Git">
<span class="topic-card__number">12</span>
<div class="topic-card__body">
<div class="topic-card__title">Collaboration Workflows</div>
<div class="topic-card__meta">
<span class="meta-difficulty meta-difficulty--intermediate">Intermediate</span>
<span class="meta-time">35 min</span>
</div>
<p class="topic-card__description">Choosing how your team works with Git. Covers centralized, feature branch, Gitflow, trunk-based, and forking workflows.</p>
</div>
<span class="topic-card__check" aria-hidden="true">&#10003;</span>
</a>
<a class="topic-card" href="platforms/" data-guide="platforms" data-topic="Git">
<span class="topic-card__number">13</span>
<div class="topic-card__body">
<div class="topic-card__title">GitHub, GitLab, and Bitbucket</div>
<div class="topic-card__meta">
<span class="meta-difficulty meta-difficulty--intermediate">Intermediate</span>
<span class="meta-time">35 min</span>
</div>
<p class="topic-card__description">Platform-specific features and tooling. Covers PRs vs MRs, CI/CD configuration, CLIs, code owners, and platform migration.</p>
</div>
<span class="topic-card__check" aria-hidden="true">&#10003;</span>
</a>
<h3>Advanced Operations</h3>
<a class="topic-card" href="hooks-and-automation/" data-guide="hooks-and-automation" data-topic="Git">
<span class="topic-card__number">14</span>
<div class="topic-card__body">
<div class="topic-card__title">Git Hooks and Automation</div>
<div class="topic-card__meta">
<span class="meta-difficulty meta-difficulty--advanced">Advanced</span>
<span class="meta-time">40 min</span>
</div>
<p class="topic-card__description">Automating quality checks and workflows. Covers every hook type, hook frameworks, git bisect, git blame, and smudge/clean filters.</p>
</div>
<span class="topic-card__check" aria-hidden="true">&#10003;</span>
</a>
<a class="topic-card" href="security/" data-guide="security" data-topic="Git">
<span class="topic-card__number">15</span>
<div class="topic-card__body">
<div class="topic-card__title">Git Security</div>
<div class="topic-card__meta">
<span class="meta-difficulty meta-difficulty--advanced">Advanced</span>
<span class="meta-time">35 min</span>
</div>
<p class="topic-card__description">Signing, credentials, and secret management. Covers GPG and SSH signing, credential helpers, secret scanning, and git filter-repo.</p>
</div>
<span class="topic-card__check" aria-hidden="true">&#10003;</span>
</a>
<a class="topic-card" href="monorepos-and-scaling/" data-guide="monorepos-and-scaling" data-topic="Git">
<span class="topic-card__number">16</span>
<div class="topic-card__body">
<div class="topic-card__title">Monorepos and Scaling Git</div>
<div class="topic-card__meta">
<span class="meta-difficulty meta-difficulty--advanced">Advanced</span>
<span class="meta-time">40 min</span>
</div>
<p class="topic-card__description">Git at enterprise scale. Covers sparse checkout, partial clones, commit graphs, Scalar, submodules vs subtrees, and build system integration.</p>
</div>
<span class="topic-card__check" aria-hidden="true">&#10003;</span>
</a>
<a class="topic-card" href="troubleshooting-and-recovery/" data-guide="troubleshooting-and-recovery" data-topic="Git">
<span class="topic-card__number">17</span>
<div class="topic-card__body">
<div class="topic-card__title">Troubleshooting and Recovery</div>
<div class="topic-card__meta">
<span class="meta-difficulty meta-difficulty--advanced">Advanced</span>
<span class="meta-time">40 min</span>
</div>
<p class="topic-card__description">The recovery playbook. Covers reflog recovery, undoing common mistakes, Git LFS, performance diagnosis, and repository corruption repair.</p>
</div>
<span class="topic-card__check" aria-hidden="true">&#10003;</span>
</a>
</div>
