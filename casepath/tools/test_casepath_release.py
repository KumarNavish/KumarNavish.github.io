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
    assert record["clean_environment_reproduction"]["overall_status"].startswith(
        "blocked_"
    )
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
        for number in range(1, 13)
    }
    (
        attempt_1,
        attempt_2,
        attempt_3,
        attempt_4,
        attempt_5,
        attempt_6,
        attempt_7,
        attempt_8,
        attempt_9,
        attempt_10,
        attempt_11,
        attempt_12,
    ) = (attempts[number] for number in range(1, 13))
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
    assert attempt_8["execution_observation"] == {
        "source_commit": "2ab71f600f1e523388dec62e11da4c85b9a15be7",
        "qa_deploy_id": "dep-d9tont6gekts7394fu50",
        "qa_deploy_outcome": "build_failed",
        "qa_deploy_started_at": "2026-08-11T20:54:12.154773Z",
        "qa_error_at": "2026-08-11T20:54:57.057789659Z",
        "qa_build_failed_at": "2026-08-11T20:54:57.157747982Z",
        "qa_deploy_finished_at": "2026-08-11T20:54:58.013224Z",
        "qa_run_id": "run_06fb240a468fd0c8",
        "orchestration_id": "orch_0083b550d06c4b83",
        "failed_agent_id": "canonical_facts",
        "provider_response_count": 1,
        "downstream_model_calls": 0,
        "downstream_agent_receipts": 0,
        "deterministic_gate_receipts": 0,
    }
    assert attempt_8["provider_observation"] == {
        "provider": "openrouter",
        "provider_outcome": "succeeded",
        "requested_model": "nvidia/nemotron-3-ultra-550b-a55b",
        "response_model": "nvidia/nemotron-3-ultra-550b-a55b",
        "response_id": "gen-1786481671-XHJr7oDjH1PtrUL2kNg3",
        "actual_cost_usd": 0.0179293,
        "prompt_tokens": 23163,
        "completion_tokens": 2897,
        "total_tokens": 26060,
        "finish_reason": "stop",
        "latency_ms": 25938.06,
        "bounded_generation_metadata_lookup": "not_available_before_deadline",
        "later_generation_metadata_observation": {
            "read_only": True,
            "response_id": "gen-1786481671-XHJr7oDjH1PtrUL2kNg3",
            "model": "nvidia/nemotron-3-ultra-550b-a55b-20260604",
            "provider_name": "DeepInfra",
            "actual_cost_usd": 0.0179293,
            "prompt_tokens": 23163,
            "completion_tokens": 2897,
            "total_tokens": 26060,
            "finish_reason": "stop",
            "same_generation_confirmed": True,
            "available_after_bounded_lookup": True,
        },
    }
    assert attempt_8["application_result"] == {
        "outcome": "rejected",
        "failure_type": "same_generation_metadata_not_available_within_bounded_lookup",
        "error_type": "ModelResponseError",
        "error_invariant": "generation_metadata_completeness",
        "successful_ledger_call_bound": False,
        "ledger_call_id": "modelcall_58f841d20124e35f",
        "ledger_outcome": "failed",
        "canonical_result_accepted": False,
        "response_identity_retained": True,
        "usage_metadata_retained": True,
        "later_generation_metadata_verified": True,
        "contribution_diagnostics_retained": False,
    }
    assert attempt_9["execution_observation"] == {
        "source_commit": "1464e482503f2b22bebffaa01a9cff84e70113ff",
        "qa_deploy_id": "dep-d9tp3fjncjis739pbnrg",
        "qa_deploy_outcome": "build_failed",
        "qa_deploy_created_at": "2026-08-11T21:18:54.833304Z",
        "qa_deploy_finished_at": "2026-08-11T21:19:50.743049Z",
        "qa_run_id": "run_3abf4f5dcf955488",
        "ledger_created_at": "2026-08-11T21:19:16.695619+00:00",
        "ledger_updated_at": "2026-08-11T21:19:45.558899+00:00",
        "orchestration_id": "orch_16fbcb9e76eaff90",
        "failed_agent_id": "canonical_facts",
        "network_call_count": 1,
        "downstream_model_calls": 0,
    }
    assert attempt_9["provider_observation"] == {
        "provider": "openrouter",
        "provider_outcome": "upstream_rejected",
        "requested_model": "nvidia/nemotron-3-ultra-550b-a55b",
        "response_identity_status": "upstream_request_only_no_generation",
        "routing_diagnosis": {
            "attempt_09_policy": "default_provider_routing",
            "prior_deepinfra_request_status": 200,
            "exact_internal_provider_error_message_observed": False,
        },
        "upstream_request_log_observation": {
            "read_only": True,
            "displayed_at_local": "2026-08-11 23:19 Europe/Zurich",
            "request_id": "gen-1786483159-hyYthqPv76o6PHXpGLzl",
            "final_provider": "Together",
            "upstream_status": 400,
            "router_attempts": 2,
            "router_latency_ms": 759,
        },
        "generation_metadata_lookup": {
            "read_only": True,
            "request_id": "gen-1786483159-hyYthqPv76o6PHXpGLzl",
            "http_status": 404,
            "generation_recovered": False,
        },
        "synchronous_usage_cost_present": False,
        "openrouter_upstream_request_log_observed": True,
        "new_openrouter_log_generation_observed": False,
        "openrouter_log_check_performed": True,
        "provider_cache_replay_assessment": "not_applicable_upstream_rejected",
        "charge_status": "unknown_unconfirmed",
        "charge_included_in_known_aggregate": False,
        "estimated_cost_reservation_usd": 0.027645,
        "estimated_reservation_is_actual_charge": False,
        "latency_ms": 28858.701,
    }
    assert attempt_9["application_result"] == {
        "outcome": "rejected",
        "failure_type": "provider_response_envelope",
        "error_type": "ModelResponseError",
        "error_invariant": "provider_response_envelope",
        "successful_ledger_call_bound": False,
        "ledger_call_id": "modelcall_eda1fe14d069e2d4",
        "ledger_outcome": "failed",
        "canonical_result_accepted": False,
        "response_identity_retained": False,
        "usage_metadata_retained": False,
        "accepted_generation_recovered": False,
        "contribution_diagnostics_retained": False,
    }
    assert attempt_10["execution_observation"] == {
        "source_commit": "0c73193688db85be2e84a8a83b73e311581e3874",
        "qa_deploy_id": "dep-d9tq5bmgekts73978kdg",
        "qa_deploy_outcome": "build_failed",
        "qa_deploy_created_at": "2026-08-11T22:31:10.431539Z",
        "qa_deploy_started_at": "2026-08-11T22:31:10.393462Z",
        "qa_error_at": "2026-08-11T22:33:15.916134259Z",
        "qa_deploy_finished_at": "2026-08-11T22:33:20.129521Z",
        "qa_run_id": "run_d2c28f11f5a4b30e",
        "ledger_created_at": "2026-08-11T22:31:31.379439+00:00",
        "ledger_updated_at": "2026-08-11T22:33:13.302269+00:00",
        "orchestration_id": "orch_4306b740e7a14b00",
        "failed_agent_id": "orchestrator_plan",
        "network_call_count": 2,
        "completed_model_calls": 1,
        "failed_model_calls": 1,
        "downstream_model_calls_after_failure": 0,
        "deterministic_gate_receipts": 0,
    }
    assert attempt_10["provider_observation"] == {
        "provider": "openrouter",
        "provider_outcome": "partial_success_then_length_rejected",
        "requested_model": "nvidia/nemotron-3-ultra-550b-a55b",
        "upstream_provider": "DeepInfra",
        "network_call_count": 2,
        "actual_cost_usd": 0.0307499,
        "actual_cost_complete": True,
        "unknown_cost_call_count": 0,
        "prompt_tokens": 43197,
        "completion_tokens": 4183,
        "total_tokens": 47380,
        "calls": [
            {
                "call_id": "modelcall_1079d5361af8d6b8",
                "agent_id": "canonical_facts",
                "outcome": "succeeded_with_guarded_fallback",
                "response_id": "gen-1786487495-uThNkWVHk7bkiuVb8vaP",
                "response_model": "nvidia/nemotron-3-ultra-550b-a55b",
                "upstream_provider": "DeepInfra",
                "finish_reason": "stop",
                "actual_cost_usd": 0.0198785,
                "prompt_tokens": 23163,
                "completion_tokens": 3783,
                "total_tokens": 26946,
                "latency_ms": 85972.266,
                "created_at": "2026-08-11T22:31:31.379439+00:00",
                "updated_at": "2026-08-11T22:32:57.367156+00:00",
                "deterministic_fallback_applied": True,
                "accepted_fact_count": 17,
                "rejected_fact_count": 1,
                "source_reference_projection_count": 10,
            },
            {
                "call_id": "modelcall_0be219e96b14ec27",
                "agent_id": "orchestrator_plan",
                "outcome": "failed",
                "response_id": "gen-1786487581-HBwGLlRWSJnrBZXAU3Y9",
                "response_model": "nvidia/nemotron-3-ultra-550b-a55b",
                "upstream_provider": "DeepInfra",
                "finish_reason": "length",
                "actual_cost_usd": 0.0108714,
                "prompt_tokens": 20034,
                "completion_tokens": 400,
                "total_tokens": 20434,
                "latency_ms": 12309.811,
                "created_at": "2026-08-11T22:33:00.980714+00:00",
                "updated_at": "2026-08-11T22:33:13.302269+00:00",
                "error_type": "AgentBoundaryError",
                "error_invariant": "provider_finish_reason",
            },
        ],
    }
    assert attempt_10["application_result"] == {
        "outcome": "rejected",
        "failure_type": "orchestrator_plan_truncated_at_output_limit",
        "error_type": "AgentBoundaryError",
        "error_invariant": "provider_finish_reason",
        "successful_ledger_call_bound": False,
        "ledger_call_id": "modelcall_0be219e96b14ec27",
        "ledger_outcome": "failed",
        "canonical_stage_completed": True,
        "canonical_stage_outcome": "succeeded_with_guarded_fallback",
        "canonical_stage_call_id": "modelcall_1079d5361af8d6b8",
        "canonical_guarded_fallback_applied": True,
        "canonical_contribution_diagnostics_retained": True,
        "orchestrator_plan_accepted": False,
        "full_orchestration_accepted": False,
        "runtime_acceptance_established": False,
        "downstream_execution_started": False,
    }
    assert attempt_11["execution_observation"] == {
        "source_commit": "d59978be2f1824f6d769f6f2e32fb7a13e3843e7",
        "qa_deploy_id": "dep-d9tqd4ht0dsc73bthmgg",
        "qa_deploy_outcome": "build_failed",
        "qa_deploy_created_at": "2026-08-11T22:47:46.251804Z",
        "qa_deploy_started_at": "2026-08-11T22:47:46.222303Z",
        "qa_error_at": "2026-08-11T22:48:48.17386701Z",
        "qa_build_failed_at": "2026-08-11T22:48:48.211155358Z",
        "qa_deploy_finished_at": "2026-08-11T22:48:49.788544Z",
        "qa_run_id": "run_bdd1832d34d2188f",
        "ledger_created_at": "2026-08-11T22:48:07.570335+00:00",
        "ledger_updated_at": "2026-08-11T22:48:45.892252+00:00",
        "orchestration_id": "orch_6ca09d18eed0e3f6",
        "failed_agent_id": "orchestrator_plan",
        "network_call_count": 2,
        "completed_model_calls": 1,
        "failed_model_calls": 1,
        "downstream_model_calls_after_failure": 0,
        "deterministic_gate_receipts": 0,
    }
    assert attempt_11["provider_observation"] == {
        "provider": "openrouter",
        "provider_outcome": "partial_success_then_length_rejected",
        "requested_model": "nvidia/nemotron-3-ultra-550b-a55b",
        "upstream_provider": "DeepInfra",
        "network_call_count": 2,
        "actual_cost_usd": 0.0286577,
        "actual_cost_complete": True,
        "unknown_cost_call_count": 0,
        "prompt_tokens": 43197,
        "completion_tokens": 3232,
        "total_tokens": 46429,
        "calls": [
            {
                "call_id": "modelcall_0e3ac23f5327d9de",
                "agent_id": "canonical_facts",
                "outcome": "succeeded_with_guarded_fallback",
                "response_id": "gen-1786488490-tndMk9aYrOZRx6zRO0bs",
                "response_model": "nvidia/nemotron-3-ultra-550b-a55b",
                "upstream_provider": "DeepInfra",
                "finish_reason": "stop",
                "actual_cost_usd": 0.0169063,
                "prompt_tokens": 23163,
                "completion_tokens": 2432,
                "total_tokens": 25595,
                "latency_ms": 25695.53,
                "created_at": "2026-08-11T22:48:07.570335+00:00",
                "updated_at": "2026-08-11T22:48:33.279294+00:00",
                "deterministic_fallback_applied": True,
                "accepted_fact_count": 17,
                "rejected_fact_count": 1,
                "source_reference_projection_count": 10,
            },
            {
                "call_id": "modelcall_72e43889f3f0bece",
                "agent_id": "orchestrator_plan",
                "outcome": "failed",
                "response_id": "gen-1786488517-b5k43pHtTXGdyxrtSIP8",
                "response_model": "nvidia/nemotron-3-ultra-550b-a55b",
                "upstream_provider": "DeepInfra",
                "finish_reason": "length",
                "actual_cost_usd": 0.0117514,
                "prompt_tokens": 20034,
                "completion_tokens": 800,
                "total_tokens": 20834,
                "latency_ms": 9017.156,
                "created_at": "2026-08-11T22:48:36.865710+00:00",
                "updated_at": "2026-08-11T22:48:45.892252+00:00",
                "error_type": "AgentBoundaryError",
                "error_invariant": "provider_finish_reason",
            },
        ],
    }
    assert attempt_11["application_result"] == {
        "outcome": "rejected",
        "failure_type": "orchestrator_plan_truncated_at_output_limit",
        "error_type": "AgentBoundaryError",
        "error_invariant": "provider_finish_reason",
        "successful_ledger_call_bound": False,
        "ledger_call_id": "modelcall_72e43889f3f0bece",
        "ledger_outcome": "failed",
        "canonical_stage_completed": True,
        "canonical_stage_outcome": "succeeded_with_guarded_fallback",
        "canonical_stage_call_id": "modelcall_0e3ac23f5327d9de",
        "canonical_guarded_fallback_applied": True,
        "canonical_contribution_diagnostics_retained": True,
        "orchestrator_plan_accepted": False,
        "full_orchestration_accepted": False,
        "runtime_acceptance_established": False,
        "downstream_execution_started": False,
    }
    assert attempt_12["execution_observation"] == {
        "source_commit": "a839ff99870f5be11f232d1bfc818854202bd2dd",
        "qa_deploy_id": "dep-d9tqqlfavr4c73cfqb0g",
        "qa_deploy_outcome": "build_failed",
        "qa_deploy_created_at": "2026-08-11T23:16:37.178532Z",
        "qa_deploy_started_at": "2026-08-11T23:16:37.149773Z",
        "qa_error_at": "2026-08-11T23:18:55.342617058Z",
        "qa_build_failed_at": "2026-08-11T23:18:55.38377292Z",
        "qa_deploy_finished_at": "2026-08-11T23:18:56.810953Z",
        "qa_run_id": "run_403c755cd290a3dc",
        "ledger_created_at": "2026-08-11T23:16:52.937497+00:00",
        "ledger_updated_at": "2026-08-11T23:18:45.865871+00:00",
        "orchestration_id": "orch_bdc09ac146345588",
        "failed_agent_id": "process_decision_mapping",
        "network_call_count": 4,
        "completed_model_calls": 3,
        "failed_model_calls": 1,
        "downstream_model_calls_after_failure": 0,
        "deterministic_gate_receipts": 0,
    }
    assert attempt_12["provider_observation"] == {
        "provider": "openrouter",
        "provider_outcome": "three_successes_then_process_majority_rejected",
        "requested_model": "nvidia/nemotron-3-ultra-550b-a55b",
        "upstream_provider": "DeepInfra",
        "network_call_count": 4,
        "actual_cost_usd": 0.0332561,
        "actual_cost_complete": True,
        "unknown_cost_call_count": 0,
        "prompt_tokens": 44585,
        "completion_tokens": 5030,
        "total_tokens": 49615,
        "calls": [
            {
                "call_id": "modelcall_f738b46b703992a2",
                "agent_id": "canonical_facts",
                "outcome": "succeeded_with_guarded_fallback",
                "response_id": "gen-1786490215-0nOpYjNjTeMxtSF7ZbzI",
                "response_model": "nvidia/nemotron-3-ultra-550b-a55b",
                "upstream_provider": "DeepInfra",
                "finish_reason": "stop",
                "actual_cost_usd": 0.0175791,
                "prompt_tokens": 23171,
                "completion_tokens": 2736,
                "total_tokens": 25907,
                "latency_ms": 44011.294,
                "created_at": "2026-08-11T23:16:52.937497+00:00",
                "updated_at": "2026-08-11T23:17:36.966427+00:00",
                "deterministic_fallback_applied": True,
                "accepted_fact_count": 17,
                "rejected_fact_count": 1,
                "source_reference_projection_count": 11,
            },
            {
                "call_id": "modelcall_19ca5512d3d071b2",
                "agent_id": "orchestrator_plan",
                "outcome": "succeeded",
                "response_id": "gen-1786490261-TMfcJt5jr492iTT2dA6M",
                "response_model": "nvidia/nemotron-3-ultra-550b-a55b",
                "upstream_provider": "DeepInfra",
                "finish_reason": "stop",
                "actual_cost_usd": 0.0003892,
                "prompt_tokens": 438,
                "completion_tokens": 89,
                "total_tokens": 527,
                "latency_ms": 3256.765,
                "created_at": "2026-08-11T23:17:40.626131+00:00",
                "updated_at": "2026-08-11T23:17:43.894060+00:00",
                "deterministic_fallback_applied": False,
                "accepted_item_count": 1,
                "rejected_item_count": 0,
                "ignored_proposal_count": 0,
            },
            {
                "call_id": "modelcall_1acb408e46e5998b",
                "agent_id": "document_source_integrity",
                "outcome": "succeeded",
                "response_id": "gen-1786490265-IreIMO88mFsoshGiYAxN",
                "response_model": "nvidia/nemotron-3-ultra-550b-a55b",
                "upstream_provider": "DeepInfra",
                "finish_reason": "stop",
                "actual_cost_usd": 0.0011036,
                "prompt_tokens": 736,
                "completion_tokens": 346,
                "total_tokens": 1082,
                "latency_ms": 12820.868,
                "created_at": "2026-08-11T23:17:43.910751+00:00",
                "updated_at": "2026-08-11T23:17:56.744034+00:00",
                "deterministic_fallback_applied": False,
                "accepted_item_count": 6,
                "rejected_item_count": 0,
                "ignored_proposal_count": 0,
            },
            {
                "call_id": "modelcall_0a572660847e0df6",
                "agent_id": "process_decision_mapping",
                "outcome": "failed",
                "response_id": "gen-1786490266-bA9bYAcZ5u9sx20mRS4t",
                "response_model": "nvidia/nemotron-3-ultra-550b-a55b",
                "upstream_provider": "DeepInfra",
                "finish_reason": "stop",
                "actual_cost_usd": 0.0141842,
                "prompt_tokens": 20240,
                "completion_tokens": 1859,
                "total_tokens": 22099,
                "latency_ms": 61943.078,
                "created_at": "2026-08-11T23:17:43.914769+00:00",
                "updated_at": "2026-08-11T23:18:45.865871+00:00",
                "error_type": "AgentBoundaryError",
                "error_invariant": "model_contribution_majority",
            },
        ],
    }
    assert attempt_12["application_result"] == {
        "outcome": "rejected",
        "failure_type": "process_decision_mapping_model_contribution_majority",
        "error_type": "AgentBoundaryError",
        "error_invariant": "model_contribution_majority",
        "successful_ledger_call_bound": False,
        "ledger_call_id": "modelcall_0a572660847e0df6",
        "ledger_outcome": "failed",
        "canonical_stage_completed": True,
        "canonical_stage_outcome": "succeeded_with_guarded_fallback",
        "canonical_stage_call_id": "modelcall_f738b46b703992a2",
        "canonical_guarded_fallback_applied": True,
        "canonical_contribution_diagnostics_retained": True,
        "orchestrator_plan_accepted": True,
        "orchestrator_plan_call_id": "modelcall_19ca5512d3d071b2",
        "document_source_integrity_accepted": True,
        "document_source_integrity_call_id": "modelcall_1acb408e46e5998b",
        "process_decision_mapping_accepted": False,
        "full_orchestration_accepted": False,
        "runtime_acceptance_established": False,
        "downstream_execution_started": True,
        "later_model_calls_after_failure": False,
    }
    assert sum(
        attempt["provider_observation"]["actual_cost_usd"]
        for attempt in attempts.values()
        if "actual_cost_usd" in attempt["provider_observation"]
    ) == pytest.approx(0.1634040)
    assert "actual_cost_usd" not in attempt_3["provider_observation"]
    assert "prompt_tokens" not in attempt_3["provider_observation"]
    assert attempt_3["provider_observation"]["charge_status"] == "unknown_unconfirmed"
    assert "actual_cost_usd" not in attempt_7["provider_observation"]
    assert "prompt_tokens" not in attempt_7["provider_observation"]
    assert attempt_7["provider_observation"]["charge_status"] == "unknown_unconfirmed"
    assert (
        attempt_7["provider_observation"]["estimated_reservation_is_actual_charge"]
        is False
    )
    assert "actual_cost_usd" not in attempt_9["provider_observation"]
    assert "prompt_tokens" not in attempt_9["provider_observation"]
    assert attempt_9["provider_observation"]["charge_status"] == "unknown_unconfirmed"
    assert (
        attempt_9["provider_observation"]["charge_included_in_known_aggregate"] is False
    )
    assert (
        attempt_9["provider_observation"]["estimated_reservation_is_actual_charge"]
        is False
    )
    for attempt in attempts.values():
        release_tool.verify_failed_model_attempt_evidence(contract, attempt)

    incomplete_usage = deepcopy(attempt_3)
    incomplete_usage["provider_observation"]["actual_cost_usd"] = 0.01
    with pytest.raises(release_tool.VerificationError, match="exact bounded schema"):
        release_tool.verify_failed_model_attempt_evidence(contract, incomplete_usage)

    mislabeled_estimate = deepcopy(attempt_7)
    mislabeled_estimate["provider_observation"][
        "estimated_reservation_is_actual_charge"
    ] = True
    with pytest.raises(release_tool.VerificationError, match="exact bounded schema"):
        release_tool.verify_failed_model_attempt_evidence(contract, mislabeled_estimate)

    unbound_upstream_log = deepcopy(attempt_9)
    unbound_upstream_log["provider_observation"][
        "openrouter_upstream_request_log_observed"
    ] = False
    with pytest.raises(release_tool.VerificationError, match="exact bounded schema"):
        release_tool.verify_failed_model_attempt_evidence(
            contract, unbound_upstream_log
        )

    privacy_mutations = []
    raw_provider_message = deepcopy(attempt_9)
    raw_provider_message["provider_observation"]["provider_message"] = (
        "RAW provider cause: claim DEF-027-E0-DEMO was rejected"
    )
    privacy_mutations.append(raw_provider_message)

    arbitrary_nested_metadata = deepcopy(attempt_9)
    arbitrary_nested_metadata["provider_observation"]["routing_diagnosis"][
        "customer_reference"
    ] = "DOC-8842-INSPECTION"
    privacy_mutations.append(arbitrary_nested_metadata)

    claim_prose_value = deepcopy(attempt_9)
    claim_prose_value["provider_observation"]["provider_outcome"] = (
        "claim DEF-027-E0-DEMO rejected because of a pipe burst"
    )
    privacy_mutations.append(claim_prose_value)

    nested_provider_message = deepcopy(attempt_10)
    nested_provider_message["provider_observation"]["calls"][1]["provider_message"] = (
        "RAW provider output for a private claim"
    )
    privacy_mutations.append(nested_provider_message)

    for unsafe_attempt in privacy_mutations:
        with pytest.raises(
            release_tool.VerificationError,
            match="exact bounded schema",
        ) as caught:
            release_tool.verify_failed_model_attempt_evidence(contract, unsafe_attempt)
        message = str(caught.value)
        assert "DEF-027-E0-DEMO" not in message
        assert "DOC-8842-INSPECTION" not in message
        assert "pipe burst" not in message

    numeric_type_aliases = []
    boolean_execution_count = deepcopy(attempt_6)
    boolean_execution_count["execution_observation"]["provider_response_count"] = True
    numeric_type_aliases.append(boolean_execution_count)

    float_http_status = deepcopy(attempt_7)
    float_http_status["provider_observation"]["response_http_status"] = 200.0
    numeric_type_aliases.append(float_http_status)

    float_nested_http_status = deepcopy(attempt_9)
    float_nested_http_status["provider_observation"]["routing_diagnosis"][
        "prior_deepinfra_request_status"
    ] = 200.0
    numeric_type_aliases.append(float_nested_http_status)

    boolean_rejected_count = deepcopy(attempt_5)
    boolean_rejected_count["application_result"]["rejected_invariants"][
        "canonical_state"
    ] = True
    numeric_type_aliases.append(boolean_rejected_count)

    boolean_unknown_cost_count = deepcopy(attempt_10)
    boolean_unknown_cost_count["provider_observation"]["unknown_cost_call_count"] = (
        False
    )
    numeric_type_aliases.append(boolean_unknown_cost_count)

    for aliased_attempt in numeric_type_aliases:
        with pytest.raises(
            release_tool.VerificationError,
            match="exact bounded schema",
        ):
            release_tool.verify_failed_model_attempt_evidence(contract, aliased_attempt)

    mismatched_attempt_10_aggregate = deepcopy(attempt_10)
    mismatched_attempt_10_aggregate["provider_observation"]["actual_cost_usd"] += 0.01
    with pytest.raises(
        release_tool.VerificationError,
        match="exact bounded schema",
    ):
        release_tool.verify_failed_model_attempt_evidence(
            contract,
            mismatched_attempt_10_aggregate,
        )

    mismatched_attempt_11_output_limit = deepcopy(attempt_11)
    mismatched_attempt_11_output_limit["provider_observation"]["calls"][1][
        "completion_tokens"
    ] = 799
    mismatched_attempt_11_output_limit["provider_observation"]["calls"][1][
        "total_tokens"
    ] = 20833
    mismatched_attempt_11_output_limit["provider_observation"]["completion_tokens"] = (
        3231
    )
    mismatched_attempt_11_output_limit["provider_observation"]["total_tokens"] = 46428
    with pytest.raises(
        release_tool.VerificationError,
        match="exact bounded schema",
    ):
        release_tool.verify_failed_model_attempt_evidence(
            contract,
            mismatched_attempt_11_output_limit,
        )

    mismatched_attempt_12_majority = deepcopy(attempt_12)
    mismatched_attempt_12_majority["provider_observation"]["calls"][3][
        "error_invariant"
    ] = "provider_finish_reason"
    with pytest.raises(
        release_tool.VerificationError,
        match="exact bounded schema",
    ):
        release_tool.verify_failed_model_attempt_evidence(
            contract,
            mismatched_attempt_12_majority,
        )

    unbound_attempt_12_document_call = deepcopy(attempt_12)
    unbound_attempt_12_document_call["application_result"][
        "document_source_integrity_call_id"
    ] = "modelcall_0000000000000000"
    with pytest.raises(
        release_tool.VerificationError,
        match="exact bounded schema",
    ):
        release_tool.verify_failed_model_attempt_evidence(
            contract,
            unbound_attempt_12_document_call,
        )

    inconsistent_attempt_12_aggregate = deepcopy(attempt_12)
    inconsistent_attempt_12_aggregate["provider_observation"]["actual_cost_usd"] += 0.01
    with pytest.raises(
        release_tool.VerificationError,
        match="exact bounded schema",
    ):
        release_tool.verify_failed_model_attempt_evidence(
            contract,
            inconsistent_attempt_12_aggregate,
        )


