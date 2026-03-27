# SPDX-License-Identifier: MIT
# Copyright (c) 2025-2026 Robworks Software LLC

"""MkDocs hook that injects guide metadata banners from YAML frontmatter.

Reads difficulty, time_estimate, prerequisites, learning_outcomes, and tags
from page metadata and renders a banner div below the page title.
"""

import html as html_mod

METADATA_FIELDS = ("difficulty", "time_estimate", "prerequisites", "learning_outcomes", "tags")
LIST_FIELDS = ("prerequisites", "learning_outcomes", "tags")

DIFFICULTY_LABELS = {
    "beginner": "Beginner",
    "intermediate": "Intermediate",
    "advanced": "Advanced",
}


def extract_metadata(meta: dict) -> dict:
    """Extract recognized metadata fields from page frontmatter."""
    result = {}
    for field in METADATA_FIELDS:
        value = meta.get(field)
        if field in LIST_FIELDS:
            result[field] = value if isinstance(value, list) else []
        else:
            result[field] = value
    return result


def build_banner_html(meta: dict) -> str:
    """Build an HTML banner div from extracted metadata."""
    parts = []

    # Difficulty badge
    difficulty = meta.get("difficulty")
    if difficulty and difficulty in DIFFICULTY_LABELS:
        label = DIFFICULTY_LABELS[difficulty]
        parts.append(
            f'<span class="meta-difficulty meta-difficulty--{difficulty}">'
            f"{label}</span>"
        )

    # Time estimate
    time_est = meta.get("time_estimate")
    if time_est:
        escaped = html_mod.escape(str(time_est))
        parts.append(f'<span class="meta-time">{escaped}</span>')

    # Prerequisites
    prereqs = meta.get("prerequisites", [])
    if prereqs:
        links = []
        for p in prereqs:
            escaped = html_mod.escape(str(p))
            links.append(f'<a href="{escaped}.md" class="meta-prereq-link">{escaped}</a>')
        parts.append(
            '<span class="meta-prerequisites">Prereqs: '
            + ", ".join(links)
            + "</span>"
        )

    # Tags
    tags = meta.get("tags", [])
    if tags:
        tag_spans = [
            f'<span class="meta-tag">{html_mod.escape(str(t))}</span>' for t in tags
        ]
        parts.append('<span class="meta-tags">' + " ".join(tag_spans) + "</span>")

    # Learning outcomes (collapsible details)
    outcomes = meta.get("learning_outcomes", [])
    if outcomes:
        items = "".join(f"<li>{html_mod.escape(str(o))}</li>" for o in outcomes)
        parts.append(
            '<details class="meta-outcomes">'
            "<summary>Learning outcomes</summary>"
            f"<ul>{items}</ul>"
            "</details>"
        )

    if not parts:
        return ""

    return (
        '<div class="guide-metadata" role="region" aria-label="Guide metadata">'
        + "".join(parts)
        + "</div>"
    )


def on_page_markdown(markdown: str, *, page, config, files) -> str:
    """MkDocs hook entry point: inject metadata banner into page markdown.

    Stub — will be implemented in Task 3.
    """
    raise NotImplementedError("on_page_markdown is not yet implemented")
