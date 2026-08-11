from __future__ import annotations

from copy import deepcopy
import hashlib
import json
import sys
from pathlib import Path

import pytest


TOOLS = Path(__file__).resolve().parent
if str(TOOLS) not in sys.path:
    sys.path.insert(0, str(TOOLS))

import casepath_release as release_tool  # noqa: E402


@pytest.mark.parametrize(
    ("text", "marker"),
    [
        ("generated attachment", "generated"),
        ("fictional document", "fictional"),
        ("sample record", "sample"),
        ("dummy value", "dummy"),
        ("benchmark answer", "benchmark"),
        ("hidden labels", "hidden_label"),
        ("service@company.example", "example_domain"),
        ("CasePath demo", "demo"),
    ],
)
def test_required_leakage_markers_are_detected(text: str, marker: str) -> None:
    findings = release_tool.scan_text("unit-test", text)
    assert marker in {finding["marker"] for finding in findings}


def test_release_contract_and_manifests_are_current() -> None:
    release_tool.verify_release_contract()
    assert release_tool.load_json(release_tool.ARTIFACT_MANIFEST_PATH) == (
        release_tool.build_artifact_manifest()
    )
    assert release_tool.load_json(release_tool.SOURCE_MANIFEST_PATH) == (
        release_tool.source_manifest_payload()
    )


def test_archive_release_record_keeps_external_limits_explicit() -> None:
    record_path = (
        release_tool.REPOSITORY
        / "casepath"
        / "releases"
        / "casepath-defects-expert-ready-1.0.0.json"
    )
    record = json.loads(record_path.read_text(encoding="utf-8"))
    assert record["archive"]["sha256"] == (
        "770ef2e68222aa237c71ad273628d306211de3290b075d408cbb978516c14533"
    )
    assert record["verification"]["tests_passed"] == 1721
    assert record["source_commit_resolution"]["status"] == "unresolved"
    assert record["clean_environment_reproduction"]["overall_status"].startswith("blocked_")
    assert record["truth"]["independent_expert_review_completed"] is False


def test_later_scenario_precedes_release_and_has_no_stale_active_markers() -> None:
    contract = release_tool.load_json(release_tool.RELEASE_PATH)
    assert contract["artifact_policy"]["scenario_dates"] == {
        "flagship_received_on": "2026-08-01",
        "later_photo_on": "2026-08-08",
        "later_claim_received_on": "2026-08-10",
    }
    release_tool.verify_release_contract()