def _ledger_summary(items: list[dict]) -> dict:
    unknown_cost_call_count = sum(
        item["call_count"] > 0 and item.get("actual_cost_usd") is None for item in items
    )
    outcomes = {
        outcome: sum(item["outcome"] == outcome for item in items)
        for outcome in sorted({item["outcome"] for item in items})
    }
    return {
        "records": len(items),
        "network_calls": sum(item["call_count"] for item in items),
        "prompt_tokens": sum(item.get("prompt_tokens", 0) for item in items),
        "completion_tokens": sum(item.get("completion_tokens", 0) for item in items),
        "total_tokens": sum(item.get("total_tokens", 0) for item in items),
        "actual_cost_usd": round(
            sum(item.get("actual_cost_usd") or 0 for item in items), 8
        ),
        "actual_cost_complete": unknown_cost_call_count == 0,
        "unknown_cost_call_count": unknown_cost_call_count,
        "outcomes": outcomes,
    }


def successful_dynamic_qa_evidence(contract: dict) -> tuple[dict, dict, dict, bytes]:
    orchestration_id = "orch_release_acceptance_test"
    required_agents = contract["agentic_runtime"]["model_agents"]
    call_ids = {
        item["agent_id"]: f"modelcall_{index:02d}_release_acceptance"
        for index, item in enumerate(required_agents, start=1)
    }
    def source_ref(index: int) -> str:
        return f"src_{index:024x}"

    source_artifact = {
        "artifacts": [
            {
                "artifact_id": "art_notice",
                "integrity_class": "text_grounded",
                "source_ref_ids": [source_ref(1)],
                "confidence_basis_points": 9100,
                "attribution": "Document and Source Integrity Agent",
                "deterministic_fallback_applied": False,
            },
            {
                "artifact_id": "art_reply",
                "integrity_class": "text_grounded",
                "source_ref_ids": [source_ref(2)],
                "confidence_basis_points": 9000,
                "attribution": "Document and Source Integrity Agent",
                "deterministic_fallback_applied": False,
            },
            {
                "artifact_id": "art_photo",
                "integrity_class": "visual_only",
                "source_ref_ids": [],
                "confidence_basis_points": 9500,
                "attribution": "Document and Source Integrity Agent",
                "deterministic_fallback_applied": False,
            },
        ]
    }
    decision_specs = [
        ("fact_scope", "scope", "in_scope", "confirmed", "covered", [source_ref(1)]),
        (
            "fact_dispute",
            "dispute",
            "dispute_present",
            "confirmed",
            "present",
            [source_ref(2)],
        ),
        ("fact_urgency", "urgency", "not_urgent", "confirmed", "routine", []),
        (
            "fact_notification",
            "notification",
            "notified",
            "confirmed",
            "sent",
            [source_ref(3)],
        ),
        (
            "fact_recurrence",
            "recurrence",
            "recurrence_supported",
            "confirmed",
            "recurring",
            [source_ref(4)],
        ),
        (
            "fact_cause",
            "causation",
            "cause_unresolved",
            "uncertain",
            "unresolved",
            [source_ref(5), source_ref(6)],
        ),
    ]
    process_decisions = []
    for index, (
        fact_id,
        decision_key,
        decision_value,
        state,
        normalized_value,
        source_ref_ids,
    ) in enumerate(decision_specs):
        fallback = index == len(decision_specs) - 1
        process_decisions.append(
            {
                "fact_id": fact_id,
                "decision_key": decision_key,
                "decision_value": decision_value,
                "state": state,
                "normalized_value": normalized_value,
                "source_ref_ids": source_ref_ids,
                "contribution_id": f"fact:{fact_id}:decision_value",
                "contribution_scope": "canonical_to_process_decision_mapping",
                "model_owned_fields": ["decision_value"],
                "confidence_basis_points": 10_000 if fallback else 8800 + index * 100,
                "attribution": (
                    "deterministic_application"
                    if fallback
                    else "Process Decision Mapping Agent"
                ),
                "deterministic_fallback_applied": fallback,
            }
        )
    process_artifact = {"decisions": process_decisions}

    evidence_specs = [
        (
            "claim_message",
            "fact_scope",
            "provided_sufficient",
            ["message"],
            [source_ref(1)],
            False,
        ),
        (
            "dispute_reply",
            "fact_dispute",
            "provided_sufficient",
            ["art_reply"],
            [source_ref(2)],
            False,
        ),
        (
            "defect_notice",
            "fact_notification",
            "provided_insufficient",
            ["art_notice"],
            [source_ref(3)],
            True,
        ),
        (
            "technical_assessment",
            "fact_cause",
            "missing",
            [],
            [source_ref(5), source_ref(6)],
            False,
        ),
        (
            "ventilation_statement",
            "fact_ventilation_allegation",
            "provided_sufficient",
            ["art_reply"],
            [source_ref(7)],
            False,
        ),
    ]
    evidence_items = []
    for item_id, fact_id, status, artifact_ids, source_ref_ids, status_fallback in (
        evidence_specs
    ):
        field_contributions = [
            {
                "contribution_id": f"item:{item_id}:status",
                "field": "status",
                "attribution": (
                    "deterministic_application"
                    if status_fallback
                    else "Evidence and Checklist Agent"
                ),
                "confidence_basis_points": 10_000 if status_fallback else 9000,
                "deterministic_fallback_applied": status_fallback,
            },
            {
                "contribution_id": f"item:{item_id}:artifacts",
                "field": "artifact_ids",
                "attribution": "Evidence and Checklist Agent",
                "confidence_basis_points": 9000,
                "deterministic_fallback_applied": False,
            },
        ]
        evidence_items.append(
            {
                "item_id": item_id,
                "status": status,
                "artifact_ids": sorted(artifact_ids),
                "source_ref_ids": source_ref_ids,
                "field_contributions": field_contributions,
                "model_owned_fields": ["status", "artifact_ids"],
                "confidence_basis_points": 9000,
                "attribution": (
                    "mixed_model_and_deterministic"
                    if status_fallback
                    else "Evidence and Checklist Agent"
                ),
                "deterministic_fallback_applied": status_fallback,
            }
        )
    evidence_artifact = {"items": evidence_items}
    plan_artifact = {
        "model_priority_fact_ids": [
            "fact_cause",
            "fact_notification",
            "fact_dispute",
        ],
        "model_priority_task_codes": [
            "source_integrity",
            "process_decisions",
            "evidence_gaps",
            "final_brief",
        ],
        "priority_task_codes": [
            "source_integrity",
            "process_decisions",
            "evidence_gaps",
            "final_brief",
        ],
        "model_priority_attribution": "Nemotron Orchestrator",
        "deterministic_coverage": {
            "fact_ids": [
                "fact_scope",
                "fact_urgency",
                "fact_recurrence",
                "fact_ventilation_allegation",
            ],
            "source_ref_ids": [source_ref(1), source_ref(2)],
            "required_text_artifact_ids": ["art_notice", "art_reply"],
            "attribution": "deterministic_application",
        },
        "focus_fact_ids": [
            "fact_cause",
            "fact_notification",
            "fact_dispute",
            "fact_scope",
            "fact_urgency",
            "fact_recurrence",
            "fact_ventilation_allegation",
        ],
        "focus_source_ref_ids": [source_ref(1), source_ref(2)],
        "contribution_type": "constrained_focus_prioritization",
    }
    final_fields = [
        ("current_node_id", "final:current_node", False),
        ("next_action_node_id", "final:next_action", False),
        ("supporting_fact_ids", "final:supporting_facts", False),
        (
            "upstream_contribution_ids",
            "final:upstream_contributions",
            False,
        ),
        ("audit_check_ids", "final:audit_checks", True),
    ]
    final_claim_brief = {
        "current_node_id": "causation",
        "next_action_node_id": "evidence_gap",
        "supporting_fact_ids": ["fact_cause", "fact_ventilation_allegation"],
        "upstream_contribution_ids": list(
            release_tool.FINAL_UPSTREAM_CONTRIBUTION_IDS
        ),
        "audit_check_ids": list(release_tool.FINAL_AUDIT_CHECK_IDS),
        "source_ref_ids": [source_ref(5), source_ref(6), source_ref(7)],
        "input_contribution_ids": list(
            release_tool.FINAL_UPSTREAM_CONTRIBUTION_IDS
        ),
        "lineage_authority": "hybrid_guarded_model_audit",
        "contribution_scope": "independent_final_claim_brief_audit",
        "field_contributions": [
            {
                "contribution_id": contribution_id,
                "field": field,
                "attribution": (
                    "deterministic_application"
                    if fallback
                    else "Final Claim Brief Agent"
                ),
                "confidence_basis_points": 10_000 if fallback else 9200,
                "deterministic_fallback_applied": fallback,
            }
            for field, contribution_id, fallback in final_fields
        ],
        "confidence_basis_points": 9200,
        "attribution": "mixed_model_and_deterministic",
        "deterministic_fallback_applied": True,
    }
    specialist_artifacts = {
        "orchestrator_plan": plan_artifact,
        "document_source_integrity": source_artifact,
        "process_decision_mapping": process_artifact,
        "evidence_checklist": evidence_artifact,
        "final_claim_brief_audit": final_claim_brief,
    }

    accepted_by_agent = {
        "canonical_facts": [
            "fact_scope",
            "fact_dispute",
            "fact_urgency",
            "fact_notification",
            "fact_recurrence",
            "fact_cause",
            "fact_ventilation_allegation",
        ],
        "orchestrator_plan": ["model_priority_order"],
        "document_source_integrity": [
            item["artifact_id"] for item in source_artifact["artifacts"]
        ],
        "process_decision_mapping": [
            item["contribution_id"]
            for item in process_decisions
            if item["deterministic_fallback_applied"] is False
        ],
        "evidence_checklist": [
            field["contribution_id"]
            for item in evidence_items
            for field in item["field_contributions"]
            if field["deterministic_fallback_applied"] is False
        ],
        "final_claim_brief_audit": [
            field["contribution_id"]
            for field in final_claim_brief["field_contributions"]
            if field["deterministic_fallback_applied"] is False
        ],
    }
    rejected_by_agent = {
        "canonical_facts": 0,
        "orchestrator_plan": 0,
        "document_source_integrity": 0,
        "process_decision_mapping": 1,
        "evidence_checklist": 1,
        "final_claim_brief_audit": 1,
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
                "usage_source": "response",
                "call_id": call_ids[agent_id],
                "origin_call_id": call_ids[agent_id],
                "response_id": f"generation_runtime_proof_{index:02d}",
                "parent_call_id": parent_call_id,
                "delegation_id": delegation_id,
                "call_count": 1,
                "cache_hit": False,
                "outcome": (
                    "succeeded_with_guarded_fallback"
                    if rejected_by_agent[agent_id]
                    else "succeeded"
                ),
                "accepted_ids": accepted_by_agent[agent_id],
                "accepted_count": len(accepted_by_agent[agent_id]),
                "rejected_count": rejected_by_agent[agent_id],
                "source_reference_projection_fact_ids": (
                    [] if agent_id == "canonical_facts" else None
                ),
                "source_reference_projection_count": (
                    0 if agent_id == "canonical_facts" else None
                ),
                "deterministic_fallback_applied": bool(
                    rejected_by_agent[agent_id]
                ),
                "input_artifact_hash": f"{index:064x}",
                "output_artifact": (
                    "canonical_claim_state"
                    if agent_id == "canonical_facts"
                    else release_tool.SPECIALIST_OUTPUT_ARTIFACTS[agent_id]
                ),
                "output_artifact_hash": (
                    f"{index + 100:064x}"
                    if agent_id == "canonical_facts"
                    else release_tool.accepted_artifact_hash(
                        specialist_artifacts[agent_id]
                    )
                ),
            }
        )
    runtime = contract["agentic_runtime"]
    by_agent = {record["agent_id"]: record for record in records}
    lineage_fields = release_tool.ACCEPTED_LINEAGE_FIELDS

    def lineage(agent_id: str) -> dict:
        agent = by_agent[agent_id]
        return {field: agent[field] for field in lineage_fields if field in agent}

    node_by_fact = {
        "fact_scope": "scope",
        "fact_dispute": "dispute",
        "fact_urgency": "urgency",
        "fact_notification": "notification",
        "fact_recurrence": "recurrence",
        "fact_cause": "causation",
    }
    assert len(decision_specs) == len(process_decisions)
    process_nodes = [
        {
            "node_id": node_by_fact[fact_id],
            "state": "completed" if fact_id != "fact_cause" else "active",
            "fact_ids": (
                [fact_id, "fact_ventilation_allegation"]
                if fact_id == "fact_cause"
                else [fact_id]
            ),
            "agent_decision_contributions": [decision],
        }
        for fact_id, decision in zip(
            [item[0] for item in decision_specs], process_decisions
        )
    ]
    process_nodes.append(
        {"node_id": "evidence_gap", "state": "available", "fact_ids": []}
    )
    process = {
        "contract": "casepath.process-graph/15.2",
        "current_node": "causation",
        "selected_path": [
            "scope",
            "dispute",
            "urgency",
            "notification",
            "recurrence",
            "causation",
        ],
        "current_overlay": {
            "completed_node_ids": [
                "scope",
                "dispute",
                "urgency",
                "notification",
                "recurrence",
            ],
            "current_node_id": "causation",
            "selected_branch_id": "insufficient",
            "blocked_node_ids": [],
            "inactive_branch_ids": [],
            "next_action_node_id": "evidence_gap",
            "decisions": {
                item["decision_key"]: item["decision_value"]
                for item in process_decisions
            },
        },
        "nodes": process_nodes,
        "edges": [
            {"source": "causation", "target": "evidence_gap", "state": "selected"}
        ],
        "agent_contribution": {
            "authority": "hybrid_guarded_model_contribution",
            "model_owned_fields": ["decision_value"],
            "deterministic_fallback_fields": ["fact_cause.decision_value"],
            "deterministic_fallback_count": 1,
            "derived_from": "accepted_or_fallback_specialist_artifact",
            "artifact": process_artifact,
            "provenance": lineage("process_decision_mapping"),
            "source_integrity_artifact": source_artifact,
            "source_integrity_provenance": lineage(
                "document_source_integrity"
            ),
        },
    }
    public_evidence_items = []
    titles = {
        "claim_message": "Original claim message",
        "dispute_reply": "Management reply",
        "defect_notice": "Defect notice",
        "technical_assessment": "Independent technical assessment",
        "ventilation_statement": "Ventilation allegation",
    }
    node_ids = {
        "claim_message": "scope",
        "dispute_reply": "dispute",
        "defect_notice": "notification",
        "technical_assessment": "causation",
        "ventilation_statement": "causation",
    }
    fact_by_evidence_item = {item_id: fact_id for item_id, fact_id, *_ in evidence_specs}
    for item in evidence_items:
        public_evidence_items.append(
            {
                "item_id": item["item_id"],
                "title": titles[item["item_id"]],
                "status": item["status"],
                "node_id": node_ids[item["item_id"]],
                "fact_id": fact_by_evidence_item[item["item_id"]],
                "why": "Bounded fixture evidence relationship.",
                "artifact_ids": list(item["artifact_ids"]),
                "current_path": True,
                "applies_when": "The accepted process reaches this node",
                "agent_contribution": item["field_contributions"],
            }
        )
    derived = release_tool._checklist_derived_sections(public_evidence_items)
    checklist = {
        "contract": "casepath.evidence-model/15.2",
        "items": public_evidence_items,
        **derived,
        "agent_contribution": {
            "authority": "hybrid_guarded_model_contribution",
            "model_owned_fields": ["status", "artifact_ids"],
            "deterministic_fallback_fields": ["item:defect_notice:status"],
            "deterministic_fallback_count": 1,
            "derived_from": "accepted_or_fallback_specialist_artifact",
            "artifact": evidence_artifact,
            "provenance": lineage("evidence_checklist"),
        },
    }
    verification = {
        "valid": True,
        "computed": True,
        "checks": [
            {"name": "graph_integrity", "status": "passed"},
            {"name": "evidence_projection", "status": "passed"},
            {"name": "final_action_binding", "status": "passed"},
        ],
    }
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
        "guarded_fallback_count": 3,
        "agents": records,
        "deterministic_gates": [
            {
                "agent_id": gate_id,
                "role": next(
                    item["role"]
                    for item in release_tool.REQUIRED_DETERMINISTIC_GATES
                    if item["gate_id"] == gate_id
                ),
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
                "input_artifact_hash": (
                    release_tool.accepted_artifact_hash(
                        {
                            "source_integrity": source_artifact,
                            "process_mapping": process_artifact,
                        }
                    )
                    if gate_id == "deterministic_process_gate"
                    else release_tool.accepted_artifact_hash(evidence_artifact)
                    if gate_id == "deterministic_evidence_gate"
                    else release_tool.accepted_artifact_hash(
                        {
                            "final_brief": final_claim_brief,
                            "verification": verification,
                        }
                    )
                ),
                "output_artifact": output_artifact,
                "output_artifact_hash": release_tool.accepted_artifact_hash(
                    artifact_value
                ),
                **(
                    {
                        "verification_report_hash": release_tool.accepted_artifact_hash(
                            verification
                        ),
                        "accepted_verification_ids": [
                            item["name"] for item in verification["checks"]
                        ],
                    }
                    if gate_id == "whole_playbook_gate"
                    else {}
                ),
            }
            for index, (
                gate_id,
                (output_artifact, artifact_value, source_agent_id),
            ) in enumerate(gate_bindings.items(), start=1)
        ],
        "specialist_artifacts": specialist_artifacts,
        "final_claim_brief": final_claim_brief,
    }
    flagship_run = {
        "run_id": "flagship-run",
        "status": "complete",
        "agent_orchestration": audit,
        "result": {
            "process": process,
            "checklist": checklist,
            "verification": verification,
            "current_overlay": process["current_overlay"],
            "facts": [
                {
                    "fact_id": fact_id,
                    "controls_process": True,
                    "decision_key": decision_key,
                    "decision_value": decision_value,
                    "state": state,
                    "normalized_value": normalized_value,
                }
                for (
                    fact_id,
                    decision_key,
                    decision_value,
                    state,
                    normalized_value,
                    _source_ref_ids,
                ) in decision_specs
            ]
            + [
                {
                    "fact_id": "fact_ventilation_allegation",
                    "controls_process": False,
                    "state": "disputed",
                }
            ],
            "next_action": {
                "title": "Resolve the evidence gap",
                "detail": "Obtain the missing independent assessment.",
                "requires_expert_approval": True,
                "process_node_id": "evidence_gap",
                "agent_brief_contribution": final_claim_brief,
            },
            "agent_orchestration": audit,
            "audit": {"agent_orchestration": audit},
        },
    }
    by_agent["canonical_facts"]["output_artifact_hash"] = (
        release_tool.runtime_artifact_hash(flagship_run["result"]["facts"])
    )
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
                "outcome": agent["outcome"],
                "upstream_provider": "DeepInfra",
                "usage_source": "response",
                "finish_reason": "stop",
                "prompt_tokens": 100 + index,
                "completion_tokens": 20 + index,
                "total_tokens": 120 + index * 2,
                "actual_cost_usd": 0.001 + index / 100_000,
                "deterministic_fallback_applied": agent[
                    "deterministic_fallback_applied"
                ],
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
    ledger["summary"] = _ledger_summary(ledger["items"])
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
        for index, path in enumerate(
            sorted(release_tool.REQUIRED_QA_EVIDENCE_FILES), start=1
        )
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


