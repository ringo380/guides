# Perl: Zero to Expert

A comprehensive course that takes you from Unix foundations through professional Perl development. Each guide builds on the last, with interactive quizzes, terminal simulations, code walkthroughs, and hands-on exercises throughout.

---

## Foundations

### [Introduction: Why Perl, and Why Unix First](perl_dev0_introduction.md)

The operating system Perl was born on. Covers Unix processes, file descriptors, signals, and why understanding the kernel layer makes Perl's I/O model intuitive. Includes your first Perl commands and a walkthrough of a basic script's anatomy.

### [Scalars, Strings, and Numbers](scalars-strings-numbers.md)

Perl's fundamental data type. Covers the `$` sigil, string interpolation, heredocs, numeric types, scalar vs. list context, string manipulation functions, `undef` and truthiness, and the special variables (`$_`, `$!`, `$@`) that make Perl concise.

### [Arrays, Hashes, and Lists](arrays-hashes-lists.md)

Perl's aggregate data types. Covers `@arrays` and `%hashes`, list operations, slices, iteration patterns, sorting with custom comparators, `map`/`grep`/`join`/`split`, and an introduction to nested data structures.

### [Control Flow](control-flow.md)

Directing program logic. Covers `if`/`elsif`/`else`, `unless`, loops (`while`/`until`/`for`/`foreach`), statement modifiers, loop control with labels (`next`/`last`/`redo`), and short-circuit operators.

## Core Language

### [Regular Expressions](regular-expressions.md)

Perl's signature feature. Covers matching (`m//`), substitution (`s///`), quantifiers, character classes, anchors, captures, backreferences, lookahead/lookbehind, the `/g`, `/x`, `/e` modifiers, and `split` with regex.

### [Subroutines and References](subroutines-references.md)

Building reusable code and complex data. Covers `sub` declarations, `@_` and argument handling, return values, references and dereferencing, anonymous data structures, closures, and `sort` with custom subroutines.

### [File I/O and System Interaction](file-io-and-system.md)

Reading, writing, and interacting with the OS. Covers `open`/`close`, file modes, the diamond operator (`<>`), directory operations, file tests (`-e`, `-f`, `-d`), `stat`, `system`/backticks/`open`-pipe, and `fork`/`exec`/`wait`.

## Professional Practice

### [Modules and CPAN](modules-and-cpan.md)

Code organization and the Perl ecosystem. Covers `use`/`require`, writing modules, `@INC` and module paths, namespaces, Exporter, `cpanm`, finding and evaluating CPAN modules, and `Dist::Zilla` for distribution management.

### [Object-Oriented Perl](object-oriented-perl.md)

Perl's OOP model. Covers `bless`, constructors, methods, inheritance (`@ISA`/`use parent`), accessor generation, `Moose`/`Moo` for modern OOP, roles, type constraints, and when to use OOP vs. procedural Perl.

### [Error Handling and Debugging](error-handling-debugging.md)

Writing resilient code and finding bugs. Covers `die`/`warn`/`eval`, `Try::Tiny`, `$@` and error propagation, `use strict`/`use warnings`, the Perl debugger (`perl -d`), `Devel::` modules, and logging strategies.

## Applied Perl

### [Testing](testing.md)

Perl's testing culture. Covers `Test::More`, `prove`, TAP protocol, test organization, `Test2::Suite`, mocking, test coverage with `Devel::Cover`, and integrating tests with CI/CD pipelines.

### [Text Processing and One-Liners](text-processing-oneliners.md)

Perl as a command-line power tool. Covers `-n`, `-p`, `-l`, `-a`, `-e` flags, field processing, in-place editing (`-i`), log parsing, CSV/TSV manipulation, and building complex one-liners incrementally.

### [Networking and Daemons](networking-daemons.md)

Network programming and background services. Covers `IO::Socket`, client-server patterns, HTTP with `HTTP::Tiny` and `LWP`, `Mojolicious::UserAgent`, writing daemons, PID management, signal handling, and process supervision.

### [Web Frameworks and APIs](web-frameworks-apis.md)

Building web applications. Covers PSGI/Plack, `Mojolicious` (routes, templates, WebSockets), `Dancer2`, RESTful API design, JSON handling, middleware, authentication patterns, and deployment.

## Reference

### [Developer Roadmap](perl_developer_roadmap.md)

The full learning path from operating system fundamentals through professional Perl development. Phase-by-phase progression with book recommendations, community resources, and career milestones.
