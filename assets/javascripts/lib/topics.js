/* SPDX-License-Identifier: MIT */
/* Copyright (c) 2025-2026 Robworks Software LLC */

/**
 * Shared topic map used by progress.js and analytics-journey.js.
 * Exports window.RunbookTopics.
 */

(function () {
  "use strict";

  window.RunbookTopics = {
    "Linux Essentials": {
      prefix: "Linux Essentials/",
      guides: [
        "shell-basics",
        "streams-and-redirection",
        "text-processing",
        "finding-files",
        "file-permissions",
        "job-control",
        "scripting-fundamentals",
        "disk-and-filesystem",
        "networking",
        "system-information",
        "archiving-and-compression",
        "best-practices",
      ],
    },
    "DNS Administration": {
      prefix: "DNS Administration/",
      guides: [
        "dns-fundamentals",
        "zone-files-and-records",
        "dns-tools",
        "bind",
        "nsd-and-unbound",
        "powerdns",
        "dnssec",
        "dns-architecture",
      ],
    },
    "Dev Zero/Perl": {
      prefix: "Dev Zero/Perl/",
      guides: [
        "perl_dev0_introduction",
        "scalars-strings-numbers",
        "arrays-hashes-lists",
        "control-flow",
        "regular-expressions",
        "subroutines-references",
        "file-io-and-system",
        "modules-and-cpan",
        "object-oriented-perl",
        "error-handling-debugging",
        "testing",
        "text-processing-oneliners",
        "networking-daemons",
        "web-frameworks-apis",
        "perl_developer_roadmap",
      ],
    },
    Databases: {
      prefix: "Databases/",
      guides: [
        "database-fundamentals",
        "sql-essentials",
        "database-design",
        "mysql-installation-and-configuration",
        "mysql-administration",
        "mysql-performance",
        "mysql-replication",
        "postgresql-fundamentals",
        "postgresql-administration",
        "postgresql-advanced",
        "nosql-concepts",
        "mongodb",
        "redis",
        "backup-and-recovery",
        "database-security",
        "scaling-and-architecture",
        "innodb-recovery-pdrt",
      ],
    },
    Git: {
      prefix: "Git/",
      guides: [
        "introduction",
        "three-trees",
        "commits-and-history",
        "branches-and-merging",
        "remote-repositories",
        "rewriting-history",
        "stashing-and-worktree",
        "configuring-git",
        "object-model",
        "refs-reflog-dag",
        "transfer-protocols",
        "collaboration-workflows",
        "platforms",
        "hooks-and-automation",
        "security",
        "monorepos-and-scaling",
        "troubleshooting-and-recovery",
      ],
    },
  };
})();
