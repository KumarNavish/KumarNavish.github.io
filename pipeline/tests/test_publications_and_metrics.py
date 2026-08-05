"""Tests for publication normalization and metrics computation."""

from __future__ import annotations

from pipeline.transform.metrics import compute_metrics
from pipeline.transform.publications import normalize_publications


def test_publication_normalization_schema_and_order() -> None:
    """Normalized publications should match schema and deterministic ordering."""
    raw_records = [
        {
            "id": "paper-b",
            "title": "B Paper",
            "year": 2021,
            "venue": "Venue X",
            "citation_count": 2,
            "authors": [{"name": "Alice"}, {"name": "Bob"}],
            "fieldsOfStudy": ["Optimization", "Machine Learning"],
            "url": "https://example.com/b",
            "source": "semantic_scholar",
        },
        {
            "id": "paper-a",
            "title": "A Paper",
            "year": 2024,
            "venue": "Venue Y",
            "citation_count": 1,
            "authors": "Carol, Dan",
            "keywords": ["Continual Learning", "Optimization"],
            "url": "https://example.com/a",
            "pdf_url": "https://example.com/a.pdf",
            "source": "override",
        },
    ]

    normalized = normalize_publications(raw_records)
    assert [item["id"] for item in normalized] == ["paper-a", "paper-b"]

    required_keys = {
        "id",
        "title",
        "year",
        "venue",
        "citation_count",
        "authors",
        "keywords",
        "url",
        "pdf_url",
        "summary",
        "source",
    }
    for item in normalized:
        assert required_keys.issubset(item.keys())
        assert isinstance(item["id"], str)
        assert isinstance(item["title"], str)
        assert item["year"] is None or isinstance(item["year"], int)
        assert isinstance(item["authors"], list)
        assert isinstance(item["keywords"], list)


def test_metrics_are_deterministic_from_fixture() -> None:
    """Metrics should be deterministic for fixed publication fixture."""
    publications = normalize_publications(
        [
            {
                "id": "p1",
                "title": "Paper One",
                "year": 2024,
                "venue": "Conference A",
                "citation_count": 10,
                "authors": ["A"],
                "keywords": ["continual learning", "optimization"],
                "source": "semantic_scholar",
            },
            {
                "id": "p2",
                "title": "Paper Two",
                "year": 2023,
                "venue": "Conference A",
                "citation_count": 5,
                "authors": ["B"],
                "keywords": ["optimization"],
                "source": "semantic_scholar",
            },
            {
                "id": "p3",
                "title": "Paper Three",
                "year": 2021,
                "venue": "Journal B",
                "citation_count": 2,
                "authors": ["C"],
                "keywords": ["graph theory"],
                "source": "semantic_scholar",
            },
        ]
    )

    metrics = compute_metrics(
        publications=publications,
        citations_total_hint=17,
        citations_by_year=[
            {"year": 2022, "citationCount": 4},
            {"year": 2023, "citationCount": 6},
            {"year": 2024, "citationCount": 7},
        ],
        source="semantic_scholar_api",
    )

    assert metrics["source"] == "semantic_scholar_api"
    assert metrics["works_count"] == 3
    assert metrics["citations_total"] == 17
    assert metrics["citations_by_year"] == [
        {"year": 2022, "citations": 4},
        {"year": 2023, "citations": 6},
        {"year": 2024, "citations": 7},
    ]
    assert metrics["top_venues"] == [
        {"venue": "Conference A", "works": 2},
        {"venue": "Journal B", "works": 1},
    ]
    assert metrics["topics"] == [
        {"topic": "optimization", "count": 2},
        {"topic": "continual learning", "count": 1},
        {"topic": "graph theory", "count": 1},
    ]

