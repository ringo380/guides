# Linux CLI Essentials

A comprehensive guide to working effectively on the Linux command line. These guides take you from "I can type commands" to understanding how the shell actually works and using it productively.

Each topic is covered in its own guide. Start anywhere - they're self-contained, but the order below follows a natural learning path.

<div class="diagram-container">
<img src="../assets/images/linux-essentials/learning-path.svg" alt="Linux Essentials learning path showing guide progression from fundamentals through file operations, system administration, and scripting">
</div>

---

## Guides

<div class="topic-progression">
<a class="topic-card" href="shell-basics/" data-guide="shell-basics" data-topic="Linux Essentials">
<span class="topic-card__number">1</span>
<span class="topic-card__badge">Start Here</span>
<div class="topic-card__body">
<div class="topic-card__title">Shell Basics</div>
<div class="topic-card__meta">
<span class="meta-difficulty meta-difficulty--beginner">Beginner</span>
<span class="meta-time">45 min</span>
</div>
<p class="topic-card__description">What the shell is, how it starts up, and how it processes your input. Covers shell types, configuration files, the PATH variable, variables, quoting rules, and shell expansions.</p>
</div>
<span class="topic-card__check" aria-hidden="true">&#10003;</span>
</a>
<a class="topic-card" href="streams-and-redirection/" data-guide="streams-and-redirection" data-topic="Linux Essentials">
<span class="topic-card__number">2</span>
<div class="topic-card__body">
<div class="topic-card__title">Streams and Redirection</div>
<div class="topic-card__meta">
<span class="meta-difficulty meta-difficulty--beginner">Beginner</span>
<span class="meta-time">30 min</span>
</div>
<p class="topic-card__description">How programs communicate through STDIN, STDOUT, and STDERR. Covers redirection, here documents, file descriptor manipulation, pipelines, and process substitution.</p>
</div>
<span class="topic-card__check" aria-hidden="true">&#10003;</span>
</a>
<a class="topic-card" href="text-processing/" data-guide="text-processing" data-topic="Linux Essentials">
<span class="topic-card__number">3</span>
<div class="topic-card__body">
<div class="topic-card__title">Text Processing</div>
<div class="topic-card__meta">
<span class="meta-difficulty meta-difficulty--intermediate">Intermediate</span>
<span class="meta-time">45 min</span>
</div>
<p class="topic-card__description">The core toolkit for searching, transforming, and analyzing text. Covers grep, sed, awk, cut, sort, uniq, tr, wc, head, tail, and tee.</p>
</div>
<span class="topic-card__check" aria-hidden="true">&#10003;</span>
</a>
<a class="topic-card" href="regular-expressions/" data-guide="regular-expressions" data-topic="Linux Essentials">
<span class="topic-card__number">4</span>
<div class="topic-card__body">
<div class="topic-card__title">Regular Expressions</div>
<div class="topic-card__meta">
<span class="meta-difficulty meta-difficulty--intermediate">Intermediate</span>
<span class="meta-time">40 min</span>
</div>
<p class="topic-card__description">The pattern-matching language used across Linux tools. Covers metacharacters, character classes, quantifiers, backreferences, BRE vs ERE vs PCRE, lookahead/lookbehind, and practical patterns.</p>
</div>
<span class="topic-card__check" aria-hidden="true">&#10003;</span>
</a>
<a class="topic-card" href="finding-files/" data-guide="finding-files" data-topic="Linux Essentials">
<span class="topic-card__number">5</span>
<div class="topic-card__body">
<div class="topic-card__title">Finding Files</div>
<div class="topic-card__meta">
<span class="meta-difficulty meta-difficulty--beginner">Beginner</span>
<span class="meta-time">25 min</span>
</div>
<p class="topic-card__description">Searching directory trees and operating on the results. Covers find (name, type, size, time, permission tests, logical operators, and actions) and xargs.</p>
</div>
<span class="topic-card__check" aria-hidden="true">&#10003;</span>
</a>
<a class="topic-card" href="file-permissions/" data-guide="file-permissions" data-topic="Linux Essentials">
<span class="topic-card__number">6</span>
<div class="topic-card__body">
<div class="topic-card__title">File Permissions</div>
<div class="topic-card__meta">
<span class="meta-difficulty meta-difficulty--beginner">Beginner</span>
<span class="meta-time">30 min</span>
</div>
<p class="topic-card__description">The Linux permission model explained. Covers chmod (symbolic and octal modes), chown, chgrp, umask, and special permission bits (setuid, setgid, sticky bit).</p>
</div>
<span class="topic-card__check" aria-hidden="true">&#10003;</span>
</a>
<a class="topic-card" href="job-control/" data-guide="job-control" data-topic="Linux Essentials">
<span class="topic-card__number">7</span>
<div class="topic-card__body">
<div class="topic-card__title">Job Control</div>
<div class="topic-card__meta">
<span class="meta-difficulty meta-difficulty--intermediate">Intermediate</span>
<span class="meta-time">30 min</span>
</div>
<p class="topic-card__description">Managing processes from the terminal. Covers foreground/background processes, signals, kill/killall/pkill, nohup, disown, ps, top/htop, and terminal multiplexers.</p>
</div>
<span class="topic-card__check" aria-hidden="true">&#10003;</span>
</a>
<a class="topic-card" href="scripting-fundamentals/" data-guide="scripting-fundamentals" data-topic="Linux Essentials">
<span class="topic-card__number">8</span>
<div class="topic-card__body">
<div class="topic-card__title">Scripting Fundamentals</div>
<div class="topic-card__meta">
<span class="meta-difficulty meta-difficulty--intermediate">Intermediate</span>
<span class="meta-time">45 min</span>
</div>
<p class="topic-card__description">Writing reliable bash scripts. Covers exit codes, conditionals, loops, functions, and error handling with set -euo pipefail and trap.</p>
</div>
<span class="topic-card__check" aria-hidden="true">&#10003;</span>
</a>
<a class="topic-card" href="disk-and-filesystem/" data-guide="disk-and-filesystem" data-topic="Linux Essentials">
<span class="topic-card__number">9</span>
<div class="topic-card__body">
<div class="topic-card__title">Disk and Filesystem</div>
<div class="topic-card__meta">
<span class="meta-difficulty meta-difficulty--intermediate">Intermediate</span>
<span class="meta-time">30 min</span>
</div>
<p class="topic-card__description">Managing storage. Covers df, du, mount/umount, /etc/fstab, lsblk, partition management with fdisk/parted, mkfs, and fsck.</p>
</div>
<span class="topic-card__check" aria-hidden="true">&#10003;</span>
</a>
<a class="topic-card" href="package-management/" data-guide="package-management" data-topic="Linux Essentials">
<span class="topic-card__number">10</span>
<div class="topic-card__body">
<div class="topic-card__title">Package Management</div>
<div class="topic-card__meta">
<span class="meta-difficulty meta-difficulty--intermediate">Intermediate</span>
<span class="meta-time">35 min</span>
</div>
<p class="topic-card__description">Installing, updating, and removing software. Covers apt and dnf workflows, low-level tools (dpkg, rpm), repository management, universal formats, and version pinning.</p>
</div>
<span class="topic-card__check" aria-hidden="true">&#10003;</span>
</a>
<a class="topic-card" href="system-services/" data-guide="system-services" data-topic="Linux Essentials">
<span class="topic-card__number">11</span>
<div class="topic-card__body">
<div class="topic-card__title">System Services</div>
<div class="topic-card__meta">
<span class="meta-difficulty meta-difficulty--intermediate">Intermediate</span>
<span class="meta-time">35 min</span>
</div>
<p class="topic-card__description">Managing services with systemd. Covers systemctl, unit file anatomy, writing custom services, journalctl log filtering, targets, and systemd timers.</p>
</div>
<span class="topic-card__check" aria-hidden="true">&#10003;</span>
</a>
<a class="topic-card" href="user-and-group-management/" data-guide="user-and-group-management" data-topic="Linux Essentials">
<span class="topic-card__number">12</span>
<div class="topic-card__body">
<div class="topic-card__title">User and Group Management</div>
<div class="topic-card__meta">
<span class="meta-difficulty meta-difficulty--intermediate">Intermediate</span>
<span class="meta-time">35 min</span>
</div>
<p class="topic-card__description">Managing users, groups, and access control. Covers useradd/usermod/userdel, /etc/passwd and /etc/shadow, group management, the sudo system, PAM basics, and user auditing.</p>
</div>
<span class="topic-card__check" aria-hidden="true">&#10003;</span>
</a>
<a class="topic-card" href="ssh-configuration/" data-guide="ssh-configuration" data-topic="Linux Essentials">
<span class="topic-card__number">13</span>
<div class="topic-card__body">
<div class="topic-card__title">SSH Configuration</div>
<div class="topic-card__meta">
<span class="meta-difficulty meta-difficulty--advanced">Advanced</span>
<span class="meta-time">45 min</span>
</div>
<p class="topic-card__description">Deep dive into SSH configuration and key management. Covers key generation, ssh-agent, ~/.ssh/config patterns, SSH certificates, sshd_config hardening, and port forwarding.</p>
</div>
<span class="topic-card__check" aria-hidden="true">&#10003;</span>
</a>
<a class="topic-card" href="log-management/" data-guide="log-management" data-topic="Linux Essentials">
<span class="topic-card__number">14</span>
<div class="topic-card__body">
<div class="topic-card__title">Log Management</div>
<div class="topic-card__meta">
<span class="meta-difficulty meta-difficulty--intermediate">Intermediate</span>
<span class="meta-time">30 min</span>
</div>
<p class="topic-card__description">Finding, filtering, and managing system logs. Covers /var/log/ structure, journalctl filtering, rsyslog configuration, logrotate setup, and structured log parsing.</p>
</div>
<span class="topic-card__check" aria-hidden="true">&#10003;</span>
</a>
<a class="topic-card" href="networking/" data-guide="networking" data-topic="Linux Essentials">
<span class="topic-card__number">15</span>
<div class="topic-card__body">
<div class="topic-card__title">Networking</div>
<div class="topic-card__meta">
<span class="meta-difficulty meta-difficulty--intermediate">Intermediate</span>
<span class="meta-time">35 min</span>
</div>
<p class="topic-card__description">Essential networking from the command line. Covers ping/traceroute/mtr, curl/wget, ssh, scp/rsync, ss/ip, dig/nslookup, and nc (netcat).</p>
</div>
<span class="topic-card__check" aria-hidden="true">&#10003;</span>
</a>
<a class="topic-card" href="system-information/" data-guide="system-information" data-topic="Linux Essentials">
<span class="topic-card__number">16</span>
<div class="topic-card__body">
<div class="topic-card__title">System Information</div>
<div class="topic-card__meta">
<span class="meta-difficulty meta-difficulty--beginner">Beginner</span>
<span class="meta-time">25 min</span>
</div>
<p class="topic-card__description">Understanding what's running on a system. Covers uname, uptime, free, lscpu, lsof, vmstat, the /proc and /sys virtual filesystems, and dmesg.</p>
</div>
<span class="topic-card__check" aria-hidden="true">&#10003;</span>
</a>
<a class="topic-card" href="archiving-and-compression/" data-guide="archiving-and-compression" data-topic="Linux Essentials">
<span class="topic-card__number">17</span>
<div class="topic-card__body">
<div class="topic-card__title">Archiving and Compression</div>
<div class="topic-card__meta">
<span class="meta-difficulty meta-difficulty--beginner">Beginner</span>
<span class="meta-time">20 min</span>
</div>
<p class="topic-card__description">Bundling and compressing files. Covers tar (with gzip, bzip2, and xz), standalone compression tools, zip/unzip, and guidance on when to use each format.</p>
</div>
<span class="topic-card__check" aria-hidden="true">&#10003;</span>
</a>
<a class="topic-card" href="best-practices/" data-guide="best-practices" data-topic="Linux Essentials">
<span class="topic-card__number">18</span>
<div class="topic-card__body">
<div class="topic-card__title">Best Practices</div>
<div class="topic-card__meta">
<span class="meta-difficulty meta-difficulty--intermediate">Intermediate</span>
<span class="meta-time">30 min</span>
</div>
<p class="topic-card__description">Conventions that prevent real bugs. Covers set -euo pipefail, quoting variables, [[ ]] vs [ ], $() vs backticks, mktemp, shellcheck, and a script template.</p>
</div>
<span class="topic-card__check" aria-hidden="true">&#10003;</span>
</a>
<a class="topic-card" href="cron-and-scheduled-tasks/" data-guide="cron-and-scheduled-tasks" data-topic="Linux Essentials">
<span class="topic-card__number">19</span>
<div class="topic-card__body">
<div class="topic-card__title">Cron and Scheduled Tasks</div>
<div class="topic-card__meta">
<span class="meta-difficulty meta-difficulty--intermediate">Intermediate</span>
<span class="meta-time">30 min</span>
</div>
<p class="topic-card__description">Automating recurring tasks. Covers cron daemon, crontab syntax, system crontab files, cron environment gotchas, anacron, and systemd timers as a modern alternative.</p>
</div>
<span class="topic-card__check" aria-hidden="true">&#10003;</span>
</a>
<a class="topic-card" href="firewall-fundamentals/" data-guide="firewall-fundamentals" data-topic="Linux Essentials">
<span class="topic-card__number">20</span>
<div class="topic-card__body">
<div class="topic-card__title">Firewall and Networking Security</div>
<div class="topic-card__meta">
<span class="meta-difficulty meta-difficulty--advanced">Advanced</span>
<span class="meta-time">40 min</span>
</div>
<p class="topic-card__description">Protecting your system from unauthorized network access. Covers the Netfilter framework, iptables, nftables, ufw, firewalld, default-deny policies, and stateful inspection.</p>
</div>
<span class="topic-card__check" aria-hidden="true">&#10003;</span>
</a>
</div>