def test_model_truth_is_scoped_and_failed_attempt_history_is_not_accepted() -> None:
    contract = release_tool.load_json(release_tool.RELEASE_PATH)
    truth = contract["truth"]
    assert truth["deterministic_build"] == {
        "status": "passed",
        "execution_mode": "deterministic_reference",
        "model_calls": 0,
        "model_backed": False,
    }
    runtime = truth["production_runtime_acceptance"]
    assert "status" not in runtime
    assert "model_backed_accepted" not in runtime
    assert runtime["verdict_authority"] == "dynamic_same_commit_qa_artifacts"
    assert runtime["source_contract_embeds_runtime_verdict"] is False
    assert runtime["dynamic_evidence"] == {
        "qa_gate": "focused-flagship-journey-v20",
        "report_path": "report.json",
        "evidence_manifest_path": "evidence-manifest.json",
        "evidence_manifest_contract": "casepath.qa-evidence-manifest/1.0.0",
        "required_report_status": "passed",
        "requires_release_id_match": True,
        "requires_non_unknown_source_commit": True,
        "requires_same_source_commit": True,
    }
    assert truth["historical_model_validation"] == {
        "scope": "failed_closed_history_only",
        "evidence_records": list(release_tool.HISTORICAL_MODEL_VALIDATION_RECORDS),
        "establishes_current_runtime_acceptance": False,
    }
    assert contract["source_identity"]["source_contract_embeds_commit"] is False

    attempts = {
        number: release_tool.load_json(
            release_tool.REPOSITORY
            / f"casepath/releases/model-validation-attempt-20260811-{number:02d}.json"
        )
        for number in range(1, 8)
    }
    attempt_1, attempt_2, attempt_3, attempt_4, attempt_5, attempt_6, attempt_7 = (
        attempts[number] for number in range(1, 8)
    )
    for evidence in attempts.values():
        assert evidence["status"] == "failed_closed"
        assert evidence["acceptance_passed"] is False
        assert evidence["model_backed_release_evidence"] is False
        assert evidence["accepted_ledger_record"] is None

    assert attempt_1["provider_observation"] == {
        "canonical_model_id": "nvidia/nemotron-3-ultra-550b-a55b-20260604",
        "upstream_provider": "DeepInfra",
        "actual_cost_usd": 0.00756,
        "prompt_tokens": 3629,
        "completion_tokens": 2625,
        "total_tokens": 6254,
        "finish_reason": "stop",
    }
    assert attempt_2["provider_observation"] == {
        "provider": "openrouter",
        "provider_outcome": "succeeded",
        "upstream_provider": "DeepInfra",
        "response_model": "nvidia/nemotron-3-ultra-550b-a55b",
        "response_id": "gen-1786461118-3rFP3Fq1fNjl0lrXGKNE",
        "actual_cost_usd": 0.0058589,
        "prompt_tokens": 4641,
        "completion_tokens": 1620,
        "total_tokens": 6261,
        "finish_reason": "stop",
    }
    assert attempt_2["application_result"] == {
        "outcome": "rejected",
        "failure_type": "non_controlling_normalized_value",
        "successful_ledger_call_bound": False,
        "ledger_call_id": "modelcall_80e9a1f447e1a026",
        "ledger_outcome": "failed",
        "canonical_result_accepted": False,
    }
    assert attempt_3["provider_observation"] == {
        "provider": "openrouter",
        "provider_outcome": "structured_content_returned",
        "synchronous_usage_cost_present": False,
        "new_openrouter_log_generation_observed": False,
        "provider_cache_replay_assessment": "likely_unconfirmed",
        "charge_status": "unknown_unconfirmed",
        "charge_included_in_known_aggregate": False,
    }
    assert attempt_3["application_result"] == {
        "outcome": "rejected",
        "failure_type": "usage_metadata_completeness",
        "successful_ledger_call_bound": False,
        "ledger_call_id": None,
        "canonical_result_accepted": False,
    }
    assert attempt_4["provider_observation"] == {
        "provider": "openrouter",
        "provider_outcome": "succeeded",
        "upstream_provider": "DeepInfra",
        "response_model": "nvidia/nemotron-3-ultra-550b-a55b",
        "response_id": "gen-1786463260-Xe8T7jBgOLjFhr82uaon",
        "actual_cost_usd": 0.0058281,
        "prompt_tokens": 4641,
        "completion_tokens": 1606,
        "total_tokens": 6247,
        "finish_reason": "stop",
    }
    assert attempt_4["application_result"] == {
        "outcome": "rejected",
        "failure_type": "fact_dispute/source_reference_set",
        "successful_ledger_call_bound": False,
        "ledger_call_id": "modelcall_29c9c7fde86d9fcf",
        "ledger_outcome": "failed",
        "canonical_result_accepted": False,
    }
    assert attempt_5["provider_observation"] == {
        "provider": "openrouter",
        "provider_outcome": "succeeded",
        "response_model": "nvidia/nemotron-3-ultra-550b-a55b",
        "response_id": "gen-1786475792-xFaK7MHwa5i0FStRHruR",
        "actual_cost_usd": 0.0157931,
        "prompt_tokens": 23141,
        "completion_tokens": 1931,
        "total_tokens": 25072,
        "finish_reason": "stop",
    }
    assert attempt_5["application_result"] == {
        "outcome": "rejected",
        "failure_type": "hybrid_model_contribution_strict_majority",
        "successful_ledger_call_bound": False,
        "ledger_call_id": "modelcall_ef72cb958e5c9e63",
        "ledger_outcome": "failed",
        "canonical_result_accepted": False,
        "accepted_fact_count": 7,
        "rejected_fact_count": 11,
        "rejected_invariants": {
            "source_reference_set": 10,
            "canonical_state": 1,
        },
    }
    assert attempt_6["execution_observation"] == {
        "source_commit": "697a19fa0be541f46af85d9f31dd5cbda96b2bb8",
        "qa_deploy_id": "dep-d9tnp72jobas73df6jmg",
        "qa_deploy_outcome": "build_failed",
        "qa_run_id": "run_b67c7356cac2cf12",
        "orchestration_id": "orch_2d81acf782aa379b",
        "failed_agent_id": "canonical_facts",
        "provider_response_count": 1,
        "downstream_model_calls": 0,
        "deterministic_gate_receipts": 0,
    }
    assert attempt_6["provider_observation"] == {
        "provider": "openrouter",
        "provider_outcome": "succeeded",
        "response_model": "nvidia/nemotron-3-ultra-550b-a55b",
        "response_id": "gen-1786477748-NYzcfF7sy7RQ71QO780m",
        "actual_cost_usd": 0.0177709,
        "prompt_tokens": 23163,
        "completion_tokens": 2825,
        "total_tokens": 25988,
        "finish_reason": "stop",
        "usage_source": "response",
        "latency_ms": 25786.994,
    }
    assert attempt_6["application_result"] == {
        "outcome": "rejected",
        "failure_type": "post_validation_missing_upstream_provider_persistence",
        "error_type": "KeyError",
        "successful_ledger_call_bound": False,
        "ledger_call_id": "modelcall_0263759a564abb00",
        "ledger_outcome": "failed",
        "canonical_result_accepted": False,
        "upstream_provider_persisted": False,
        "contribution_diagnostics_retained": False,
    }
    for unavailable_count in (
        "accepted_fact_count",
        "rejected_fact_count",
        "source_reference_projection_count",
    ):
        assert unavailable_count not in attempt_6["application_result"]
    assert attempt_7["execution_observation"] == {
        "source_commit": "7e87f40bc866444f16fd837fa3e6a999faa1c7e0",
        "frontend_deploy_id": "dep-d9to4r942hec738ntcdg",
        "api_deploy_id": "dep-d9to4qqjnfac73cc5seg",
        "qa_deploy_id": "dep-d9to5onavr4c73c9lh3g",
        "qa_deploy_outcome": "build_failed",
        "qa_run_id": "run_a4ce02e0125690b2",
        "orchestration_id": "orch_60c6c6a9508c39f9",
        "failed_agent_id": "canonical_facts",
        "provider_response_count": 1,
        "downstream_model_calls": 0,
        "deterministic_gate_receipts": 0,
    }
    assert attempt_7["provider_observation"] == {
        "provider": "openrouter",
        "provider_outcome": "http_200_response_schema_rejected_by_sdk",
        "response_http_status": 200,
        "sdk": "openrouter",
        "sdk_version": "0.11.46",
        "sdk_error_type": "ResponseValidationError",
        "response_identity_status": "unknown_unverified",
        "synchronous_usage_cost_present": False,
        "new_openrouter_log_generation_observed": False,
        "openrouter_log_check_performed": False,
        "provider_cache_replay_assessment": "not_assessed",
        "charge_status": "unknown_unconfirmed",
        "charge_included_in_known_aggregate": False,
        "estimated_cost_reservation_usd": 0.027645,
        "estimated_reservation_is_actual_charge": False,
        "latency_ms": 28814.669,
    }
    assert attempt_7["application_result"] == {
        "outcome": "rejected",
        "failure_type": "openrouter_sdk_chat_result_response_validation",
        "error_type": "ResponseValidationError",
        "successful_ledger_call_bound": False,
        "ledger_call_id": "modelcall_2c6614b3bc53305b",
        "ledger_outcome": "failed",
        "canonical_result_accepted": False,
        "response_identity_retained": False,
        "usage_metadata_retained": False,
        "contribution_diagnostics_retained": False,
    }
    assert sum(
        attempt["provider_observation"]["actual_cost_usd"]
        for attempt in attempts.values()
        if "actual_cost_usd" in attempt["provider_observation"]
    ) == pytest.approx(0.0528110)
    assert "actual_cost_usd" not in attempt_3["provider_observation"]
    assert "prompt_tokens" not in attempt_3["provider_observation"]
    assert attempt_3["provider_observation"]["charge_status"] == "unknown_unconfirmed"
    assert "actual_cost_usd" not in attempt_7["provider_observation"]
    assert "prompt_tokens" not in attempt_7["provider_observation"]
    assert attempt_7["provider_observation"]["charge_status"] == "unknown_unconfirmed"
    assert attempt_7["provider_observation"]["estimated_reservation_is_actual_charge"] is False
    for attempt in attempts.values():
        release_tool.verify_failed_model_attempt_evidence(contract, attempt)

    incomplete_usage = deepcopy(attempt_3)
    incomplete_usage["provider_observation"]["actual_cost_usd"] = 0.01
    with pytest.raises(release_tool.VerificationError, match="complete or explicitly unavailable"):
        release_tool.verify_failed_model_attempt_evidence(contract, incomplete_usage)

    mislabeled_estimate = deepcopy(attempt_7)
    mislabeled_estimate["provider_observation"][
        "estimated_reservation_is_actual_charge"
    ] = True
    with pytest.raises(release_tool.VerificationError, match="must not be represented"):
        release_tool.verify_failed_model_attempt_evidence(contract, mislabeled_estimate)


