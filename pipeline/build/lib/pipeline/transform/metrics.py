"""Metrics computation for normalized publications."""

from __future__ import annotations

from collections import Counter
from datetime import datetime, timezone
from typing import Any, Dict, Mapping, Sequence


def _normalize_citations_by_year(value: Any) -> list[Dict[str, int]]:
    """Normalize citations-by-year payload."""
    if not isinstance(value, list):
        return []
    normalized: list[Dict[str, int]] = []
    for entry in value:
        if not isinstance(entry, Mapping):
            continue
        year = entry.get("year")
        citations = entry.get("citations")
        if not isinstance(citations, int):
            citations = entry.get("citationCount")
        if isinstance(year, int) and isinstance(citations, int):
            normalized.append({"year": year, "citations": citations})
    normalized.sort(key=lambda item: item["year"])
    return normalized


def _top_counter(counter: Counter[str], *, limit: int, key_name: str, value_name: str) -> list[Dict[str, Any]]:
    """Convert counter to deterministic top-N list."""
    ranked = sorted(counter.items(), key=lambda item: (-item[1], item[0].lower()))
    return [{key_name: name, value_name: count} for name, count in ranked[:limit]]


def compute_metrics(
    *,
    publications: Sequence[Mapping[str, Any]],
    citations_total_hint: int | None = None,
    citations_by_year: Sequence[Mapping[str, Any]] | None = None,
    source: str = "unknown",
) -> Dict[str, Any]:
    """Compute aggregate metrics from normalized publications."""
    works_count = len(publications)
    citation_values = [
        int(item["citation_count"])
        for item in publications
        if isinstance(item.get("citation_count"), int)
    ]
    citations_total = citations_total_hint if isinstance(citations_total_hint, int) else None
    if citations_total is None and citation_values:
        citations_total = sum(citation_values)

    venue_counter: Counter[str] = Counter()
    topic_counter: Counter[str] = Counter()
    for publication in publications:
        venue = publication.get("venue")
        if isinstance(venue, str) and venue.strip():
            venue_counter[venue.strip()] += 1

        keywords = publication.get("keywords")
        if isinstance(keywords, list):
            for keyword in keywords:
                if isinstance(keyword, str) and keyword.strip():
                    topic_counter[keyword.strip()] += 1

    return {
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "source": source,
        "works_count": works_count,
        "citations_total": citations_total,
        "citations_by_year": _normalize_citations_by_year(list(citations_by_year or [])),
        "top_venues": _top_counter(venue_counter, limit=5, key_name="venue", value_name="works"),
        "topics": _top_counter(topic_counter, limit=10, key_name="topic", value_name="count"),
    }

