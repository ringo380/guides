"""Tests for hooks/interactive.py — the MkDocs fence-to-HTML transformer."""

import json
import re
import sys
from pathlib import Path

import pytest

# Make hooks/ importable
sys.path.insert(0, str(Path(__file__).resolve().parent.parent / "hooks"))

from interactive import FENCE_RE, FENCE_TYPES, _fence_to_html, on_page_markdown


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _extract_config(html: str) -> dict:
    """Pull the JSON config back out of a rendered div's data-config attribute."""
    m = re.search(r'data-config="([^"]*)"', html)
    assert m, f"No data-config found in: {html}"
    raw = m.group(1).replace("&amp;", "&").replace("&quot;", '"').replace("&#39;", "'")
    return json.loads(raw)


def _make_fence(fence_type: str, yaml_body: str, backticks: str = "```") -> str:
    return f"{backticks}{fence_type}\n{yaml_body}\n{backticks}"


# ---------------------------------------------------------------------------
# Fence detection
# ---------------------------------------------------------------------------

class TestFenceDetection:
    """FENCE_RE pattern matching and on_page_markdown substitution."""

    @pytest.mark.parametrize("fence_type", FENCE_TYPES)
    def test_each_fence_type_produces_correct_class(self, fence_type):
        md = _make_fence(fence_type, "title: Test")
        result = on_page_markdown(md)
        assert f'class="interactive-{fence_type}"' in result

    def test_four_backtick_fence(self):
        md = _make_fence("quiz", "question: Four ticks?", backticks="````")
        result = on_page_markdown(md)
        assert 'class="interactive-quiz"' in result

    def test_non_interactive_fence_untouched(self):
        md = "```python\nprint('hi')\n```"
        assert on_page_markdown(md) == md

    def test_regular_markdown_preserved(self):
        md = "# Heading\n\nSome text.\n"
        assert on_page_markdown(md) == md

    def test_multiple_fences_all_transformed(self):
        md = (
            _make_fence("quiz", "question: Q1")
            + "\n\nSome text.\n\n"
            + _make_fence("terminal", "title: T1")
        )
        result = on_page_markdown(md)
        assert 'class="interactive-quiz"' in result
        assert 'class="interactive-terminal"' in result
        assert "Some text." in result

    def test_surrounding_markdown_preserved(self):
        md = "Before\n\n" + _make_fence("exercise", "title: E") + "\n\nAfter"
        result = on_page_markdown(md)
        assert result.startswith("Before\n\n")
        assert "After" in result
        assert 'class="interactive-exercise"' in result


# ---------------------------------------------------------------------------
# YAML parsing
# ---------------------------------------------------------------------------

class TestYamlParsing:
    """YAML content within fences is parsed correctly."""

    def test_valid_yaml_parsed(self):
        md = _make_fence("quiz", 'question: "What?"\ntype: multiple-choice')
        result = on_page_markdown(md)
        config = _extract_config(result)
        assert config["question"] == "What?"
        assert config["type"] == "multiple-choice"

    def test_invalid_yaml_produces_warning(self):
        md = _make_fence("quiz", ":\n  bad:\n    - [unclosed")
        result = on_page_markdown(md)
        assert "admonition warning" in result
        assert "Invalid interactive component configuration" in result

    def test_empty_yaml_produces_empty_config(self):
        md = _make_fence("terminal", "")
        result = on_page_markdown(md)
        config = _extract_config(result)
        assert config == {}


# ---------------------------------------------------------------------------
# JSON escaping / HTML attribute safety
# ---------------------------------------------------------------------------

class TestJsonEscaping:
    """Config values are safely embedded in HTML attributes."""

    def test_double_quotes_escaped(self):
        md = _make_fence("quiz", 'question: \'She said "hello"\'')
        result = on_page_markdown(md)
        assert "&quot;" in result
        config = _extract_config(result)
        assert '"hello"' in config["question"]

    def test_ampersand_escaped(self):
        md = _make_fence("quiz", "question: A & B")
        result = on_page_markdown(md)
        assert "&amp;" in result
        config = _extract_config(result)
        assert config["question"] == "A & B"

    def test_single_quote_escaped(self):
        md = _make_fence("quiz", "question: it's fine")
        result = on_page_markdown(md)
        assert "&#39;" in result
        config = _extract_config(result)
        assert config["question"] == "it's fine"

    def test_unicode_preserved(self):
        md = _make_fence("quiz", "question: Ça marche?")
        result = on_page_markdown(md)
        config = _extract_config(result)
        assert config["question"] == "Ça marche?"


# ---------------------------------------------------------------------------
# Title extraction
# ---------------------------------------------------------------------------

class TestTitleExtraction:
    """Noscript title is derived from config or fence type."""

    def test_title_key_preferred(self):
        md = _make_fence("terminal", "title: My Terminal")
        result = on_page_markdown(md)
        assert "<strong>My Terminal</strong>" in result

    def test_question_key_fallback(self):
        md = _make_fence("quiz", "question: What is Git?")
        result = on_page_markdown(md)
        assert "<strong>What is Git?</strong>" in result

    def test_fence_type_fallback(self):
        md = _make_fence("command-builder", "base: ls")
        result = on_page_markdown(md)
        assert "<strong>Command Builder</strong>" in result


# ---------------------------------------------------------------------------
# Noscript fallback
# ---------------------------------------------------------------------------

class TestNoscriptFallback:
    """Each div includes a noscript element."""

    @pytest.mark.parametrize("fence_type", FENCE_TYPES)
    def test_noscript_present(self, fence_type):
        md = _make_fence(fence_type, "title: Test")
        result = on_page_markdown(md)
        assert "<noscript>" in result
        assert "(requires JavaScript)" in result
