"""Pipeline CLI entrypoint with task graph execution and ops reporting."""

from __future__ import annotations

import argparse
import json
import os
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Dict, Sequence

import yaml

from pipeline.core import Task, TaskContext, TaskRunner, emit_ops_reports
from pipeline.emit import build_profile, build_search_index, emit_resume_pdf
from pipeline.ingest import ingest_github_repositories, ingest_semantic_scholar_publications
from pipeline.registry import load_registry
from pipeline.transform import compute_metrics, normalize_projects, normalize_publications

REGISTRY_DIR = Path("registry")
GITHUB_RAW_RELATIVE_PATH = Path("artifacts/github/repos.raw.json")
SEMANTIC_SCHOLAR_RAW_RELATIVE_PATH = Path("artifacts/semantic-scholar/publications.raw.json")
PROJECTS_API_RELATIVE_PATH = Path("api/v1/projects.json")
PUBLICATIONS_API_RELATIVE_PATH = Path("api/v1/publications.json")
METRICS_API_RELATIVE_PATH = Path("api/v1/metrics.json")
SEARCH_INDEX_API_RELATIVE_PATH = Path("api/v1/search-index.json")
PROFILE_API_RELATIVE_PATH = Path("api/v1/profile.json")
RESUME_ARTIFACT_RELATIVE_PATH = Path("artifacts/resume.pdf")
PUBLICATIONS_OVERRIDES_PATH = REGISTRY_DIR / "publications_overrides.yaml"
RESUME_TEMPLATE_PATH = REGISTRY_DIR / "resume_template.typ"


def _write_json(path: Path, payload: Dict[str, Any]) -> None:
    """Write JSON to disk with deterministic formatting."""
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(payload, indent=2, sort_keys=True) + "\n", encoding="utf-8")


def _load_publication_overrides(path: Path) -> list[Dict[str, Any]]:
    """Load publication overrides from registry YAML file."""
    if not path.exists():
        return []

    payload = yaml.safe_load(path.read_text(encoding="utf-8"))
    if payload is None:
        return []

    if isinstance(payload, list):
        return [item for item in payload if isinstance(item, dict)]

    if isinstance(payload, dict):
        publications = payload.get("publications")
        if isinstance(publications, list):
            return [item for item in publications if isinstance(item, dict)]

    return []


def _task_emit_status_api(context: TaskContext) -> None:
    """Emit a small status endpoint consumed by the static frontend."""
    timestamp = datetime.now(timezone.utc).isoformat()
    payload = {
        "status": "ok",
        "generated_at": timestamp,
        "message": "pipeline task graph active",
    }
    _write_json(context.out_dir / "api" / "v1" / "status.json", payload)


def _task_ingest_github(context: TaskContext) -> None:
    """Ingest repository metadata from GitHub API, cache, or bundled sample."""
    bundle = load_registry(REGISTRY_DIR)
    token = context.env.get("GITHUB_TOKEN")
    ingest_github_repositories(
        username=bundle.config.github_username,
        out_dir=context.out_dir,
        token=token,
    )


def _task_emit_projects_api(context: TaskContext) -> None:
    """Emit normalized projects API from ingested GitHub repositories."""
    bundle = load_registry(REGISTRY_DIR)
    raw_path = context.out_dir / GITHUB_RAW_RELATIVE_PATH
    payload = json.loads(raw_path.read_text(encoding="utf-8"))

    repos = payload.get("repos", [])
    if not isinstance(repos, list):
        repos = []

    items = normalize_projects(
        github_repos=[repo for repo in repos if isinstance(repo, dict)],
        registry_projects=bundle.projects.projects,
        github_username=bundle.config.github_username,
    )

    projects_payload: Dict[str, Any] = {
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "source": payload.get("source", "unknown"),
        "warning": payload.get("warning"),
        "count": len(items),
        "items": items,
    }
    _write_json(context.out_dir / PROJECTS_API_RELATIVE_PATH, projects_payload)


def _task_ingest_publications(context: TaskContext) -> None:
    """Ingest publications from Semantic Scholar with graceful fallback."""
    bundle = load_registry(REGISTRY_DIR)
    overrides = _load_publication_overrides(PUBLICATIONS_OVERRIDES_PATH)
    result = ingest_semantic_scholar_publications(
        author_id=bundle.config.semantic_scholar_author_id,
        out_dir=context.out_dir,
        overrides=overrides,
        api_key=context.env.get("SEMANTIC_SCHOLAR_API_KEY"),
    )
    if result.warning:
        context.warn(result.warning)
    context.info(f"publication source: {result.source} ({len(result.publications)} records)")


def _task_emit_publications_api(context: TaskContext) -> None:
    """Emit normalized publications API from ingested artifact."""
    raw_path = context.out_dir / SEMANTIC_SCHOLAR_RAW_RELATIVE_PATH
    payload = json.loads(raw_path.read_text(encoding="utf-8"))
    raw_publications = payload.get("publications", [])
    if not isinstance(raw_publications, list):
        raw_publications = []

    items = normalize_publications([item for item in raw_publications if isinstance(item, dict)])
    publications_payload: Dict[str, Any] = {
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "source": payload.get("source", "unknown"),
        "warning": payload.get("warning"),
        "count": len(items),
        "items": items,
    }
    _write_json(context.out_dir / PUBLICATIONS_API_RELATIVE_PATH, publications_payload)


