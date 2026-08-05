"""Normalize GitHub repositories into public projects API shape."""

from __future__ import annotations

from typing import Any, Dict, Iterable, Mapping, Sequence


def _to_override_dict(value: Any) -> Dict[str, Any]:
    """Convert registry override object to a plain dictionary."""
    if value is None:
        return {}
    if hasattr(value, "model_dump"):
        dumped = value.model_dump(mode="json")
        return dumped if isinstance(dumped, dict) else {}
    if isinstance(value, dict):
        return dict(value)
    return {}


def _dedupe_strings(values: Iterable[str]) -> list[str]:
    """Preserve order while removing duplicate/blank strings."""
    deduped: list[str] = []
    seen: set[str] = set()
    for value in values:
        if not isinstance(value, str):
            continue
        cleaned = value.strip()
        if not cleaned or cleaned in seen:
            continue
        seen.add(cleaned)
        deduped.append(cleaned)
    return deduped


def _language_breakdown(repo: Mapping[str, Any]) -> Dict[str, int]:
    """Normalize language breakdown map from raw GitHub payload."""
    payload = repo.get("languages")
    if isinstance(payload, dict):
        normalized: Dict[str, int] = {}
        for language, amount in payload.items():
            if not isinstance(language, str):
                continue
            if isinstance(amount, int):
                normalized[language] = max(amount, 0)
        if normalized:
            return normalized

    fallback_language = repo.get("language")
    if isinstance(fallback_language, str) and fallback_language.strip():
        return {fallback_language.strip(): 1}
    return {}


def _project_sort_key(project: Mapping[str, Any]) -> tuple[int, int, int, str]:
    """Deterministic sort for project cards."""
    featured = 0 if bool(project.get("featured")) else 1
    stars = -int(project.get("stars", 0))
    forks = -int(project.get("forks", 0))
    name = str(project.get("name", "")).lower()
    return (featured, stars, forks, name)


def normalize_projects(
    *,
    github_repos: Sequence[Mapping[str, Any]],
    registry_projects: Mapping[str, Any],
    github_username: str,
) -> list[Dict[str, Any]]:
    """Merge GitHub repositories with curated registry metadata."""
    normalized: list[Dict[str, Any]] = []
    seen_repo_names: set[str] = set()

    for repo in github_repos:
        name_raw = repo.get("name")
        name = name_raw.strip() if isinstance(name_raw, str) else ""
        if not name:
            continue

        override = _to_override_dict(registry_projects.get(name))
        topics = _dedupe_strings(repo.get("topics", []) if isinstance(repo.get("topics"), list) else [])
        override_tags = override.get("tags", [])
        if not isinstance(override_tags, list):
            override_tags = []
        tags = _dedupe_strings([*topics, *override_tags])
        featured = bool(override.get("featured", False))

        normalized.append(
            {
                "name": name,
                "html_url": repo.get("html_url") or f"https://github.com/{github_username}/{name}",
                "description": (repo.get("description") or "").strip(),
                "topics": topics,
                "tags": tags,
                "language_breakdown": _language_breakdown(repo),
                "stars": int(repo.get("stargazers_count") or 0),
                "forks": int(repo.get("forks_count") or 0),
                "last_push": repo.get("pushed_at"),
                "homepage": repo.get("homepage"),
                "featured": featured,
                "pinned": featured,
                "demo_url": override.get("demo_url"),
                "paper_url": override.get("paper_url"),
                "one_line": override.get("one_line"),
            }
        )
        seen_repo_names.add(name)

    for name, override_value in registry_projects.items():
        if name in seen_repo_names:
            continue
        override = _to_override_dict(override_value)
        featured = bool(override.get("featured", False))
        override_tags = override.get("tags", [])
        if not isinstance(override_tags, list):
            override_tags = []
        tags = _dedupe_strings(override_tags)

        normalized.append(
            {
                "name": name,
                "html_url": f"https://github.com/{github_username}/{name}",
                "description": "",
                "topics": [],
                "tags": tags,
                "language_breakdown": {},
                "stars": 0,
                "forks": 0,
                "last_push": None,
                "homepage": None,
                "featured": featured,
                "pinned": featured,
                "demo_url": override.get("demo_url"),
                "paper_url": override.get("paper_url"),
                "one_line": override.get("one_line"),
            }
        )

    return sorted(normalized, key=_project_sort_key)