def successful_dynamic_qa_evidence(contract: dict) -> tuple[dict, dict, dict, bytes]:
    orchestration_id = "orch_release_acceptance_test"
    required_agents = contract["agentic_runtime"]["model_agents"]
    call_ids = {
        item["agent_id"]: f"modelcall_{index:02d}_release_acceptance"
        for index, item in enumerate(required_agents, start=1)
    }
    records = []
    for index, item in enumerate(required_agents, start=1):
        agent_id = item["agent_id"]
        if agent_id == "canonical_facts":
            parent_call_id = None
            delegation_id = None
        elif agent_id == "orchestrator_plan":
            parent_call_id = call_ids["canonical_facts"]
            delegation_id = f"delegation_{index:02d}"
        else:
            parent_call_id = call_ids["orchestrator_plan"]
            delegation_id = f"delegation_{index:02d}"
        records.append(
            {
                "agent_id": agent_id,
                "role": item["role"],
                "actor_type": "nemotron_agent",
                "acceptance_scope": "pre_review_model_output",
                "model": release_tool.REQUIRED_PRODUCTION_MODEL,
                "provider": "openrouter",
                "upstream_provider": "DeepInfra",
                "requested_model": release_tool.REQUIRED_PRODUCTION_MODEL,
                "response_model": release_tool.REQUIRED_PRODUCTION_MODEL,
                "finish_reason": "stop",
                "call_id": call_ids[agent_id],
                "response_id": f"generation_runtime_proof_{index:02d}",
                "parent_call_id": parent_call_id,
                "delegation_id": delegation_id,
                "call_count": 1,
                "cache_hit": False,
                "outcome": "succeeded",
                "accepted_ids": [
                    f"accepted_{agent_id}_{accepted_index}"
                    for accepted_index in range(1, 4)
                ],
                "accepted_count": 3,
                "rejected_count": 0,
                "source_reference_projection_fact_ids": (
                    [] if agent_id == "canonical_facts" else None
                ),
                "source_reference_projection_count": (
                    0 if agent_id == "canonical_facts" else None
                ),
                "deterministic_fallback_applied": False,
                "input_artifact_hash": f"{index:064x}",
                "output_artifact_hash": f"{index + 100:064x}",
            }
        )
    runtime = contract["agentic_runtime"]
    process = {
        "contract": "casepath.process-graph/15.2",
        "current_node": "scope",
        "nodes": [{"node_id": "scope", "state": "active"}],
    }
    checklist = {
        "contract": "casepath.evidence-model/15.2",
        "items": [{"item_id": "lease", "status": "provided_sufficient"}],
    }
    final_claim_brief = {
        "contract": "casepath.final-claim-brief/1.0.0",
        "current_node_id": "scope",
        "next_action_node_id": "notice",
    }
    by_agent = {record["agent_id"]: record for record in records}
    gate_bindings = {
        "deterministic_process_gate": (
            "process_graph",
            process,
            "process_decision_mapping",
        ),
        "deterministic_evidence_gate": (
            "evidence_model",
            checklist,
            "evidence_checklist",
        ),
        "whole_playbook_gate": (
            "final_claim_brief",
            final_claim_brief,
            "final_claim_brief_audit",
        ),
    }
    audit = {
        "orchestration_id": orchestration_id,
        "schema_version": runtime["orchestration_schema"],
        "implementation": runtime["implementation"],
        "authority_mode": runtime["authority_mode"],
        "model": runtime["model"],
        "framework": runtime["framework"],
        "model_assisted": True,
        "all_required_agents_contributed": True,
        "external_tracing": False,
        "prompt_storage": False,
        "raw_output_storage": False,
        "deterministic_safety_authority": True,
        "execution_topology": deepcopy(release_tool.REQUIRED_EXECUTION_TOPOLOGY),
        "guarded_fallback_count": 0,
        "agents": records,
        "deterministic_gates": [
            {
                "agent_id": gate_id,
                "actor_type": "deterministic_gate",
                "receipt_type": "accepted_artifact",
                "acceptance_scope": "pre_review_model_output",
                "model": None,
                "outcome": "passed",
                "source_agent_id": source_agent_id,
                "source_call_id": by_agent[source_agent_id]["call_id"],
                "delegation_id": by_agent[source_agent_id]["delegation_id"],
                "accepted_ids": by_agent[source_agent_id]["accepted_ids"],
                "accepted_count": by_agent[source_agent_id]["accepted_count"],
                "input_artifact_hash": f"{index + 200:064x}",
                "output_artifact": output_artifact,
                "output_artifact_hash": release_tool.accepted_artifact_hash(
                    artifact_value
                ),
            }
            for index, (
                gate_id,
                (output_artifact, artifact_value, source_agent_id),
            ) in enumerate(gate_bindings.items(), start=1)
        ],
        "final_claim_brief": final_claim_brief,
    }
    flagship_run = {
        "run_id": "flagship-run",
        "status": "complete",
        "result": {
            "process": process,
            "checklist": checklist,
            "agent_orchestration": audit,
            "audit": {"agent_orchestration": audit},
        },
    }
    ledger = {
        "scope": "global_budget_ledger",
        "items": [
            {
                "call_id": agent["call_id"],
                "orchestration_id": orchestration_id,
                "agent_id": agent["agent_id"],
                "parent_call_id": agent["parent_call_id"],
                "delegation_id": agent["delegation_id"],
                "call_count": 1,
                "provider": "openrouter",
                "provider_endpoint": "https://openrouter.ai/api/v1/chat/completions",
                "model": release_tool.REQUIRED_PRODUCTION_MODEL,
                "response_id": agent["response_id"],
                "response_model": agent["response_model"],
                "outcome": "succeeded",
                "upstream_provider": "DeepInfra",
                "usage_source": "response",
                "finish_reason": "stop",
                "prompt_tokens": 100 + index,
                "completion_tokens": 20 + index,
                "total_tokens": 120 + index * 2,
                "actual_cost_usd": 0.001 + index / 100_000,
                "deterministic_fallback_applied": False,
                **(
                    {
                        "accepted_fact_count": agent["accepted_count"],
                        "rejected_fact_count": agent["rejected_count"],
                        "source_reference_projection_fact_ids": agent[
                            "source_reference_projection_fact_ids"
                        ],
                        "source_reference_projection_count": agent[
                            "source_reference_projection_count"
                        ],
                    }
                    if agent["agent_id"] == "canonical_facts"
                    else {
                        "accepted_item_count": agent["accepted_count"],
                        "rejected_item_count": agent["rejected_count"],
                    }
                ),
            }
            for index, agent in enumerate(records, start=1)
        ],
    }
    commit = "a" * 40
    deployment = {
        component: {"release_id": contract["release_id"], "source_commit": commit}
        for component in ("frontend", "api", "qa")
    }
    gate = {
        "path": "browser-focused-v20.mjs",
        "sha256": "b" * 64,
        "bytes": 1234,
    }
    runtime_versions = {"node": "v24.14.1", "playwright": "1.55.0", "chromium": "140"}
    files = [
        {"path": path, "sha256": f"{index:064x}", "bytes": 100 + index}
        for index, path in enumerate(sorted(release_tool.REQUIRED_QA_EVIDENCE_FILES), start=1)
    ]
    manifest = {
        "contract": release_tool.QA_EVIDENCE_MANIFEST_CONTRACT,
        "release_id": contract["release_id"],
        "source_commit": commit,
        "gate": gate,
        "runtime": runtime_versions,
        "retained_before_session_reset": True,
        "retained_media_contract": {"missing": [], "empty": []},
        "files": files,
    }
    manifest_bytes = f"{json.dumps(manifest, indent=2)}\n".encode()
    report = {
        "status": "passed",
        "release_id": contract["release_id"],
        "failed": 0,
        "deployment": deployment,
        "runtime": runtime_versions,
        "evidence": {
            "contract": "casepath.qa-evidence/1.0.0",
            "gate": gate,
            "files": files,
            "retained_before_session_reset": True,
            "manifest": {
                "path": "evidence-manifest.json",
                "sha256": hashlib.sha256(manifest_bytes).hexdigest(),
                "bytes": len(manifest_bytes),
            },
        },
    }
    retained = {
        "flagship-run.json": flagship_run,
        "flagship-cold-model-ledger.json": ledger,
    }
    return report, manifest, retained, manifest_bytes