def _runtime_result_and_audit(retained: dict) -> tuple[dict, dict]:
    result = retained["flagship-run.json"]["result"]
    return result, result["audit"]["agent_orchestration"]


def _refresh_causal_artifact_hashes(retained: dict) -> None:
    """Re-sign fixture joins so a negative reaches the intended invariant."""

    result, audit = _runtime_result_and_audit(retained)
    artifacts = audit["specialist_artifacts"]
    agents = {item["agent_id"]: item for item in audit["agents"]}
    for agent_id in release_tool.SPECIALIST_ARTIFACT_IDS:
        agents[agent_id]["output_artifact_hash"] = (
            release_tool.accepted_artifact_hash(artifacts[agent_id])
        )

    process_artifact = artifacts["process_decision_mapping"]
    source_artifact = artifacts["document_source_integrity"]
    process_contribution = result["process"]["agent_contribution"]
    process_contribution["artifact"] = process_artifact
    process_contribution["source_integrity_artifact"] = source_artifact
    decisions = {
        item["fact_id"]: item for item in process_artifact["decisions"]
    }
    for node in result["process"]["nodes"]:
        expected = [
            decisions[fact_id]
            for fact_id in node.get("fact_ids", [])
            if fact_id in decisions
        ]
        if expected:
            node["agent_decision_contributions"] = expected
        else:
            node.pop("agent_decision_contributions", None)

    evidence_artifact = artifacts["evidence_checklist"]
    result["checklist"]["agent_contribution"]["artifact"] = evidence_artifact
    evidence_by_id = {
        item["item_id"]: item for item in evidence_artifact["items"]
    }
    for item in result["checklist"]["items"]:
        accepted = evidence_by_id[item["item_id"]]
        item["status"] = accepted["status"]
        item["artifact_ids"] = list(accepted["artifact_ids"])
        item["agent_contribution"] = accepted["field_contributions"]
    result["checklist"].update(
        release_tool._checklist_derived_sections(result["checklist"]["items"])
    )

    final_artifact = artifacts["final_claim_brief_audit"]
    audit["final_claim_brief"] = final_artifact
    result["next_action"]["agent_brief_contribution"] = final_artifact
    gates = {item["agent_id"]: item for item in audit["deterministic_gates"]}
    gates["deterministic_process_gate"]["input_artifact_hash"] = (
        release_tool.accepted_artifact_hash(
            {
                "source_integrity": source_artifact,
                "process_mapping": process_artifact,
            }
        )
    )
    gates["deterministic_evidence_gate"]["input_artifact_hash"] = (
        release_tool.accepted_artifact_hash(evidence_artifact)
    )
    gates["deterministic_process_gate"]["output_artifact_hash"] = (
        release_tool.accepted_artifact_hash(result["process"])
    )
    gates["deterministic_evidence_gate"]["output_artifact_hash"] = (
        release_tool.accepted_artifact_hash(result["checklist"])
    )
    gates["whole_playbook_gate"]["output_artifact_hash"] = (
        release_tool.accepted_artifact_hash(final_artifact)
    )
    gates["whole_playbook_gate"]["verification_report_hash"] = (
        release_tool.accepted_artifact_hash(result["verification"])
    )


