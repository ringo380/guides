# SPDX-License-Identifier: MIT
# Copyright (c) 2025-2026 Robworks Software LLC

"""MkDocs hook that converts custom interactive fences to HTML divs.

Supported fence types: quiz, terminal, command-builder, exercise, code-walkthrough

Each fence contains YAML that gets parsed and embedded as a JSON data attribute
on a div element. The corresponding JS component picks it up on page load.
"""

import json
import re

import yaml

FENCE_TYPES = ("quiz", "terminal", "command-builder", "exercise", "code-walkthrough")

# Match ```<type>\n<yaml>\n``` blocks. Handles optional leading whitespace and
# fences with 3+ backticks.
FENCE_RE = re.compile(
    r"^(`{3,})("
    + "|".join(re.escape(t) for t in FENCE_TYPES)
    + r")\s*\n(.*?)\n\1\s*$",
    re.MULTILINE | re.DOTALL,
)


def _fence_to_html(match: re.Match) -> str:
    """Convert a single fence match to an HTML div with embedded config."""
    fence_type = match.group(2)
    yaml_content = match.group(3)

    try:
        config = yaml.safe_load(yaml_content)
    except yaml.YAMLError:
        # If YAML is invalid, render as a warning
        return (
            f'<div class="admonition warning">'
            f"<p>Invalid interactive component configuration ({fence_type})</p>"
            f"</div>"
        )

    if config is None:
        config = {}

    config_json = json.dumps(config, ensure_ascii=False)
    # Escape for safe embedding in an HTML attribute
    config_attr = config_json.replace("&", "&amp;").replace("'", "&#39;").replace('"', "&quot;")

    title = config.get("title", config.get("question", fence_type.replace("-", " ").title()))

    # Build noscript fallback
    noscript = f"<noscript><p><strong>{title}</strong> (requires JavaScript)</p></noscript>"

    return (
        f'<div class="interactive-{fence_type}" data-config="{config_attr}">'
        f"{noscript}"
        f"</div>"
    )


def on_page_markdown(markdown: str, **kwargs) -> str:
    """MkDocs hook entry point: transform custom fences in page markdown."""
    return FENCE_RE.sub(_fence_to_html, markdown)
