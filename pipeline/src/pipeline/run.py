"""Pipeline CLI entrypoint with task graph execution and ops reporting."""

from __future__ import annotations

import argparse
import json
import os
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Dict, Sequence

from pipeline.core import Task, TaskContext, TaskRunner, emit_ops_reports
from pipeline.ingest import ingest_github_repositories
from pipeline.registry import load_registry
from pipeline.transform import normalize_projects

REGISTRY_DIR = Path("registry")
GITHUB_RAW_RELATIVE_PATH = Path("artifacts/github/repos.raw.json")
PROJECTS_API_RELATIVE_PATH = Path("api/v1/projects.json")


def _write_json(path: Path, payload: Dict[str, Any]) -> None:
    """Write JSON to disk with deterministic formatting."""
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(payload, indent=2, sort_keys=True) + "\n", encoding="utf-8")


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
            name="emit_status_api",
            action=_task_emit_status_api,
            inputs=(str(PROJECTS_API_RELATIVE_PATH),),
            outputs=("api/v1/status.json",),
            deps=("emit_projects_api",),
        ),
    ]


def run(out_dir: Path, *, env: Dict[str, str] | None = None) -> int:
    """Run task graph and emit operations telemetry reports."""
    runtime_env = env if env is not None else dict(os.environ)
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