def test_dynamic_runtime_acceptance_passes_without_source_promotion() -> None:
    contract = release_tool.load_json(release_tool.RELEASE_PATH)
    original = deepcopy(contract)
    report, manifest, retained, manifest_bytes = successful_dynamic_qa_evidence(
        contract
    )
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


def test_dynamic_runtime_acceptance_rejects_forged_specialist_hash() -> None:
    contract = release_tool.load_json(release_tool.RELEASE_PATH)
    report, manifest, retained, manifest_bytes = successful_dynamic_qa_evidence(
        contract
    )
    _result, audit = _runtime_result_and_audit(retained)
    agent = next(
        item
        for item in audit["agents"]
        if item["agent_id"] == "document_source_integrity"
    )
    agent["output_artifact_hash"] = "f" * 64

    with pytest.raises(
        release_tool.VerificationError,
        match=r"audit\.agents\.document_source_integrity\.output_artifact_hash",
    ):
        release_tool.verify_dynamic_runtime_acceptance(
            contract,
            report,
            manifest,
            retained,
            evidence_manifest_bytes=manifest_bytes,
        )


def test_dynamic_runtime_acceptance_rejects_forged_specialist_artifact() -> None:
    contract = release_tool.load_json(release_tool.RELEASE_PATH)
    report, manifest, retained, manifest_bytes = successful_dynamic_qa_evidence(
        contract
    )
    _result, audit = _runtime_result_and_audit(retained)
    private_sentinel = "private-forged-artifact-value"
    audit["specialist_artifacts"]["orchestrator_plan"][
        "contribution_type"
    ] = private_sentinel

    with pytest.raises(release_tool.VerificationError) as caught:
        release_tool.verify_dynamic_runtime_acceptance(
            contract,
            report,
            manifest,
            retained,
            evidence_manifest_bytes=manifest_bytes,
        )
    assert "audit.agents.orchestrator_plan.output_artifact_hash" in str(caught.value)
    assert private_sentinel not in str(caught.value)


