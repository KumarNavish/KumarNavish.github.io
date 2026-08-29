"""Build compact search index payload from projects and publications."""

from __future__ import annotations

import re
from typing import Any, Dict, Iterable, Mapping, Sequence

TOKEN_PATTERN = re.compile(r"[a-z0-9]+")


def _tokenize(parts: Iterable[str]) -> list[str]:
    """Tokenize and deduplicate text fragments into lowercase terms."""
    terms: list[str] = []
    seen: set[str] = set()
    for part in parts:
        if not isinstance(part, str):
            continue
        for token in TOKEN_PATTERN.findall(part.lower()):
            if len(token) < 2:
                continue
            if token in seen:
                continue
            seen.add(token)
            terms.append(token)
    return terms


def _project_document(project: Mapping[str, Any]) -> Dict[str, Any]:
    """Convert a normalized project item into search document format."""
    name = str(project.get("name", "")).strip()
    description = str(project.get("description", "")).strip()
    one_line = str(project.get("one_line", "")).strip()
    tags = [tag for tag in project.get("tags", []) if isinstance(tag, str)] if isinstance(project.get("tags"), list) else []
    topics = [topic for topic in project.get("topics", []) if isinstance(topic, str)] if isinstance(project.get("topics"), list) else []
    languages = list(project.get("language_breakdown", {}).keys()) if isinstance(project.get("language_breakdown"), dict) else []

    terms = _tokenize([name, description, one_line, *tags, *topics, *languages])
    return {
        "id": f"project:{name}",
        "type": "project",
        "title": name,
        "subtitle": one_line or description,
        "route": "/projects",
        "url": project.get("html_url"),
        "terms": terms,
    }


def _publication_document(publication: Mapping[str, Any]) -> Dict[str, Any]:
    """Convert a normalized publication item into search document format."""
    publication_id = str(publication.get("id", "")).strip()
    title = str(publication.get("title", "")).strip()
    venue = str(publication.get("venue", "")).strip()
    keywords = [
        keyword
        for keyword in publication.get("keywords", [])
        if isinstance(keyword, str)
    ] if isinstance(publication.get("keywords"), list) else []
    authors = [
        author
        for author in publication.get("authors", [])
        if isinstance(author, str)
    ] if isinstance(publication.get("authors"), list) else []
    year = publication.get("year")
    year_text = str(year) if isinstance(year, int) else ""

    terms = _tokenize([title, venue, year_text, *keywords, *authors])
    return {
        "id": f"publication:{publication_id}",
        "type": "publication",
        "title": title,
        "subtitle": f"{venue} ({year_text})".strip() if venue or year_text else "",
        "route": "/publications",
        "url": publication.get("url"),
        "terms": terms,
    }


def build_search_index(
    *,
    projects: Sequence[Mapping[str, Any]],
    publications: Sequence[Mapping[str, Any]],
    generated_at: str,
    source_provenance: Mapping[str, Any],
) -> Dict[str, Any]:
    """Build compact inverted search index from projects and publications."""
    documents: list[Dict[str, Any]] = []

    for project in projects:
        if not isinstance(project, Mapping):
            continue
        if not isinstance(project.get("name"), str):
            continue
        documents.append(_project_document(project))

    for publication in publications:
        if not isinstance(publication, Mapping):
            continue
        if not isinstance(publication.get("title"), str):
            continue
        documents.append(_publication_document(publication))

    postings: dict[str, list[int]] = {}
    compact_documents: list[Dict[str, Any]] = []
    for doc_id, document in enumerate(documents):
        terms = document.pop("terms", [])
        compact_documents.append({"doc_id": doc_id, **document})
        if not isinstance(terms, list):
            continue
        for term in terms:
            postings.setdefault(term, []).append(doc_id)

    for term, doc_ids in postings.items():
        postings[term] = sorted(set(doc_ids))

    return {
        "generated_at": generated_at,
        "schema": "compact-inverted-v1",
        "document_count": len(compact_documents),
        "term_count": len(postings),
        "source_provenance": dict(source_provenance),
        "documents": compact_documents,
        "postings": postings,
    }