def _task_emit_metrics_api(context: TaskContext) -> None:
    """Emit derived metrics from normalized publications."""
    publications_payload = json.loads((context.out_dir / PUBLICATIONS_API_RELATIVE_PATH).read_text(encoding="utf-8"))
    raw_payload = json.loads((context.out_dir / SEMANTIC_SCHOLAR_RAW_RELATIVE_PATH).read_text(encoding="utf-8"))

    publications_items = publications_payload.get("items", [])
    if not isinstance(publications_items, list):
        publications_items = []

    metrics_payload = compute_metrics(
        publications=[item for item in publications_items if isinstance(item, dict)],
        citations_total_hint=(
            raw_payload.get("citation_count_total")
            if isinstance(raw_payload.get("citation_count_total"), int)
            else None
        ),
        citations_by_year=raw_payload.get("citations_by_year") if isinstance(raw_payload.get("citations_by_year"), list) else [],
        source=raw_payload.get("source", "unknown"),
    )
    _write_json(context.out_dir / METRICS_API_RELATIVE_PATH, metrics_payload)


def _task_emit_search_index(context: TaskContext) -> None:
    """Emit compact search index across projects and publications."""
    projects_payload = json.loads((context.out_dir / PROJECTS_API_RELATIVE_PATH).read_text(encoding="utf-8"))
    publications_payload = json.loads((context.out_dir / PUBLICATIONS_API_RELATIVE_PATH).read_text(encoding="utf-8"))

    projects_items = projects_payload.get("items", [])
    if not isinstance(projects_items, list):
        projects_items = []
    publications_items = publications_payload.get("items", [])
    if not isinstance(publications_items, list):
        publications_items = []

    search_index_payload = build_search_index(
        projects=[item for item in projects_items if isinstance(item, dict)],
        publications=[item for item in publications_items if isinstance(item, dict)],
        generated_at=datetime.now(timezone.utc).isoformat(),
        source_provenance={
            "projects_source": projects_payload.get("source"),
            "publications_source": publications_payload.get("source"),
        },
    )
    _write_json(context.out_dir / SEARCH_INDEX_API_RELATIVE_PATH, search_index_payload)


def _task_emit_profile_api(context: TaskContext) -> None:
    """Emit unified profile endpoint with counts, links, and provenance."""
    bundle = load_registry(REGISTRY_DIR)
    projects_payload = json.loads((context.out_dir / PROJECTS_API_RELATIVE_PATH).read_text(encoding="utf-8"))
    publications_payload = json.loads((context.out_dir / PUBLICATIONS_API_RELATIVE_PATH).read_text(encoding="utf-8"))
    metrics_payload = json.loads((context.out_dir / METRICS_API_RELATIVE_PATH).read_text(encoding="utf-8"))

    profile_payload = build_profile(
        config=bundle.config.model_dump(mode="json"),
        projects_payload=projects_payload,
        publications_payload=publications_payload,
        metrics_payload=metrics_payload,
        last_run_timestamp=context.env.get("PIPELINE_RUN_TIMESTAMP", datetime.now(timezone.utc).isoformat()),
        generated_at=datetime.now(timezone.utc).isoformat(),
    )
    _write_json(context.out_dir / PROFILE_API_RELATIVE_PATH, profile_payload)


def _task_emit_resume_pdf(context: TaskContext) -> None:
    """Emit resume PDF artifact from registry and normalized APIs."""
    bundle = load_registry(REGISTRY_DIR)
    projects_payload = json.loads((context.out_dir / PROJECTS_API_RELATIVE_PATH).read_text(encoding="utf-8"))
    publications_payload = json.loads((context.out_dir / PUBLICATIONS_API_RELATIVE_PATH).read_text(encoding="utf-8"))
    metrics_payload = json.loads((context.out_dir / METRICS_API_RELATIVE_PATH).read_text(encoding="utf-8"))

    result = emit_resume_pdf(
        template_path=RESUME_TEMPLATE_PATH,
        output_path=context.out_dir / RESUME_ARTIFACT_RELATIVE_PATH,
        config=bundle.config.model_dump(mode="json"),
        experience_roles=[role.model_dump(mode="json") for role in bundle.experience.roles],
        programs={
            program_id: program.model_dump(mode="json")
            for program_id, program in bundle.programs.programs.items()
        },
        projects_payload=projects_payload,
        publications_payload=publications_payload,
        metrics_payload=metrics_payload,
        generated_at=context.env.get("PIPELINE_RUN_TIMESTAMP"),
    )
    if result.warning:
        context.warn(result.warning)
    context.info(f"resume artifact generated using {result.method}")