def test_dynamic_runtime_acceptance_rejects_forged_canonical_fact() -> None:
    contract = release_tool.load_json(release_tool.RELEASE_PATH)
    report, manifest, retained, manifest_bytes = successful_dynamic_qa_evidence(
        contract
    )
    result, _audit = _runtime_result_and_audit(retained)
    private_sentinel = "private-forged-canonical-state"
    result["facts"][-1]["state"] = private_sentinel

    with pytest.raises(release_tool.VerificationError) as caught:
        release_tool.verify_dynamic_runtime_acceptance(
            contract,
            report,
            manifest,
            retained,
            evidence_manifest_bytes=manifest_bytes,
        )
    assert "audit.agents.canonical_facts.output_artifact_hash" in str(caught.value)
    assert private_sentinel not in str(caught.value)


def test_dynamic_runtime_acceptance_rejects_forged_orchestrator_unit() -> None:
    contract = release_tool.load_json(release_tool.RELEASE_PATH)
    report, manifest, retained, manifest_bytes = successful_dynamic_qa_evidence(
        contract
    )
    _result, audit = _runtime_result_and_audit(retained)
    plan = audit["specialist_artifacts"]["orchestrator_plan"]
    plan["deterministic_coverage"]["fact_ids"] = []
    _refresh_causal_artifact_hashes(retained)

    with pytest.raises(
        release_tool.VerificationError,
        match=r"orchestrator_plan\.focus_fact_ids",
    ):
        release_tool.verify_dynamic_runtime_acceptance(
            contract,
            report,
            manifest,
            retained,
            evidence_manifest_bytes=manifest_bytes,
        )


