"""Pipeline CLI entrypoint with task graph execution and ops reporting."""

from __future__ import annotations

import argparse
import json
import os
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Dict, Sequence

from pipeline.core import Task, TaskContext, TaskRunner, emit_ops_reports


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
        "message": "pipeline core runner active",
    }
    _write_json(context.out_dir / "api" / "v1" / "status.json", payload)


def build_tasks() -> Sequence[Task]:
    """Declare pipeline tasks and dependencies."""
    return [
        Task(
            name="emit_status_api",
            action=_task_emit_status_api,
            inputs=("registry/config.yaml",),
            outputs=("api/v1/status.json",),
            deps=(),
        )
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
