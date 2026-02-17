#!/bin/bash
# Creates a docs/ directory with symlinks to source content.
# MkDocs requires docs_dir to be separate from the config file location.
# Run this before `mkdocs serve` for local development.

set -euo pipefail

REPO_ROOT="$(cd "$(dirname "$0")" && pwd)"

rm -rf "$REPO_ROOT/docs"
mkdir -p "$REPO_ROOT/docs"

ln -s "$REPO_ROOT/README.md" "$REPO_ROOT/docs/README.md"
ln -s "$REPO_ROOT/Linux Essentials" "$REPO_ROOT/docs/Linux Essentials"
ln -s "$REPO_ROOT/DNS Administration" "$REPO_ROOT/docs/DNS Administration"
ln -s "$REPO_ROOT/Git" "$REPO_ROOT/docs/Git"
ln -s "$REPO_ROOT/Databases" "$REPO_ROOT/docs/Databases"
ln -s "$REPO_ROOT/Dev Zero" "$REPO_ROOT/docs/Dev Zero"