def test_dynamic_runtime_acceptance_rejects_unbound_plan_source_handoff() -> None:
    contract = release_tool.load_json(release_tool.RELEASE_PATH)
    report, manifest, retained, manifest_bytes = successful_dynamic_qa_evidence(
        contract
    )
    _result, audit = _runtime_result_and_audit(retained)
    plan = audit["specialist_artifacts"]["orchestrator_plan"]
    forged_ref = "src_eeeeeeeeeeeeeeeeeeeeeeee"
    plan["focus_source_ref_ids"][1] = forged_ref
    plan["deterministic_coverage"]["source_ref_ids"][1] = forged_ref
    _refresh_causal_artifact_hashes(retained)

    with pytest.raises(
        release_tool.VerificationError,
        match=r"orchestrator_plan\.focus_source_ref_ids",
    ):
        release_tool.verify_dynamic_runtime_acceptance(
            contract,
            report,
            manifest,
            retained,
            evidence_manifest_bytes=manifest_bytes,
        )


def test_dynamic_runtime_acceptance_rejects_forged_process_gate_input() -> None:
    contract = release_tool.load_json(release_tool.RELEASE_PATH)
    report, manifest, retained, manifest_bytes = successful_dynamic_qa_evidence(
        contract
    )
    _result, audit = _runtime_result_and_audit(retained)
    process_gate = next(
        item
        for item in audit["deterministic_gates"]
        if item["agent_id"] == "deterministic_process_gate"
    )
    process_gate["input_artifact_hash"] = "f" * 64

    with pytest.raises(
        release_tool.VerificationError,
        match=r"deterministic_process_gate\.input_artifact_hash",
    ):
        release_tool.verify_dynamic_runtime_acceptance(
            contract,
            report,
            manifest,
            retained,
            evidence_manifest_bytes=manifest_bytes,
        )


