"""Tests for pipeline task runner and ops reporting."""

from __future__ import annotations

import json
from pathlib import Path

from pipeline.core import Task, TaskContext, TaskRunner, emit_ops_reports

REPO_ROOT = Path(__file__).resolve().parents[2]


def _noop_task(_: TaskContext) -> None:
    """No-op task action for DAG ordering tests."""


def _warn_task(context: TaskContext) -> None:
    """Emit a warning log for report serialization checks."""
    context.warn("test warning")


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
        "GITHUB_EVENT_NAME": "push",
        "GITHUB_WORKFLOW": "pages",
        "GITHUB_RUN_ATTEMPT": "1",
    }

    tasks = [
        Task(
            name="emit_marker",
            action=emit_marker,
            inputs=("registry/config.yaml",),
            outputs=("api/v1/marker.json",),
            deps=(),
        ),
        Task(
            name="warn_marker",
            action=_warn_task,
            inputs=("api/v1/marker.json",),
            outputs=(),
            deps=("emit_marker",),
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
    assert latest_run["run"]["trigger"]["event_name"] == "push"
    assert latest_run["run"]["trigger"]["is_scheduled"] is False
    assert latest_run["summary"]["success"] == 2
    assert latest_run["tasks"][0]["name"] == "emit_marker"
    assert latest_run["tasks"][0]["status"] == "success"
    assert latest_run["tasks"][0]["duration_seconds"] >= 0.0
    assert latest_run["tasks"][1]["name"] == "warn_marker"
    assert latest_run["tasks"][1]["logs"][0]["level"] == "warning"

    dag = json.loads(report_paths["dag"].read_text(encoding="utf-8"))
    assert len(dag["tasks"]) == 2
    assert dag["tasks"][0]["name"] == "emit_marker"
    assert dag["edges"] == [{"from": "emit_marker", "to": "warn_marker"}]

    provenance = json.loads(report_paths["provenance"].read_text(encoding="utf-8"))
    assert provenance["action_run_url"] == "https://github.com/example/portfolio/actions/runs/12345"
    assert provenance["environment"]["github_run_id"] == "12345"
    assert provenance["environment"]["github_event_name"] == "push"
    assert provenance["trigger"]["workflow"] == "pages"
    assert provenance["artifacts"]["latest_run"] == "ops/latest-run.json"


def test_emit_ops_reports_lists_resume_artifact_when_present(tmp_path: Path) -> None:
    """Provenance should expose generated resume artifact path when emitted."""
    out_dir = tmp_path / "public"
    resume_path = out_dir / "artifacts" / "resume.pdf"
    resume_path.parent.mkdir(parents=True, exist_ok=True)
    resume_path.write_bytes(b"%PDF-1.4\n%mock\n")

    task = Task(name="extract", action=_noop_task)
    context = TaskContext(out_dir=out_dir, env={})
    run = TaskRunner([task]).run(context)
    reports = emit_ops_reports(
        out_dir=out_dir,
        repo_root=REPO_ROOT,
        tasks=[task],
        run=run,
        env={},
    )

    provenance = json.loads(reports["provenance"].read_text(encoding="utf-8"))
    assert provenance["artifacts"]["resume_pdf"] == "artifacts/resume.pdf"


def test_emit_ops_reports_includes_schedule_trigger_metadata(tmp_path: Path) -> None:
    """Scheduled runs should include cron metadata in reports."""
    event_path = tmp_path / "event.json"
    event_path.write_text("{\"schedule\": \"0 3 * * 1\"}\n", encoding="utf-8")
    out_dir = tmp_path / "public"
    env = {
        "GITHUB_EVENT_NAME": "schedule",
        "GITHUB_EVENT_PATH": str(event_path),
        "GITHUB_WORKFLOW": "schedule",
        "GITHUB_RUN_ATTEMPT": "2",
    }

    task = Task(name="extract", action=_noop_task)
    run = TaskRunner([task]).run(TaskContext(out_dir=out_dir, env=env))
    reports = emit_ops_reports(
        out_dir=out_dir,
        repo_root=REPO_ROOT,
        tasks=[task],
        run=run,
        env=env,
    )

    latest_run = json.loads(reports["latest_run"].read_text(encoding="utf-8"))
    provenance = json.loads(reports["provenance"].read_text(encoding="utf-8"))

    assert latest_run["run"]["trigger"]["event_name"] == "schedule"
    assert latest_run["run"]["trigger"]["is_scheduled"] is True
    assert latest_run["run"]["trigger"]["schedule"] == "0 3 * * 1"
    assert provenance["trigger"]["schedule"] == "0 3 * * 1"
