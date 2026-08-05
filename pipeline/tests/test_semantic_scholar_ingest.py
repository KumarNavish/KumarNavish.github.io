"""Tests for Semantic Scholar ingestion fallback behavior."""

from __future__ import annotations

import json
from pathlib import Path

import pytest

from pipeline.ingest.semantic_scholar import RAW_ARTIFACT_RELATIVE_PATH, ingest_semantic_scholar_publications


def test_ingest_uses_overrides_when_author_id_missing(tmp_path: Path) -> None:
    """Missing author id should degrade gracefully to overrides."""
    overrides = [
        {
            "id": "override-1",
            "title": "Override Publication",
            "year": 2025,
            "citation_count": 3,
            "source": "override",
        }
    ]

    result = ingest_semantic_scholar_publications(
        author_id="",
        out_dir=tmp_path,
        overrides=overrides,
    )

    assert result.source == "overrides"
    assert result.warning is not None
    assert "missing" in result.warning.lower()
    assert len(result.publications) == 1
    assert (tmp_path / RAW_ARTIFACT_RELATIVE_PATH).exists()


def test_ingest_uses_cache_on_api_failure(monkeypatch: pytest.MonkeyPatch, tmp_path: Path) -> None:
    """When API fails and cache exists, ingest should fallback to cache."""
    cache_path = tmp_path / RAW_ARTIFACT_RELATIVE_PATH
    cache_path.parent.mkdir(parents=True, exist_ok=True)
    cache_payload = {
        "source": "semantic_scholar_api",
        "fetched_at": "2026-02-14T00:00:00+00:00",
        "author_id": "author-xyz",
        "citation_count_total": 9,
        "citations_by_year": [{"year": 2024, "citations": 9}],
        "publications": [
            {
                "id": "cached",
                "title": "Cached Publication",
                "year": 2024,
                "citation_count": 9,
                "source": "semantic_scholar",
            }
        ],
    }
    cache_path.write_text(json.dumps(cache_payload), encoding="utf-8")

    def _raise_failure(*args: object, **kwargs: object) -> object:
        raise RuntimeError("api unavailable")

    monkeypatch.setattr("pipeline.ingest.semantic_scholar._fetch_author_payload", _raise_failure)

    result = ingest_semantic_scholar_publications(
        author_id="author-xyz",
        out_dir=tmp_path,
        overrides=[],
    )

    assert result.source == "cache"
    assert result.warning is not None
    assert result.citation_count_total == 9
    assert result.publications[0]["id"] == "cached"