def test_dynamic_runtime_acceptance_passes_without_source_promotion() -> None:
    contract = release_tool.load_json(release_tool.RELEASE_PATH)
    original = deepcopy(contract)
    report, manifest, retained, manifest_bytes = successful_dynamic_qa_evidence(contract)
    result = release_tool.verify_dynamic_runtime_acceptance(
        contract,
        report,
        manifest,
        retained,
        evidence_manifest_bytes=manifest_bytes,
    )
    assert result == {
        "release_id": contract["release_id"],
        "source_commit": "a" * 40,
        "orchestration_id": "orch_release_acceptance_test",
        "model_agents": 6,
        "deterministic_gates": 3,
        "status": "passed",
        "verdict_source": "dynamic_same_commit_qa_artifacts",
    }
    assert contract == original


def _append_realistic_warm_ledger_item(retained: dict) -> dict:
    ledger = retained["flagship-cold-model-ledger.json"]
    cold_item = ledger["items"][0]
    warm_item = {
        "call_id": "modelcall_isolation_cache_replay_01",
        "provider": "openrouter",
        "provider_endpoint": "https://openrouter.ai/api/v1/chat/completions",
        "upstream_provider": cold_item["upstream_provider"],
        "model": release_tool.REQUIRED_PRODUCTION_MODEL,
        "implementation": "model_backed_openrouter_canonicalizer",
        "orchestration_id": "orch_isolation_cache_replay",
        "agent_id": "canonical_facts",
        "agent_role": "Guarded Canonical Facts Agent",
        "parent_call_id": None,
        "delegation_id": None,
        "call_count": 0,
        "estimated_cost_usd": 0,
        "latency_ms": 1.25,
        "cache_key": "cache_isolation_canonical_facts",
        "purpose": "isolated cache replay",
        "outcome": "cache_hit",
        "authority_mode": "hybrid_guarded",
        "accepted_fact_ids": ["fact_safe_identifier"],
        "accepted_fact_count": 1,
        "rejected_facts": [],
        "rejected_fact_count": 0,
        "ignored_noncontrolling_normalized_proposals": 0,
        "deterministic_fallback_applied": False,
        "response_id": cold_item["response_id"],
        "origin_call_id": cold_item["call_id"],
        "origin_usage": {
            "prompt_tokens": cold_item["prompt_tokens"],
            "completion_tokens": cold_item["completion_tokens"],
            "total_tokens": cold_item["total_tokens"],
            "actual_cost_usd": cold_item["actual_cost_usd"],
            "usage_source": cold_item["usage_source"],
        },
        "origin_finish_reason": cold_item["finish_reason"],
        "response_model": cold_item["response_model"],
        "usage_source": "cache",
        "finish_reason": cold_item["finish_reason"],
        "created_at": "2026-08-11T00:00:00Z",
        "updated_at": "2026-08-11T00:00:01Z",
    }
    ledger["items"].append(warm_item)
    return warm_item


