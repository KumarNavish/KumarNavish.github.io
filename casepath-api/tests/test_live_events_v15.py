from __future__ import annotations

import json
from pathlib import Path
import threading
import time
from typing import Any

from fastapi.testclient import TestClient
import pytest

import casepath_api.app as app_module
from casepath_api.canonicalizer import MODEL_MODE_REFERENCE
from casepath_api.pipeline_v15 import ClaimPipeline
from casepath_api.storage import Storage


SESSION_A = "session-a-12345678"
SESSION_B = "session-b-12345678"


def headers(session_id: str = SESSION_A) -> dict[str, str]:
    return {"X-CasePath-Session": session_id}


@pytest.fixture
def client(tmp_path: Path, monkeypatch) -> TestClient:
    storage = Storage(str(tmp_path / "events.db"))
    pipeline = ClaimPipeline(
        storage, model_mode=MODEL_MODE_REFERENCE, pace_seconds=0
    )
    monkeypatch.setattr(app_module, "storage", storage)
    monkeypatch.setattr(app_module, "pipeline", pipeline)
    monkeypatch.setattr(app_module, "held_out_pipeline", pipeline)
    return TestClient(app_module.app)


def create_completed_run(client: TestClient) -> tuple[str, dict[str, Any]]:
    response = client.post(
        "/api/runs",
        json={"claim_id": "DEMO-MOULD-002", "knowledge_mode": "current"},
        headers=headers(),
    )
    assert response.status_code == 202
    run_id = response.json()["run_id"]
    for _ in range(500):
        run_response = client.get(f"/api/runs/{run_id}", headers=headers())
        assert run_response.status_code == 200
        run = run_response.json()
        if run["status"] in {"complete", "failed"}:
            assert run["status"] == "complete", run.get("error")
            return run_id, run
        time.sleep(0.01)
    raise AssertionError("run timeout")


def decode_sse(body: str) -> list[dict[str, Any]]:
    return [
        json.loads(line.removeprefix("data: "))
        for line in body.splitlines()
        if line.startswith("data: ")
    ]


def recursively_contains_key(value: Any, forbidden: set[str]) -> bool:
    if isinstance(value, dict):
        return bool(forbidden & set(value)) or any(
            recursively_contains_key(item, forbidden) for item in value.values()
        )
    if isinstance(value, list):
        return any(recursively_contains_key(item, forbidden) for item in value)
    return False


def test_stream_replays_exact_audit_and_semantic_events_then_closes(
    client: TestClient,
):
    run_id, run = create_completed_run(client)

    response = client.get(f"/api/runs/{run_id}/events", headers=headers())

    assert response.status_code == 200
    assert response.headers["content-type"].startswith("text/event-stream")
    assert response.headers["cache-control"] == "no-cache, no-transform"
    assert response.headers["connection"] == "keep-alive"
    assert response.headers["x-accel-buffering"] == "no"
    events = decode_sse(response.text)
    assert [item["sequence"] for item in events] == list(
        range(1, len(events) + 1)
    )
    assert events[-1]["type"] == "run.completed"
    assert events[-1]["status"] == "complete"
    assert events[-1]["entity"] == {
        "kind": "run",
        "id": run_id,
        "status": "complete",
    }
    audit_by_id = {item["event_id"]: item for item in run["events"]}
    mirrored = [item for item in events if item["type"] == "run.activity"]
    assert len(mirrored) == len(audit_by_id)
    assert all(
        item["audit_event"] == audit_by_id[item["audit_event"]["event_id"]]
        for item in mirrored
    )
    event_types = {item["type"] for item in events}
    assert {
        "fact.accepted",
        "legal_source.linked",
        "process_node.created",
        "branch.created",
        "evidence_requirement.linked",
        "precedent.selected",
        "verification.accepted",
    } <= event_types
    assert not recursively_contains_key(
        events,
        {"raw_output", "raw_response", "reasoning", "canonical_output"},
    )


def test_process_and_evidence_projection_follow_verification_gate(
    client: TestClient,
):
    run_id, _ = create_completed_run(client)
    events = decode_sse(
        client.get(f"/api/runs/{run_id}/events", headers=headers()).text
    )
    verified_sequence = max(
        item["sequence"]
        for item in events
        if item["type"] == "run.activity"
        and item["audit_event"].get("stage") == "verify"
        and item["audit_event"].get("status") == "completed"
    )
    projected = [
        item
        for item in events
        if item["type"]
        in {
            "process_node.created",
            "branch.created",
            "evidence_requirement.linked",
        }
    ]
    assert projected
    assert all(item["sequence"] > verified_sequence for item in projected)
    assert all(item["acceptance"]["state"] == "accepted" for item in projected)


def test_stream_replay_after_cursor_and_session_isolation(client: TestClient):
    run_id, _ = create_completed_run(client)
    all_events = decode_sse(
        client.get(f"/api/runs/{run_id}/events", headers=headers()).text
    )
    cursor = all_events[len(all_events) // 2]["sequence"]

    replay = client.get(
        f"/api/runs/{run_id}/events?after={cursor}", headers=headers()
    )

    assert replay.status_code == 200
    replayed = decode_sse(replay.text)
    assert replayed == [item for item in all_events if item["sequence"] > cursor]
    assert client.get(f"/api/runs/{run_id}/events").status_code == 400
    assert (
        client.get(
            f"/api/runs/{run_id}/events", headers=headers(SESSION_B)
        ).status_code
        == 404
    )
    assert (
        client.get(
            f"/api/runs/{run_id}/events?after=-1", headers=headers()
        ).status_code
        == 422
    )


def test_outbox_wakes_waiters_and_terminal_is_idempotent(tmp_path: Path):
    storage = Storage(str(tmp_path / "storage.db"))
    run_id = storage.create_run("claim", session_id=SESSION_A)
    revision = storage.stream_revision(run_id)

    worker = threading.Thread(
        target=lambda: storage.add_event(
            run_id,
            {
                "stage": "read",
                "agent": "Attachment Parsing Tool",
                "status": "started",
            },
        )
    )
    worker.start()
    changed = storage.wait_for_stream_change(run_id, revision, timeout=1)
    worker.join()
    assert changed != revision

    storage.patch_run(run_id, status="complete")
    storage.patch_run(run_id, status="complete")
    storage.add_event(
        run_id,
        {"stage": "review", "agent": "Reviewer", "status": "completed"},
    )
    events = storage.stream_events(run_id, session_id=SESSION_A)
    terminal = [item for item in events if item["type"] == "run.completed"]
    assert len(terminal) == 1
    assert events[-1] == terminal[0]
