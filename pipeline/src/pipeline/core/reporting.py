"""Ops reporting for pipeline runs."""

from __future__ import annotations

import json
import platform
import subprocess
import sys
from pathlib import Path
from typing import Any, Dict, Iterable, Mapping

from pipeline.core.task import PipelineRun, Task


def _write_json(path: Path, payload: Dict[str, Any]) -> None:
    """Write deterministic JSON output with parent directory creation."""
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(payload, indent=2, sort_keys=True) + "\n", encoding="utf-8")


def _resolve_git_sha(repo_root: Path) -> str:
    """Resolve git SHA from the current repository root."""
    result = subprocess.run(
        ["git", "rev-parse", "HEAD"],
        cwd=repo_root,
        check=False,
        capture_output=True,
        text=True,
    )
    if result.returncode != 0:
        return "unknown"
    return result.stdout.strip() or "unknown"


def _resolve_action_run_url(env: Mapping[str, str]) -> str | None:
    """Build Actions run URL when run metadata is available in environment."""
    run_id = env.get("GITHUB_RUN_ID")
    if not run_id:
        return None

    server = env.get("GITHUB_SERVER_URL", "https://github.com").rstrip("/")
    repository = env.get("GITHUB_REPOSITORY")
    if repository:
        return f"{server}/{repository}/actions/runs/{run_id}"
    return f"{server}/actions/runs/{run_id}"


def _count_statuses(run: PipelineRun) -> Dict[str, int]:
    """Count task outcomes for run summary."""
    success = sum(1 for task in run.task_executions if task.status == "success")
    failed = sum(1 for task in run.task_executions if task.status == "failed")
    skipped = sum(1 for task in run.task_executions if task.status == "skipped")
    return {"success": success, "failed": failed, "skipped": skipped}


def emit_ops_reports(
    *,
    out_dir: Path,
    repo_root: Path,
    tasks: Iterable[Task],
    run: PipelineRun,
    env: Mapping[str, str],
) -> Dict[str, Path]:
    """Emit `latest-run`, `dag`, and `provenance` ops reports."""
    task_list = list(tasks)
    git_sha = _resolve_git_sha(repo_root=repo_root)
    action_run_url = _resolve_action_run_url(env)
    status_counts = _count_statuses(run)
    ops_dir = out_dir / "ops"

    latest_run_payload: Dict[str, Any] = {
        "run": {
            "status": run.status,
            "timestamp": run.finished_at.isoformat(),
            "started_at": run.started_at.isoformat(),
            "finished_at": run.finished_at.isoformat(),
            "duration_seconds": round(run.duration_seconds, 6),
            "git_sha": git_sha,
            "task_count": len(run.task_executions),
        },
        "summary": status_counts,
        "tasks": [
            {
                "name": task.name,
                "status": task.status,
                "inputs": list(task.inputs),
                "outputs": list(task.outputs),
                "deps": list(task.deps),
                "started_at": task.started_at.isoformat(),
                "finished_at": task.finished_at.isoformat(),
                "duration_seconds": task.duration_seconds,
                "logs": [
                    {
                        "level": log.level,
                        "message": log.message,
                        "timestamp": log.timestamp,
                    }
                    for log in task.logs
                ],
                "error": task.error,
            }
            for task in run.task_executions
        ],
    }
    if action_run_url:
        latest_run_payload["run"]["action_run_url"] = action_run_url

    dag_payload = {
        "generated_at": run.finished_at.isoformat(),
        "tasks": [
            {
                "name": task.name,
                "inputs": list(task.inputs),
                "outputs": list(task.outputs),
                "deps": list(task.deps),
            }
            for task in task_list
        ],
        "edges": [
            {"from": dep, "to": task.name}
            for task in task_list
            for dep in task.deps
        ],
    }

    artifacts_map: Dict[str, str] = {
        "latest_run": "ops/latest-run.json",
        "dag": "ops/dag.json",
        "provenance": "ops/provenance.json",
    }
    resume_path = out_dir / "artifacts" / "resume.pdf"
    if resume_path.exists():
        artifacts_map["resume_pdf"] = "artifacts/resume.pdf"

    provenance_payload: Dict[str, Any] = {
        "generated_at": run.finished_at.isoformat(),
        "git_sha": git_sha,
        "pipeline": {
            "python_version": sys.version.split()[0],
            "platform": platform.platform(),
        },
        "environment": {
            "github_repository": env.get("GITHUB_REPOSITORY"),
            "github_run_id": env.get("GITHUB_RUN_ID"),
            "github_ref": env.get("GITHUB_REF"),
            "github_actor": env.get("GITHUB_ACTOR"),
        },
        "artifacts": artifacts_map,
    }
    if action_run_url:
        provenance_payload["action_run_url"] = action_run_url

    latest_run_path = ops_dir / "latest-run.json"
    dag_path = ops_dir / "dag.json"
    provenance_path = ops_dir / "provenance.json"

    _write_json(latest_run_path, latest_run_payload)
    _write_json(dag_path, dag_payload)
    _write_json(provenance_path, provenance_payload)

    return {
        "latest_run": latest_run_path,
        "dag": dag_path,
        "provenance": provenance_path,
    }
