"""Tests for GitHub project normalization and merge logic."""

from __future__ import annotations

from pipeline.transform.projects import normalize_projects


def _override(
    *,
    featured: bool = False,
    tags: list[str] | None = None,
    demo_url: str | None = None,
    paper_url: str | None = None,
    one_line: str = "",
) -> dict[str, object]:
    """Helper for concise override fixtures."""
    return {
        "featured": featured,
        "tags": tags or [],
        "demo_url": demo_url,
        "paper_url": paper_url,
        "image": None,
        "one_line": one_line,
    }


def test_normalize_projects_merges_registry_overrides() -> None:
    """Registry overrides should enrich GitHub payload fields."""
    github_repos = [
        {
            "name": "CL-PLO",
            "html_url": "https://github.com/KumarNavish/CL-PLO",
            "description": "continual learning sandbox",
            "topics": ["continual-learning", "optimization"],
            "language": "Python",
            "languages": {"Python": 12000, "Jupyter Notebook": 4000},
            "stargazers_count": 7,
            "forks_count": 2,
            "pushed_at": "2026-02-14T00:00:00Z",
            "homepage": "https://kumarnavish.github.io/CL-PLO/",
        }
    ]
    overrides = {
        "CL-PLO": _override(
            featured=True,
            tags=["neural-policies"],
            demo_url="https://kumarnavish.github.io/CL-PLO/",
            one_line="Experimental sandbox for continual learning policy optimization strategies.",
        ),
        "KumarNavish.github.io": _override(
            featured=True,
            tags=["research-systems"],
            demo_url="https://kumarnavish.github.io/",
            one_line="Portfolio website rendered from generated public APIs and operations telemetry.",
        ),
    }

    projects = normalize_projects(
        github_repos=github_repos,
        registry_projects=overrides,
        github_username="KumarNavish",
    )

    by_name = {project["name"]: project for project in projects}
    assert "CL-PLO" in by_name
    assert "KumarNavish.github.io" in by_name

    clplo = by_name["CL-PLO"]
    assert clplo["featured"] is True
    assert clplo["pinned"] is True
    assert clplo["demo_url"] == "https://kumarnavish.github.io/CL-PLO/"
    assert set(clplo["tags"]) == {"continual-learning", "optimization", "neural-policies"}
    assert clplo["language_breakdown"]["Python"] == 12000

    website = by_name["KumarNavish.github.io"]
    assert website["stars"] == 0
    assert website["html_url"] == "https://github.com/KumarNavish/KumarNavish.github.io"
    assert website["one_line"] == "Portfolio website rendered from generated public APIs and operations telemetry."


def test_normalize_projects_has_deterministic_sort_order() -> None:
    """Ordering should be stable and deterministic across runs."""
    github_repos = [
        {
            "name": "beta",
            "html_url": "https://github.com/KumarNavish/beta",
            "description": "",
            "topics": [],
            "language": "Python",
            "languages": {"Python": 1},
            "stargazers_count": 4,
            "forks_count": 1,
            "pushed_at": "2026-01-01T00:00:00Z",
            "homepage": None,
        },
        {
            "name": "alpha",
            "html_url": "https://github.com/KumarNavish/alpha",
            "description": "",
            "topics": [],
            "language": "Python",
            "languages": {"Python": 1},
            "stargazers_count": 4,
            "forks_count": 1,
            "pushed_at": "2026-01-01T00:00:00Z",
            "homepage": None,
        },
        {
            "name": "gamma",
            "html_url": "https://github.com/KumarNavish/gamma",
            "description": "",
            "topics": [],
            "language": "Python",
            "languages": {"Python": 1},
            "stargazers_count": 1,
            "forks_count": 0,
            "pushed_at": "2026-01-01T00:00:00Z",
            "homepage": None,
        },
    ]
    overrides = {
        "gamma": _override(featured=True, tags=["featured"], one_line="gamma one-line"),
    }

    first = normalize_projects(
        github_repos=github_repos,
        registry_projects=overrides,
        github_username="KumarNavish",
    )
    second = normalize_projects(
        github_repos=github_repos,
        registry_projects=overrides,
        github_username="KumarNavish",
    )

    assert [project["name"] for project in first] == ["gamma", "alpha", "beta"]
    assert [project["name"] for project in second] == ["gamma", "alpha", "beta"]

