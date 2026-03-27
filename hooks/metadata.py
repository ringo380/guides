# SPDX-License-Identifier: MIT
# Copyright (c) 2025-2026 Robworks Software LLC

"""MkDocs hook that injects guide metadata banners from YAML frontmatter.

Reads difficulty, time_estimate, prerequisites, learning_outcomes, and tags
from page metadata and renders a banner div below the page title.
"""

METADATA_FIELDS = ("difficulty", "time_estimate", "prerequisites", "learning_outcomes", "tags")
LIST_FIELDS = ("prerequisites", "learning_outcomes", "tags")


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


def build_banner_html(metadata: dict) -> str:
    """Build an HTML banner string from extracted metadata.

    Stub — will be implemented in Task 2.
    """
    raise NotImplementedError("build_banner_html is not yet implemented")


def on_page_markdown(markdown: str, *, page, config, files) -> str:
    """MkDocs hook entry point: inject metadata banner into page markdown.

    Stub — will be implemented in Task 3.
    """
    raise NotImplementedError("on_page_markdown is not yet implemented")