def test_dynamic_runtime_acceptance_accepts_real_public_ledger_shape() -> None:
    contract = release_tool.load_json(release_tool.RELEASE_PATH)
    report, manifest, retained, manifest_bytes = successful_dynamic_qa_evidence(contract)
    _append_realistic_warm_ledger_item(retained)

    result = release_tool.verify_dynamic_runtime_acceptance(
        contract,
        report,
        manifest,
        retained,
        evidence_manifest_bytes=manifest_bytes,
    )
    assert result["status"] == "passed"


def test_dynamic_runtime_acceptance_rejects_forbidden_retained_run_field() -> None:
    contract = release_tool.load_json(release_tool.RELEASE_PATH)
    report, manifest, retained, manifest_bytes = successful_dynamic_qa_evidence(contract)
    unsafe_value = "private provider narrative must not be retained"
    retained["flagship-run.json"]["reasoning"] = unsafe_value

    with pytest.raises(
        release_tool.VerificationError,
        match=r"forbidden public field at \$\.flagship_run\.reasoning",
    ) as caught:
        release_tool.verify_dynamic_runtime_acceptance(
            contract,
            report,
            manifest,
            retained,
            evidence_manifest_bytes=manifest_bytes,
        )
    assert unsafe_value not in str(caught.value)


def test_dynamic_runtime_acceptance_rejects_non_allowlisted_ledger_field() -> None:
    contract = release_tool.load_json(release_tool.RELEASE_PATH)
    report, manifest, retained, manifest_bytes = successful_dynamic_qa_evidence(contract)
    unsafe_value = "private provider trace must not be retained"
    retained["flagship-cold-model-ledger.json"]["items"][0][
        "provider_trace_excerpt"
    ] = unsafe_value

    with pytest.raises(
        release_tool.VerificationError,
        match=r"items\[0\]\.provider_trace_excerpt",
    ) as caught:
        release_tool.verify_dynamic_runtime_acceptance(
            contract,
            report,
            manifest,
            retained,
            evidence_manifest_bytes=manifest_bytes,
        )
    assert unsafe_value not in str(caught.value)


