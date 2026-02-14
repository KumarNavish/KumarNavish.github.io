"""Tests for pipeline task runner and ops reporting."""

from __future__ import annotations

import json
from pathlib import Path

from pipeline.core import Task, TaskContext, TaskRunner, emit_ops_reports

REPO_ROOT = Path(__file__).resolve().parents[2]


def _noop_task(_: TaskContext) -> None:
    """No-op task action for DAG ordering tests."""


def test_task_runner_topological_order_respects_dependencies() -> None:
    """Runner should return deterministic order that respects the DAG."""
    tasks = [
        Task(name="extract", action=_noop_task),
        Task(name="transform", action=_noop_task, deps=("extract",)),
        Task(name="load", action=_noop_task, deps=("transform",)),
        Task(name="index", action=_noop_task, deps=("extract",)),
    ]

    runner = TaskRunner(tasks)
    order = runner.topological_order()

    assert order.index("extract") < order.index("transform")
    assert order.index("transform") < order.index("load")
    assert order.index("extract") < order.index("index")


def test_emit_ops_reports_writes_required_schema(tmp_path: Path) -> None:
    """Ops reports should include latest-run, DAG, and provenance payloads."""

    def emit_marker(context: TaskContext) -> None:
        marker_path = context.out_dir / "api" / "v1" / "marker.json"
        marker_path.parent.mkdir(parents=True, exist_ok=True)
        marker_path.write_text("{\"ok\": true}\n", encoding="utf-8")

    out_dir = tmp_path / "public"
    env = {
        "GITHUB_SERVER_URL": "https://github.com",
        "GITHUB_REPOSITORY": "example/portfolio",
        "GITHUB_RUN_ID": "12345",
        "GITHUB_REF": "refs/heads/main",
        "GITHUB_ACTOR": "automation-bot",
    }

    tasks = [
        Task(
            name="emit_marker",
            action=emit_marker,
            inputs=("registry/config.yaml",),
            outputs=("api/v1/marker.json",),
            deps=(),
        )
    ]
    context = TaskContext(out_dir=out_dir, env=env)
    runner = TaskRunner(tasks)
    run = runner.run(context)

    report_paths = emit_ops_reports(
        out_dir=out_dir,
        repo_root=REPO_ROOT,
        tasks=tasks,
        run=run,
        env=env,
    )

    assert report_paths["latest_run"].exists()
    assert report_paths["dag"].exists()
    assert report_paths["provenance"].exists()

    latest_run = json.loads(report_paths["latest_run"].read_text(encoding="utf-8"))
    assert latest_run["run"]["status"] == "success"
    assert "git_sha" in latest_run["run"]
    assert "timestamp" in latest_run["run"]
    assert latest_run["run"]["action_run_url"] == "https://github.com/example/portfolio/actions/runs/12345"
    assert latest_run["summary"]["success"] == 1
    assert latest_run["tasks"][0]["name"] == "emit_marker"
    assert latest_run["tasks"][0]["status"] == "success"
    assert latest_run["tasks"][0]["duration_seconds"] >= 0.0

    dag = json.loads(report_paths["dag"].read_text(encoding="utf-8"))
    assert len(dag["tasks"]) == 1
    assert dag["tasks"][0]["name"] == "emit_marker"
    assert dag["edges"] == []

    provenance = json.loads(report_paths["provenance"].read_text(encoding="utf-8"))
    assert provenance["action_run_url"] == "https://github.com/example/portfolio/actions/runs/12345"
    assert provenance["environment"]["github_run_id"] == "12345"
    assert provenance["artifacts"]["latest_run"] == "ops/latest-run.json"

