"""Semantic Scholar publication ingestion with graceful fallback behavior."""

from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime, timezone
import json
from pathlib import Path
from typing import Any, Dict, List, Mapping, Optional, Sequence
from urllib.error import HTTPError, URLError
from urllib.parse import quote
from urllib.request import Request, urlopen

API_TIMEOUT_SECONDS = 15.0
RAW_ARTIFACT_RELATIVE_PATH = Path("artifacts/semantic-scholar/publications.raw.json")
AUTHOR_FIELDS = ",".join(
    [
        "name",
        "paperCount",
        "citationCount",
        "citationsByYear",
        "papers.paperId",
        "papers.title",
        "papers.year",
        "papers.venue",
        "papers.citationCount",
        "papers.url",
        "papers.authors",
        "papers.fieldsOfStudy",
        "papers.publicationDate",
        "papers.openAccessPdf",
    ]
)


@dataclass(frozen=True)
class SemanticScholarIngestResult:
    """Payload produced by Semantic Scholar ingestion."""

    source: str
    fetched_at: str
    publications: List[Dict[str, Any]]
    author_id: Optional[str] = None
    citation_count_total: Optional[int] = None
    citations_by_year: List[Dict[str, int]] | None = None
    warning: Optional[str] = None

    def as_json(self) -> Dict[str, Any]:
        """Return JSON-serializable payload."""
        return {
            "source": self.source,
            "fetched_at": self.fetched_at,
            "author_id": self.author_id,
            "citation_count_total": self.citation_count_total,
            "citations_by_year": self.citations_by_year or [],
            "warning": self.warning,
            "count": len(self.publications),
            "publications": self.publications,
        }


def _request_json(url: str, *, headers: Mapping[str, str], timeout_seconds: float) -> Any:
    """Execute GET request and decode JSON payload."""
    request = Request(url=url, headers=dict(headers), method="GET")
    with urlopen(request, timeout=timeout_seconds) as response:
        return json.loads(response.read().decode("utf-8"))


def _headers(api_key: Optional[str]) -> Dict[str, str]:
    """Build Semantic Scholar headers with optional API key."""
    headers = {
        "Accept": "application/json",
        "User-Agent": "portfolio-pipeline",
    }
    if api_key:
        headers["x-api-key"] = api_key
    return headers


def _normalize_author_payload(payload: Mapping[str, Any]) -> tuple[List[Dict[str, Any]], Optional[int], List[Dict[str, int]]]:
    """Normalize raw author payload into publication records and citation metadata."""
    raw_papers = payload.get("papers")
    papers = raw_papers if isinstance(raw_papers, list) else []
    publications: List[Dict[str, Any]] = []

    for paper in papers:
        if not isinstance(paper, dict):
            continue
        authors = paper.get("authors")
        normalized_authors = []
        if isinstance(authors, list):
            for author in authors:
                if isinstance(author, dict) and isinstance(author.get("name"), str):
                    normalized_authors.append(author["name"])

        fields = paper.get("fieldsOfStudy")
        keywords = [field for field in fields if isinstance(field, str)] if isinstance(fields, list) else []

        open_access_pdf = paper.get("openAccessPdf")
        pdf_url = None
        if isinstance(open_access_pdf, dict):
            pdf_candidate = open_access_pdf.get("url")
            if isinstance(pdf_candidate, str):
                pdf_url = pdf_candidate

        publications.append(
            {
                "id": paper.get("paperId"),
                "title": paper.get("title"),
                "year": paper.get("year"),
                "venue": paper.get("venue"),
                "citation_count": paper.get("citationCount"),
                "authors": normalized_authors,
                "keywords": keywords,
                "url": paper.get("url"),
                "pdf_url": pdf_url,
                "publication_date": paper.get("publicationDate"),
                "source": "semantic_scholar",
            }
        )

    citation_total_raw = payload.get("citationCount")
    citation_total = int(citation_total_raw) if isinstance(citation_total_raw, int) else None

    citations_by_year_raw = payload.get("citationsByYear")
    citations_by_year: List[Dict[str, int]] = []
    if isinstance(citations_by_year_raw, list):
        for entry in citations_by_year_raw:
            if not isinstance(entry, dict):
                continue
            year = entry.get("year")
            citations = entry.get("citationCount")
            if isinstance(year, int) and isinstance(citations, int):
                citations_by_year.append({"year": year, "citations": citations})
    citations_by_year.sort(key=lambda item: item["year"])

    return publications, citation_total, citations_by_year


