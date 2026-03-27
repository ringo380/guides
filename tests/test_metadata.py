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
