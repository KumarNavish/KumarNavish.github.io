"""Tests for GitHub ingest fallback behavior."""

from __future__ import annotations

import json
from pathlib import Path

import pytest

from pipeline.ingest.github import RAW_ARTIFACT_RELATIVE_PATH, ingest_github_repositories


def test_ingest_uses_sample_when_live_and_cache_unavailable(
    monkeypatch: pytest.MonkeyPatch,
    tmp_path: Path,
) -> None:
    """If live fetch fails and no cache exists, fallback should use bundled sample."""

    def _raise_failure(*args: object, **kwargs: object) -> object:
        raise RuntimeError("network unavailable")

    monkeypatch.setattr("pipeline.ingest.github._fetch_repositories_live", _raise_failure)

    result = ingest_github_repositories(username="KumarNavish", out_dir=tmp_path)

    assert result.source == "sample"
    assert result.warning is not None
    assert len(result.repos) >= 3
    assert (tmp_path / RAW_ARTIFACT_RELATIVE_PATH).exists()


def test_ingest_uses_cache_before_sample(monkeypatch: pytest.MonkeyPatch, tmp_path: Path) -> None:
    """If live fetch fails but cache exists, fallback should reuse cache payload."""
    cache_path = tmp_path / RAW_ARTIFACT_RELATIVE_PATH
    cache_path.parent.mkdir(parents=True, exist_ok=True)
    cache_payload = {
        "username": "KumarNavish",
        "source": "github_api",
        "fetched_at": "2026-02-14T00:00:00+00:00",
        "repo_count": 1,
        "repos": [
            {
                "name": "cached-repo",
                "html_url": "https://github.com/KumarNavish/cached-repo",
                "description": "cached payload",
                "topics": ["cached"],
                "language": "Python",
                "languages": {"Python": 10},
                "stargazers_count": 0,
                "forks_count": 0,
                "pushed_at": "2026-02-10T00:00:00Z",
                "homepage": None,
            }
        ],
    }
    cache_path.write_text(json.dumps(cache_payload), encoding="utf-8")

    def _raise_failure(*args: object, **kwargs: object) -> object:
        raise RuntimeError("api down")

    monkeypatch.setattr("pipeline.ingest.github._fetch_repositories_live", _raise_failure)

    result = ingest_github_repositories(username="KumarNavish", out_dir=tmp_path)

    assert result.source == "cache"
    assert result.repos[0]["name"] == "cached-repo"
    assert result.warning is not None

