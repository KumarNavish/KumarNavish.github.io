"""GitHub repository ingestion with cache/sample fallback."""

from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime, timezone
import json
from pathlib import Path
from typing import Any, Dict, List, Mapping, Optional
from urllib.error import HTTPError, URLError
from urllib.parse import quote
from urllib.request import Request, urlopen

API_VERSION = "2022-11-28"
DEFAULT_TIMEOUT_SECONDS = 10.0
RAW_ARTIFACT_RELATIVE_PATH = Path("artifacts/github/repos.raw.json")

_SAMPLE_REPOS: List[Dict[str, Any]] = [
    {
        "name": "KumarNavish.github.io",
        "html_url": "https://github.com/KumarNavish/KumarNavish.github.io",
        "description": "Personal research website published on GitHub Pages.",
        "topics": ["research", "portfolio", "automation"],
        "language": "JavaScript",
        "languages": {"JavaScript": 12000, "CSS": 6000, "HTML": 3200},
        "stargazers_count": 0,
        "forks_count": 0,
        "pushed_at": "2026-02-14T13:58:00Z",
        "homepage": "https://kumarnavish.github.io/",
    },
    {
        "name": "CL-PLO",
        "html_url": "https://github.com/KumarNavish/CL-PLO",
        "description": "Continual learning policy optimization experiments.",
        "topics": ["continual-learning", "optimization"],
        "language": "Python",
        "languages": {"Python": 100000, "Jupyter Notebook": 25000},
        "stargazers_count": 1,
        "forks_count": 0,
        "pushed_at": "2026-02-10T08:00:00Z",
        "homepage": "https://kumarnavish.github.io/CL-PLO/",
    },
    {
        "name": "bis-continual-process-automation-demo",
        "html_url": "https://github.com/KumarNavish/bis-continual-process-automation-demo",
        "description": "Demo connecting continual methods to process automation.",
        "topics": ["process-automation", "systems"],
        "language": "TypeScript",
        "languages": {"TypeScript": 45000, "CSS": 5000, "HTML": 2000},
        "stargazers_count": 0,
        "forks_count": 0,
        "pushed_at": "2026-02-09T07:00:00Z",
        "homepage": "https://kumarnavish.github.io/bis-continual-process-automation-demo/",
    },
]


@dataclass(frozen=True)
class GitHubIngestResult:
    """Payload produced by GitHub ingestion."""

    username: str
    source: str
    fetched_at: str
    repos: List[Dict[str, Any]]
    warning: Optional[str] = None

    def as_json(self) -> Dict[str, Any]:
        """Return JSON-serializable payload."""
        return {
            "username": self.username,
            "source": self.source,
            "fetched_at": self.fetched_at,
            "warning": self.warning,
            "repo_count": len(self.repos),
            "repos": self.repos,
        }


def _request_json(url: str, *, headers: Mapping[str, str], timeout_seconds: float) -> tuple[Any, Optional[str]]:
    """Execute a GET request and decode JSON payload."""
    request = Request(url=url, headers=dict(headers), method="GET")
    with urlopen(request, timeout=timeout_seconds) as response:
        payload = json.loads(response.read().decode("utf-8"))
        link_header = response.headers.get("Link")
    return payload, link_header


def _parse_next_link(link_header: Optional[str]) -> Optional[str]:
    """Parse RFC-5988 link header and return `rel=next` URL when present."""
    if not link_header:
        return None
    for fragment in link_header.split(","):
        piece = fragment.strip()
        if 'rel="next"' not in piece:
            continue
        if not piece.startswith("<") or ">" not in piece:
            continue
        return piece[1 : piece.index(">")]
    return None


def _build_headers(token: Optional[str]) -> Dict[str, str]:
    """Build default GitHub API headers with optional auth token."""
    headers = {
        "Accept": "application/vnd.github+json",
        "X-GitHub-Api-Version": API_VERSION,
        "User-Agent": "portfolio-pipeline",
    }
    if token:
        headers["Authorization"] = f"Bearer {token}"
    return headers


