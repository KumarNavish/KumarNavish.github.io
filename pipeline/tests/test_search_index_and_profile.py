"""Tests for search index and profile emitters."""

from __future__ import annotations

from pipeline.emit import build_profile, build_search_index


def test_search_index_includes_projects_and_publications() -> None:
    """Search index should contain both project and publication documents."""
    projects = [
        {
            "name": "CL-PLO",
            "description": "Continual learning policy optimization experiments.",
            "one_line": "Research sandbox",
            "tags": ["continual-learning", "optimization"],
            "topics": ["continual-learning"],
            "language_breakdown": {"Python": 100},
            "html_url": "https://github.com/KumarNavish/CL-PLO",
        }
    ]
    publications = [
        {
            "id": "paper-1",
            "title": "Optimization Guarantees",
            "venue": "arXiv",
            "year": 2025,
            "keywords": ["optimization", "variational inference"],
            "authors": ["N Kumar"],
            "url": "https://arxiv.org/abs/1234.5678",
        }
    ]

    payload = build_search_index(
        projects=projects,
        publications=publications,
        generated_at="2026-02-14T00:00:00+00:00",
        source_provenance={
            "projects_source": "github_api",
            "publications_source": "overrides",
        },
    )

    assert payload["document_count"] == 2
    assert {doc["type"] for doc in payload["documents"]} == {"project", "publication"}
    terms = payload["postings"].keys()
    assert "continual" in terms
    assert "optimization" in terms
    assert "guarantees" in terms


def test_profile_includes_last_run_and_source_provenance() -> None:
    """Profile payload should expose last run timestamp and provenance metadata."""
    profile = build_profile(
        config={
            "github_username": "KumarNavish",
            "semantic_scholar_author_id": "",
            "site_title": "Navish Kumar | Research Systems",
            "timezone": "Europe/Zurich",
            "refresh_policy": "weekly",
        },
        projects_payload={
            "source": "github_api",
            "items": [
                {
                    "name": "CL-PLO",
                    "featured": True,
                    "stars": 10,
                    "one_line": "Research sandbox",
                    "html_url": "https://github.com/KumarNavish/CL-PLO",
                    "demo_url": "https://kumarnavish.github.io/CL-PLO/",
                }
            ],
        },
        publications_payload={
            "source": "overrides",
            "items": [
                {
                    "id": "paper-1",
                    "title": "Optimization Guarantees",
                    "year": 2025,
                    "venue": "arXiv",
                    "citation_count": 1,
                    "url": "https://arxiv.org/abs/1234.5678",
                }
            ],
        },
        metrics_payload={
            "source": "overrides",
            "works_count": 1,
            "citations_total": 1,
        },
        last_run_timestamp="2026-02-14T00:00:00+00:00",
        generated_at="2026-02-14T00:00:00+00:00",
    )

    assert profile["last_sync"]["last_run_timestamp"] == "2026-02-14T00:00:00+00:00"
    assert profile["source_provenance"]["projects_source"] == "github_api"
    assert profile["source_provenance"]["publications_source"] == "overrides"
    assert profile["counts"]["projects"] == 1
    assert profile["counts"]["publications"] == 1

