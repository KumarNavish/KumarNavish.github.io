#!/usr/bin/env python3
"""Generate and verify CasePath source and artifact release manifests."""

from __future__ import annotations

import argparse
from collections.abc import Mapping
import hashlib
import json
import math
import mimetypes
import os
import re
import stat
import subprocess
import sys
from datetime import date, datetime
from email import policy
from email.parser import BytesParser
from pathlib import Path
from typing import Any, Iterable

import yaml
from PIL import Image
from pypdf import PdfReader


REPOSITORY = Path(__file__).resolve().parents[2]
RELEASE_PATH = REPOSITORY / "casepath" / "release.json"
SOURCE_MANIFEST_PATH = REPOSITORY / "casepath" / "source-manifest.json"
ARTIFACT_ROOT = REPOSITORY / "casepath-api" / "artifacts"
ARTIFACT_MANIFEST_PATH = ARTIFACT_ROOT / "artifact-manifest.json"
SOURCE_DATE_EPOCH = int(os.environ.get("SOURCE_DATE_EPOCH", "1786406400"))
RELEASE_CONTRACT = "casepath.release-contract/2.2.0"
REQUIRED_PRODUCTION_MODE = "openrouter_nemotron"
REQUIRED_PRODUCTION_MODEL = "nvidia/nemotron-3-ultra-550b-a55b"
ACCEPTED_PRODUCTION_RESPONSE_MODELS = {
    REQUIRED_PRODUCTION_MODEL,
    "nvidia/nemotron-3-ultra-550b-a55b-20260604",
}
PROVIDER_PROVENANCE_LIMITS = {
    "response_id": 160,
    "response_model": 160,
    "upstream_provider": 80,
}
PROVIDER_PROVENANCE_PATTERNS = {
    "response_id": re.compile(r"^[A-Za-z0-9][A-Za-z0-9._-]{2,159}$"),
    "upstream_provider": re.compile(r"^[A-Za-z0-9][A-Za-z0-9._-]{1,79}$"),
}
OPENROUTER_GENERATION_ID_PATTERN = re.compile(
    r"^gen-[0-9]{10}-[A-Za-z0-9]{20}$"
)
FORBIDDEN_PROVIDER_PROVENANCE_MARKERS = (
    "authorization",
    "api_key",
    "apikey",
    "bearer ",
    "credential",
    "sk-or-",
    "sk-",
    "secret",
    "sentinel",
    "customer",
    "landlord",
    "lease",
    "mould",
    "moisture",
    "tenant",
)
ACCEPTED_FINISH_REASONS = {
    "stop",
    "length",
    "tool_calls",
    "content_filter",
    "error",
    "cancelled",
}
PROVIDER_PROVENANCE_FIELDS = {
    "response_id",
    "response_model",
    "upstream_provider",
    "finish_reason",
}
ACCEPTED_USAGE_SOURCES = {"response", "generation_metadata"}
FORBIDDEN_PUBLIC_FIELDS = {
    "api_key",
    "canonical_output",
    "chain_of_thought",
    "completion",
    "messages",
    "private_reference",
    "prompt",
    "provider_credential",
    "raw",
    "raw_output",
    "raw_prompt",
    "reasoning",
    "request_body",
    "response_body",
    "system_prompt",
    "user_prompt",
}
ALLOWED_MODEL_LEDGER_FIELDS = {
    "call_id",
    "provider",
    "provider_endpoint",
    "upstream_provider",
    "model",
    "implementation",
    "orchestration_id",
    "agent_id",
    "agent_role",
    "parent_call_id",
    "delegation_id",
    "call_count",
    "prompt_tokens",
    "completion_tokens",
    "total_tokens",
    "estimated_cost_usd",
    "actual_cost_usd",
    "latency_ms",
    "cache_key",
    "purpose",
    "outcome",
    "error_type",
    "error_agent_id",
    "error_fact_id",
    "error_invariant",
    "provider_error_code",
    "invalid_provenance_field",
    "invalid_provenance_value_hash",
    "ignored_noncontrolling_normalized_proposals",
    "authority_mode",
    "accepted_fact_ids",
    "accepted_fact_count",
    "rejected_facts",
    "rejected_fact_count",
    "source_reference_projection_fact_ids",
    "source_reference_projection_count",
    "accepted_item_ids",
    "accepted_item_count",
    "rejected_items",
    "rejected_item_count",
    "ignored_proposal_count",
    "deterministic_fallback_applied",
    "response_id",
    "origin_call_id",
    "origin_usage",
    "origin_finish_reason",
    "response_model",
    "generation_model",
    "usage_source",
    "metadata_poll_count",
    "metadata_latency_ms",
    "finish_reason",
    "created_at",
    "updated_at",
}
MODEL_LEDGER_SUMMARY_FIELDS = {
    "records",
    "network_calls",
    "prompt_tokens",
    "completion_tokens",
    "total_tokens",
    "actual_cost_usd",
    "actual_cost_complete",
    "unknown_cost_call_count",
    "outcomes",
}
ORIGIN_USAGE_FIELDS = {
    "prompt_tokens",
    "completion_tokens",
    "total_tokens",
    "actual_cost_usd",
    "usage_source",
}
REQUIRED_RUNTIME_PROFILE = "nemotron_langgraph_multi_agent_hybrid_guarded"
REQUIRED_ORCHESTRATION_SCHEMA = "casepath.nemotron-agent-dag/1.0.0"
REQUIRED_AUTHORITY_MODE = "multi_agent_hybrid_guarded"
REQUIRED_AGENT_IMPLEMENTATION = "langgraph_stategraph_langchain_openrouter"
REQUIRED_FRAMEWORK = {
    "langchain": "1.3.14",
    "langgraph": "1.2.9",
    "langchain_openrouter": "0.2.7",
}
REQUIRED_MODEL_AGENTS = (
    {
        "agent_id": "canonical_facts",
        "role": "Guarded Canonical Facts Agent",
        "stage": "canonicalization",
    },
    {
        "agent_id": "orchestrator_plan",
        "role": "Nemotron Orchestrator",
        "stage": "orchestration_plan",
    },
    {
        "agent_id": "document_source_integrity",
        "role": "Document and Source Integrity Agent",
        "stage": "parallel_specialist",
    },
    {
        "agent_id": "process_decision_mapping",
        "role": "Process Decision Mapping Agent",
        "stage": "parallel_specialist",
    },
    {
        "agent_id": "evidence_checklist",
        "role": "Evidence and Checklist Agent",
        "stage": "post_process_gate",
    },
    {
        "agent_id": "final_claim_brief_audit",
        "role": "Final Claim Brief Agent",
        "stage": "post_evidence_gate",
    },
)
REQUIRED_DETERMINISTIC_GATES = (
    {
        "gate_id": "deterministic_process_gate",
        "role": "Deterministic Process Contract Gate",
    },
    {
        "gate_id": "deterministic_evidence_gate",
        "role": "Deterministic Evidence Contract Gate",
    },
    {
        "gate_id": "whole_playbook_gate",
        "role": "Deterministic Whole-Playbook Gate",
    },
)
REQUIRED_PARALLEL_GROUPS = (("document_source_integrity", "process_decision_mapping"),)
REQUIRED_EXECUTION_TOPOLOGY = {
    "authority": "deterministic_application",
    "implementation": "compiled_langgraph_stategraph",
    "delegations": [
        {
            "agent_id": "document_source_integrity",
            "dependencies": ["orchestrator_plan"],
        },
        {
            "agent_id": "process_decision_mapping",
            "dependencies": ["orchestrator_plan"],
        },
        {
            "agent_id": "evidence_checklist",
            "dependencies": ["deterministic_process_gate"],
        },
        {
            "agent_id": "final_claim_brief_audit",
            "dependencies": ["deterministic_evidence_gate"],
        },
    ],
    "parallel_groups": [
        ["document_source_integrity", "process_decision_mapping"],
    ],
}
REQUIRED_RUNTIME_ACCEPTANCE_FLAGS = (
    "requires_successful_call_binding",
    "requires_positive_actual_cost",
    "requires_positive_token_counts",
    "requires_single_orchestration_binding",
    "requires_complete_required_agent_set",
    "requires_distinct_call_ids",
    "requires_distinct_response_ids",
    "requires_positive_accepted_contribution_per_agent",
    "requires_accepted_majority_per_agent",
    "requires_cold_network_run",
    "requires_deterministic_gate_passes",
    "requires_guarded_fallback_disclosure",
    "requires_source_reference_projection_disclosure",
)
RUNTIME_VERDICT_AUTHORITY = "dynamic_same_commit_qa_artifacts"
QA_REPORT_PATH = "report.json"
QA_EVIDENCE_MANIFEST_PATH = "evidence-manifest.json"
QA_EVIDENCE_MANIFEST_CONTRACT = "casepath.qa-evidence-manifest/1.0.0"
HISTORICAL_MODEL_VALIDATION_RECORDS = tuple(
    f"casepath/releases/model-validation-attempt-20260811-{number:02d}.json"
    for number in range(1, 10)
)
_HISTORICAL_TOP_FIELDS = frozenset(
    {
        "contract",
        "release_id",
        "attempt_id",
        "status",
        "acceptance_passed",
        "model_backed_release_evidence",
        "requested_runtime",
        "provider_observation",
        "accepted_ledger_record",
        "application_result",
        "sanitization",
    }
)
_HISTORICAL_EXECUTION_FIELDS = {
    "production-flagship-20260811-06": frozenset(
        "source_commit qa_deploy_id qa_deploy_outcome qa_run_id orchestration_id "
        "failed_agent_id provider_response_count downstream_model_calls "
        "deterministic_gate_receipts".split()
    ),
    "production-flagship-20260811-07": frozenset(
        "source_commit frontend_deploy_id api_deploy_id qa_deploy_id "
        "qa_deploy_outcome qa_run_id orchestration_id failed_agent_id "
        "provider_response_count downstream_model_calls deterministic_gate_receipts".split()
    ),
    "production-flagship-20260811-08": frozenset(
        "source_commit qa_deploy_id qa_deploy_outcome qa_deploy_started_at "
        "qa_error_at qa_build_failed_at qa_deploy_finished_at qa_run_id "
        "orchestration_id failed_agent_id provider_response_count "
        "downstream_model_calls downstream_agent_receipts deterministic_gate_receipts".split()
    ),
    "production-flagship-20260811-09": frozenset(
        "source_commit qa_deploy_id qa_deploy_outcome qa_deploy_created_at "
        "qa_deploy_finished_at qa_run_id ledger_created_at ledger_updated_at "
        "orchestration_id failed_agent_id network_call_count downstream_model_calls".split()
    ),
}
_HISTORICAL_PROVIDER_FIELDS = {
    "authorized-smoke-20260811-01": frozenset(
        "canonical_model_id upstream_provider actual_cost_usd prompt_tokens "
        "completion_tokens total_tokens finish_reason".split()
    ),
    "authorized-smoke-20260811-02": frozenset(
        "provider provider_outcome upstream_provider response_model response_id "
        "actual_cost_usd prompt_tokens completion_tokens total_tokens finish_reason".split()
    ),
    "authorized-smoke-20260811-03": frozenset(
        "provider provider_outcome synchronous_usage_cost_present "
        "new_openrouter_log_generation_observed provider_cache_replay_assessment "
        "charge_status charge_included_in_known_aggregate".split()
    ),
    "authorized-smoke-20260811-04": frozenset(
        "provider provider_outcome upstream_provider response_model response_id "
        "actual_cost_usd prompt_tokens completion_tokens total_tokens finish_reason".split()
    ),
    "production-flagship-20260811-05": frozenset(
        "provider provider_outcome response_model response_id actual_cost_usd "
        "prompt_tokens completion_tokens total_tokens finish_reason".split()
    ),
    "production-flagship-20260811-06": frozenset(
        "provider provider_outcome response_model response_id actual_cost_usd "
        "prompt_tokens completion_tokens total_tokens finish_reason usage_source latency_ms".split()
    ),
    "production-flagship-20260811-07": frozenset(
        "provider provider_outcome response_http_status sdk sdk_version sdk_error_type "
        "response_identity_status synchronous_usage_cost_present "
        "new_openrouter_log_generation_observed openrouter_log_check_performed "
        "provider_cache_replay_assessment charge_status "
        "charge_included_in_known_aggregate estimated_cost_reservation_usd "
        "estimated_reservation_is_actual_charge latency_ms".split()
    ),
    "production-flagship-20260811-08": frozenset(
        "provider provider_outcome requested_model response_model response_id "
        "actual_cost_usd prompt_tokens completion_tokens total_tokens finish_reason "
        "latency_ms bounded_generation_metadata_lookup "
        "later_generation_metadata_observation".split()
    ),
    "production-flagship-20260811-09": frozenset(
        "provider provider_outcome requested_model response_identity_status "
        "routing_diagnosis upstream_request_log_observation generation_metadata_lookup "
        "synchronous_usage_cost_present openrouter_upstream_request_log_observed "
        "new_openrouter_log_generation_observed openrouter_log_check_performed "
        "provider_cache_replay_assessment charge_status "
        "charge_included_in_known_aggregate estimated_cost_reservation_usd "
        "estimated_reservation_is_actual_charge latency_ms".split()
    ),
}
_HISTORICAL_APPLICATION_FIELDS = {
    "authorized-smoke-20260811-01": frozenset(
        "outcome failure_type successful_ledger_call_bound ledger_call_id".split()
    ),
    "authorized-smoke-20260811-02": frozenset(
        "outcome failure_type successful_ledger_call_bound ledger_call_id "
        "ledger_outcome canonical_result_accepted".split()
    ),
    "authorized-smoke-20260811-03": frozenset(
        "outcome failure_type successful_ledger_call_bound ledger_call_id "
        "canonical_result_accepted".split()
    ),
    "authorized-smoke-20260811-04": frozenset(
        "outcome failure_type successful_ledger_call_bound ledger_call_id "
        "ledger_outcome canonical_result_accepted".split()
    ),
    "production-flagship-20260811-05": frozenset(
        "outcome failure_type successful_ledger_call_bound ledger_call_id ledger_outcome "
        "canonical_result_accepted accepted_fact_count rejected_fact_count "
        "rejected_invariants".split()
    ),
    "production-flagship-20260811-06": frozenset(
        "outcome failure_type error_type successful_ledger_call_bound ledger_call_id "
        "ledger_outcome canonical_result_accepted upstream_provider_persisted "
        "contribution_diagnostics_retained".split()
    ),
    "production-flagship-20260811-07": frozenset(
        "outcome failure_type error_type successful_ledger_call_bound ledger_call_id "
        "ledger_outcome canonical_result_accepted response_identity_retained "
        "usage_metadata_retained contribution_diagnostics_retained".split()
    ),
    "production-flagship-20260811-08": frozenset(
        "outcome failure_type error_type error_invariant successful_ledger_call_bound "
        "ledger_call_id ledger_outcome canonical_result_accepted "
        "response_identity_retained usage_metadata_retained "
        "later_generation_metadata_verified contribution_diagnostics_retained".split()
    ),
    "production-flagship-20260811-09": frozenset(
        "outcome failure_type error_type error_invariant successful_ledger_call_bound "
        "ledger_call_id ledger_outcome canonical_result_accepted "
        "response_identity_retained usage_metadata_retained "
        "accepted_generation_recovered contribution_diagnostics_retained".split()
    ),
}
_HISTORICAL_FAILURE_TYPES = {
    "authorized-smoke-20260811-01": "exact_private_reference_mismatch",
    "authorized-smoke-20260811-02": "non_controlling_normalized_value",
    "authorized-smoke-20260811-03": "usage_metadata_completeness",
    "authorized-smoke-20260811-04": "fact_dispute/source_reference_set",
    "production-flagship-20260811-05": "hybrid_model_contribution_strict_majority",
    "production-flagship-20260811-06": "post_validation_missing_upstream_provider_persistence",
    "production-flagship-20260811-07": "openrouter_sdk_chat_result_response_validation",
    "production-flagship-20260811-08": "same_generation_metadata_not_available_within_bounded_lookup",
    "production-flagship-20260811-09": "provider_response_envelope",
}
_HISTORICAL_PROVIDER_OUTCOMES = {
    "authorized-smoke-20260811-02": "succeeded",
    "authorized-smoke-20260811-03": "structured_content_returned",
    "authorized-smoke-20260811-04": "succeeded",
    "production-flagship-20260811-05": "succeeded",
    "production-flagship-20260811-06": "succeeded",
    "production-flagship-20260811-07": "http_200_response_schema_rejected_by_sdk",
    "production-flagship-20260811-08": "succeeded",
    "production-flagship-20260811-09": "upstream_rejected",
}
_HISTORICAL_ERROR_TYPES = {
    "production-flagship-20260811-06": "KeyError",
    "production-flagship-20260811-07": "ResponseValidationError",
    "production-flagship-20260811-08": "ModelResponseError",
    "production-flagship-20260811-09": "ModelResponseError",
}
_HISTORICAL_ERROR_INVARIANTS = {
    "production-flagship-20260811-08": "generation_metadata_completeness",
    "production-flagship-20260811-09": "provider_response_envelope",
}
_HISTORICAL_SOURCE_COMMIT_PATTERN = re.compile(r"^[0-9a-f]{40}$")
_HISTORICAL_DEPLOY_ID_PATTERN = re.compile(r"^dep-[a-z0-9]{12,40}$")
_HISTORICAL_RUN_ID_PATTERN = re.compile(r"^run_[0-9a-f]{16}$")
_HISTORICAL_ORCHESTRATION_ID_PATTERN = re.compile(r"^orch_[0-9a-f]{16}$")
_HISTORICAL_CALL_ID_PATTERN = re.compile(r"^modelcall_[0-9a-f]{16}$")
_HISTORICAL_LOCAL_TIME_PATTERN = re.compile(
    r"^[0-9]{4}-[0-9]{2}-[0-9]{2} [0-9]{2}:[0-9]{2} Europe/Zurich$"
)
REQUIRED_QA_EVIDENCE_FILES = {
    "deployment-identity.json",
    "release-contract.json",
    "readiness-receipt.json",
    "flagship-run.json",
    "flagship-cold-model-ledger.json",
    "flagship-cache-lineage.json",
    "runtime-versions.json",
    "02-live-nemotron-agent.png",
    "03-deterministic-accepted-artifact.png",
    "uninterrupted-focused-demo.webm",
}