def test_dynamic_runtime_acceptance_rejects_nonexact_origin_usage_schema() -> None:
    contract = release_tool.load_json(release_tool.RELEASE_PATH)
    report, manifest, retained, manifest_bytes = successful_dynamic_qa_evidence(contract)
    warm_item = _append_realistic_warm_ledger_item(retained)
    warm_item["origin_usage"]["provider_trace_excerpt"] = "not retained"

    with pytest.raises(
        release_tool.VerificationError,
        match=r"items\[6\]\.origin_usage violates the exact origin-usage schema",
    ):
        release_tool.verify_dynamic_runtime_acceptance(
            contract,
            report,
            manifest,
            retained,
            evidence_manifest_bytes=manifest_bytes,
        )


@pytest.mark.parametrize(
    ("field", "value"),
    [
        ("response_id", "r" * 160),
        ("response_model", release_tool.REQUIRED_PRODUCTION_MODEL),
        (
            "response_model",
            "nvidia/nemotron-3-ultra-550b-a55b-20260604",
        ),
        ("upstream_provider", "P" * 80),
        ("finish_reason", "tool_calls"),
    ],
)
def test_successful_provider_provenance_accepts_exact_bounded_values(
    field: str,
    value: str,
) -> None:
    assert release_tool._provider_provenance_value_is_safe(field, value)


@pytest.mark.parametrize(
    ("field", "unsafe_value"),
    [
        ("response_id", "sk" + "-or-unit-test-placeholder"),
        ("response_id", "api_key_unit_test_placeholder"),
        ("response_id", "tenant-moisture-claim-42"),
        ("response_id", "r" * 161),
        ("upstream_provider", "landlord-claim"),
        ("upstream_provider", "P" * 81),
        ("finish_reason", "tenant stopped payment"),
        ("response_model", "nvidia/another-model"),
    ],
)
def test_dynamic_runtime_acceptance_rejects_unsafe_successful_provenance(
    field: str,
    unsafe_value: str,
) -> None:
    contract = release_tool.load_json(release_tool.RELEASE_PATH)
    report, manifest, retained, manifest_bytes = successful_dynamic_qa_evidence(contract)
    agent = retained["flagship-run.json"]["result"]["audit"][
        "agent_orchestration"
    ]["agents"][0]
    ledger_item = retained["flagship-cold-model-ledger.json"]["items"][0]
    agent[field] = unsafe_value
    ledger_item[field] = unsafe_value

    with pytest.raises(
        release_tool.VerificationError,
        match=rf"{field} violates the provider-provenance sanitizer",
    ) as caught:
        release_tool.verify_dynamic_runtime_acceptance(
            contract,
            report,
            manifest,
            retained,
            evidence_manifest_bytes=manifest_bytes,
        )
    assert unsafe_value not in str(caught.value)


