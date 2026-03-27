"""Tests for hooks/metadata.py — guide metadata banner injection."""

import json
import sys
from pathlib import Path
from unittest.mock import MagicMock

import pytest

sys.path.insert(0, str(Path(__file__).resolve().parent.parent / "hooks"))

from metadata import extract_metadata, build_banner_html, on_page_markdown


class TestExtractMetadata:
    """Frontmatter metadata fields are extracted correctly."""

    def test_extracts_difficulty(self):
        meta = {"difficulty": "beginner"}
        result = extract_metadata(meta)
        assert result["difficulty"] == "beginner"

    def test_extracts_time_estimate(self):
        meta = {"time_estimate": "30 min"}
        result = extract_metadata(meta)
        assert result["time_estimate"] == "30 min"

    def test_extracts_prerequisites(self):
        meta = {"prerequisites": ["shell-basics", "file-permissions"]}
        result = extract_metadata(meta)
        assert result["prerequisites"] == ["shell-basics", "file-permissions"]

    def test_extracts_learning_outcomes(self):
        meta = {"learning_outcomes": ["Navigate the filesystem", "Use cd and ls"]}
        result = extract_metadata(meta)
        assert result["learning_outcomes"] == ["Navigate the filesystem", "Use cd and ls"]

    def test_extracts_tags(self):
        meta = {"tags": ["cli", "linux"]}
        result = extract_metadata(meta)
        assert result["tags"] == ["cli", "linux"]

    def test_missing_fields_return_none(self):
        result = extract_metadata({})
        assert result["difficulty"] is None
        assert result["time_estimate"] is None
        assert result["prerequisites"] == []
        assert result["learning_outcomes"] == []
        assert result["tags"] == []

    def test_ignores_non_metadata_keys(self):
        meta = {"template": "home.html", "difficulty": "advanced"}
        result = extract_metadata(meta)
        assert result["difficulty"] == "advanced"
        assert "template" not in result


class TestBuildBannerHtml:
    """Banner HTML is generated from extracted metadata."""

    def test_difficulty_badge_rendered(self):
        meta = {"difficulty": "beginner", "time_estimate": None,
                "prerequisites": [], "learning_outcomes": [], "tags": []}
        html = build_banner_html(meta)
        assert 'class="meta-difficulty meta-difficulty--beginner"' in html
        assert "Beginner" in html

    def test_time_estimate_rendered(self):
        meta = {"difficulty": None, "time_estimate": "30 min",
                "prerequisites": [], "learning_outcomes": [], "tags": []}
        html = build_banner_html(meta)
        assert "30 min" in html
        assert 'class="meta-time"' in html

    def test_prerequisites_rendered_as_links(self):
        meta = {"difficulty": None, "time_estimate": None,
                "prerequisites": ["shell-basics"], "learning_outcomes": [], "tags": []}
        html = build_banner_html(meta)
        assert "shell-basics" in html
        assert 'class="meta-prerequisites"' in html

    def test_learning_outcomes_rendered(self):
        meta = {"difficulty": None, "time_estimate": None,
                "prerequisites": [], "learning_outcomes": ["Use the shell"], "tags": []}
        html = build_banner_html(meta)
        assert "Use the shell" in html
        assert 'class="meta-outcomes"' in html

    def test_tags_rendered(self):
        meta = {"difficulty": None, "time_estimate": None,
                "prerequisites": [], "learning_outcomes": [], "tags": ["cli", "linux"]}
        html = build_banner_html(meta)
        assert "cli" in html
        assert "linux" in html
        assert 'class="meta-tag"' in html

    def test_empty_metadata_returns_empty_string(self):
        meta = {"difficulty": None, "time_estimate": None,
                "prerequisites": [], "learning_outcomes": [], "tags": []}
        html = build_banner_html(meta)
        assert html == ""

    def test_banner_has_wrapper_div(self):
        meta = {"difficulty": "intermediate", "time_estimate": "45 min",
                "prerequisites": [], "learning_outcomes": [], "tags": []}
        html = build_banner_html(meta)
        assert html.startswith('<div class="guide-metadata"')
        assert 'role="region"' in html
        assert html.strip().endswith("</div>")


class TestOnPageMarkdown:
    """MkDocs hook injects banner after first heading."""

    def _make_page(self, meta=None):
        """Create a mock MkDocs page object."""
        page = MagicMock()
        page.meta = meta or {}
        page.is_homepage = False
        return page

    def test_banner_injected_after_first_h1(self):
        md = "# Shell Basics\n\nSome content here."
        page = self._make_page({"difficulty": "beginner"})
        result = on_page_markdown(md, page=page)
        assert result.startswith("# Shell Basics\n")
        assert '<div class="guide-metadata"' in result
        assert "Some content here." in result

    def test_no_metadata_returns_unchanged(self):
        md = "# Shell Basics\n\nSome content here."
        page = self._make_page({})
        result = on_page_markdown(md, page=page)
        assert result == md

    def test_homepage_skipped(self):
        md = "# Home\n\nWelcome."
        page = self._make_page({"difficulty": "beginner"})
        page.is_homepage = True
        result = on_page_markdown(md, page=page)
        assert result == md

    def test_no_h1_still_injects_at_top(self):
        md = "Some content without heading."
        page = self._make_page({"difficulty": "advanced"})
        result = on_page_markdown(md, page=page)
        assert result.startswith('<div class="guide-metadata"')