SOURCE_ROOTS = ("casepath", "casepath-api", "casepath-qa")
EXTRA_SOURCE_FILES = ("render.yaml",)
SOURCE_EXCLUSIONS = {
    "casepath/deployment.json",
    "casepath/source-manifest.json",
}
OBSOLETE_CLAIM_IDS = {
    "BS-DEF-2026-041",
    "BS-RENT-2026-073",
    "BS-TERM-2026-088",
}
OBSOLETE_ACTIVE_MARKERS = {
    "later-window-condensation-2026-08-12.jpg",
    "2026-08-14T09:46:00Z",
    "Fri, 14 Aug 2026 09:46:00 +0200",
    "20260814-094600-SK",
    "Source photograph dated 12 August 2026.",
}
ACTIVE_SCENARIO_FILES = (
    "casepath/release.json",
    "casepath-api/generate_artifacts.py",
    "casepath-api/prepare_runtime_v12.py",
    "casepath-api/replace_photographic_evidence.py",
    "casepath-api/render-build.sh",
    "casepath-api/casepath_api/data.py",
)
EXPECTED_ARTIFACTS = {
    "bedroom-mould-2026-07-27.jpg",
    "defect-timeline.pdf",
    "delivery-receipt.pdf",
    "later-claim-email.eml",
    "later-window-condensation-2026-08-08.jpg",
    "lease-agreement.pdf",
    "management-reply.eml",
    "notification-email.eml",
    "window-replacement-notice.pdf",
}
MODEL_VISIBLE_FILES = EXPECTED_ARTIFACTS
MODEL_VISIBLE_PREFIXES = ("pages/",)
SOURCE_ASSET_HASHES = {
    "casepath-api/source-assets/flagship-bedroom-corner.png":
        "70645bf156c85d3d6f8117aaa94fe359f3e685c5576173bc0037dd3452dfd65e",
    "casepath-api/source-assets/later-window-condensation.png":
        "ab2e71da9706f8dcf54a65fae5d6dbab65f4790c708b0f05996b75e80a0fbff8",
}

LEAKAGE_PATTERNS = {
    "generated": re.compile(r"\bgenerated\b", re.IGNORECASE),
    "fictional": re.compile(r"\bfictional\b", re.IGNORECASE),
    "sample": re.compile(r"\bsample\b", re.IGNORECASE),
    "dummy": re.compile(r"\bdummy\b", re.IGNORECASE),
    "benchmark": re.compile(r"\bbenchmark\b", re.IGNORECASE),
    "demo": re.compile(r"\bdemo\b", re.IGNORECASE),
    "casepath": re.compile(r"\bcasepath\b", re.IGNORECASE),
    "hidden_label": re.compile(r"\bhidden[ _-]+labels?\b", re.IGNORECASE),
    "ground_truth": re.compile(r"\bground[ _-]+truths?\b", re.IGNORECASE),
    "expected_action": re.compile(r"\bexpected[ _-]+actions?\b", re.IGNORECASE),
    "reference_answer": re.compile(r"\breference[ _-]+answers?\b", re.IGNORECASE),
    "scenario_template": re.compile(r"\bscenario[ _-]+templates?\b", re.IGNORECASE),
    "example_domain": re.compile(r"(?:\.example\b|\bexample\.(?:com|net|org|test)\b)", re.IGNORECASE),
}


class VerificationError(RuntimeError):
    """Raised when a release invariant is not satisfied."""