def test_dynamic_runtime_acceptance_rejects_unsafe_ledger_only_provenance() -> None:
    contract = release_tool.load_json(release_tool.RELEASE_PATH)
    report, manifest, retained, manifest_bytes = successful_dynamic_qa_evidence(contract)
    unsafe_value = "credential-provider-unit-test"
    retained["flagship-cold-model-ledger.json"]["items"][0][
        "upstream_provider"
    ] = unsafe_value

    with pytest.raises(
        release_tool.VerificationError,
        match="upstream_provider violates the provider-provenance sanitizer",
    ) as caught:
        release_tool.verify_dynamic_runtime_acceptance(
            contract,
            report,
            manifest,
            retained,
            evidence_manifest_bytes=manifest_bytes,
        )
    assert unsafe_value not in str(caught.value)


def test_dynamic_runtime_evidence_paths_verify_the_atomic_artifact_pair(tmp_path: Path) -> None:
    contract = release_tool.load_json(release_tool.RELEASE_PATH)
    report, manifest, retained, _ = successful_dynamic_qa_evidence(contract)
    records = []
    for filename in sorted(release_tool.REQUIRED_QA_EVIDENCE_FILES):
        if filename in retained:
            payload = f"{json.dumps(retained[filename], indent=2)}\n".encode()
        else:
            payload = f"retained evidence: {filename}\n".encode()
        (tmp_path / filename).write_bytes(payload)
        records.append(
            {
                "path": filename,
                "sha256": hashlib.sha256(payload).hexdigest(),
                "bytes": len(payload),
            }
        )
    manifest["files"] = records
    report["evidence"]["files"] = records
    manifest_bytes = f"{json.dumps(manifest, indent=2)}\n".encode()
    (tmp_path / "evidence-manifest.json").write_bytes(manifest_bytes)
    report["evidence"]["manifest"] = {
        "path": "evidence-manifest.json",
        "sha256": hashlib.sha256(manifest_bytes).hexdigest(),
        "bytes": len(manifest_bytes),
    }
    (tmp_path / "report.json").write_text(
        f"{json.dumps(report, indent=2)}\n",
        encoding="utf-8",
    )

    result = release_tool.verify_dynamic_runtime_acceptance_paths(
        tmp_path / "report.json",
        tmp_path / "evidence-manifest.json",
    )
    assert result["status"] == "passed"
    assert result["source_commit"] == "a" * 40