def _fetch_languages(
    *,
    languages_url: Optional[str],
    headers: Mapping[str, str],
    timeout_seconds: float,
) -> Dict[str, int]:
    """Fetch language byte breakdown for one repository."""
    if not languages_url:
        return {}
    try:
        payload, _ = _request_json(languages_url, headers=headers, timeout_seconds=timeout_seconds)
    except (HTTPError, URLError, TimeoutError, OSError):
        return {}
    if not isinstance(payload, dict):
        return {}
    normalized: Dict[str, int] = {}
    for language, amount in payload.items():
        if not isinstance(language, str):
            continue
        if isinstance(amount, int):
            normalized[language] = max(amount, 0)
    return normalized


def _compact_repo_payload(repo: Mapping[str, Any], *, languages: Mapping[str, int]) -> Dict[str, Any]:
    """Reduce GitHub repository object to required fields."""
    topics_raw = repo.get("topics")
    topics = [topic for topic in topics_raw if isinstance(topic, str)] if isinstance(topics_raw, list) else []

    return {
        "name": repo.get("name", ""),
        "html_url": repo.get("html_url", ""),
        "description": repo.get("description") or "",
        "topics": topics,
        "language": repo.get("language"),
        "languages": dict(languages),
        "stargazers_count": int(repo.get("stargazers_count") or 0),
        "forks_count": int(repo.get("forks_count") or 0),
        "pushed_at": repo.get("pushed_at"),
        "homepage": repo.get("homepage"),
    }


def _fetch_repositories_live(
    *,
    username: str,
    token: Optional[str],
    timeout_seconds: float,
) -> List[Dict[str, Any]]:
    """Fetch repositories from GitHub REST API, including language breakdown."""
    headers = _build_headers(token)
    url = f"https://api.github.com/users/{quote(username)}/repos?per_page=100&type=owner&sort=updated"
    compact_repos: List[Dict[str, Any]] = []

    while url:
        payload, link_header = _request_json(url, headers=headers, timeout_seconds=timeout_seconds)
        if not isinstance(payload, list):
            raise RuntimeError("unexpected GitHub API response shape for repositories")

        for repo in payload:
            if not isinstance(repo, dict):
                continue
            languages = _fetch_languages(
                languages_url=repo.get("languages_url"),
                headers=headers,
                timeout_seconds=timeout_seconds,
            )
            compact_repos.append(_compact_repo_payload(repo, languages=languages))

        url = _parse_next_link(link_header)

    if not compact_repos:
        raise RuntimeError("GitHub API returned zero repositories")
    return compact_repos


def _read_cached_payload(cache_path: Path) -> Optional[Dict[str, Any]]:
    """Load previously written raw artifact payload if available."""
    if not cache_path.exists():
        return None
    try:
        data = json.loads(cache_path.read_text(encoding="utf-8"))
    except json.JSONDecodeError:
        return None
    if not isinstance(data, dict):
        return None
    repos = data.get("repos")
    if not isinstance(repos, list):
        return None
    return data


def ingest_github_repositories(
    *,
    username: str,
    out_dir: Path,
    token: Optional[str] = None,
    timeout_seconds: float = DEFAULT_TIMEOUT_SECONDS,
) -> GitHubIngestResult:
    """Ingest GitHub repositories with fallback to cache or bundled sample."""
    cache_path = out_dir / RAW_ARTIFACT_RELATIVE_PATH
    fetched_at = datetime.now(timezone.utc).isoformat()

    try:
        repos = _fetch_repositories_live(username=username, token=token, timeout_seconds=timeout_seconds)
        result = GitHubIngestResult(
            username=username,
            source="github_api",
            fetched_at=fetched_at,
            repos=repos,
        )
    except Exception as exc:  # pragma: no cover - fallback behavior tested through interface contract
        warning = f"{type(exc).__name__}: {exc}"
        cached = _read_cached_payload(cache_path)
        if cached is not None:
            repos = cached.get("repos", [])
            result = GitHubIngestResult(
                username=username,
                source="cache",
                fetched_at=fetched_at,
                repos=[repo for repo in repos if isinstance(repo, dict)],
                warning=warning,
            )
        else:
            result = GitHubIngestResult(
                username=username,
                source="sample",
                fetched_at=fetched_at,
                repos=[dict(repo) for repo in _SAMPLE_REPOS],
                warning=warning,
            )

    cache_path.parent.mkdir(parents=True, exist_ok=True)
    cache_path.write_text(json.dumps(result.as_json(), indent=2, sort_keys=True) + "\n", encoding="utf-8")
    return result

