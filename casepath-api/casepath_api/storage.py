from __future__ import annotations

import json
import os
from pathlib import Path
import secrets
import sqlite3
import threading
from datetime import datetime, timezone
from typing import Any


def now() -> str:
    return datetime.now(timezone.utc).isoformat()


class Storage:
    def __init__(self, path: str | None = None):
        self.path = Path(path or os.getenv("CASEPATH_DB_PATH", "/tmp/casepath-useful-demo/casepath.db"))
        self.path.parent.mkdir(parents=True, exist_ok=True)
        self.lock = threading.RLock()
        self.init()

    def connect(self):
        con = sqlite3.connect(self.path, timeout=30, check_same_thread=False)
        con.row_factory = sqlite3.Row
        return con

    def init(self):
        with self.connect() as con:
            con.executescript(
                """
                PRAGMA journal_mode=WAL;
                CREATE TABLE IF NOT EXISTS runs (
                    run_id TEXT PRIMARY KEY,
                    claim_id TEXT NOT NULL,
                    status TEXT NOT NULL,
                    payload TEXT NOT NULL,
                    created_at TEXT NOT NULL,
                    updated_at TEXT NOT NULL
                );
                CREATE TABLE IF NOT EXISTS events (
                    event_id TEXT PRIMARY KEY,
                    run_id TEXT NOT NULL,
                    ordinal INTEGER NOT NULL,
                    payload TEXT NOT NULL,
                    created_at TEXT NOT NULL
                );
                CREATE TABLE IF NOT EXISTS reviews (
                    review_id TEXT PRIMARY KEY,
                    run_id TEXT NOT NULL,
                    claim_id TEXT NOT NULL,
                    payload TEXT NOT NULL,
                    created_at TEXT NOT NULL
                );
                CREATE TABLE IF NOT EXISTS memories (
                    memory_id TEXT PRIMARY KEY,
                    claim_id TEXT NOT NULL UNIQUE,
                    payload TEXT NOT NULL,
                    created_at TEXT NOT NULL,
                    updated_at TEXT NOT NULL
                );
                CREATE TABLE IF NOT EXISTS candidates (
                    candidate_id TEXT PRIMARY KEY,
                    payload TEXT NOT NULL,
                    created_at TEXT NOT NULL,
                    updated_at TEXT NOT NULL
                );
                """
            )

    @staticmethod
    def ident(prefix: str) -> str:
        return f"{prefix}_{secrets.token_hex(8)}"

    def create_run(self, claim_id: str) -> str:
        run_id = self.ident("run")
        payload = {"run_id": run_id, "claim_id": claim_id, "status": "queued", "events": []}
        with self.lock, self.connect() as con:
            con.execute(
                "INSERT INTO runs VALUES (?,?,?,?,?,?)",
                (run_id, claim_id, "queued", json.dumps(payload), now(), now()),
            )
        return run_id

    def patch_run(self, run_id: str, *, status: str | None = None, patch: dict[str, Any] | None = None):
        with self.lock, self.connect() as con:
            row = con.execute("SELECT * FROM runs WHERE run_id=?", (run_id,)).fetchone()
            if not row:
                raise KeyError(run_id)
            payload = json.loads(row["payload"])
            if patch:
                payload.update(patch)
            if status:
                payload["status"] = status
            con.execute(
                "UPDATE runs SET status=?, payload=?, updated_at=? WHERE run_id=?",
                (status or row["status"], json.dumps(payload, ensure_ascii=False), now(), run_id),
            )

    def add_event(self, run_id: str, payload: dict[str, Any]) -> dict[str, Any]:
        with self.lock, self.connect() as con:
            ordinal = con.execute("SELECT COUNT(*) FROM events WHERE run_id=?", (run_id,)).fetchone()[0] + 1
            event = {"event_id": self.ident("evt"), "ordinal": ordinal, "created_at": now(), **payload}
            con.execute(
                "INSERT INTO events VALUES (?,?,?,?,?)",
                (event["event_id"], run_id, ordinal, json.dumps(event, ensure_ascii=False), event["created_at"]),
            )
        return event

    def get_run(self, run_id: str) -> dict[str, Any] | None:
        with self.connect() as con:
            row = con.execute("SELECT * FROM runs WHERE run_id=?", (run_id,)).fetchone()
            if not row:
                return None
            payload = json.loads(row["payload"])
            events = [json.loads(r["payload"]) for r in con.execute("SELECT payload FROM events WHERE run_id=? ORDER BY ordinal", (run_id,))]
            return {**payload, "events": events, "created_at": row["created_at"], "updated_at": row["updated_at"]}

    def save_review(self, run_id: str, claim_id: str, payload: dict[str, Any]) -> str:
        review_id = self.ident("review")
        with self.lock, self.connect() as con:
            con.execute("INSERT INTO reviews VALUES (?,?,?,?,?)", (review_id, run_id, claim_id, json.dumps(payload, ensure_ascii=False), now()))
        return review_id

    def save_memory(self, claim_id: str, payload: dict[str, Any]) -> str:
        with self.lock, self.connect() as con:
            row = con.execute("SELECT memory_id FROM memories WHERE claim_id=?", (claim_id,)).fetchone()
            if row:
                con.execute("UPDATE memories SET payload=?, updated_at=? WHERE claim_id=?", (json.dumps(payload, ensure_ascii=False), now(), claim_id))
                return row["memory_id"]
            memory_id = self.ident("memory")
            stamp = now()
            con.execute("INSERT INTO memories VALUES (?,?,?,?,?)", (memory_id, claim_id, json.dumps(payload, ensure_ascii=False), stamp, stamp))
            return memory_id

    def memories(self) -> list[dict[str, Any]]:
        with self.connect() as con:
            return [
                {"memory_id": r["memory_id"], "claim_id": r["claim_id"], **json.loads(r["payload"]), "updated_at": r["updated_at"]}
                for r in con.execute("SELECT * FROM memories ORDER BY updated_at DESC")
            ]

    def save_candidate(self, candidate_id: str, payload: dict[str, Any]):
        with self.lock, self.connect() as con:
            row = con.execute("SELECT candidate_id FROM candidates WHERE candidate_id=?", (candidate_id,)).fetchone()
            stamp = now()
            if row:
                con.execute("UPDATE candidates SET payload=?, updated_at=? WHERE candidate_id=?", (json.dumps(payload, ensure_ascii=False), stamp, candidate_id))
            else:
                con.execute("INSERT INTO candidates VALUES (?,?,?,?)", (candidate_id, json.dumps(payload, ensure_ascii=False), stamp, stamp))

    def candidates(self) -> list[dict[str, Any]]:
        with self.connect() as con:
            return [{"candidate_id": r["candidate_id"], **json.loads(r["payload"])} for r in con.execute("SELECT * FROM candidates ORDER BY updated_at DESC")]

    def reset(self):
        with self.lock, self.connect() as con:
            con.executescript("DELETE FROM events; DELETE FROM runs; DELETE FROM reviews; DELETE FROM memories; DELETE FROM candidates;")