def test_dynamic_runtime_acceptance_rejects_weak_or_unbound_proof() -> None:
    contract = release_tool.load_json(release_tool.RELEASE_PATH)
    report, manifest, retained, manifest_bytes = successful_dynamic_qa_evidence(contract)

    misaligned = deepcopy(report)
    misaligned["deployment"]["api"]["source_commit"] = "d" * 40
    with pytest.raises(release_tool.VerificationError, match="commits are not aligned"):
        release_tool.verify_dynamic_runtime_acceptance(
            contract,
            misaligned,
            manifest,
            retained,
            evidence_manifest_bytes=manifest_bytes,
        )

    duplicate_response = deepcopy(retained)
    agents = duplicate_response["flagship-run.json"]["result"]["audit"][
        "agent_orchestration"
    ]["agents"]
    agents[1]["response_id"] = agents[0]["response_id"]
    with pytest.raises(release_tool.VerificationError, match="response IDs must be distinct"):
        release_tool.verify_dynamic_runtime_acceptance(
            contract,
            report,
            manifest,
            duplicate_response,
            evidence_manifest_bytes=manifest_bytes,
        )

    weak_contribution = deepcopy(retained)
    agent = weak_contribution["flagship-run.json"]["result"]["audit"][
        "agent_orchestration"
    ]["agents"][3]
    agent.update(
        {
            "accepted_count": 1,
            "rejected_count": 1,
            "deterministic_fallback_applied": True,
        }
    )
    with pytest.raises(release_tool.VerificationError, match="strict accepted majority"):
        release_tool.verify_dynamic_runtime_acceptance(
            contract,
            report,
            manifest,
            weak_contribution,
            evidence_manifest_bytes=manifest_bytes,
        )

    traced = deepcopy(retained)
    traced["flagship-run.json"]["result"]["audit"]["agent_orchestration"]["external_tracing"] = True
    with pytest.raises(release_tool.VerificationError, match="external_tracing"):
        release_tool.verify_dynamic_runtime_acceptance(
            contract,
            report,
            manifest,
            traced,
            evidence_manifest_bytes=manifest_bytes,
        )

    forged_hash = deepcopy(retained)
    forged_gates = forged_hash["flagship-run.json"]["result"]["audit"][
        "agent_orchestration"
    ]["deterministic_gates"]
    forged_gates[0]["output_artifact_hash"] = "f" * 64
    with pytest.raises(release_tool.VerificationError, match="output_artifact_hash"):
        release_tool.verify_dynamic_runtime_acceptance(
            contract,
            report,
            manifest,
            forged_hash,
            evidence_manifest_bytes=manifest_bytes,
        )

    missing_dto = deepcopy(retained)
    del missing_dto["flagship-run.json"]["result"]["checklist"]
    with pytest.raises(release_tool.VerificationError, match="accepted DTO is missing"):
        release_tool.verify_dynamic_runtime_acceptance(
            contract,
            report,
            manifest,
            missing_dto,
            evidence_manifest_bytes=manifest_bytes,
        )

    forged_topology = deepcopy(retained)
    topology = forged_topology["flagship-run.json"]["result"]["audit"][
        "agent_orchestration"
    ]["execution_topology"]
    topology["delegations"][0]["dependencies"] = ["canonical_facts"]
    with pytest.raises(release_tool.VerificationError, match="execution_topology"):
        release_tool.verify_dynamic_runtime_acceptance(
            contract,
            report,
            manifest,
            forged_topology,
            evidence_manifest_bytes=manifest_bytes,
        )

    legacy_topology = deepcopy(retained)
    legacy_audit = legacy_topology["flagship-run.json"]["result"]["audit"][
        "agent_orchestration"
    ]
    del legacy_audit["execution_topology"]
    legacy_audit["parallel_groups"] = [
        ["document_source_integrity", "process_decision_mapping"]
    ]
    with pytest.raises(release_tool.VerificationError, match="execution_topology"):
        release_tool.verify_dynamic_runtime_acceptance(
            contract,
            report,
            manifest,
            legacy_topology,
            evidence_manifest_bytes=manifest_bytes,
        )

    forged_accepted_ids = deepcopy(retained)
    gate = forged_accepted_ids["flagship-run.json"]["result"]["audit"][
        "agent_orchestration"
    ]["deterministic_gates"][1]
    gate["accepted_ids"] = ["unbound"] * gate["accepted_count"]
    with pytest.raises(release_tool.VerificationError, match="accepted_ids"):
        release_tool.verify_dynamic_runtime_acceptance(
            contract,
            report,
            manifest,
            forged_accepted_ids,
            evidence_manifest_bytes=manifest_bytes,
        )


def test_accepted_artifact_hash_matches_backend_and_rejects_floats() -> None:
    assert release_tool.accepted_artifact_hash(
        {"z": "ü", "a": [{"basis_points": 9100}, True, None]}
    ) == "a0d744bb4829b2124b022b17dd45499e7012bd19dd95940d1a8a3aed474e42c3"
    with pytest.raises(release_tool.VerificationError, match="contains a float"):
        release_tool.accepted_artifact_hash({"confidence": 0.91})


def test_static_contract_rejects_an_embedded_runtime_verdict() -> None:
    contract = deepcopy(release_tool.load_json(release_tool.RELEASE_PATH))
    contract["truth"]["production_runtime_acceptance"]["status"] = "passed"
    with pytest.raises(release_tool.VerificationError, match="must not embed"):
        release_tool.verify_static_runtime_acceptance_contract(contract)


def test_agentic_runtime_contract_is_exact_and_tracing_is_disabled() -> None:
    contract = release_tool.load_json(release_tool.RELEASE_PATH)
    runtime = contract["agentic_runtime"]
    assert runtime == release_tool.expected_agentic_runtime()
    assert runtime["framework"] == {
        "langchain": "1.3.14",
        "langgraph": "1.2.9",
        "langchain_openrouter": "0.2.7",
    }
    assert runtime["safety"]["external_tracing"] is False
    assert [item["agent_id"] for item in runtime["model_agents"]] == [
        "canonical_facts",
        "orchestrator_plan",
        "document_source_integrity",
        "process_decision_mapping",
        "evidence_checklist",
        "final_claim_brief_audit",
    ]


def test_render_uses_model_aware_readiness_probe() -> None:
    contract = release_tool.load_json(release_tool.RELEASE_PATH)
    release_tool.verify_render_runtime_contract(contract)
    blueprint = release_tool.yaml.safe_load(
        (release_tool.REPOSITORY / "render.yaml").read_text(encoding="utf-8")
    )
    api_service = next(
        item
        for item in blueprint["services"]
        if item.get("name") == "casepath-agentic-api"
    )
    assert api_service["healthCheckPath"] == "/readyz"