def sha256_file(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as stream:
        for chunk in iter(lambda: stream.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def relative(path: Path) -> str:
    return path.relative_to(REPOSITORY).as_posix()


def write_json(path: Path, payload: dict[str, Any]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    temporary = path.with_name(f".{path.name}.tmp")
    temporary.write_text(
        json.dumps(payload, indent=2, sort_keys=True, ensure_ascii=False) + "\n",
        encoding="utf-8",
    )
    os.replace(temporary, path)
    os.utime(path, (SOURCE_DATE_EPOCH, SOURCE_DATE_EPOCH))


def load_json(path: Path) -> dict[str, Any]:
    try:
        value = json.loads(path.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError) as exc:
        raise VerificationError(f"Cannot read valid JSON from {relative(path)}: {exc}") from exc
    if not isinstance(value, dict):
        raise VerificationError(f"Expected an object in {relative(path)}")
    return value


def git_inventory() -> list[str]:
    command = [
        "git",
        "ls-files",
        "--cached",
        "--others",
        "--exclude-standard",
        "--",
        *SOURCE_ROOTS,
        *EXTRA_SOURCE_FILES,
    ]
    try:
        output = subprocess.check_output(command, cwd=REPOSITORY, text=True)
    except (OSError, subprocess.CalledProcessError) as exc:
        raise VerificationError(f"Unable to inventory repository files: {exc}") from exc

    paths: list[str] = []
    for candidate in output.splitlines():
        normalized = Path(candidate).as_posix()
        if normalized in SOURCE_EXCLUSIONS:
            continue
        if normalized.startswith("casepath-api/artifacts/"):
            continue
        full_path = REPOSITORY / normalized
        if full_path.is_file():
            paths.append(normalized)
    return sorted(set(paths))


def source_file_record(path_text: str) -> dict[str, Any]:
    path = REPOSITORY / path_text
    mode = path.stat().st_mode
    return {
        "executable": bool(mode & stat.S_IXUSR),
        "path": path_text,
        "sha256": sha256_file(path),
        "size_bytes": path.stat().st_size,
    }


def source_commit_identity() -> dict[str, str]:
    for variable in ("RENDER_GIT_COMMIT", "CASEPATH_SOURCE_COMMIT"):
        value = os.environ.get(variable, "").strip().lower()
        if re.fullmatch(r"[0-9a-f]{40}", value):
            return {"source": variable, "value": value}
    return {
        "source": "unavailable",
        "value": "unknown",
    }


def is_gate(path_text: str) -> bool:
    path = Path(path_text)
    return (
        path_text.startswith("casepath-qa/")
        and path.suffix in {".mjs", ".py"}
        and path.name.startswith(("browser-", "check-", "reset-", "patch_"))
    )


def is_model_visible(path_text: str) -> bool:
    return path_text in MODEL_VISIBLE_FILES or path_text.startswith(MODEL_VISIBLE_PREFIXES)


def scan_text(surface: str, text: str) -> list[dict[str, str]]:
    findings: list[dict[str, str]] = []
    for marker, pattern in LEAKAGE_PATTERNS.items():
        match = pattern.search(text)
        if match:
            start = max(0, match.start() - 32)
            end = min(len(text), match.end() + 32)
            context = " ".join(text[start:end].split())
            findings.append({"marker": marker, "surface": surface, "context": context})
    return findings


def artifact_surfaces(path: Path) -> Iterable[tuple[str, str]]:
    yield "filename", path.name
    raw = path.read_bytes()
    yield "raw_bytes", raw.decode("latin-1", errors="ignore")

    suffix = path.suffix.lower()
    if suffix == ".pdf":
        reader = PdfReader(path)
        metadata = reader.metadata or {}
        for key, value in metadata.items():
            yield f"pdf_metadata:{key}", str(value)
        for index, page in enumerate(reader.pages, start=1):
            yield f"pdf_page:{index}", page.extract_text() or ""
    elif suffix == ".eml":
        message = BytesParser(policy=policy.default).parsebytes(raw)
        for key, value in message.items():
            yield f"email_header:{key}", str(value)
        body = message.get_body(preferencelist=("plain",))
        if body is not None:
            yield "email_body", body.get_content()
    elif suffix in {".jpg", ".jpeg", ".png"}:
        with Image.open(path) as image:
            yield "image_info", json.dumps(image.info, sort_keys=True, default=str)
            exif = image.getexif()
            if exif:
                yield "image_exif", json.dumps(dict(exif), sort_keys=True, default=str)


def scan_artifact(path: Path) -> list[dict[str, str]]:
    findings: list[dict[str, str]] = []
    for surface, text in artifact_surfaces(path):
        findings.extend(scan_text(surface, text))
    return findings


def media_type(path: Path) -> str:
    if path.suffix.lower() == ".eml":
        return "message/rfc822"
    guessed, _ = mimetypes.guess_type(path.name)
    return guessed or "application/octet-stream"


def verify_source_assets() -> list[dict[str, Any]]:
    records: list[dict[str, Any]] = []
    for path_text, expected_sha in sorted(SOURCE_ASSET_HASHES.items()):
        path = REPOSITORY / path_text
        if not path.is_file():
            raise VerificationError(f"Missing source image: {path_text}")
        actual_sha = sha256_file(path)
        if actual_sha != expected_sha:
            raise VerificationError(
                f"Source image hash mismatch for {path_text}: expected {expected_sha}, got {actual_sha}"
            )
        with Image.open(path) as image:
            records.append({
                "dimensions": [image.width, image.height],
                "path": path_text,
                "sha256": actual_sha,
            })
    return records


def verify_runtime_jpeg_metadata(path: Path) -> None:
    with Image.open(path) as image:
        if image.format != "JPEG":
            raise VerificationError(f"Runtime image is not JPEG: {relative(path)}")
        if image.getexif():
            raise VerificationError(f"Runtime image retains EXIF metadata: {relative(path)}")
        forbidden_keys = {"comment", "exif", "icc_profile", "photoshop"}.intersection(image.info)
        if forbidden_keys:
            raise VerificationError(
                f"Runtime image retains metadata {sorted(forbidden_keys)}: {relative(path)}"
            )


def build_artifact_manifest() -> dict[str, Any]:
    if not ARTIFACT_ROOT.is_dir():
        raise VerificationError("Artifact directory does not exist; run the artifact generators first")

    source_assets = verify_source_assets()
    files: list[dict[str, Any]] = []
    discovered_primary: set[str] = set()
    for path in sorted(ARTIFACT_ROOT.rglob("*")):
        if not path.is_file() or path == ARTIFACT_MANIFEST_PATH:
            continue
        path_text = path.relative_to(ARTIFACT_ROOT).as_posix()
        visible = is_model_visible(path_text)
        if path_text in EXPECTED_ARTIFACTS:
            discovered_primary.add(path_text)
        if path.suffix.lower() in {".jpg", ".jpeg"} and visible:
            verify_runtime_jpeg_metadata(path)
        findings = scan_artifact(path) if visible else []
        if findings:
            raise VerificationError(
                f"Model-visible leakage in {path_text}: {json.dumps(findings, ensure_ascii=False)}"
            )
        if int(path.stat().st_mtime) != SOURCE_DATE_EPOCH:
            raise VerificationError(
                f"Non-deterministic filesystem timestamp for {path_text}: "
                f"expected {SOURCE_DATE_EPOCH}, got {int(path.stat().st_mtime)}"
            )
        files.append({
            "leakage_scan": "passed" if visible else "not_model_visible",
            "media_type": media_type(path),
            "model_visible": visible,
            "path": path_text,
            "sha256": sha256_file(path),
            "size_bytes": path.stat().st_size,
        })

    missing = sorted(EXPECTED_ARTIFACTS - discovered_primary)
    unexpected = sorted(discovered_primary - EXPECTED_ARTIFACTS)
    if missing or unexpected:
        raise VerificationError(f"Artifact set mismatch: missing={missing}, unexpected={unexpected}")

    return {
        "contract": "casepath.artifact-manifest/1.0.0",
        "file_count": len(files),
        "files": files,
        "leakage_policy": {
            "markers": sorted(LEAKAGE_PATTERNS),
            "model_visible_files_scanned": sum(1 for item in files if item["model_visible"]),
            "status": "passed",
            "surfaces": [
                "raw bytes",
                "PDF extracted text and metadata",
                "email headers and body",
                "image metadata",
            ],
        },
        "release_id": load_json(RELEASE_PATH)["release_id"],
        "source_assets": source_assets,
        "source_date_epoch": SOURCE_DATE_EPOCH,
    }


def source_manifest_payload() -> dict[str, Any]:
    release = load_json(RELEASE_PATH)
    paths = git_inventory()
    files = [source_file_record(path) for path in paths]
    gates = [
        {"path": item["path"], "sha256": item["sha256"]}
        for item in files
        if is_gate(item["path"])
    ]

    artifact_manifest = load_json(ARTIFACT_MANIFEST_PATH)
    model_visible_artifacts = [
        {"path": item["path"], "sha256": item["sha256"]}
        for item in artifact_manifest["files"]
        if item["model_visible"]
    ]
    return {
        "artifact_manifest": {
            "model_visible_files": model_visible_artifacts,
            "path": relative(ARTIFACT_MANIFEST_PATH),
            "sha256": sha256_file(ARTIFACT_MANIFEST_PATH),
        },
        "contract": "casepath.source-manifest/2.0.0",
        "file_count": len(files),
        "files": files,
        "gate_count": len(gates),
        "gates": gates,
        "inventory_policy": {
            "includes_nonignored_pending_files": True,
            "roots": [*SOURCE_ROOTS, *EXTRA_SOURCE_FILES],
            "self_output_excluded": relative(SOURCE_MANIFEST_PATH),
        },
        "release_id": release["release_id"],
        "source_commit": source_commit_identity(),
    }


def expected_agentic_runtime() -> dict[str, Any]:
    """Return the exact production architecture claimed by this release."""

    return {
        "runtime_profile": REQUIRED_RUNTIME_PROFILE,
        "execution_mode": REQUIRED_PRODUCTION_MODE,
        "provider": "openrouter",
        "model": REQUIRED_PRODUCTION_MODEL,
        "orchestration_schema": REQUIRED_ORCHESTRATION_SCHEMA,
        "authority_mode": REQUIRED_AUTHORITY_MODE,
        "implementation": REQUIRED_AGENT_IMPLEMENTATION,
        "framework": REQUIRED_FRAMEWORK,
        "model_agents": [dict(item) for item in REQUIRED_MODEL_AGENTS],
        "deterministic_gates": [dict(item) for item in REQUIRED_DETERMINISTIC_GATES],
        "parallel_groups": [list(item) for item in REQUIRED_PARALLEL_GROUPS],
        "safety": {
            "deterministic_safety_authority": True,
            "external_tracing": False,
            "prompt_storage": False,
            "raw_output_storage": False,
        },
    }


def verify_agentic_runtime_contract(release: dict[str, Any]) -> None:
    runtime = release.get("agentic_runtime")
    expected = expected_agentic_runtime()
    if runtime != expected:
        raise VerificationError(
            "Agentic runtime must exactly declare the guarded LangChain/LangGraph "
            f"Nemotron architecture; expected {expected!r}, got {runtime!r}"
        )


def verify_render_runtime_contract(release: dict[str, Any]) -> None:
    blueprint_path = REPOSITORY / "render.yaml"
    try:
        blueprint = yaml.safe_load(blueprint_path.read_text(encoding="utf-8"))
    except (OSError, yaml.YAMLError) as exc:
        raise VerificationError(f"Cannot read valid Render Blueprint: {exc}") from exc
    services = blueprint.get("services") if isinstance(blueprint, dict) else None
    if not isinstance(services, list):
        raise VerificationError("Render Blueprint services must be a list")
    api_services = [
        item
        for item in services
        if isinstance(item, dict) and item.get("name") == "casepath-agentic-api"
    ]
    if len(api_services) != 1:
        raise VerificationError("Render Blueprint must declare the canonical API exactly once")
    api_service = api_services[0]
    if api_service.get("healthCheckPath") != "/readyz":
        raise VerificationError(
            "Canonical API Render health check must use the model-aware /readyz endpoint"
        )
    env_records = api_service.get("envVars")
    if not isinstance(env_records, list):
        raise VerificationError("Canonical API Render environment must be a list")
    env_by_key: dict[str, dict[str, Any]] = {}
    for record in env_records:
        if not isinstance(record, dict) or not isinstance(record.get("key"), str):
            raise VerificationError("Canonical API Render environment entries must name a key")
        key = record["key"]
        if key in env_by_key:
            raise VerificationError(f"Duplicate canonical API Render environment key: {key}")
        env_by_key[key] = record
    expected_values = {
        "PYTHON_VERSION": "3.13.9",
        "CASEPATH_MODEL_MODE": REQUIRED_PRODUCTION_MODE,
        "CASEPATH_AGENT_RUNTIME_PROFILE": REQUIRED_RUNTIME_PROFILE,
        "CASEPATH_RELEASE_ID": release.get("release_id"),
        "CASEPATH_MODEL_CUMULATIVE_USD_CAP": "25",
        "LANGSMITH_TRACING": "false",
    }
    for key, expected in expected_values.items():
        if env_by_key.get(key) != {"key": key, "value": expected}:
            raise VerificationError(
                f"Canonical API Render environment {key} must be {expected!r}"
            )
    if env_by_key.get("OPENROUTER_API_KEY") != {
        "key": "OPENROUTER_API_KEY",
        "sync": False,
    }:
        raise VerificationError(
            "OpenRouter credential must remain an unsynchronized Render secret reference"
        )


def _reject_accepted_artifact_floats(value: Any, *, path: str = "$") -> None:
    if isinstance(value, float):
        raise VerificationError(f"Accepted artifact contains a float at {path}")
    if isinstance(value, Mapping):
        for key, child in value.items():
            _reject_accepted_artifact_floats(child, path=f"{path}.{key}")
    elif isinstance(value, list):
        for index, child in enumerate(value):
            _reject_accepted_artifact_floats(child, path=f"{path}[{index}]")


def accepted_artifact_hash(value: Any) -> str:
    """Match the backend's compact sorted UTF-8 hash after rejecting all floats."""

    _reject_accepted_artifact_floats(value)
    try:
        payload = json.dumps(
            value,
            sort_keys=True,
            ensure_ascii=False,
            separators=(",", ":"),
        )
    except (TypeError, ValueError) as exc:
        raise VerificationError(f"Accepted artifact is not canonical JSON: {exc}") from exc
    return hashlib.sha256(payload.encode("utf-8")).hexdigest()


def _verify_positive_usage(record: Any, label: str) -> None:
    if not isinstance(record, dict):
        raise VerificationError(f"{label} must be an object")
    actual_cost = record.get("actual_cost_usd")
    prompt_tokens = record.get("prompt_tokens")
    completion_tokens = record.get("completion_tokens")
    total_tokens = record.get("total_tokens")
    if (
        not isinstance(actual_cost, (int, float))
        or isinstance(actual_cost, bool)
        or not math.isfinite(actual_cost)
        or actual_cost <= 0
    ):
        raise VerificationError(f"{label} must have positive finite actual cost")
    token_values = (prompt_tokens, completion_tokens, total_tokens)
    if any(
        not isinstance(value, int) or isinstance(value, bool) or value <= 0
        for value in token_values
    ):
        raise VerificationError(f"{label} must have positive integer token counts")
    if total_tokens < prompt_tokens + completion_tokens:
        raise VerificationError(f"{label} total tokens are internally inconsistent")


def _provider_provenance_value_is_safe(field: str, value: Any) -> bool:
    """Match the runtime/QA sanitizer without returning provider-authored input."""

    if not isinstance(value, str) or not value or value != value.strip():
        return False
    if any(marker in value.casefold() for marker in FORBIDDEN_PROVIDER_PROVENANCE_MARKERS):
        return False
    if field == "response_id":
        return (
            len(value) <= PROVIDER_PROVENANCE_LIMITS[field]
            and PROVIDER_PROVENANCE_PATTERNS[field].fullmatch(value) is not None
        )
    if field == "response_model":
        return value in ACCEPTED_PRODUCTION_RESPONSE_MODELS
    if field == "upstream_provider":
        return (
            len(value) <= PROVIDER_PROVENANCE_LIMITS[field]
            and PROVIDER_PROVENANCE_PATTERNS[field].fullmatch(value) is not None
        )
    if field == "finish_reason":
        return value in ACCEPTED_FINISH_REASONS
    return False


def _verify_successful_provider_provenance(record: Any, label: str) -> None:
    """Require complete sanitized provenance while keeping rejected values private."""

    if not isinstance(record, Mapping):
        raise VerificationError(f"{label} must be an object")
    for field in (
        "response_id",
        "response_model",
        "upstream_provider",
        "finish_reason",
    ):
        if not _provider_provenance_value_is_safe(field, record.get(field)):
            raise VerificationError(
                f"{label} {field} violates the provider-provenance sanitizer"
            )
    if record.get("upstream_provider") != "DeepInfra":
        raise VerificationError(f"{label} upstream_provider must be 'DeepInfra'")


def _verify_bounded_origin_usage(value: Any, label: str) -> None:
    if not isinstance(value, dict) or set(value) != ORIGIN_USAGE_FIELDS:
        raise VerificationError(f"{label} violates the exact origin-usage schema")
    _verify_positive_usage(value, label)
    if value.get("usage_source") not in ACCEPTED_USAGE_SOURCES:
        raise VerificationError(f"{label}.usage_source is not allowed")


def _verify_public_model_ledger(ledger: Any, label: str) -> None:
    """Validate every retained public ledger item, not only acceptance-bound calls."""

    if (
        not isinstance(ledger, dict)
        or ledger.get("scope") != "global_budget_ledger"
        or not isinstance(ledger.get("items"), list)
    ):
        raise VerificationError(f"{label} is absent or unsanitized")
    call_ids: list[str] = []
    summary = ledger.get("summary")
    if not isinstance(summary, dict) or set(summary) != MODEL_LEDGER_SUMMARY_FIELDS:
        raise VerificationError(f"{label}.summary violates the exact public schema")
    summary_count_fields = (
        "records",
        "network_calls",
        "prompt_tokens",
        "completion_tokens",
        "total_tokens",
        "unknown_cost_call_count",
    )
    if any(
        not isinstance(summary.get(field), int)
        or isinstance(summary.get(field), bool)
        or summary[field] < 0
        for field in summary_count_fields
    ):
        raise VerificationError(f"{label}.summary has invalid count fields")
    summary_cost = summary.get("actual_cost_usd")
    if (
        not isinstance(summary_cost, (int, float))
        or isinstance(summary_cost, bool)
        or not math.isfinite(float(summary_cost))
        or summary_cost < 0
    ):
        raise VerificationError(f"{label}.summary has invalid actual cost")
    if not isinstance(summary.get("actual_cost_complete"), bool):
        raise VerificationError(f"{label}.summary has invalid cost completeness")
    summary_outcomes = summary.get("outcomes")
    if not isinstance(summary_outcomes, dict) or any(
        not isinstance(outcome, str)
        or not outcome
        or not isinstance(count, int)
        or isinstance(count, bool)
        or count <= 0
        for outcome, count in summary_outcomes.items()
    ):
        raise VerificationError(f"{label}.summary has invalid outcome counts")
    for index, item in enumerate(ledger["items"]):
        item_path = f"{label}.items[{index}]"
        if not isinstance(item, dict):
            raise VerificationError(f"{item_path} must be an object")
        unexpected = sorted(set(item) - ALLOWED_MODEL_LEDGER_FIELDS)
        if unexpected:
            raise VerificationError(
                f"Non-allowlisted public field at {item_path}.{unexpected[0]}"
            )
        call_id = item.get("call_id")
        if not isinstance(call_id, str) or not call_id:
            raise VerificationError(f"{item_path}.call_id is absent")
        call_ids.append(call_id)
        for field in PROVIDER_PROVENANCE_FIELDS:
            if (
                field in item
                and item[field] is not None
                and not _provider_provenance_value_is_safe(field, item[field])
            ):
                raise VerificationError(
                    f"{item_path}.{field} violates the provider-provenance sanitizer"
                )
        if (
            item.get("generation_model") is not None
            and not _provider_provenance_value_is_safe(
                "response_model", item["generation_model"]
            )
        ):
            raise VerificationError(
                f"{item_path}.generation_model violates the provider-provenance sanitizer"
            )
        if (
            item.get("origin_finish_reason") is not None
            and not _provider_provenance_value_is_safe(
                "finish_reason", item["origin_finish_reason"]
            )
        ):
            raise VerificationError(
                f"{item_path}.origin_finish_reason violates the provider-provenance sanitizer"
            )
        if item.get("error_invariant") == "invalid_provenance":
            invalid_field = item.get("invalid_provenance_field")
            if (
                invalid_field not in PROVIDER_PROVENANCE_FIELDS
                or not re.fullmatch(
                    r"[0-9a-f]{64}",
                    str(item.get("invalid_provenance_value_hash", "")),
                )
                or item.get(invalid_field) is not None
            ):
                raise VerificationError(
                    f"{item_path}.invalid_provenance_field has an unbounded diagnostic"
                )
        elif (
            item.get("invalid_provenance_field") is not None
            or item.get("invalid_provenance_value_hash") is not None
        ):
            raise VerificationError(
                f"{item_path}.invalid_provenance_field is out of scope"
            )
        provider_error_code = item.get("provider_error_code")
        if provider_error_code is not None and (
            item.get("error_invariant") != "provider_upstream_rejection"
            or not isinstance(provider_error_code, int)
            or isinstance(provider_error_code, bool)
            or not 0 <= provider_error_code <= 9_999
        ):
            raise VerificationError(
                f"{item_path}.provider_error_code is unbounded or out of scope"
            )
        if (
            item.get("error_invariant") == "provider_upstream_rejection"
            and item.get("response_id") is not None
            and (
                not isinstance(item["response_id"], str)
                or OPENROUTER_GENERATION_ID_PATTERN.fullmatch(item["response_id"])
                is None
            )
        ):
            raise VerificationError(
                f"{item_path}.response_id is not an exact OpenRouter generation ID"
            )
        if "origin_usage" in item:
            _verify_bounded_origin_usage(
                item["origin_usage"],
                f"{item_path}.origin_usage",
            )
            if not _provider_provenance_value_is_safe(
                "finish_reason", item.get("origin_finish_reason")
            ):
                raise VerificationError(
                    f"{item_path}.origin_finish_reason is absent or invalid"
                )
    if len(set(call_ids)) != len(call_ids):
        raise VerificationError(f"{label}.items contain duplicate call_id fields")
    token_fields = ("prompt_tokens", "completion_tokens", "total_tokens")
    network_calls = 0
    token_totals = {field: 0 for field in token_fields}
    confirmed_costs: list[float] = []
    unknown_cost_call_count = 0
    outcomes: dict[str, int] = {}
    for item in ledger["items"]:
        call_count = item.get("call_count")
        if (
            not isinstance(call_count, int)
            or isinstance(call_count, bool)
            or call_count < 0
        ):
            raise VerificationError(f"{label}.summary source call_count is invalid")
        network_calls += call_count
        for field in token_fields:
            value = item.get(field, 0)
            if not isinstance(value, int) or isinstance(value, bool) or value < 0:
                raise VerificationError(f"{label}.summary source {field} is invalid")
            token_totals[field] += value
        actual_cost = item.get("actual_cost_usd")
        if actual_cost is None:
            if call_count > 0:
                unknown_cost_call_count += 1
        elif (
            not isinstance(actual_cost, (int, float))
            or isinstance(actual_cost, bool)
            or not math.isfinite(float(actual_cost))
            or actual_cost < 0
        ):
            raise VerificationError(f"{label}.summary source actual cost is invalid")
        else:
            confirmed_costs.append(float(actual_cost))
        outcome = item.get("outcome")
        if not isinstance(outcome, str) or not outcome:
            raise VerificationError(f"{label}.summary source outcome is invalid")
        outcomes[outcome] = outcomes.get(outcome, 0) + 1
    expected_summary = {
        "records": len(ledger["items"]),
        "network_calls": network_calls,
        **token_totals,
        "actual_cost_usd": round(sum(confirmed_costs), 8),
        "actual_cost_complete": unknown_cost_call_count == 0,
        "unknown_cost_call_count": unknown_cost_call_count,
        "outcomes": {key: outcomes[key] for key in sorted(outcomes)},
    }
    if summary != expected_summary:
        raise VerificationError(f"{label}.summary is inconsistent with ledger rows")


def _historical_schema_error(section: str) -> None:
    """Fail without echoing a provider-authored key or value."""

    raise VerificationError(
        f"Historical model validation {section} violates its exact bounded schema"
    )


def _require_historical_fields(
    value: Any,
    expected: frozenset[str],
    section: str,
) -> dict[str, Any]:
    if not isinstance(value, dict) or set(value) != expected:
        _historical_schema_error(section)
    return value


def _is_historical_timestamp(value: Any) -> bool:
    if not isinstance(value, str) or not 20 <= len(value) <= 40:
        return False
    # Render timestamps can carry nanoseconds while ``datetime`` accepts at most
    # microseconds.  Preserve strict ISO/offset validation without rejecting the
    # additional bounded precision in a retained deployment receipt.
    normalized = re.sub(r"(\.\d{6})\d+(?=Z|[+-]\d{2}:\d{2}$)", r"\1", value)
    try:
        parsed = datetime.fromisoformat(normalized.replace("Z", "+00:00"))
    except ValueError:
        return False
    return parsed.tzinfo is not None


def _is_bounded_historical_number(
    value: Any,
    *,
    minimum: float = 0,
    maximum: float = 180_000,
) -> bool:
    return (
        isinstance(value, (int, float))
        and not isinstance(value, bool)
        and math.isfinite(float(value))
        and minimum <= float(value) <= maximum
    )


def _is_exact_historical_int(value: Any, expected: int) -> bool:
    return (
        isinstance(value, int)
        and not isinstance(value, bool)
        and value == expected
    )


def _verify_historical_execution(
    attempt_id: str,
    execution: Any,
) -> None:
    expected_fields = _HISTORICAL_EXECUTION_FIELDS.get(attempt_id)
    if expected_fields is None:
        if execution is not None:
            _historical_schema_error("execution observation")
        return
    values = _require_historical_fields(
        execution,
        expected_fields,
        "execution observation",
    )
    patterns = {
        "source_commit": _HISTORICAL_SOURCE_COMMIT_PATTERN,
        "frontend_deploy_id": _HISTORICAL_DEPLOY_ID_PATTERN,
        "api_deploy_id": _HISTORICAL_DEPLOY_ID_PATTERN,
        "qa_deploy_id": _HISTORICAL_DEPLOY_ID_PATTERN,
        "qa_run_id": _HISTORICAL_RUN_ID_PATTERN,
        "orchestration_id": _HISTORICAL_ORCHESTRATION_ID_PATTERN,
    }
    for field, pattern in patterns.items():
        if field in values and (
            not isinstance(values[field], str)
            or pattern.fullmatch(values[field]) is None
        ):
            _historical_schema_error("execution observation")
    if values.get("qa_deploy_outcome") != "build_failed":
        _historical_schema_error("execution observation")
    if values.get("failed_agent_id") != "canonical_facts":
        _historical_schema_error("execution observation")
    for field in values:
        if field.endswith("_at") and not _is_historical_timestamp(values[field]):
            _historical_schema_error("execution observation")
    for field in ("provider_response_count", "network_call_count"):
        if field in values and not _is_exact_historical_int(values[field], 1):
            _historical_schema_error("execution observation")
    for field in (
        "downstream_model_calls",
        "downstream_agent_receipts",
        "deterministic_gate_receipts",
    ):
        if field in values and not _is_exact_historical_int(values[field], 0):
            _historical_schema_error("execution observation")


def _verify_historical_provider_observation(
    attempt_id: str,
    provider: Any,
) -> None:
    values = _require_historical_fields(
        provider,
        _HISTORICAL_PROVIDER_FIELDS[attempt_id],
        "provider observation",
    )
    if "provider" in values and values["provider"] != "openrouter":
        _historical_schema_error("provider observation")
    expected_outcome = _HISTORICAL_PROVIDER_OUTCOMES.get(attempt_id)
    if expected_outcome is not None and values.get("provider_outcome") != expected_outcome:
        _historical_schema_error("provider observation")
    for field in ("canonical_model_id", "model"):
        if field in values and values[field] != (
            "nvidia/nemotron-3-ultra-550b-a55b-20260604"
        ):
            _historical_schema_error("provider observation")
    if "requested_model" in values and values["requested_model"] != REQUIRED_PRODUCTION_MODEL:
        _historical_schema_error("provider observation")
    if (
        "response_model" in values
        and values["response_model"] not in ACCEPTED_PRODUCTION_RESPONSE_MODELS
    ):
        _historical_schema_error("provider observation")
    if "response_id" in values and (
        not isinstance(values["response_id"], str)
        or OPENROUTER_GENERATION_ID_PATTERN.fullmatch(values["response_id"]) is None
    ):
        _historical_schema_error("provider observation")
    if "upstream_provider" in values and values["upstream_provider"] != "DeepInfra":
        _historical_schema_error("provider observation")
    if "finish_reason" in values and values["finish_reason"] != "stop":
        _historical_schema_error("provider observation")
    if "usage_source" in values and values["usage_source"] != "response":
        _historical_schema_error("provider observation")
    present_usage = {
        "actual_cost_usd",
        "prompt_tokens",
        "completion_tokens",
        "total_tokens",
    }.intersection(values)
    if present_usage:
        _verify_positive_usage(values, "Historical provider observation")
        if values["actual_cost_usd"] > 25 or values["total_tokens"] > 10_000_000:
            _historical_schema_error("provider observation")
    if "latency_ms" in values and not _is_bounded_historical_number(
        values["latency_ms"], minimum=0.001
    ):
        _historical_schema_error("provider observation")
    if "estimated_cost_reservation_usd" in values and not _is_bounded_historical_number(
        values["estimated_cost_reservation_usd"], minimum=0.000_000_01, maximum=25
    ):
        _historical_schema_error("provider observation")
    expected_booleans = {
        "synchronous_usage_cost_present": False,
        "new_openrouter_log_generation_observed": False,
        "charge_included_in_known_aggregate": False,
        "estimated_reservation_is_actual_charge": False,
        "openrouter_upstream_request_log_observed": True,
    }
    for field, expected in expected_booleans.items():
        if field in values and values[field] is not expected:
            _historical_schema_error("provider observation")
    if "openrouter_log_check_performed" in values:
        expected = attempt_id == "production-flagship-20260811-09"
        if values["openrouter_log_check_performed"] is not expected:
            _historical_schema_error("provider observation")
    expected_cache_assessment = {
        "authorized-smoke-20260811-03": "likely_unconfirmed",
        "production-flagship-20260811-07": "not_assessed",
        "production-flagship-20260811-09": "not_applicable_upstream_rejected",
    }.get(attempt_id)
    if (
        expected_cache_assessment is not None
        and values.get("provider_cache_replay_assessment") != expected_cache_assessment
    ):
        _historical_schema_error("provider observation")
    if "charge_status" in values and values["charge_status"] != "unknown_unconfirmed":
        _historical_schema_error("provider observation")
    if "response_http_status" in values and not _is_exact_historical_int(
        values["response_http_status"], 200
    ):
        _historical_schema_error("provider observation")
    if "sdk" in values and values["sdk"] != "openrouter":
        _historical_schema_error("provider observation")
    if "sdk_version" in values and values["sdk_version"] != "0.11.46":
        _historical_schema_error("provider observation")
    if "sdk_error_type" in values and values["sdk_error_type"] != "ResponseValidationError":
        _historical_schema_error("provider observation")
    expected_identity_status = {
        "production-flagship-20260811-07": "unknown_unverified",
        "production-flagship-20260811-09": "upstream_request_only_no_generation",
    }.get(attempt_id)
    if (
        expected_identity_status is not None
        and values.get("response_identity_status") != expected_identity_status
    ):
        _historical_schema_error("provider observation")
    if "bounded_generation_metadata_lookup" in values and values[
        "bounded_generation_metadata_lookup"
    ] != "not_available_before_deadline":
        _historical_schema_error("provider observation")

    later = values.get("later_generation_metadata_observation")
    if later is not None:
        later = _require_historical_fields(
            later,
            frozenset(
                "read_only response_id model provider_name actual_cost_usd prompt_tokens "
                "completion_tokens total_tokens finish_reason same_generation_confirmed "
                "available_after_bounded_lookup".split()
            ),
            "later generation observation",
        )
        if (
            later["read_only"] is not True
            or later["response_id"] != values.get("response_id")
            or later["model"] != "nvidia/nemotron-3-ultra-550b-a55b-20260604"
            or later["provider_name"] != "DeepInfra"
            or later["finish_reason"] != "stop"
            or later["same_generation_confirmed"] is not True
            or later["available_after_bounded_lookup"] is not True
        ):
            _historical_schema_error("later generation observation")
        _verify_positive_usage(later, "Historical later generation observation")
        for field in (
            "actual_cost_usd",
            "prompt_tokens",
            "completion_tokens",
            "total_tokens",
        ):
            if later[field] != values[field]:
                _historical_schema_error("later generation observation")

    routing = values.get("routing_diagnosis")
    if routing is not None:
        routing = _require_historical_fields(
            routing,
            frozenset(
                {
                    "attempt_09_policy",
                    "prior_deepinfra_request_status",
                    "exact_internal_provider_error_message_observed",
                }
            ),
            "routing diagnosis",
        )
        if (
            routing["attempt_09_policy"] != "default_provider_routing"
            or not _is_exact_historical_int(
                routing["prior_deepinfra_request_status"], 200
            )
            or routing["exact_internal_provider_error_message_observed"] is not False
        ):
            _historical_schema_error("routing diagnosis")

    upstream_log = values.get("upstream_request_log_observation")
    if upstream_log is not None:
        upstream_log = _require_historical_fields(
            upstream_log,
            frozenset(
                "read_only displayed_at_local request_id final_provider upstream_status "
                "router_attempts router_latency_ms".split()
            ),
            "upstream request observation",
        )
        if (
            upstream_log["read_only"] is not True
            or not isinstance(upstream_log["displayed_at_local"], str)
            or _HISTORICAL_LOCAL_TIME_PATTERN.fullmatch(
                upstream_log["displayed_at_local"]
            )
            is None
            or not isinstance(upstream_log["request_id"], str)
            or OPENROUTER_GENERATION_ID_PATTERN.fullmatch(upstream_log["request_id"])
            is None
            or upstream_log["final_provider"] != "Together"
            or not _is_exact_historical_int(upstream_log["upstream_status"], 400)
            or not isinstance(upstream_log["router_attempts"], int)
            or isinstance(upstream_log["router_attempts"], bool)
            or not 1 <= upstream_log["router_attempts"] <= 10
            or not _is_bounded_historical_number(upstream_log["router_latency_ms"])
        ):
            _historical_schema_error("upstream request observation")

    generation_lookup = values.get("generation_metadata_lookup")
    if generation_lookup is not None:
        generation_lookup = _require_historical_fields(
            generation_lookup,
            frozenset("read_only request_id http_status generation_recovered".split()),
            "generation lookup",
        )
        if (
            generation_lookup["read_only"] is not True
            or upstream_log is None
            or generation_lookup["request_id"] != upstream_log["request_id"]
            or not _is_exact_historical_int(generation_lookup["http_status"], 404)
            or generation_lookup["generation_recovered"] is not False
        ):
            _historical_schema_error("generation lookup")


def _verify_historical_application_result(
    attempt_id: str,
    result: Any,
) -> None:
    values = _require_historical_fields(
        result,
        _HISTORICAL_APPLICATION_FIELDS[attempt_id],
        "application result",
    )
    if (
        values["outcome"] != "rejected"
        or values["failure_type"] != _HISTORICAL_FAILURE_TYPES[attempt_id]
        or values["successful_ledger_call_bound"] is not False
    ):
        _historical_schema_error("application result")
    expected_error_type = _HISTORICAL_ERROR_TYPES.get(attempt_id)
    if expected_error_type is not None and values.get("error_type") != expected_error_type:
        _historical_schema_error("application result")
    expected_invariant = _HISTORICAL_ERROR_INVARIANTS.get(attempt_id)
    if expected_invariant is not None and values.get("error_invariant") != expected_invariant:
        _historical_schema_error("application result")
    ledger_call_id = values.get("ledger_call_id")
    if ledger_call_id is not None and (
        not isinstance(ledger_call_id, str)
        or _HISTORICAL_CALL_ID_PATTERN.fullmatch(ledger_call_id) is None
    ):
        _historical_schema_error("application result")
    if "ledger_outcome" in values and values["ledger_outcome"] != "failed":
        _historical_schema_error("application result")
    expected_booleans: dict[str, bool] = {
        "canonical_result_accepted": False,
        "upstream_provider_persisted": False,
        "contribution_diagnostics_retained": False,
        "accepted_generation_recovered": False,
    }
    if attempt_id in {
        "production-flagship-20260811-07",
        "production-flagship-20260811-08",
        "production-flagship-20260811-09",
    }:
        retained = attempt_id == "production-flagship-20260811-08"
        expected_booleans["response_identity_retained"] = retained
        expected_booleans["usage_metadata_retained"] = retained
    if "later_generation_metadata_verified" in values:
        expected_booleans["later_generation_metadata_verified"] = True
    for field, expected in expected_booleans.items():
        if field in values and values[field] is not expected:
            _historical_schema_error("application result")
    if "accepted_fact_count" in values:
        rejected = values.get("rejected_invariants")
        if (
            not _is_exact_historical_int(values["accepted_fact_count"], 7)
            or not _is_exact_historical_int(values.get("rejected_fact_count"), 11)
            or not isinstance(rejected, dict)
            or set(rejected) != {"source_reference_set", "canonical_state"}
            or not _is_exact_historical_int(rejected.get("source_reference_set"), 10)
            or not _is_exact_historical_int(rejected.get("canonical_state"), 1)
        ):
            _historical_schema_error("application result")


def _verify_historical_attempt_schema(evidence: Any) -> None:
    if not isinstance(evidence, dict):
        _historical_schema_error("record")
    attempt_id = evidence.get("attempt_id")
    if attempt_id not in _HISTORICAL_PROVIDER_FIELDS:
        _historical_schema_error("record identity")
    expected_top = _HISTORICAL_TOP_FIELDS
    if attempt_id in _HISTORICAL_EXECUTION_FIELDS:
        expected_top = expected_top | {"execution_observation"}
    _require_historical_fields(evidence, frozenset(expected_top), "record")
    requested_runtime = _require_historical_fields(
        evidence.get("requested_runtime"),
        frozenset({"mode", "model"}),
        "requested runtime",
    )
    if requested_runtime != {
        "mode": REQUIRED_PRODUCTION_MODE,
        "model": REQUIRED_PRODUCTION_MODEL,
    }:
        _historical_schema_error("requested runtime")
    _verify_historical_execution(attempt_id, evidence.get("execution_observation"))
    _verify_historical_provider_observation(
        attempt_id,
        evidence.get("provider_observation"),
    )
    _verify_historical_application_result(
        attempt_id,
        evidence.get("application_result"),
    )


def _verify_sanitized_evidence(value: Any, label: str) -> None:
    def walk(current: Any, path: str) -> None:
        if isinstance(current, dict):
            for key, child in current.items():
                child_path = f"{path}.{key}"
                if key in FORBIDDEN_PUBLIC_FIELDS:
                    raise VerificationError(
                        f"{label} contains forbidden public field at {child_path}"
                    )
                walk(child, child_path)
        elif isinstance(current, list):
            for index, child in enumerate(current):
                walk(child, f"{path}[{index}]")

    walk(value, "$")


def verify_failed_model_attempt_evidence(
    release: dict[str, Any],
    evidence: dict[str, Any],
) -> None:
    """Verify one retained provider attempt without treating it as acceptance."""

    _verify_historical_attempt_schema(evidence)
    if evidence.get("contract") != "casepath.model-validation-evidence/1.0.0":
        raise VerificationError("Unsupported historical model validation evidence contract")
    if evidence.get("release_id") != release.get("release_id"):
        raise VerificationError("Historical model validation release ID does not match")
    requested_runtime = evidence.get("requested_runtime")
    if not isinstance(requested_runtime, dict) or {
        "mode": requested_runtime.get("mode"),
        "model": requested_runtime.get("model"),
    } != {
        "mode": REQUIRED_PRODUCTION_MODE,
        "model": REQUIRED_PRODUCTION_MODEL,
    }:
        raise VerificationError("Historical model attempt does not name the authorized runtime")
    if evidence.get("status") != "failed_closed":
        raise VerificationError("Historical model attempts must remain failed closed")
    if evidence.get("acceptance_passed") is not False:
        raise VerificationError("Historical model attempts cannot record acceptance")
    if evidence.get("model_backed_release_evidence") is not False:
        raise VerificationError("Historical model attempts cannot establish release evidence")
    if evidence.get("accepted_ledger_record") is not None:
        raise VerificationError("Historical model attempts cannot retain an accepted ledger record")
    expected_sanitization = {
        "private_reference_included": False,
        "provider_credential_included": False,
        "raw_output_included": False,
        "raw_prompt_included": False,
    }
    if evidence.get("sanitization") != expected_sanitization:
        raise VerificationError("Historical model validation sanitization is incomplete")
    _verify_sanitized_evidence(evidence, "Historical model validation evidence")

    result = evidence.get("application_result")
    if not isinstance(result, dict) or result.get("outcome") != "rejected":
        raise VerificationError("Historical failed-closed evidence must record rejection")
    if result.get("successful_ledger_call_bound") is not False:
        raise VerificationError("Historical evidence cannot bind a successful ledger call")
    if result.get("ledger_outcome") not in {None, "failed"}:
        raise VerificationError("Historical evidence cannot record a successful ledger outcome")
    if result.get("canonical_result_accepted") not in {None, False}:
        raise VerificationError("Historical evidence cannot accept a canonical result")
    ledger_call_id = result.get("ledger_call_id")
    if ledger_call_id is not None and (
        not isinstance(ledger_call_id, str) or not ledger_call_id
    ):
        raise VerificationError("Historical ledger call ID must be null or non-empty")

    provider_observation = evidence.get("provider_observation")
    if not isinstance(provider_observation, dict):
        raise VerificationError("Historical provider observation must be an object")
    usage_fields = {
        "actual_cost_usd",
        "prompt_tokens",
        "completion_tokens",
        "total_tokens",
    }
    present_usage_fields = usage_fields.intersection(provider_observation)
    if present_usage_fields == usage_fields:
        _verify_positive_usage(provider_observation, "Historical provider observation")
    elif present_usage_fields:
        raise VerificationError(
            "Historical provider usage must be complete or explicitly unavailable"
        )
    else:
        expected_unknown_usage = {
            "charge_included_in_known_aggregate": False,
            "charge_status": "unknown_unconfirmed",
            "new_openrouter_log_generation_observed": False,
            "synchronous_usage_cost_present": False,
        }
        for key, expected in expected_unknown_usage.items():
            if provider_observation.get(key) != expected:
                raise VerificationError(
                    f"Unknown historical usage requires {key}={expected!r}"
                )
        cache_assessment = provider_observation.get("provider_cache_replay_assessment")
        if cache_assessment not in {
            "likely_unconfirmed",
            "not_assessed",
            "not_applicable_upstream_rejected",
        }:
            raise VerificationError(
                "Unknown historical usage requires a bounded cache-replay assessment"
            )
        if (
            cache_assessment == "not_assessed"
            and provider_observation.get("openrouter_log_check_performed") is not False
        ):
            raise VerificationError(
                "A non-assessed cache replay requires openrouter_log_check_performed=false"
            )
        if cache_assessment == "not_applicable_upstream_rejected" and (
            provider_observation.get("provider_outcome") != "upstream_rejected"
            or provider_observation.get("openrouter_log_check_performed") is not True
            or provider_observation.get("openrouter_upstream_request_log_observed") is not True
        ):
            raise VerificationError(
                "An upstream-rejected cache assessment requires a checked upstream request log"
            )
        estimated_reservation = provider_observation.get(
            "estimated_cost_reservation_usd"
        )
        if estimated_reservation is not None:
            if (
                not isinstance(estimated_reservation, (int, float))
                or isinstance(estimated_reservation, bool)
                or not math.isfinite(estimated_reservation)
                or estimated_reservation <= 0
            ):
                raise VerificationError(
                    "Historical estimated cost reservation must be positive and finite"
                )
            if provider_observation.get("estimated_reservation_is_actual_charge") is not False:
                raise VerificationError(
                    "Historical estimated reservation must not be represented as actual charge"
                )
        if "response_id" in provider_observation or "response_model" in provider_observation:
            raise VerificationError(
                "Unknown historical usage cannot retain an unobserved response identity"
            )


def verify_static_runtime_acceptance_contract(release: dict[str, Any]) -> None:
    """Verify immutable criteria and history; never infer a deployment verdict."""

    verify_agentic_runtime_contract(release)
    verify_render_runtime_contract(release)
    truth = release.get("truth")
    if not isinstance(truth, dict):
        raise VerificationError("Release contract truth must be an object")
    expected_build = {
        "execution_mode": "deterministic_reference",
        "model_backed": False,
        "model_calls": 0,
        "status": "passed",
    }
    if truth.get("deterministic_build") != expected_build:
        raise VerificationError(
            f"Deterministic build evidence must remain {expected_build!r}"
        )

    runtime = truth.get("production_runtime_acceptance")
    if not isinstance(runtime, dict):
        raise VerificationError("Production runtime acceptance criteria must be an object")
    if "status" in runtime or "model_backed_accepted" in runtime:
        raise VerificationError(
            "The tracked criteria contract must not embed a mutable runtime verdict"
        )
    expected_dynamic_evidence = {
        "qa_gate": "focused-flagship-journey-v20",
        "report_path": QA_REPORT_PATH,
        "evidence_manifest_path": QA_EVIDENCE_MANIFEST_PATH,
        "evidence_manifest_contract": QA_EVIDENCE_MANIFEST_CONTRACT,
        "required_report_status": "passed",
        "requires_release_id_match": True,
        "requires_non_unknown_source_commit": True,
        "requires_same_source_commit": True,
    }
    if runtime.get("verdict_authority") != RUNTIME_VERDICT_AUTHORITY:
        raise VerificationError("Runtime verdict authority must be the dynamic QA artifacts")
    if runtime.get("source_contract_embeds_runtime_verdict") is not False:
        raise VerificationError("The source contract must remain verdict-free")
    if runtime.get("dynamic_evidence") != expected_dynamic_evidence:
        raise VerificationError(
            "Runtime criteria must point to the exact report and evidence-manifest pair"
        )
    for key in REQUIRED_RUNTIME_ACCEPTANCE_FLAGS:
        if runtime.get(key) is not True:
            raise VerificationError(f"Production runtime acceptance must require {key}")
    expected_runtime = {
        "required_mode": REQUIRED_PRODUCTION_MODE,
        "required_model": REQUIRED_PRODUCTION_MODEL,
        "required_runtime_profile": REQUIRED_RUNTIME_PROFILE,
    }
    for key, expected in expected_runtime.items():
        if runtime.get(key) != expected:
            raise VerificationError(f"Production runtime {key} must be {expected!r}")

    history = truth.get("historical_model_validation")
    expected_history = {
        "scope": "failed_closed_history_only",
        "evidence_records": list(HISTORICAL_MODEL_VALIDATION_RECORDS),
        "establishes_current_runtime_acceptance": False,
    }
    if history != expected_history:
        raise VerificationError(
            "Historical model validation must retain exactly nine failed-closed records"
        )
    for path_text in HISTORICAL_MODEL_VALIDATION_RECORDS:
        verify_failed_model_attempt_evidence(
            release,
            load_json(REPOSITORY / path_text),
        )


def _orchestration_audit(run: dict[str, Any]) -> dict[str, Any] | None:
    result = run.get("result")
    if not isinstance(result, dict):
        return None
    audit_container = result.get("audit")
    if isinstance(audit_container, dict) and isinstance(
        audit_container.get("agent_orchestration"), dict
    ):
        return audit_container["agent_orchestration"]
    direct = result.get("agent_orchestration")
    return direct if isinstance(direct, dict) else None


def _verify_cold_flagship_evidence(
    run: dict[str, Any],
    ledger: dict[str, Any],
) -> str:
    if run.get("status") != "complete":
        raise VerificationError("Dynamic flagship run must be complete")
    audit = _orchestration_audit(run)
    if not isinstance(audit, dict):
        raise VerificationError("Dynamic flagship run lacks an orchestration audit")
    expected_audit = {
        "schema_version": REQUIRED_ORCHESTRATION_SCHEMA,
        "implementation": REQUIRED_AGENT_IMPLEMENTATION,
        "framework": REQUIRED_FRAMEWORK,
        "model": REQUIRED_PRODUCTION_MODEL,
        "authority_mode": REQUIRED_AUTHORITY_MODE,
        "model_assisted": True,
        "deterministic_safety_authority": True,
        "external_tracing": False,
        "prompt_storage": False,
        "raw_output_storage": False,
        "execution_topology": REQUIRED_EXECUTION_TOPOLOGY,
        "all_required_agents_contributed": True,
    }
    for key, expected in expected_audit.items():
        if audit.get(key) != expected:
            raise VerificationError(
                f"Dynamic flagship orchestration {key} must be {expected!r}"
            )
    orchestration_id = audit.get("orchestration_id")
    if not isinstance(orchestration_id, str) or not orchestration_id:
        raise VerificationError("Dynamic flagship orchestration ID is absent")

    agents = audit.get("agents")
    if not isinstance(agents, list) or len(agents) != len(REQUIRED_MODEL_AGENTS):
        raise VerificationError("Dynamic flagship must contain exactly six model agents")
    by_agent: dict[str, dict[str, Any]] = {}
    for agent in agents:
        agent_id = agent.get("agent_id") if isinstance(agent, dict) else None
        if not isinstance(agent_id, str) or agent_id in by_agent:
            raise VerificationError("Dynamic flagship agent IDs must be present and distinct")
        by_agent[agent_id] = agent
    expected_agent_ids = [item["agent_id"] for item in REQUIRED_MODEL_AGENTS]
    if set(by_agent) != set(expected_agent_ids):
        raise VerificationError("Dynamic flagship agent set is not the required six-role set")

    call_ids: list[str] = []
    response_ids: list[str] = []
    delegation_ids: list[str] = []
    fallback_count = 0
    for expected_agent in REQUIRED_MODEL_AGENTS:
        agent_id = expected_agent["agent_id"]
        agent = by_agent[agent_id]
        expected_pairs = {
            "actor_type": "nemotron_agent",
            "acceptance_scope": "pre_review_model_output",
            "model": REQUIRED_PRODUCTION_MODEL,
            "provider": "openrouter",
            "requested_model": REQUIRED_PRODUCTION_MODEL,
            "call_count": 1,
            "cache_hit": False,
        }
        for key, expected in expected_pairs.items():
            if agent.get(key) != expected:
                raise VerificationError(
                    f"Dynamic flagship agent {agent_id} {key} must be {expected!r}"
                )
        if agent.get("outcome") not in {"succeeded", "succeeded_with_guarded_fallback"}:
            raise VerificationError(f"Dynamic flagship agent {agent_id} did not succeed")
        _verify_successful_provider_provenance(
            agent,
            f"Dynamic flagship agent {agent_id}",
        )
        for key in ("call_id",):
            value = agent.get(key)
            if not isinstance(value, str) or not value:
                raise VerificationError(f"Dynamic flagship agent {agent_id} lacks {key}")
        for key in ("input_artifact_hash", "output_artifact_hash"):
            if not re.fullmatch(r"[0-9a-f]{64}", str(agent.get(key, ""))):
                raise VerificationError(f"Dynamic flagship agent {agent_id} lacks {key}")
        accepted_count = agent.get("accepted_count")
        rejected_count = agent.get("rejected_count")
        if (
            not isinstance(accepted_count, int)
            or isinstance(accepted_count, bool)
            or accepted_count < 1
            or not isinstance(rejected_count, int)
            or isinstance(rejected_count, bool)
            or rejected_count < 0
            or accepted_count <= rejected_count
        ):
            raise VerificationError(
                f"Dynamic flagship agent {agent_id} lacks a strict accepted majority"
            )
        accepted_ids = agent.get("accepted_ids")
        if (
            not isinstance(accepted_ids, list)
            or len(accepted_ids) != accepted_count
            or len(set(accepted_ids)) != len(accepted_ids)
            or any(not isinstance(item, str) or not item for item in accepted_ids)
        ):
            raise VerificationError(
                f"Dynamic flagship agent {agent_id} accepted IDs are unbound"
            )
        fallback_applied = agent.get("deterministic_fallback_applied")
        if fallback_applied is not (rejected_count > 0):
            raise VerificationError(
                f"Dynamic flagship agent {agent_id} fallback disclosure is inconsistent"
            )
        fallback_count += int(fallback_applied)
        if agent_id == "canonical_facts":
            projected = agent.get("source_reference_projection_fact_ids")
            projection_count = agent.get("source_reference_projection_count")
            if (
                not isinstance(projected, list)
                or len(set(projected)) != len(projected)
                or any(item not in accepted_ids for item in projected)
                or projection_count != len(projected)
            ):
                raise VerificationError(
                    "Canonical facts source-reference projection disclosure is invalid"
                )
        call_ids.append(agent["call_id"])
        response_ids.append(agent["response_id"])

        canonical_call_id = by_agent["canonical_facts"].get("call_id")
        orchestrator_call_id = by_agent["orchestrator_plan"].get("call_id")
        parent_call_id = agent.get("parent_call_id")
        delegation_id = agent.get("delegation_id")
        if agent_id == "canonical_facts":
            if parent_call_id is not None or delegation_id is not None:
                raise VerificationError("Canonical facts must be the root model call")
        elif agent_id == "orchestrator_plan":
            if parent_call_id != canonical_call_id:
                raise VerificationError("Nemotron orchestrator must follow canonical facts")
        elif parent_call_id != orchestrator_call_id:
            raise VerificationError(f"Specialist {agent_id} must follow the orchestrator")
        if agent_id != "canonical_facts":
            if not isinstance(delegation_id, str) or not delegation_id:
                raise VerificationError(f"Dynamic flagship agent {agent_id} lacks delegation")
            delegation_ids.append(delegation_id)

    if len(set(call_ids)) != len(call_ids):
        raise VerificationError("Dynamic flagship call IDs must be distinct")
    if len(set(response_ids)) != len(response_ids):
        raise VerificationError("Dynamic flagship response IDs must be distinct")
    if len(set(delegation_ids)) != len(delegation_ids):
        raise VerificationError("Dynamic flagship delegation IDs must be distinct")
    if audit.get("guarded_fallback_count") != fallback_count:
        raise VerificationError("Dynamic flagship fallback count is not exact")

    gates = audit.get("deterministic_gates")
    if not isinstance(gates, list) or len(gates) != len(REQUIRED_DETERMINISTIC_GATES):
        raise VerificationError("Dynamic flagship must contain exactly three deterministic gates")
    gates_by_id: dict[str, dict[str, Any]] = {}
    for gate in gates:
        gate_id = gate.get("agent_id") if isinstance(gate, dict) else None
        if not isinstance(gate_id, str) or gate_id in gates_by_id:
            raise VerificationError("Dynamic flagship gate IDs must be present and distinct")
        gates_by_id[gate_id] = gate
    if set(gates_by_id) != {item["gate_id"] for item in REQUIRED_DETERMINISTIC_GATES}:
        raise VerificationError("Dynamic flagship gate set is not the required three-gate set")
    result = run["result"]
    gate_bindings = {
        "deterministic_process_gate": (
            "process_graph",
            result.get("process"),
            "process_decision_mapping",
        ),
        "deterministic_evidence_gate": (
            "evidence_model",
            result.get("checklist"),
            "evidence_checklist",
        ),
        "whole_playbook_gate": (
            "final_claim_brief",
            audit.get("final_claim_brief"),
            "final_claim_brief_audit",
        ),
    }
    for gate_id, (output_artifact, artifact_value, source_agent_id) in gate_bindings.items():
        if not isinstance(artifact_value, Mapping):
            raise VerificationError(
                f"Dynamic flagship {gate_id} accepted DTO is missing"
            )
        gate = gates_by_id[gate_id]
        source_agent = by_agent[source_agent_id]
        expected_pairs = {
            "actor_type": "deterministic_gate",
            "receipt_type": "accepted_artifact",
            "acceptance_scope": "pre_review_model_output",
            "model": None,
            "outcome": "passed",
            "source_agent_id": source_agent_id,
            "source_call_id": source_agent["call_id"],
            "delegation_id": source_agent["delegation_id"],
            "accepted_ids": source_agent["accepted_ids"],
            "accepted_count": source_agent["accepted_count"],
            "output_artifact": output_artifact,
            "output_artifact_hash": accepted_artifact_hash(artifact_value),
        }
        for key, expected in expected_pairs.items():
            if gate.get(key) != expected:
                raise VerificationError(
                    f"Dynamic flagship gate {gate_id} {key} must be {expected!r}"
                )
        if not re.fullmatch(r"[0-9a-f]{64}", str(gate.get("input_artifact_hash", ""))):
            raise VerificationError(f"Dynamic flagship gate {gate_id} lacks an input hash")

    _verify_public_model_ledger(ledger, "Dynamic flagship ledger")
    ledger_by_call = {
        item.get("call_id"): item
        for item in ledger["items"]
        if isinstance(item, dict) and item.get("call_id") in call_ids
    }
    if len(ledger_by_call) != len(REQUIRED_MODEL_AGENTS):
        raise VerificationError("Dynamic flagship ledger lacks six bound cold calls")
    ledger_response_ids: list[str] = []
    for agent_id in expected_agent_ids:
        agent = by_agent[agent_id]
        item = ledger_by_call[agent["call_id"]]
        expected_pairs = {
            "orchestration_id": orchestration_id,
            "agent_id": agent_id,
            "parent_call_id": agent.get("parent_call_id"),
            "delegation_id": agent.get("delegation_id"),
            "call_count": 1,
            "provider": "openrouter",
            "provider_endpoint": "https://openrouter.ai/api/v1/chat/completions",
            "model": REQUIRED_PRODUCTION_MODEL,
            "response_id": agent["response_id"],
            "response_model": agent["response_model"],
            "deterministic_fallback_applied": agent["deterministic_fallback_applied"],
        }
        for key, expected in expected_pairs.items():
            if item.get(key) != expected:
                raise VerificationError(
                    f"Dynamic flagship ledger {agent_id} {key} must be {expected!r}"
                )
        if item.get("outcome") not in {"succeeded", "succeeded_with_guarded_fallback"}:
            raise VerificationError(f"Dynamic flagship ledger {agent_id} did not succeed")
        _verify_successful_provider_provenance(
            item,
            f"Dynamic flagship ledger {agent_id}",
        )
        if item.get("usage_source") not in {"response", "generation_metadata"}:
            raise VerificationError(f"Dynamic flagship ledger {agent_id} lacks usage provenance")
        _verify_positive_usage(item, f"Dynamic flagship ledger {agent_id}")
        accepted_key = (
            "accepted_fact_count" if agent_id == "canonical_facts" else "accepted_item_count"
        )
        rejected_key = (
            "rejected_fact_count" if agent_id == "canonical_facts" else "rejected_item_count"
        )
        if (
            item.get(accepted_key) != agent["accepted_count"]
            or item.get(rejected_key) != agent["rejected_count"]
        ):
            raise VerificationError(
                f"Dynamic flagship ledger {agent_id} contribution counts are unbound"
            )
        if agent_id == "canonical_facts" and (
            item.get("source_reference_projection_fact_ids")
            != agent["source_reference_projection_fact_ids"]
            or item.get("source_reference_projection_count")
            != agent["source_reference_projection_count"]
        ):
            raise VerificationError(
                "Dynamic flagship ledger canonical source projection is unbound"
            )
        ledger_response_ids.append(item["response_id"])
    if len(set(ledger_response_ids)) != len(ledger_response_ids):
        raise VerificationError("Dynamic flagship ledger response IDs must be distinct")
    _verify_sanitized_evidence(
        {"flagship_run": run, "flagship_cold_model_ledger": ledger},
        "Dynamic flagship evidence",
    )
    return orchestration_id


def verify_dynamic_runtime_acceptance(
    release: dict[str, Any],
    report: dict[str, Any],
    evidence_manifest: dict[str, Any],
    retained_evidence: dict[str, dict[str, Any]],
    *,
    evidence_manifest_bytes: bytes,
) -> dict[str, Any]:
    """Decide runtime acceptance from one same-commit QA artifact pair."""

    verify_static_runtime_acceptance_contract(release)
    criteria = release["truth"]["production_runtime_acceptance"]
    dynamic = criteria["dynamic_evidence"]
    if report.get("status") != dynamic["required_report_status"]:
        raise VerificationError("Dynamic QA report did not pass")
    if report.get("release_id") != release.get("release_id"):
        raise VerificationError("Dynamic QA report release ID does not match")
    if report.get("failed") != 0:
        raise VerificationError("Dynamic QA report contains failures")
    deployment = report.get("deployment")
    if not isinstance(deployment, dict):
        raise VerificationError("Dynamic QA report lacks deployment identity")
    source_commits: list[str] = []
    for component in ("frontend", "api", "qa"):
        identity = deployment.get(component)
        if not isinstance(identity, dict):
            raise VerificationError(f"Dynamic QA report lacks {component} identity")
        if identity.get("release_id") != release.get("release_id"):
            raise VerificationError(f"Dynamic QA {component} release ID does not match")
        source_commit = identity.get("source_commit")
        if not isinstance(source_commit, str) or not re.fullmatch(r"[0-9a-f]{40}", source_commit):
            raise VerificationError(
                f"Dynamic QA {component} source commit is absent, unknown, or malformed"
            )
        source_commits.append(source_commit)
    if len(set(source_commits)) != 1:
        raise VerificationError("Dynamic QA frontend, API, and QA commits are not aligned")
    source_commit = source_commits[0]

    if evidence_manifest.get("contract") != dynamic["evidence_manifest_contract"]:
        raise VerificationError("Dynamic QA evidence manifest contract is unsupported")
    if evidence_manifest.get("release_id") != release.get("release_id"):
        raise VerificationError("Dynamic QA evidence manifest release ID does not match")
    if evidence_manifest.get("source_commit") != source_commit:
        raise VerificationError("Dynamic QA evidence manifest is not from the aligned commit")
    if evidence_manifest.get("retained_before_session_reset") is not True:
        raise VerificationError("Dynamic QA evidence was not retained before reset")
    report_evidence = report.get("evidence")
    if not isinstance(report_evidence, dict):
        raise VerificationError("Dynamic QA report lacks its evidence binding")
    if report_evidence.get("contract") != "casepath.qa-evidence/1.0.0":
        raise VerificationError("Dynamic QA report evidence contract is unsupported")
    if report_evidence.get("retained_before_session_reset") is not True:
        raise VerificationError("Dynamic QA report evidence was not retained before reset")
    if evidence_manifest.get("gate") != report_evidence.get("gate"):
        raise VerificationError("Dynamic QA gate identity differs between report and manifest")
    if evidence_manifest.get("runtime") != report.get("runtime"):
        raise VerificationError("Dynamic QA runtime differs between report and manifest")
    manifest_binding = report_evidence.get("manifest")
    if not isinstance(manifest_binding, dict) or manifest_binding.get("path") != dynamic[
        "evidence_manifest_path"
    ]:
        raise VerificationError("Dynamic QA report does not bind evidence-manifest.json")
    expected_hash = hashlib.sha256(evidence_manifest_bytes).hexdigest()
    if manifest_binding.get("sha256") != expected_hash:
        raise VerificationError("Dynamic QA report evidence-manifest hash does not match")
    if manifest_binding.get("bytes") != len(evidence_manifest_bytes):
        raise VerificationError("Dynamic QA report evidence-manifest size does not match")

    files = evidence_manifest.get("files")
    if not isinstance(files, list):
        raise VerificationError("Dynamic QA evidence manifest files must be a list")
    if report_evidence.get("files") != files:
        raise VerificationError("Dynamic QA report and manifest file inventories differ")
    files_by_path: dict[str, dict[str, Any]] = {}
    for record in files:
        path_text = record.get("path") if isinstance(record, dict) else None
        if not isinstance(path_text, str) or not path_text or path_text in files_by_path:
            raise VerificationError("Dynamic QA evidence paths must be present and distinct")
        if not re.fullmatch(r"[0-9a-f]{64}", str(record.get("sha256", ""))):
            raise VerificationError(f"Dynamic QA evidence {path_text} lacks a SHA-256")
        if not isinstance(record.get("bytes"), int) or record["bytes"] <= 0:
            raise VerificationError(f"Dynamic QA evidence {path_text} is empty")
        files_by_path[path_text] = record
    missing = sorted(REQUIRED_QA_EVIDENCE_FILES - files_by_path.keys())
    if missing:
        raise VerificationError(f"Dynamic QA evidence manifest lacks required files: {missing}")
    media_contract = evidence_manifest.get("retained_media_contract")
    if (
        not isinstance(media_contract, dict)
        or media_contract.get("missing") != []
        or media_contract.get("empty") != []
    ):
        raise VerificationError("Dynamic QA retained-media contract is incomplete")

    flagship_run = retained_evidence.get("flagship-run.json")
    flagship_ledger = retained_evidence.get("flagship-cold-model-ledger.json")
    if not isinstance(flagship_run, dict) or not isinstance(flagship_ledger, dict):
        raise VerificationError("Dynamic QA pair lacks retained flagship run or cold ledger")
    orchestration_id = _verify_cold_flagship_evidence(flagship_run, flagship_ledger)
    return {
        "release_id": release["release_id"],
        "source_commit": source_commit,
        "orchestration_id": orchestration_id,
        "model_agents": len(REQUIRED_MODEL_AGENTS),
        "deterministic_gates": len(REQUIRED_DETERMINISTIC_GATES),
        "status": "passed",
        "verdict_source": RUNTIME_VERDICT_AUTHORITY,
    }


def verify_dynamic_runtime_acceptance_paths(
    report_path: Path,
    evidence_manifest_path: Path,
) -> dict[str, Any]:
    """Verify a retained QA output directory without mutating release source."""

    if report_path.name != QA_REPORT_PATH:
        raise VerificationError(f"Dynamic QA report must be named {QA_REPORT_PATH}")
    if evidence_manifest_path.name != QA_EVIDENCE_MANIFEST_PATH:
        raise VerificationError(
            f"Dynamic QA evidence manifest must be named {QA_EVIDENCE_MANIFEST_PATH}"
        )
    if report_path.parent.resolve() != evidence_manifest_path.parent.resolve():
        raise VerificationError("Dynamic QA report and evidence manifest must share a directory")
    try:
        report = json.loads(report_path.read_text(encoding="utf-8"))
        manifest_bytes = evidence_manifest_path.read_bytes()
        evidence_manifest = json.loads(manifest_bytes.decode("utf-8"))
    except (OSError, UnicodeDecodeError, json.JSONDecodeError) as exc:
        raise VerificationError(f"Cannot read dynamic QA evidence: {exc}") from exc
    if not isinstance(report, dict) or not isinstance(evidence_manifest, dict):
        raise VerificationError("Dynamic QA report and evidence manifest must be objects")

    evidence_root = evidence_manifest_path.parent
    files = evidence_manifest.get("files")
    if not isinstance(files, list):
        raise VerificationError("Dynamic QA evidence manifest files must be a list")
    for record in files:
        if not isinstance(record, dict) or not isinstance(record.get("path"), str):
            raise VerificationError("Dynamic QA evidence manifest file record is invalid")
        relative_path = Path(record["path"])
        if relative_path.is_absolute() or ".." in relative_path.parts:
            raise VerificationError(f"Unsafe dynamic QA evidence path: {record['path']!r}")
        artifact_path = evidence_root / relative_path
        if not artifact_path.is_file():
            raise VerificationError(f"Missing dynamic QA evidence file: {record['path']}")
        if sha256_file(artifact_path) != record.get("sha256"):
            raise VerificationError(f"Dynamic QA evidence hash mismatch: {record['path']}")
        if artifact_path.stat().st_size != record.get("bytes"):
            raise VerificationError(f"Dynamic QA evidence size mismatch: {record['path']}")

    retained_evidence = {}
    for filename in ("flagship-run.json", "flagship-cold-model-ledger.json"):
        try:
            value = json.loads((evidence_root / filename).read_text(encoding="utf-8"))
        except (OSError, json.JSONDecodeError) as exc:
            raise VerificationError(f"Cannot read retained {filename}: {exc}") from exc
        if not isinstance(value, dict):
            raise VerificationError(f"Retained {filename} must be an object")
        retained_evidence[filename] = value
    return verify_dynamic_runtime_acceptance(
        load_json(RELEASE_PATH),
        report,
        evidence_manifest,
        retained_evidence,
        evidence_manifest_bytes=manifest_bytes,
    )


def verify_release_contract() -> None:
    release = load_json(RELEASE_PATH)
    required_pairs = {
        ("contract",): RELEASE_CONTRACT,
        ("schema_version",): "2.2.0",
        ("release_id",): "casepath-v20-reference-20260811",
        ("components", "frontend", "version"): "20.0.0",
        ("components", "api", "version"): "15.2.0",
        ("components", "pipeline", "version"): "15.2.0",
        ("components", "qa", "version"): "20.0.0",
        ("claims", "flagship"): "DEF-027-E0-DEMO",
        ("claims", "later_claim"): "DEMO-MOULD-002",
        ("truth", "deterministic_build", "execution_mode"): "deterministic_reference",
        ("truth", "deterministic_build", "model_calls"): 0,
        ("truth", "deterministic_build", "model_backed"): False,
        ("truth", "production_runtime_acceptance", "required_mode"): REQUIRED_PRODUCTION_MODE,
        ("truth", "production_runtime_acceptance", "required_model"): REQUIRED_PRODUCTION_MODEL,
        (
            "truth",
            "production_runtime_acceptance",
            "required_runtime_profile",
        ): REQUIRED_RUNTIME_PROFILE,
        ("truth", "independent_expert_review"): False,
        ("truth", "legal_approval"): False,
        ("truth", "operational_validation"): False,
        ("compatibility", "component_versions_are_independent"): True,
        ("artifact_policy", "scenario_dates", "flagship_received_on"): "2026-08-01",
        ("artifact_policy", "scenario_dates", "later_photo_on"): "2026-08-08",
        ("artifact_policy", "scenario_dates", "later_claim_received_on"): "2026-08-10",
    }
    for keys, expected in required_pairs.items():
        value: Any = release
        for key in keys:
            if not isinstance(value, dict) or key not in value:
                raise VerificationError(f"Release contract is missing {'.'.join(keys)}")
            value = value[key]
        if value != expected:
            raise VerificationError(
                f"Release contract {'.'.join(keys)} must be {expected!r}, got {value!r}"
            )

    verify_static_runtime_acceptance_contract(release)

    release_text = RELEASE_PATH.read_text(encoding="utf-8")
    present_obsolete = sorted(
        identifier for identifier in OBSOLETE_CLAIM_IDS if identifier in release_text
    )
    if present_obsolete:
        raise VerificationError(f"Release contract contains obsolete claim IDs: {present_obsolete}")

    for path_text in ACTIVE_SCENARIO_FILES:
        path = REPOSITORY / path_text
        source = path.read_text(encoding="utf-8")
        stale = sorted(marker for marker in OBSOLETE_ACTIVE_MARKERS if marker in source)
        if stale:
            raise VerificationError(
                f"Active scenario file {path_text} contains stale markers: {stale}"
            )

    scenario_dates = release["artifact_policy"]["scenario_dates"]
    try:
        flagship_received = date.fromisoformat(scenario_dates["flagship_received_on"])
        later_photo = date.fromisoformat(scenario_dates["later_photo_on"])
        later_claim_received = date.fromisoformat(scenario_dates["later_claim_received_on"])
        released_on = date.fromisoformat(release["released_on"])
    except (KeyError, TypeError, ValueError) as exc:
        raise VerificationError(f"Invalid scenario date policy: {exc}") from exc
    if not flagship_received < later_photo < later_claim_received <= released_on:
        raise VerificationError(
            "Scenario dates must satisfy flagship_received < later_photo < "
            "later_claim_received <= released_on"
        )

    expected_source_identity = {
        "authority": RUNTIME_VERDICT_AUTHORITY,
        "source_contract_embeds_commit": False,
        "runtime_environment_variable": "RENDER_GIT_COMMIT",
        "unknown_semantics": (
            "A dynamic production acceptance result must fail when any service or evidence "
            "artifact reports an absent, unknown, or malformed source commit."
        ),
    }
    if release.get("source_identity") != expected_source_identity:
        raise VerificationError(
            "Release source identity must delegate commit truth to dynamic same-commit QA artifacts"
        )

    marker_checks = [
        (
            REPOSITORY / "casepath" / "index.html",
            re.compile(r'<meta\s+name="casepath-release"\s+content="20\.0\.0">'),
            "frontend 20.0.0 release meta",
        ),
        (
            REPOSITORY / "casepath-api" / "casepath_api" / "__init__.py",
            re.compile(r'__version__\s*=\s*"15\.2\.0"'),
            "API 15.2.0 version",
        ),
        (
            REPOSITORY / "casepath-api" / "casepath_api" / "pipeline_v15.py",
            re.compile(r'RELEASE\s*=\s*"15\.2\.0"'),
            "pipeline 15.2.0 release",
        ),
        (
            REPOSITORY / "casepath-qa" / "browser-focused-v20.mjs",
            re.compile(r"const\s+PRODUCT_RELEASE\s*=\s*'20\.0\.0'"),
            "QA 20.0.0 report marker",
        ),
    ]
    for path, pattern, label in marker_checks:
        if not path.is_file() or not pattern.search(path.read_text(encoding="utf-8")):
            raise VerificationError(f"Missing {label} in {relative(path)}")

    def pinned_requirements(path: Path) -> dict[str, str]:
        pins: dict[str, str] = {}
        for raw_line in path.read_text(encoding="utf-8").splitlines():
            line = raw_line.strip()
            if not line or line.startswith("#"):
                continue
            if "==" not in line:
                raise VerificationError(f"Unpinned dependency in {relative(path)}: {line}")
            package, version = line.split("==", 1)
            normalized = package.split("[", 1)[0].strip().lower().replace("_", "-")
            if normalized in pins:
                raise VerificationError(
                    f"Duplicate dependency pin in {relative(path)}: {normalized}"
                )
            pins[normalized] = version.strip()
        return pins

    direct_path = REPOSITORY / "casepath-api" / "requirements.txt"
    lock_path = REPOSITORY / "casepath-api" / "requirements.lock"
    direct = pinned_requirements(direct_path)
    locked = pinned_requirements(lock_path)
    inconsistent = {
        package: {"direct": version, "lock": locked.get(package)}
        for package, version in direct.items()
        if locked.get(package) != version
    }
    if inconsistent:
        raise VerificationError(f"Dependency lock is inconsistent: {inconsistent}")
    required_framework_pins = {
        "langchain": REQUIRED_FRAMEWORK["langchain"],
        "langgraph": REQUIRED_FRAMEWORK["langgraph"],
        "langchain-openrouter": REQUIRED_FRAMEWORK["langchain_openrouter"],
    }
    inconsistent_framework = {
        package: {"required": version, "locked": locked.get(package)}
        for package, version in required_framework_pins.items()
        if locked.get(package) != version
    }
    if inconsistent_framework:
        raise VerificationError(
            f"Agent framework lock is inconsistent: {inconsistent_framework}"
        )
    required_resolved_packages = {
        "distro",
        "jsonpatch",
        "jsonpath-python",
        "jsonpointer",
        "langchain-core",
        "langchain-protocol",
        "langgraph-checkpoint",
        "langgraph-prebuilt",
        "langgraph-sdk",
        "langsmith",
        "openrouter",
        "orjson",
        "ormsgpack",
        "requests",
        "requests-toolbelt",
        "sniffio",
        "tenacity",
        "urllib3",
        "uuid-utils",
        "xxhash",
        "zstandard",
    }
    missing_resolved = sorted(required_resolved_packages - locked.keys())
    if missing_resolved:
        raise VerificationError(
            f"Agent framework transitive lock is incomplete: {missing_resolved}"
        )


def generate() -> None:
    verify_release_contract()
    artifact_manifest = build_artifact_manifest()
    write_json(ARTIFACT_MANIFEST_PATH, artifact_manifest)
    write_json(SOURCE_MANIFEST_PATH, source_manifest_payload())
    verify()


def verify() -> None:
    verify_release_contract()

    expected_artifact = build_artifact_manifest()
    actual_artifact = load_json(ARTIFACT_MANIFEST_PATH)
    if actual_artifact != expected_artifact:
        raise VerificationError(
            "Artifact manifest is stale; run `python casepath/tools/casepath_release.py generate`"
        )

    expected_source = source_manifest_payload()
    actual_source = load_json(SOURCE_MANIFEST_PATH)
    if actual_source != expected_source:
        raise VerificationError(
            "Source manifest is stale; run `python casepath/tools/casepath_release.py generate`"
        )

    print(
        json.dumps(
            {
                "artifact_files": expected_artifact["file_count"],
                "leakage_scan": expected_artifact["leakage_policy"]["status"],
                "model_visible_artifacts": expected_artifact["leakage_policy"][
                    "model_visible_files_scanned"
                ],
                "release_id": actual_source["release_id"],
                "source_commit": actual_source["source_commit"],
                "source_files": actual_source["file_count"],
                "status": "verified",
            },
            indent=2,
            sort_keys=True,
        )
    )


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "command",
        choices=("generate", "verify", "verify-runtime-evidence"),
    )
    parser.add_argument(
        "--report",
        type=Path,
        help="Path to the dynamic QA report.json",
    )
    parser.add_argument(
        "--evidence-manifest",
        type=Path,
        help="Path to the dynamic QA evidence-manifest.json",
    )
    args = parser.parse_args()
    if args.command == "verify-runtime-evidence" and (
        args.report is None or args.evidence_manifest is None
    ):
        parser.error(
            "verify-runtime-evidence requires --report and --evidence-manifest"
        )
    return args


def main() -> int:
    args = parse_args()
    try:
        if args.command == "generate":
            generate()
        elif args.command == "verify":
            verify()
        else:
            result = verify_dynamic_runtime_acceptance_paths(
                args.report,
                args.evidence_manifest,
            )
            print(json.dumps(result, indent=2, sort_keys=True))
    except VerificationError as exc:
        print(f"release verification failed: {exc}", file=sys.stderr)
        return 1
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