def test_dynamic_runtime_acceptance_rejects_forged_inherited_process_field() -> None:
    contract = release_tool.load_json(release_tool.RELEASE_PATH)
    report, manifest, retained, manifest_bytes = successful_dynamic_qa_evidence(
        contract
    )
    _result, audit = _runtime_result_and_audit(retained)
    private_sentinel = "private-forged-process-state"
    audit["specialist_artifacts"]["process_decision_mapping"]["decisions"][0][
        "state"
    ] = private_sentinel
    _refresh_causal_artifact_hashes(retained)

    with pytest.raises(release_tool.VerificationError) as caught:
        release_tool.verify_dynamic_runtime_acceptance(
            contract,
            report,
            manifest,
            retained,
            evidence_manifest_bytes=manifest_bytes,
        )
    assert "process_decision_mapping.decisions[].state" in str(caught.value)
    assert private_sentinel not in str(caught.value)


def test_dynamic_runtime_acceptance_rejects_forged_evidence_fact_binding() -> None:
    contract = release_tool.load_json(release_tool.RELEASE_PATH)
    report, manifest, retained, manifest_bytes = successful_dynamic_qa_evidence(
        contract
    )
    result, _audit = _runtime_result_and_audit(retained)
    item = next(
        value
        for value in result["checklist"]["items"]
        if value["item_id"] == "ventilation_statement"
    )
    item["fact_id"] = "fact_scope"
    _refresh_causal_artifact_hashes(retained)

    with pytest.raises(
        release_tool.VerificationError,
        match=r"final_claim_brief_audit\.source_ref_ids",
    ):
        release_tool.verify_dynamic_runtime_acceptance(
            contract,
            report,
            manifest,
            retained,
            evidence_manifest_bytes=manifest_bytes,
        )


def test_dynamic_runtime_acceptance_rejects_forged_evidence_source_ref() -> None:
    contract = release_tool.load_json(release_tool.RELEASE_PATH)
    report, manifest, retained, manifest_bytes = successful_dynamic_qa_evidence(
        contract
    )
    _result, audit = _runtime_result_and_audit(retained)
    evidence_item = next(
        item
        for item in audit["specialist_artifacts"]["evidence_checklist"]["items"]
        if item["item_id"] == "ventilation_statement"
    )
    evidence_item["source_ref_ids"] = ["src_ffffffffffffffffffffffff"]
    _refresh_causal_artifact_hashes(retained)

    with pytest.raises(
        release_tool.VerificationError,
        match=r"final_claim_brief_audit\.source_ref_ids",
    ):
        release_tool.verify_dynamic_runtime_acceptance(
            contract,
            report,
            manifest,
            retained,
            evidence_manifest_bytes=manifest_bytes,
        )


@pytest.mark.parametrize(
    ("field", "forged_value"),
    [
        ("current_node_id", "scope"),
        ("next_action_node_id", "scope"),
        ("supporting_fact_ids", ["fact_cause"]),
        (
            "upstream_contribution_ids",
            ["document_source_integrity", "process_decision_mapping"],
        ),
        (
            "audit_check_ids",
            [
                "current_node_supported_by_canonical_facts",
                "next_action_connected_in_static_topology",
            ],
        ),
    ],
)
def test_dynamic_runtime_acceptance_rejects_forged_final_field(
    field: str,
    forged_value: object,
) -> None:
    contract = release_tool.load_json(release_tool.RELEASE_PATH)
    report, manifest, retained, manifest_bytes = successful_dynamic_qa_evidence(
        contract
    )
    _result, audit = _runtime_result_and_audit(retained)
    audit["specialist_artifacts"]["final_claim_brief_audit"][field] = forged_value
    _refresh_causal_artifact_hashes(retained)

    with pytest.raises(
        release_tool.VerificationError,
        match=rf"final_claim_brief_audit\.{field}",
    ):
        release_tool.verify_dynamic_runtime_acceptance(
            contract,
            report,
            manifest,
            retained,
            evidence_manifest_bytes=manifest_bytes,
        )


def test_dynamic_runtime_acceptance_rejects_forged_field_unit() -> None:
    contract = release_tool.load_json(release_tool.RELEASE_PATH)
    report, manifest, retained, manifest_bytes = successful_dynamic_qa_evidence(
        contract
    )
    _result, audit = _runtime_result_and_audit(retained)
    field = audit["specialist_artifacts"]["evidence_checklist"]["items"][0][
        "field_contributions"
    ][0]
    field["contribution_id"] = "item:claim_message:forged"
    _refresh_causal_artifact_hashes(retained)

    with pytest.raises(
        release_tool.VerificationError,
        match=r"evidence_checklist\.items\[0\]\.field_contributions\[0\]",
    ):
        release_tool.verify_dynamic_runtime_acceptance(
            contract,
            report,
            manifest,
            retained,
            evidence_manifest_bytes=manifest_bytes,
        )


def test_dynamic_runtime_acceptance_rejects_forged_projection_lineage() -> None:
    contract = release_tool.load_json(release_tool.RELEASE_PATH)
    report, manifest, retained, manifest_bytes = successful_dynamic_qa_evidence(
        contract
    )
    result, audit = _runtime_result_and_audit(retained)
    private_sentinel = "private-forged-lineage-call"
    result["process"]["agent_contribution"]["provenance"][
        "call_id"
    ] = private_sentinel
    process_gate = next(
        item
        for item in audit["deterministic_gates"]
        if item["agent_id"] == "deterministic_process_gate"
    )
    process_gate["output_artifact_hash"] = release_tool.accepted_artifact_hash(
        result["process"]
    )

    with pytest.raises(release_tool.VerificationError) as caught:
        release_tool.verify_dynamic_runtime_acceptance(
            contract,
            report,
            manifest,
            retained,
            evidence_manifest_bytes=manifest_bytes,
        )
    assert "result.process.agent_contribution.provenance" in str(caught.value)
    assert private_sentinel not in str(caught.value)


