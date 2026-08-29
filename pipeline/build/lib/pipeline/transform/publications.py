"""Normalize publication records into a stable public API schema."""

from __future__ import annotations

import re
from typing import Any, Dict, Mapping, Sequence

_SLUG_PATTERN = re.compile(r"[^a-z0-9]+")


def _as_int(value: Any) -> int | None:
    """Convert scalar value to int when possible."""
    if isinstance(value, bool):
        return None
    if isinstance(value, int):
        return value
    if isinstance(value, str) and value.strip():
        try:
            return int(value)
        except ValueError:
            return None
    return None


def _as_string(value: Any) -> str | None:
    """Convert value to trimmed string when possible."""
    if isinstance(value, str):
        text = value.strip()
        return text or None
    return None


def _normalize_authors(value: Any) -> list[str]:
    """Normalize author list from supported raw input shapes."""
    if isinstance(value, list):
        authors: list[str] = []
        for entry in value:
            if isinstance(entry, str) and entry.strip():
                authors.append(entry.strip())
            elif isinstance(entry, dict) and isinstance(entry.get("name"), str) and entry["name"].strip():
                authors.append(entry["name"].strip())
        return authors

    if isinstance(value, str):
        parts = [part.strip() for part in value.split(",")]
        return [part for part in parts if part]

    return []


def _normalize_keywords(record: Mapping[str, Any]) -> list[str]:
    """Normalize topic/keyword list from publication record."""
    keyword_fields = [
        record.get("keywords"),
        record.get("fields_of_study"),
        record.get("fieldsOfStudy"),
        record.get("tags"),
    ]
    seen: set[str] = set()
    keywords: list[str] = []
    for field in keyword_fields:
        if not isinstance(field, list):
            continue
        for entry in field:
            if not isinstance(entry, str):
                continue
            keyword = entry.strip()
            if not keyword or keyword in seen:
                continue
            seen.add(keyword)
            keywords.append(keyword)
    return keywords


def _fallback_id(*, title: str, year: int | None) -> str:
    """Generate deterministic fallback ID when source record has no identifier."""
    slug = _SLUG_PATTERN.sub("-", title.lower()).strip("-")
    if not slug:
        slug = "untitled"
    return f"{slug}-{year}" if year is not None else slug


def normalize_publications(records: Sequence[Mapping[str, Any]]) -> list[Dict[str, Any]]:
    """Normalize publication records for API output."""
    normalized: list[Dict[str, Any]] = []

    for record in records:
        if not isinstance(record, Mapping):
            continue

        title = _as_string(record.get("title"))
        if not title:
            continue

        year = _as_int(record.get("year"))
        citation_count = _as_int(record.get("citation_count"))
        venue = _as_string(record.get("venue"))
        publication_id = _as_string(record.get("id")) or _as_string(record.get("paperId"))
        publication_id = publication_id or _fallback_id(title=title, year=year)

        normalized.append(
            {
                "id": publication_id,
                "title": title,
                "year": year,
                "venue": venue,
                "citation_count": citation_count,
                "authors": _normalize_authors(record.get("authors")),
                "keywords": _normalize_keywords(record),
                "url": _as_string(record.get("url")) or _as_string(record.get("external_url")),
                "pdf_url": _as_string(record.get("pdf_url")),
                "summary": _as_string(record.get("summary")) or _as_string(record.get("abstract")),
                "source": _as_string(record.get("source")) or "unknown",
            }
        )

    return sorted(
        normalized,
        key=lambda item: (
            -(item["year"] if isinstance(item["year"], int) else -1),
            -(item["citation_count"] if isinstance(item["citation_count"], int) else -1),
            item["title"].lower(),
        ),
    )

