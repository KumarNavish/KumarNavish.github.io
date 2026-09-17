#!/usr/bin/env python3
import json, os, sqlite3, time
from pathlib import Path
from urllib.request import Request, urlopen

BASE = "http://127.0.0.1:" + os.environ.get("PORT", "10000")
EXPECTED = os.environ["CASEPATH_SOURCE_COMMIT"]
WORK_DB = Path(os.environ.get("CASEPATH_DB_PATH", "/tmp/casepath-reviewer/casepath.db")).parent / "agent-work-v1.sqlite3"

def call(path, method="GET", body=None, headers=None, timeout=30):
    data = None if body is None else json.dumps(body, separators=(",", ":")).encode()
    request = Request(BASE + path, data=data, method=method, headers={
        "Accept": "application/json",
        **({"Content-Type": "application/json"} if data is not None else {}),
        **(headers or {}),
    })
    with urlopen(request, timeout=timeout) as response:
        return response.status, json.loads(response.read())

def first_claim(value):
    if isinstance(value, dict):
        if isinstance(value.get("claim_id"), str):
            return value["claim_id"]
        for child in value.values():
            found = first_claim(child)
            if found:
                return found
    elif isinstance(value, list):
        for child in value:
            found = first_claim(child)
            if found:
                return found
    return None

deadline = time.time() + 90
last = None
while time.time() < deadline:
    try:
        _, health = call("/healthz", timeout=3)
        if health.get("status") == "ok":
            break
    except Exception as exc:
        last = repr(exc)
    time.sleep(0.5)
else:
    raise SystemExit("reviewer acceptance: server never became healthy: " + str(last))

_, health = call("/healthz")
_, ready = call("/readyz")
_, queue = call("/api/claim-loops/v1/workspace/claims?limit=1")
claim_id = first_claim(queue)
if not claim_id:
    raise SystemExit("reviewer acceptance: no seeded claim found")
_, context = call(f"/api/agent-work/v1/claims/{claim_id}/context")
context_sha = context.get("context_sha256")
if not isinstance(context_sha, str):
    raise SystemExit("reviewer acceptance: context hash missing")

_, started = call(
    f"/api/agent-work/v1/claims/{claim_id}/runs",
    method="POST",
    body={
        "idempotency_key": "reviewer-release-acceptance-v2",
        "expected_context_sha256": context_sha,
        "facts_worker": "reference",
    },
    headers={"X-CasePath-Agent-Work": "1"},
)
summary = started.get("summary") or {}
run_id = summary.get("run_id")
if not isinstance(run_id, str):
    raise SystemExit("reviewer acceptance: run id missing")

deadline = time.time() + 300
run_status = None
while time.time() < deadline:
    try:
        with sqlite3.connect(f"file:{WORK_DB.as_posix()}?mode=ro", uri=True, timeout=2) as db:
            row = db.execute("SELECT status FROM work_runs WHERE run_id=?", (run_id,)).fetchone()
        run_status = row[0] if row else None
    except sqlite3.Error:
        run_status = None
    if run_status in {"completed", "blocked", "failed", "interrupted"}:
        break
    time.sleep(0.5)
else:
    raise SystemExit("reviewer acceptance: review did not reach a terminal journal state")

_, current = call(f"/api/agent-work/v1/claims/{claim_id}/runs/{run_id}", timeout=60)
terminal = current.get("summary") or {}
_, events = call(f"/api/agent-work/v1/claims/{claim_id}/runs/{run_id}/events?limit=500", timeout=60)
event_rows = events.get("events") or []
role_rows = terminal.get("roles") or []
checks = {
    "health_ok": health.get("status") == "ok",
    "source_commit": health.get("source_commit"),
    "source_commit_aligned": health.get("source_commit_aligned") is True,
    "expected_source_commit": EXPECTED,
    "ready": ready.get("status") == "ready",
    "claim_count": queue.get("total_count"),
    "authority": queue.get("authority"),
    "run_id": run_id,
    "run_status": terminal.get("status"),
    "journal_status": run_status,
    "completed_roles": terminal.get("completed_roles"),
    "role_count": terminal.get("role_count"),
    "roles": [{"id": r.get("id"), "status": r.get("status")} for r in role_rows],
    "event_count": len(event_rows),
    "last_sequence": terminal.get("last_sequence"),
    "provider_requests": terminal.get("provider_requests"),
    "provider_cost_usd": terminal.get("provider_cost_usd"),
    "pending_calls": terminal.get("pending_calls"),
}
required = (
    checks["health_ok"]
    and checks["source_commit"] == EXPECTED
    and checks["source_commit_aligned"]
    and checks["ready"]
    and checks["claim_count"] == 150
    and checks["authority"] == "claim_loop_events"
    and checks["run_status"] == "completed"
    and checks["journal_status"] == "completed"
    and checks["completed_roles"] == 6
    and checks["role_count"] == 6
    and len(checks["roles"]) == 6
    and all(r["status"] == "completed" for r in checks["roles"])
    and checks["event_count"] >= 1
    and checks["last_sequence"] == checks["event_count"]
    and checks["provider_requests"] == 0
    and checks["provider_cost_usd"] == 0
    and checks["pending_calls"] == []
)
print("CASEPATH_REVIEWER_ACCEPTANCE " + json.dumps(checks, sort_keys=True, separators=(",", ":")), flush=True)
if not required:
    raise SystemExit("reviewer acceptance: invariant failed")