def _fetch_author_payload(
    *,
    author_id: str,
    api_key: Optional[str],
    timeout_seconds: float,
) -> tuple[List[Dict[str, Any]], Optional[int], List[Dict[str, int]]]:
    """Fetch publications and citation metadata for a Semantic Scholar author."""
    url = f"https://api.semanticscholar.org/graph/v1/author/{quote(author_id)}?fields={AUTHOR_FIELDS}"
    payload = _request_json(url, headers=_headers(api_key), timeout_seconds=timeout_seconds)
    if not isinstance(payload, dict):
        raise RuntimeError("unexpected Semantic Scholar response shape for author payload")
    return _normalize_author_payload(payload)


def _read_cached_payload(cache_path: Path) -> Optional[Dict[str, Any]]:
    """Load cached ingestion payload when available."""
    if not cache_path.exists():
        return None
    try:
        payload = json.loads(cache_path.read_text(encoding="utf-8"))
    except json.JSONDecodeError:
        return None
    if not isinstance(payload, dict):
        return None
    publications = payload.get("publications")
    if not isinstance(publications, list):
        return None
    return payload


def _override_publications(overrides: Sequence[Mapping[str, Any]]) -> List[Dict[str, Any]]:
    """Convert override records into JSON-safe publication list."""
    normalized: List[Dict[str, Any]] = []
    for entry in overrides:
        if not isinstance(entry, Mapping):
            continue
        normalized.append(dict(entry))
    return normalized


def ingest_semantic_scholar_publications(
    *,
    author_id: Optional[str],
    out_dir: Path,
    overrides: Sequence[Mapping[str, Any]],
    api_key: Optional[str] = None,
    timeout_seconds: float = API_TIMEOUT_SECONDS,
) -> SemanticScholarIngestResult:
    """Ingest publications from Semantic Scholar with cache/override fallback."""
    cache_path = out_dir / RAW_ARTIFACT_RELATIVE_PATH
    fetched_at = datetime.now(timezone.utc).isoformat()
    normalized_author_id = (author_id or "").strip()
    override_payload = _override_publications(overrides)

    if not normalized_author_id:
        result = SemanticScholarIngestResult(
            source="overrides",
            fetched_at=fetched_at,
            publications=override_payload,
            author_id=None,
            warning="semantic_scholar_author_id missing; using registry/publications_overrides.yaml",
        )
        cache_path.parent.mkdir(parents=True, exist_ok=True)
        cache_path.write_text(json.dumps(result.as_json(), indent=2, sort_keys=True) + "\n", encoding="utf-8")
        return result

    try:
        publications, citation_total, citations_by_year = _fetch_author_payload(
            author_id=normalized_author_id,
            api_key=api_key,
            timeout_seconds=timeout_seconds,
        )
        result = SemanticScholarIngestResult(
            source="semantic_scholar_api",
            fetched_at=fetched_at,
            publications=publications,
            author_id=normalized_author_id,
            citation_count_total=citation_total,
            citations_by_year=citations_by_year,
        )
    except (HTTPError, URLError, TimeoutError, OSError, RuntimeError, ValueError) as exc:
        warning = f"{type(exc).__name__}: {exc}"
        cached = _read_cached_payload(cache_path)
        if cached is not None:
            cached_publications = cached.get("publications", [])
            cached_citations = cached.get("citations_by_year", [])
            result = SemanticScholarIngestResult(
                source="cache",
                fetched_at=fetched_at,
                publications=[entry for entry in cached_publications if isinstance(entry, dict)],
                author_id=normalized_author_id,
                citation_count_total=(
                    int(cached["citation_count_total"])
                    if isinstance(cached.get("citation_count_total"), int)
                    else None
                ),
                citations_by_year=[
                    {"year": int(item["year"]), "citations": int(item["citations"])}
                    for item in cached_citations
                    if isinstance(item, dict) and isinstance(item.get("year"), int) and isinstance(item.get("citations"), int)
                ],
                warning=warning,
            )
        else:
            result = SemanticScholarIngestResult(
                source="overrides",
                fetched_at=fetched_at,
                publications=override_payload,
                author_id=normalized_author_id,
                warning=f"{warning}; falling back to registry/publications_overrides.yaml",
            )

    cache_path.parent.mkdir(parents=True, exist_ok=True)
    cache_path.write_text(json.dumps(result.as_json(), indent=2, sort_keys=True) + "\n", encoding="utf-8")
    return result