def build_tasks() -> Sequence[Task]:
    """Declare pipeline tasks and dependencies."""
    return [
        Task(
            name="ingest_github",
            action=_task_ingest_github,
            inputs=("registry/config.yaml", "registry/projects.yaml"),
            outputs=(str(GITHUB_RAW_RELATIVE_PATH),),
            deps=(),
        ),
        Task(
            name="emit_projects_api",
            action=_task_emit_projects_api,
            inputs=(str(GITHUB_RAW_RELATIVE_PATH), "registry/projects.yaml"),
            outputs=(str(PROJECTS_API_RELATIVE_PATH),),
            deps=("ingest_github",),
        ),
        Task(
            name="ingest_publications",
            action=_task_ingest_publications,
            inputs=(str(PUBLICATIONS_OVERRIDES_PATH), "registry/config.yaml"),
            outputs=(str(SEMANTIC_SCHOLAR_RAW_RELATIVE_PATH),),
            deps=(),
        ),
        Task(
            name="emit_publications_api",
            action=_task_emit_publications_api,
            inputs=(str(SEMANTIC_SCHOLAR_RAW_RELATIVE_PATH),),
            outputs=(str(PUBLICATIONS_API_RELATIVE_PATH),),
            deps=("ingest_publications",),
        ),
        Task(
            name="emit_metrics_api",
            action=_task_emit_metrics_api,
            inputs=(str(PUBLICATIONS_API_RELATIVE_PATH), str(SEMANTIC_SCHOLAR_RAW_RELATIVE_PATH)),
            outputs=(str(METRICS_API_RELATIVE_PATH),),
            deps=("emit_publications_api",),
        ),
        Task(
            name="emit_search_index",
            action=_task_emit_search_index,
            inputs=(str(PROJECTS_API_RELATIVE_PATH), str(PUBLICATIONS_API_RELATIVE_PATH)),
            outputs=(str(SEARCH_INDEX_API_RELATIVE_PATH),),
            deps=("emit_projects_api", "emit_publications_api"),
        ),
        Task(
            name="emit_profile_api",
            action=_task_emit_profile_api,
            inputs=(str(PROJECTS_API_RELATIVE_PATH), str(PUBLICATIONS_API_RELATIVE_PATH), str(METRICS_API_RELATIVE_PATH)),
            outputs=(str(PROFILE_API_RELATIVE_PATH),),
            deps=("emit_projects_api", "emit_publications_api", "emit_metrics_api"),
        ),
        Task(
            name="emit_resume_pdf",
            action=_task_emit_resume_pdf,
            inputs=(
                "registry/experience.yaml",
                "registry/programs.yaml",
                str(RESUME_TEMPLATE_PATH),
                str(PROJECTS_API_RELATIVE_PATH),
                str(PUBLICATIONS_API_RELATIVE_PATH),
                str(METRICS_API_RELATIVE_PATH),
                str(PROFILE_API_RELATIVE_PATH),
            ),
            outputs=(str(RESUME_ARTIFACT_RELATIVE_PATH),),
            deps=("emit_profile_api",),
        ),
        Task(
            name="emit_status_api",
            action=_task_emit_status_api,
            inputs=(str(PROJECTS_API_RELATIVE_PATH), str(METRICS_API_RELATIVE_PATH), str(PROFILE_API_RELATIVE_PATH)),
            outputs=("api/v1/status.json",),
            deps=("emit_search_index", "emit_resume_pdf"),
        ),
    ]


def run(out_dir: Path, *, env: Dict[str, str] | None = None) -> int:
    """Run task graph and emit operations telemetry reports."""
    runtime_env = dict(env) if env is not None else dict(os.environ)
    runtime_env.setdefault("PIPELINE_RUN_TIMESTAMP", datetime.now(timezone.utc).isoformat())
    context = TaskContext(out_dir=out_dir, env=runtime_env)
    tasks = list(build_tasks())
    runner = TaskRunner(tasks)
    result = runner.run(context)

    report_paths = emit_ops_reports(
        out_dir=out_dir,
        repo_root=Path.cwd(),
        tasks=tasks,
        run=result,
        env=runtime_env,
    )

    success_count = sum(1 for task in result.task_executions if task.status == "success")
    failed_count = sum(1 for task in result.task_executions if task.status == "failed")
    skipped_count = sum(1 for task in result.task_executions if task.status == "skipped")
    print(
        f"pipeline run {result.status}: tasks={len(result.task_executions)} "
        f"success={success_count} failed={failed_count} skipped={skipped_count}"
    )
    print(f"ops reports: {report_paths['latest_run']}, {report_paths['dag']}, {report_paths['provenance']}")
    return 0 if result.status == "success" else 1


def parse_args() -> argparse.Namespace:
    """Parse CLI options."""
    parser = argparse.ArgumentParser(description="Run portfolio pipeline tasks")
    parser.add_argument(
        "--out",
        default="site/public",
        help="Output directory root for generated artifacts (default: site/public)",
    )
    return parser.parse_args()


def main() -> int:
    """CLI entrypoint."""
    args = parse_args()
    return run(Path(args.out))


if __name__ == "__main__":
    raise SystemExit(main())
