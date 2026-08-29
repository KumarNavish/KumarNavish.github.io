"""Build unified profile endpoint from generated API payloads."""

from __future__ import annotations

from datetime import datetime, timezone
from typing import Any, Dict, Mapping, Sequence


def _as_items(payload: Mapping[str, Any]) -> list[Mapping[str, Any]]:
    """Extract `items` list from payload and normalize shape."""
    items = payload.get("items")
    if not isinstance(items, list):
        return []
    return [item for item in items if isinstance(item, Mapping)]


def _featured_projects(projects: Sequence[Mapping[str, Any]], *, limit: int = 4) -> list[Dict[str, Any]]:
    """Select featured projects for profile highlight."""
    featured = [project for project in projects if bool(project.get("featured"))]
    ranked = sorted(
        featured,
        key=lambda item: (
            -int(item.get("stars", 0)) if isinstance(item.get("stars"), int) else 0,
            str(item.get("name", "")).lower(),
        ),
    )
    return [
        {
            "name": item.get("name"),
            "one_line": item.get("one_line"),
            "html_url": item.get("html_url"),
            "demo_url": item.get("demo_url"),
            "stars": item.get("stars", 0),
        }
        for item in ranked[:limit]
    ]


def _featured_publications(publications: Sequence[Mapping[str, Any]], *, limit: int = 4) -> list[Dict[str, Any]]:
    """Select most-cited publications for profile highlight."""
    ranked = sorted(
        publications,
        key=lambda item: (
            -int(item.get("citation_count", 0)) if isinstance(item.get("citation_count"), int) else 0,
            -(item.get("year") if isinstance(item.get("year"), int) else -1),
            str(item.get("title", "")).lower(),
        ),
    )
    return [
        {
            "id": item.get("id"),
            "title": item.get("title"),
            "year": item.get("year"),
            "venue": item.get("venue"),
            "citation_count": item.get("citation_count"),
            "url": item.get("url"),
        }
        for item in ranked[:limit]
    ]


def build_profile(
    *,
    config: Mapping[str, Any],
    projects_payload: Mapping[str, Any],
    publications_payload: Mapping[str, Any],
    metrics_payload: Mapping[str, Any],
    last_run_timestamp: str,
    generated_at: str | None = None,
) -> Dict[str, Any]:
    """Build the unified `profile.json` endpoint."""
    timestamp = generated_at or datetime.now(timezone.utc).isoformat()
    github_username = str(config.get("github_username", "")).strip()
    semantic_author_id = str(config.get("semantic_scholar_author_id", "")).strip()

    projects = _as_items(projects_payload)
    publications = _as_items(publications_payload)
    featured_projects = _featured_projects(projects)
    featured_publications = _featured_publications(publications)

    links: Dict[str, str] = {
        "website": f"https://{github_username.lower()}.github.io/" if github_username else "",
        "github": f"https://github.com/{github_username}" if github_username else "",
    }
    if semantic_author_id:
        links["semantic_scholar"] = f"https://www.semanticscholar.org/author/{semantic_author_id}"

    return {
        "generated_at": timestamp,
        "site_title": config.get("site_title"),
        "identity": {
            "github_username": github_username,
            "semantic_scholar_author_id": semantic_author_id or None,
            "timezone": config.get("timezone"),
            "refresh_policy": config.get("refresh_policy"),
        },
        "links": links,
        "counts": {
            "projects": len(projects),
            "featured_projects": len(featured_projects),
            "publications": len(publications),
            "works_count": metrics_payload.get("works_count"),
            "citations_total": metrics_payload.get("citations_total"),
        },
        "featured": {
            "projects": featured_projects,
            "publications": featured_publications,
        },
        "last_sync": {
            "last_run_timestamp": last_run_timestamp,
            "generated_at": timestamp,
        },
        "source_provenance": {
            "projects_source": projects_payload.get("source"),
            "publications_source": publications_payload.get("source"),
            "metrics_source": metrics_payload.get("source"),
            "ops_source": "ops/latest-run.json",
        },
    }