def test_dynamic_runtime_acceptance_rejects_unbound_final_next_action() -> None:
    contract = release_tool.load_json(release_tool.RELEASE_PATH)
    report, manifest, retained, manifest_bytes = successful_dynamic_qa_evidence(
        contract
    )
    result, _audit = _runtime_result_and_audit(retained)
    result["next_action"]["process_node_id"] = "scope"

    with pytest.raises(
        release_tool.VerificationError,
        match=r"result\.next_action\.process_node_id",
    ):
        release_tool.verify_dynamic_runtime_acceptance(
            contract,
            report,
            manifest,
            retained,
            evidence_manifest_bytes=manifest_bytes,
        )


@pytest.mark.parametrize(
    ("actor", "expected_path"),
    [
        ("agent", "Dynamic flagship agent orchestrator_plan role"),
        ("gate", "Dynamic flagship gate deterministic_process_gate role"),
    ],
)
def test_dynamic_runtime_acceptance_rejects_relabelled_runtime_roles(
    actor: str,
    expected_path: str,
) -> None:
    contract = release_tool.load_json(release_tool.RELEASE_PATH)
    report, manifest, retained, manifest_bytes = successful_dynamic_qa_evidence(
        contract
    )
    _result, audit = _runtime_result_and_audit(retained)
    if actor == "agent":
        target = next(
            item
            for item in audit["agents"]
            if item["agent_id"] == "orchestrator_plan"
        )
    else:
        target = next(
            item
            for item in audit["deterministic_gates"]
            if item["agent_id"] == "deterministic_process_gate"
        )
    target["role"] = "Relabelled Runtime Actor"

    with pytest.raises(release_tool.VerificationError, match=expected_path):
        release_tool.verify_dynamic_runtime_acceptance(
            contract,
            report,
            manifest,
            retained,
            evidence_manifest_bytes=manifest_bytes,
        )


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
    ledger["summary"] = _ledger_summary(ledger["items"])
    return warm_item


def test_dynamic_runtime_acceptance_accepts_real_public_ledger_shape() -> None:
    contract = release_tool.load_json(release_tool.RELEASE_PATH)
    report, manifest, retained, manifest_bytes = successful_dynamic_qa_evidence(
        contract
    )
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
    report, manifest, retained, manifest_bytes = successful_dynamic_qa_evidence(
        contract
    )
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
    report, manifest, retained, manifest_bytes = successful_dynamic_qa_evidence(
        contract
    )
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
    report, manifest, retained, manifest_bytes = successful_dynamic_qa_evidence(
        contract
    )
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
    report, manifest, retained, manifest_bytes = successful_dynamic_qa_evidence(
        contract
    )
    agent = retained["flagship-run.json"]["result"]["audit"]["agent_orchestration"][
        "agents"
    ][0]
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
    report, manifest, retained, manifest_bytes = successful_dynamic_qa_evidence(
        contract
    )
    unsafe_value = "credential-provider-unit-test"
    retained["flagship-cold-model-ledger.json"]["items"][0]["upstream_provider"] = (
        unsafe_value
    )

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


def test_dynamic_runtime_acceptance_rejects_valid_but_unpinned_upstream() -> None:
    contract = release_tool.load_json(release_tool.RELEASE_PATH)
    report, manifest, retained, manifest_bytes = successful_dynamic_qa_evidence(
        contract
    )
    audit_agent = retained["flagship-run.json"]["result"]["audit"][
        "agent_orchestration"
    ]["agents"][0]
    audit_agent["upstream_provider"] = "Together"

    with pytest.raises(
        release_tool.VerificationError,
        match="upstream_provider must be 'DeepInfra'",
    ):
        release_tool.verify_dynamic_runtime_acceptance(
            contract,
            report,
            manifest,
            retained,
            evidence_manifest_bytes=manifest_bytes,
        )


def test_public_ledger_accepts_bounded_unknown_cost_upstream_rejection() -> None:
    ledger = {
        "scope": "global_budget_ledger",
        "summary": {
            "records": 1,
            "network_calls": 1,
            "prompt_tokens": 0,
            "completion_tokens": 0,
            "total_tokens": 0,
            "actual_cost_usd": 0,
            "actual_cost_complete": False,
            "unknown_cost_call_count": 1,
            "outcomes": {"failed": 1},
        },
        "items": [
            {
                "call_id": "modelcall-upstream-rejected",
                "call_count": 1,
                "outcome": "failed",
                "error_invariant": "provider_upstream_rejection",
                "response_id": "gen-1786483159-hyYthqPv76o6PHXpGLzl",
                "provider_error_code": 400,
                "actual_cost_usd": None,
            }
        ],
    }

    release_tool._verify_public_model_ledger(ledger, "fixture")
    boolean_forged = deepcopy(ledger)
    boolean_forged["summary"] = {
        "records": True,
        "network_calls": True,
        "prompt_tokens": False,
        "completion_tokens": False,
        "total_tokens": False,
        "actual_cost_usd": False,
        "actual_cost_complete": False,
        "unknown_cost_call_count": True,
        "outcomes": {"failed": True},
    }
    with pytest.raises(
        release_tool.VerificationError,
        match="summary has invalid",
    ):
        release_tool._verify_public_model_ledger(boolean_forged, "fixture")

    ledger["items"][0]["provider_error_code"] = "RAW_PROVIDER_CODE"
    with pytest.raises(
        release_tool.VerificationError,
        match="provider_error_code is unbounded or out of scope",
    ):
        release_tool._verify_public_model_ledger(ledger, "fixture")

    ledger["items"][0]["provider_error_code"] = 400
    unsafe_response_id = "DEF-027-E0-DEMO"
    ledger["items"][0]["response_id"] = unsafe_response_id
    with pytest.raises(
        release_tool.VerificationError,
        match="exact OpenRouter generation ID",
    ) as caught:
        release_tool._verify_public_model_ledger(ledger, "fixture")
    assert unsafe_response_id not in str(caught.value)


def test_public_ledger_rejects_every_forged_summary_field() -> None:
    ledger = {
        "scope": "global_budget_ledger",
        "items": [
            {
                "call_id": "modelcall-summary-known",
                "call_count": 1,
                "prompt_tokens": 17,
                "completion_tokens": 5,
                "total_tokens": 22,
                "actual_cost_usd": 0.0042,
                "outcome": "succeeded",
            },
            {
                "call_id": "modelcall-summary-unknown",
                "call_count": 1,
                "actual_cost_usd": None,
                "outcome": "failed",
            },
            {
                "call_id": "modelcall-summary-cache",
                "call_count": 0,
                "outcome": "cache_hit",
            },
        ],
    }
    ledger["summary"] = _ledger_summary(ledger["items"])
    release_tool._verify_public_model_ledger(ledger, "fixture")

    forged_values = {
        "records": 999,
        "network_calls": 0,
        "prompt_tokens": 0,
        "completion_tokens": 0,
        "total_tokens": 0,
        "actual_cost_usd": 0,
        "actual_cost_complete": True,
        "unknown_cost_call_count": 0,
        "outcomes": {},
    }
    for field, forged_value in forged_values.items():
        forged = deepcopy(ledger)
        forged["summary"][field] = forged_value
        with pytest.raises(
            release_tool.VerificationError,
            match="summary is inconsistent with ledger rows",
        ):
            release_tool._verify_public_model_ledger(forged, "fixture")


def test_dynamic_runtime_evidence_paths_verify_the_atomic_artifact_pair(
    tmp_path: Path,
) -> None:
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
    report, manifest, retained, manifest_bytes = successful_dynamic_qa_evidence(
        contract
    )

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
    with pytest.raises(
        release_tool.VerificationError, match="response IDs must be distinct"
    ):
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
    with pytest.raises(
        release_tool.VerificationError, match="strict accepted majority"
    ):
        release_tool.verify_dynamic_runtime_acceptance(
            contract,
            report,
            manifest,
            weak_contribution,
            evidence_manifest_bytes=manifest_bytes,
        )

    traced = deepcopy(retained)
    traced["flagship-run.json"]["result"]["audit"]["agent_orchestration"][
        "external_tracing"
    ] = True
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
    artifact = {"z": "ü", "a": [{"basis_points": 9100}, True, None]}
    expected = "a0d744bb4829b2124b022b17dd45499e7012bd19dd95940d1a8a3aed474e42c3"
    assert release_tool.accepted_artifact_hash(artifact) == expected
    assert release_tool.runtime_artifact_hash(artifact) == expected
    assert (
        release_tool.runtime_artifact_hash({"confidence": 0.91})
        == "917ee2f800c6299c798234ab12ba84a416bd6439dd70b1fad1cab3f4a775662a"
    )
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
