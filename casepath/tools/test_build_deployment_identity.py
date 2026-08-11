from __future__ import annotations

import json
import sys
from pathlib import Path


TOOLS = Path(__file__).resolve().parent
if str(TOOLS) not in sys.path:
    sys.path.insert(0, str(TOOLS))

import build_deployment_identity as identity  # noqa: E402


def test_local_fallback_is_deterministic_and_never_aligned(tmp_path: Path) -> None:
    first = identity.build_payload({})
    second = identity.build_payload({"RENDER_GIT_COMMIT": "not-a-commit"})
    assert first == second
    assert first["release_id"] == "casepath-v20-reference-20260811"
    assert first["component_version"] == "20.0.0"
    assert first["source_commit"] == "unknown"
    assert first["alignment_eligible"] is False

    output = tmp_path / "deployment.json"
    identity.write_payload(output, first)
    assert json.loads(output.read_text(encoding="utf-8")) == first
    assert int(output.stat().st_mtime) == identity.SOURCE_DATE_EPOCH


def test_render_commit_is_normalized_and_alignment_eligible() -> None:
    commit = "ABCDEF0123456789ABCDEF0123456789ABCDEF01"
    payload = identity.build_payload({"RENDER_GIT_COMMIT": commit})
    assert payload["source_commit"] == commit.lower()
    assert payload["source_commit_source"] == "RENDER_GIT_COMMIT"
    assert payload["alignment_eligible"] is True
