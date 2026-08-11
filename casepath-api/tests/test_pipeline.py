from __future__ import annotations

from copy import deepcopy
import json
import math
import time
from pathlib import Path

import pytest

from casepath_api.data import ARTIFACTS, CLAIMS, HISTORICAL_CASES, observable_claim_package
from casepath_api.canonicalizer import (
    MAX_OUTPUT_TOKENS,
    MODEL_MODE_OPENROUTER,
    OPENROUTER_MODEL,
    OpenRouterNemotronCanonicalizer,
    observable_source_reference_registry,
    resolve_observable_source_reference_id,
)
from casepath_api.pipeline_v15 import (
    ClaimPipeline,
    apply_evidence_projection,
    apply_process_projection,
    decision_projection,
    digest,
)
from casepath_api.multi_agent import AgentInvocationFailure, accepted_artifact_hash
from casepath_api.storage import Storage
from casepath_api.validation import ContractValidationError


def wait(storage: Storage, run_id: str) -> dict:
    for _ in range(500):
        run = storage.get_run(run_id)
        if run and run["status"] in {"complete", "failed"}:
            return run
        time.sleep(0.01)
    raise AssertionError("run timeout")


@pytest.fixture
def runtime(tmp_path: Path) -> tuple[Storage, ClaimPipeline]:
    storage = Storage(str(tmp_path / "casepath.db"))
    return storage, ClaimPipeline(storage, pace_seconds=0)


def accepted_review(pipeline: ClaimPipeline, run_id: str, *, mode: str = "conditional") -> dict:
    return pipeline.review(
        run_id,
        {
            "decision": "approve_with_edit",
            "building_envelope_mode": mode,
            "confidence": 0.91,
            "justification": "Generated-demo edit only; qualified review has not occurred.",
        },
    )


def provider_fact_proposals(oracle_facts: list[dict]) -> list[dict]:
    registry = observable_source_reference_registry(
        observable_claim_package(CLAIMS["DEF-027-E0-DEMO"])
    )
    proposals = []
    for value in oracle_facts:
        proposal = {
            key: deepcopy(item)
            for key, item in value.items()
            if key not in {
                "value",
                "explanation",
                "source_refs",
                "controls_process",
                "decision_key",
                "decision_value",
            }
        }
        proposal["source_ref_ids"] = [
            resolve_observable_source_reference_id(ref, registry)
            for ref in value["source_refs"]
            if ref["locator_kind"] == "text_quote"
        ]
        proposals.append(proposal)
    return proposals


class StubAgentOrchestrator:
    """Pipeline-only seam; real StateGraph behavior is covered in test_multi_agent_v15."""

    def invoke(self, **values):
        facts = values["facts"]
        process = values["process"]
        checklist = values["checklist"]
        progress_sink = values.get("progress_sink")
        roles = [
            "orchestrator_plan",
            "document_source_integrity",
            "process_decision_mapping",
            "evidence_checklist",
            "final_claim_brief_audit",
        ]
        agents = [
            {
                "stage": "understand",
                "acceptance_scope": "pre_review_model_output",
                "agent_id": "canonical_facts",
                "role": "Guarded Canonical Facts Agent",
                "actor_type": "nemotron_agent",
                "model": OPENROUTER_MODEL,
                "provider": "openrouter",
                "requested_model": OPENROUTER_MODEL,
                "call_count": 1,
                "parent_call_id": None,
                "delegation_id": None,
                "call_id": values["canonicalization"]["call_id"],
                "cache_hit": False,
                "outcome": "succeeded",
                "accepted_count": len(facts),
                "rejected_count": 0,
                "deterministic_fallback_applied": False,
            }
        ]
        plan_call_id = "modelcall-plan-stub"
        for index, role in enumerate(roles):
            entry = {
                "stage": role,
                "acceptance_scope": "pre_review_model_output",
                "agent_id": role,
                "role": role.replace("_", " ").title(),
                "actor_type": "nemotron_agent",
                "model": OPENROUTER_MODEL,
                "provider": "openrouter",
                "requested_model": OPENROUTER_MODEL,
                "call_count": 1,
                "parent_call_id": (
                    values["canonicalization"]["call_id"]
                    if role == "orchestrator_plan"
                    else plan_call_id
                ),
                "delegation_id": f"dlg-stub-{index}",
                "call_id": plan_call_id if role == "orchestrator_plan" else f"modelcall-{role}-stub",
                "cache_hit": False,
                "outcome": "succeeded",
                "accepted_ids": [role],
                "accepted_count": 1,
                "rejected": [],
                "rejected_count": 0,
                "deterministic_fallback_applied": False,
                "output_artifact": f"{role}_contribution",
                "input_artifact_hash": "1" * 64,
                "output_artifact_hash": "2" * 64,
            }
            agents.append(entry)
            if progress_sink:
                progress_sink(
                    {
                        "receipt_type": "agent_completed",
                        "acceptance_scope": "pre_review_model_output",
                        "agent_id": role,
                        "role": entry["role"],
                        "actor_type": "nemotron_agent",
                        "status": "completed",
                        "call_id": entry["call_id"],
                        "parent_call_id": entry["parent_call_id"],
                        "delegation_id": entry["delegation_id"],
                        "accepted_ids": entry["accepted_ids"],
                        "accepted_count": 1,
                        "rejected_count": 0,
                        "deterministic_fallback_applied": False,
                        "output_artifact": entry["output_artifact"],
                        "output_artifact_hash": entry["output_artifact_hash"],
                    }
                )
        decisions = [
            {
                "fact_id": fact["fact_id"],
                "state": fact["state"],
                "normalized_value": fact["normalized_value"],
                "source_ref_ids": [],
                "confidence_basis_points": 8200,
                "attribution": "Process Decision Mapping Agent",
                "deterministic_fallback_applied": False,
            }
            for fact in facts
            if fact["controls_process"]
        ]
        evidence_items = [
            {
                "item_id": item["item_id"],
                "status": item["status"],
                "artifact_ids": item.get("artifact_ids", []),
                "source_ref_ids": [],
                "confidence_basis_points": 8300,
                "attribution": "Evidence and Checklist Agent",
                "deterministic_fallback_applied": False,
            }
            for item in checklist["items"]
        ]
        final_brief = {
            "current_node_id": process["current_overlay"]["current_node_id"],
            "next_action_node_id": process["current_overlay"]["next_action_node_id"],
            "source_ref_ids": [],
            "input_contribution_ids": [
                "document_source_integrity",
                "process_decision_mapping",
                "evidence_checklist",
            ],
            "lineage_authority": "deterministic_application",
            "confidence_basis_points": 8400,
            "attribution": "Final Claim Brief Agent",
            "deterministic_fallback_applied": False,
        }
        gates = [
            {
                "agent_id": gate_id,
                "role": gate_id.replace("_", " ").title(),
                "actor_type": "deterministic_gate",
                "model": None,
                "outcome": "passed",
                "input_artifact_hash": "3" * 64,
                "output_artifact_hash": "4" * 64,
            }
            for gate_id in (
                "deterministic_process_gate",
                "deterministic_evidence_gate",
                "whole_playbook_gate",
            )
        ]
        return {
            "schema_version": "casepath.nemotron-agent-dag/1.0.0",
            "implementation": "langgraph_stategraph_langchain_openrouter",
            "orchestration_id": values["orchestration_id"],
            "model": OPENROUTER_MODEL,
            "authority_mode": "multi_agent_hybrid_guarded",
            "all_required_agents_contributed": True,
            "external_tracing": False,
            "agents": agents,
            "deterministic_gates": gates,
            "specialist_artifacts": {
                "orchestrator_plan": {"focus_fact_ids": [facts[0]["fact_id"]]},
                "document_source_integrity": {"artifacts": []},
                "process_decision_mapping": {"decisions": decisions},
                "evidence_checklist": {"items": evidence_items},
                "final_claim_brief_audit": final_brief,
            },
            "final_claim_brief": final_brief,
        }


def test_source_artifacts_are_real_files():
    lease = ARTIFACTS["art_lease"]
    assert lease["media_type"] == "application/pdf"
    assert lease["page_count"] == 6
    assert lease["path"].read_bytes().startswith(b"%PDF")
    assert ARTIFACTS["art_photo"]["path"].read_bytes()[:2] == b"\xff\xd8"
    assert "From:" in ARTIFACTS["art_notification"]["path"].read_text()


@pytest.mark.parametrize("claim_id", ["DEF-027-E0-DEMO", "DEMO-MOULD-002"])
def test_v15_completed_outputs_have_no_dangling_contract_refs(runtime, claim_id: str):
    storage, pipeline = runtime
    run = wait(storage, pipeline.create(claim_id))
    assert run["status"] == "complete", run.get("error")
    result = run["result"]
    assert result["verification"]["valid"] is True
    assert result["verification"]["computed"] is True
    assert len(result["verification"]["checks"]) == 8
    assert len(result["process"]["nodes"]) == 19
    assert len(result["process"]["edges"]) == 22
    assert result["process"]["validator"] == {
        "valid": True,
        "computed": True,
        "checks": ["Graph integrity", "Law-to-process linkage", "Current-state safety"],
    }
    assert result["checklist"]["validator"]["valid"] is True
    supplied = {value["item_id"] for value in result["checklist"]["present"]}
    requested = {value["item_id"] for value in result["checklist"]["required"]}
    assert supplied.isdisjoint(requested)
    facts_by_id = {value["fact_id"]: value for value in result["facts"]}
    for item in result["checklist"]["items"]:
        if item["status"].startswith("provided"):
            fact_sources = {
                ref["artifact_id"]
                for ref in facts_by_id[item["fact_id"]]["source_refs"]
            }
            assert set(item["artifact_ids"]) & fact_sources


def test_later_scope_and_unknown_urgency_remain_unverified_and_unsupplied(runtime):
    storage, pipeline = runtime
    result = wait(storage, pipeline.create("DEMO-MOULD-002"))["result"]
    tenancy = next(value for value in result["facts"] if value["fact_id"] == "later_fact_tenancy")
    assert tenancy["state"] == "unknown"
    assert tenancy["normalized_value"] == "unverified"
    assert tenancy["source_refs"] == []
    assert result["category"] == "Moisture and condensation report"
    assert result["scope"] == "Residential-tenancy scope unverified"
    assert result["process"]["current_node"] == "scope"
    scope_node = next(value for value in result["process"]["nodes"] if value["node_id"] == "scope")
    assert scope_node["state"] == "current"
    assert scope_node["answer"] == "Unverified"
    assert result["process"]["selected_path"] == ["intake", "scope"]
    assert result["process"]["current_overlay"]["next_action_node_id"] == "scope"
    lease = next(value for value in result["checklist"]["items"] if value["item_id"] == "lease")
    assert "does not establish a residential-tenancy relationship" in lease["why"]
    policy = next(value for value in result["checklist"]["items"] if value["item_id"] == "policy_reference")
    assert policy["artifact_ids"] == ["intake"]
    health = next(value for value in result["checklist"]["items"] if value["item_id"] == "health_safety_statement")
    assert health["status"] == "missing"
    assert health["artifact_ids"] == []
    assert health["item_id"] not in {value["item_id"] for value in result["checklist"]["present"]}


def test_primary_scope_dispute_and_notification_propositions_have_sufficient_exact_refs(runtime):
    storage, pipeline = runtime
    result = wait(storage, pipeline.create("DEF-027-E0-DEMO"))["result"]
    facts = {value["fact_id"]: value for value in result["facts"]}

    def text_ref_tuples(fact_id: str) -> set[tuple[str, int, str]]:
        return {
            (ref["artifact_id"], ref["page"], ref["excerpt"])
            for ref in facts[fact_id]["source_refs"]
            if ref["locator_kind"] == "text_quote"
        }

    assert text_ref_tuples("fact_tenancy") == {
        ("art_lease", 1, "Residential Lease Agreement"),
        ("art_lease", 1, "Tenant Alex Morgan, Feldbergstrasse 114, 4057 Basel"),
        ("art_lease", 1, "The apartment is rented for residential use."),
    }
    assert text_ref_tuples("fact_dispute") == {
        ("message", 1, "I disagree because the problem keeps returning."),
        ("message", 1, "I want the cause clarified and the defect repaired."),
        ("art_management_reply", 1, "the marks appear consistent with insufficient ventilation"),
        ("art_management_reply", 1, "We do not currently plan a technical inspection."),
    }
    assert text_ref_tuples("fact_notification") == {
        ("art_notification", 1, "Wed, 15 Jul 2026 08:32:00 +0200"),
        ("art_notification", 1, "Please arrange an inspection and repair."),
        ("art_delivery", 1, "Accepted by recipient mail server"),
    }
    assert "residential lease agreement" in facts["fact_tenancy"]["explanation"]
    assert "cause clarification and repair" in facts["fact_dispute"]["explanation"]
    assert "dated 15 July 2026" in facts["fact_notification"]["explanation"]


def test_verifier_rejects_unknown_fact_and_evidence_ids(runtime):
    storage, pipeline = runtime
    run = wait(storage, pipeline.create("DEF-027-E0-DEMO"))
    result = deepcopy(run["result"])
    result["process"]["nodes"][0]["fact_ids"] = ["unknown_fact"]
    result["process"]["nodes"][0]["evidence_requirement_ids"] = ["unknown_evidence"]
    with pytest.raises(ContractValidationError) as caught:
        pipeline._verification_report(  # noqa: SLF001 - acceptance-gate regression test
            CLAIMS[run["claim_id"]],
            {"facts": result["facts"]},
            result["legal_research"],
            result["process"],
            result["checklist"],
            result["precedents"],
        )
    paths = {issue.path for issue in caught.value.issues}
    assert "nodes[0].fact_ids[0]" in paths
    assert "nodes[0].evidence_requirement_ids[0]" in paths


def test_verifier_rejects_unknown_source_and_precedent_provenance(runtime):
    storage, pipeline = runtime
    run = wait(storage, pipeline.create("DEF-027-E0-DEMO"))
    result = deepcopy(run["result"])
    result["facts"][0]["source_refs"][0]["artifact_id"] = "hidden_answer_file"
    result["precedents"][0]["review_status"] = "expert_reviewed_memory"
    with pytest.raises(ContractValidationError):
        pipeline._verification_report(  # noqa: SLF001
            CLAIMS[run["claim_id"]],
            {"facts": result["facts"]},
            result["legal_research"],
            result["process"],
            result["checklist"],
            result["precedents"],
        )


def test_verifier_rejects_provided_evidence_not_linked_to_fact_source(runtime):
    storage, pipeline = runtime
    run = wait(storage, pipeline.create("DEF-027-E0-DEMO"))
    result = deepcopy(run["result"])
    policy = next(value for value in result["checklist"]["items"] if value["item_id"] == "policy_reference")
    policy["artifact_ids"] = ["message"]
    with pytest.raises(ContractValidationError, match="grounds its linked fact"):
        pipeline._verification_report(  # noqa: SLF001
            CLAIMS[run["claim_id"]],
            {"facts": result["facts"]},
            result["legal_research"],
            result["process"],
            result["checklist"],
            result["precedents"],
        )


def test_grounding_rejects_fake_image_quote_invalid_region_and_metadata_mismatch(runtime):
    storage, pipeline = runtime
    run = wait(storage, pipeline.create("DEF-027-E0-DEMO"))

    fake_quote = deepcopy(run["result"])
    visual_fact = next(
        value for value in fake_quote["facts"]
        if any(ref["locator_kind"] == "visual_observation" for ref in value["source_refs"])
    )
    visual_index = next(
        index for index, ref in enumerate(visual_fact["source_refs"])
        if ref["locator_kind"] == "visual_observation"
    )
    artifact_id = visual_fact["source_refs"][visual_index]["artifact_id"]
    visual_fact["source_refs"][visual_index] = {
        "artifact_id": artifact_id,
        "locator_kind": "text_quote",
        "page": 1,
        "excerpt": "The image proves a building defect.",
        "agent": "Claim Understanding Agent",
    }
    with pytest.raises(ContractValidationError, match="text quotes require an observable textual source"):
        pipeline._verification_report(  # noqa: SLF001
            CLAIMS[run["claim_id"]],
            {"facts": fake_quote["facts"]},
            fake_quote["legal_research"],
            fake_quote["process"],
            fake_quote["checklist"],
            fake_quote["precedents"],
        )

    bad_region = deepcopy(run["result"])
    visual_ref = next(
        ref for value in bad_region["facts"] for ref in value["source_refs"]
        if ref["locator_kind"] == "visual_observation"
    )
    visual_ref["region"] = [0.9, 0.9, 0.2, 0.2]
    with pytest.raises(ContractValidationError, match="normalized"):
        pipeline._verification_report(  # noqa: SLF001
            CLAIMS[run["claim_id"]],
            {"facts": bad_region["facts"]},
            bad_region["legal_research"],
            bad_region["process"],
            bad_region["checklist"],
            bad_region["precedents"],
        )

    bad_metadata = deepcopy(run["result"])
    metadata_ref = next(
        ref for value in bad_metadata["facts"] for ref in value["source_refs"]
        if ref["locator_kind"] == "metadata_field"
    )
    metadata_ref["value"] = "mismatched-observed-value"
    with pytest.raises(ContractValidationError, match="metadata value does not match"):
        pipeline._verification_report(  # noqa: SLF001
            CLAIMS[run["claim_id"]],
            {"facts": bad_metadata["facts"]},
            bad_metadata["legal_research"],
            bad_metadata["process"],
            bad_metadata["checklist"],
            bad_metadata["precedents"],
        )


@pytest.mark.parametrize(
    ("decision_key", "normalized_value", "decision_value", "expected_current", "expected_next"),
    [
        ("scope", "supported_out_of_scope", "out_of_scope", "scope", "out_of_scope"),
        ("dispute", "absent", "no_dispute", "dispute", "no_dispute"),
        ("urgency", "urgent", "urgent", "urgency", "urgent_escalation"),
        ("notification", "unverified", "notification_unverified", "notification", "formal_notice"),
        ("recurrence", "unverified", "recurrence_unverified", "defect", "defect"),
        ("causation", "building", "cause_building", "causation", "building_defect"),
    ],
)
def test_typed_fact_decisions_own_process_and_evidence_projection(
    runtime,
    decision_key: str,
    normalized_value: str,
    decision_value: str,
    expected_current: str,
    expected_next: str,
):
    storage, pipeline = runtime
    result = wait(storage, pipeline.create("DEF-027-E0-DEMO"))["result"]
    facts = deepcopy(result["facts"])
    controlling = next(value for value in facts if value["decision_key"] == decision_key)
    controlling["normalized_value"] = normalized_value
    controlling["decision_value"] = decision_value

    projection = decision_projection(facts)
    nodes = deepcopy(result["process"]["nodes"])
    edges = deepcopy(result["process"]["edges"])
    overlay = apply_process_projection(nodes, edges, projection, result["process"]["main_spine"])
    projected_process = {
        **deepcopy(result["process"]),
        "nodes": nodes,
        "edges": edges,
        "current_node": projection["current_node"],
        "selected_path": projection["selected_path"],
        "current_overlay": overlay,
    }
    assert projected_process["current_node"] == expected_current
    assert overlay["next_action_node_id"] == expected_next
    assert len(nodes) == 19
    assert len(edges) == 22
    assert result["category"] == "Rental defect - mould and moisture"

    projected_items = deepcopy(result["checklist"]["items"])
    apply_evidence_projection(projected_items, projected_process)
    before = {(value["item_id"], value["status"], value["current_path"]) for value in result["checklist"]["items"]}
    after = {(value["item_id"], value["status"], value["current_path"]) for value in projected_items}
    assert after != before


def test_post_review_result_is_recomputed_and_reverified(runtime):
    storage, pipeline = runtime
    run = wait(storage, pipeline.create("DEF-027-E0-DEMO"))
    before_hash = run["result"]["verification"]["whole_playbook_hash"]
    before_fact_ids = {
        value["node_id"]: value["fact_ids"]
        for value in run["result"]["process"]["nodes"]
    }
    reviewed = accepted_review(pipeline, run["run_id"])
    assert reviewed["accepted"] is True
    assert reviewed["verification"]["valid"] is True
    assert reviewed["verification"]["computed"] is True
    assert reviewed["verification"]["whole_playbook_hash"] != before_hash
    assert all(
        operation["component"] in {"process_graph", "evidence_model"}
        and operation["operation"] in {"add", "replace"}
        and operation["pointer"].startswith("/")
        for operation in reviewed["review"]["operations"]
    )
    assert reviewed["result"]["process"]["playbook_version"] == "mould-playbook-v3"
    assert reviewed["result"]["checklist"]["playbook_version"] == "mould-playbook-v3"
    assert reviewed["result"]["playbook"]["version"] == "mould-playbook-v3"
    reviewed_nodes = {value["node_id"]: value for value in reviewed["result"]["process"]["nodes"]}
    assert {
        node_id: reviewed_nodes[node_id]["fact_ids"]
        for node_id in before_fact_ids
    } == before_fact_ids
    assert reviewed_nodes["ventilation_dispute"]["fact_ids"] == ["fact_ventilation_allegation"]
    assert not any(
        fact_id.startswith("later_fact_")
        for node in reviewed_nodes.values()
        for fact_id in node["fact_ids"]
    )
    transform = reviewed["review_transform"]
    assert transform == reviewed["result"]["audit"]["review_transform"]
    assert transform["acceptance_scope"] == "post_review_unverified_transform"
    assert transform["authority"] == "unverified_demo_user"
    assert transform["qualification_status"] == "not_verified"
    assert transform["input_run_id"] == run["run_id"]
    assert transform["input_process_hash"] == digest(run["result"]["process"])
    assert transform["input_checklist_hash"] == digest(run["result"]["checklist"])
    assert transform["output_process_hash"] == digest(reviewed["result"]["process"])
    assert transform["output_checklist_hash"] == digest(reviewed["result"]["checklist"])
    assert transform["model_acceptance_reused"] is False


def test_reject_cannot_create_memory_or_activate_knowledge(runtime):
    storage, pipeline = runtime
    run = wait(storage, pipeline.create("DEF-027-E0-DEMO"))
    original = deepcopy(run["result"])
    response = pipeline.review(
        run["run_id"],
        {
            "decision": "reject",
            "building_envelope_mode": "conditional",
            "confidence": 0.2,
            "justification": "Reject this generated-demo edit.",
        },
    )
    assert response["accepted"] is False
    assert response["memory_id"] is None
    assert response["candidate"] is None
    assert response["result"] == original
    assert storage.memories() == []
    assert storage.candidates() == []
    assert pipeline.knowledge()["active_playbook"]["version"] == "mould-playbook-v3"
    assert storage.get_run(run["run_id"])["result"] == original


def test_one_review_creates_memory_and_quarantined_candidate(runtime):
    storage, pipeline = runtime
    run = wait(storage, pipeline.create("DEF-027-E0-DEMO"))
    response = accepted_review(pipeline, run["run_id"])
    candidate = response["candidate"]
    assert candidate["status"] == "quarantined"
    assert candidate["supporting_claims"] == ["DEF-027-E0-DEMO"]
    assert candidate["support_count"] == 1
    assert candidate["required_support"] == 3
    assert candidate["target_tests"]["status"] == "not_run"
    assert candidate["protected_regression"]["status"] == "not_run"
    assert candidate["approval"] == {"status": "pending", "qualified_reviewer": False}
    assert candidate["shared_knowledge_changed"] is False
    memory = storage.memories()[0]
    assert memory["review_status"] == "unverified_demo_memory"
    assert memory["reviewer"] == {
        "type": "unverified_demo_user",
        "qualification_status": "not_verified",
    }
    assert memory["shared_rule_authority"] is False
    assert memory["playbook_version"] == "mould-playbook-v3"
    assert memory["verification"]["valid"] is True


def test_required_now_does_not_release_conditional_rule(runtime):
    storage, pipeline = runtime
    run = wait(storage, pipeline.create("DEF-027-E0-DEMO"))
    response = accepted_review(pipeline, run["run_id"], mode="required_now")
    envelope = next(
        value for value in response["result"]["checklist"]["items"]
        if value["item_id"] == "building_envelope"
    )
    assert envelope["status"] == "missing"
    assert response["candidate"]["status"] == "quarantined"
    assert response["knowledge"]["shared_playbook_version"] == "mould-playbook-v3"
    assert response["knowledge"]["shared_knowledge_changed"] is False


def test_static_precedents_are_generated_reference_not_expert_reviewed():
    assert HISTORICAL_CASES
    assert {value["review_status"] for value in HISTORICAL_CASES} == {"generated_reference"}
    assert all(value["provenance"] == "generated_reference_not_qualified_review" for value in HISTORICAL_CASES)
    assert all("expert_correction" not in value for value in HISTORICAL_CASES)


def test_later_claim_retrieves_memory_without_promoting_shared_rule(runtime):
    storage, pipeline = runtime
    flagship = wait(storage, pipeline.create("DEF-027-E0-DEMO"))
    accepted_review(pipeline, flagship["run_id"])
    later = wait(storage, pipeline.create("DEMO-MOULD-002", knowledge_mode="current"))
    assert later["status"] == "complete", later.get("error")
    result = later["result"]
    assert result["reviewed_memory_used"] is True
    assert result["shared_rule_applied"] is False
    assert result["playbook"]["version"] == "mould-playbook-v3"
    assert result["process"]["playbook_version"] == "mould-playbook-v3"
    assert result["precedents"][0]["review_status"] == "unverified_demo_memory"
    assert result["precedents"][0]["claim_id"] == "DEF-027-E0-DEMO"
    assert all(value["node_id"] != "ventilation_dispute" for value in result["process"]["nodes"])
    envelope = next(value for value in result["checklist"]["items"] if value["item_id"] == "building_envelope")
    assert envelope["status"] == "conditional"
    assert envelope["current_path"] is False
    assert pipeline.knowledge()["active_playbook"]["version"] == "mould-playbook-v3"


def test_learning_proof_is_bound_to_completed_later_runs(runtime):
    storage, pipeline = runtime
    baseline = wait(storage, pipeline.create("DEMO-MOULD-002", knowledge_mode="baseline"))
    flagship = wait(storage, pipeline.create("DEF-027-E0-DEMO"))
    accepted_review(pipeline, flagship["run_id"])
    later = wait(storage, pipeline.create("DEMO-MOULD-002", knowledge_mode="current"))
    proof = pipeline.learning_proof(baseline["run_id"], later["run_id"])
    assert proof["ready"] is True
    assert proof["computed"] is True
    assert proof["baseline_run_id"] == baseline["run_id"]
    assert proof["later_run_id"] == later["run_id"]
    assert proof["before"]["result_hash"] != proof["after"]["result_hash"]
    assert proof["reviewed_memory_proof"]["used"] is True
    assert proof["reviewed_memory_proof"]["present_in_baseline"] is False
    assert proof["reviewed_memory_proof"]["present_in_later_run"] is True
    assert proof["changes"]["precedent_claim_ids_added"] == ["DEF-027-E0-DEMO"]
    assert proof["shared_rule"]["applied"] is False
    assert proof["shared_rule"]["version_before"] == "mould-playbook-v3"
    assert proof["shared_rule"]["version_after"] == "mould-playbook-v3"
    with pytest.raises(ValueError):
        pipeline.learning_proof(later["run_id"], later["run_id"])


def test_observable_package_excludes_hidden_generation_fields():
    package = observable_claim_package(CLAIMS["DEF-027-E0-DEMO"])

    def keys(value):
        if isinstance(value, dict):
            for key, child in value.items():
                yield key
                yield from keys(child)
        elif isinstance(value, list):
            for child in value:
                yield from keys(child)

    all_keys = set(keys(package))
    assert {"generated", "lineage", "fact_ids", "description", "document_type", "title"}.isdisjoint(all_keys)
    assert "claim_id" not in all_keys
    assert package["schema"] == "casepath.observable-claim-package/1.0.0"


def test_duplicate_review_is_idempotent_or_rejected(runtime):
    storage, pipeline = runtime
    run = wait(storage, pipeline.create("DEF-027-E0-DEMO"))
    payload = {
        "decision": "approve_with_edit",
        "building_envelope_mode": "conditional",
        "confidence": 0.91,
        "justification": "Generated-demo edit only; qualified review has not occurred.",
    }
    first = pipeline.review(run["run_id"], payload)
    duplicate = pipeline.review(run["run_id"], payload)
    assert duplicate == first
    assert len(storage.memories()) == 1
    assert len(storage.candidates()) == 1
    assert len([value for value in storage.get_run(run["run_id"])["events"] if value["stage"] == "review"]) == 1
    with pytest.raises(ValueError, match="different review"):
        pipeline.review(run["run_id"], {**payload, "building_envelope_mode": "required_now"})


def test_pipeline_events_disclose_deterministic_vs_model_identity(runtime):
    storage, pipeline = runtime
    run = wait(storage, pipeline.create("DEF-027-E0-DEMO"))
    assert run["status"] == "complete"
    understand = next(
        value for value in run["events"]
        if value["stage"] == "understand" and value["status"] == "completed"
    )
    assert understand["implementation"] == "deterministic_reference_oracle"
    assert understand["model"] is None
    assert run["result"]["audit"]["canonicalization"]["mode"] == "deterministic_reference"


def test_model_mode_retains_process_owned_visual_locator_and_passes_grounding(tmp_path: Path):
    oracle_storage = Storage(str(tmp_path / "oracle.db"))
    oracle = ClaimPipeline(oracle_storage, pace_seconds=0)
    oracle_result = wait(oracle_storage, oracle.create("DEF-027-E0-DEMO"))["result"]
    oracle_facts = oracle_result["facts"]
    proposed_noncontrolling_id = next(
        value["fact_id"]
        for value in oracle_facts
        if value["controls_process"] is False
    )
    raw_facts = provider_fact_proposals(oracle_facts)
    next(
        value for value in raw_facts if value["fact_id"] == proposed_noncontrolling_id
    )["normalized_value"] = "urgent"

    def transport(_url, _headers, _payload, _timeout):
        return {
            "id": "mock-flagship-model-call",
            "model": OPENROUTER_MODEL,
            "provider": "mock-upstream-provider",
            "choices": [{"finish_reason": "stop", "message": {"content": json.dumps({"facts": raw_facts})}}],
            "usage": {
                "prompt_tokens": 1000,
                "completion_tokens": 2500,
                "total_tokens": 3500,
                "cost": 0.01,
            },
        }

    model_storage = Storage(str(tmp_path / "model.db"))
    canonicalizer = OpenRouterNemotronCanonicalizer(
        model_storage,
        transport=transport,
        api_key_provider=lambda: "runtime-only-test-value",
    )
    pipeline = ClaimPipeline(
        model_storage,
        model_mode=MODEL_MODE_OPENROUTER,
        canonicalizer=canonicalizer,
        agent_orchestrator=StubAgentOrchestrator(),
        pace_seconds=0,
    )
    run = wait(model_storage, pipeline.create("DEF-027-E0-DEMO"))
    assert run["status"] == "complete", run.get("error")
    visual_refs = [
        ref for value in run["result"]["facts"] for ref in value["source_refs"]
        if ref["locator_kind"] == "visual_observation"
    ]
    assert visual_refs
    assert {ref["agent"] for ref in visual_refs} == {"Visual Evidence Agent"}
    noncontrolling_fact = next(
        value
        for value in run["result"]["facts"]
        if value["fact_id"] == proposed_noncontrolling_id
    )
    assert noncontrolling_fact["normalized_value"] is None
    assert noncontrolling_fact["decision_value"] is None
    assert run["result"]["process"]["current_node"] == oracle_result["process"]["current_node"]
    diagnostics = run["result"]["audit"]["canonicalization"]["diagnostics"]
    assert diagnostics["authority_mode"] == "hybrid_guarded"
    assert diagnostics["accepted_fact_ids"] == [value["fact_id"] for value in oracle_facts]
    assert diagnostics["accepted_fact_count"] == len(oracle_facts)
    assert diagnostics["rejected_facts"] == []
    assert diagnostics["rejected_fact_count"] == 0
    assert diagnostics["ignored_noncontrolling_normalized_proposals"] == 1
    assert "Model-assisted hybrid canonicalization" in run["result"]["summary"]
    assert "deterministic fallback replaced 0 rejected proposals" in run["result"]["summary"]
    assert run["result"]["verification"]["valid"] is True
    scope_node = next(
        item for item in run["result"]["process"]["nodes"] if item["node_id"] == "scope"
    )
    assert scope_node["agent_decision_contributions"][0]["confidence_basis_points"] == 8200
    assert scope_node["agent_decision_contributions"][0]["attribution"] == (
        "Process Decision Mapping Agent"
    )
    assert run["result"]["checklist"]["items"][0]["agent_contribution"]["confidence_basis_points"] == 8300
    assert run["result"]["next_action"]["agent_brief_contribution"]["confidence_basis_points"] == 8400
    assert run["result"]["audit"]["canonicalization"]["mode"] == MODEL_MODE_OPENROUTER
    assert run["result"]["audit"]["canonicalization"]["authority_mode"] == "hybrid_guarded"
    gates = {
        item["agent_id"]: item
        for item in run["result"]["agent_orchestration"]["deterministic_gates"]
    }
    assert gates["deterministic_process_gate"]["output_artifact_hash"] == (
        accepted_artifact_hash(run["result"]["process"])
    )
    assert gates["deterministic_evidence_gate"]["output_artifact_hash"] == (
        accepted_artifact_hash(run["result"]["checklist"])
    )
    assert gates["whole_playbook_gate"]["output_artifact_hash"] == (
        accepted_artifact_hash(run["result"]["agent_orchestration"]["final_claim_brief"])
    )
    assert all(
        item["acceptance_scope"] == "pre_review_model_output"
        for item in run["result"]["agent_orchestration"]["agents"]
    )
    assert model_storage.model_calls()[0]["outcome"] == "succeeded"


def test_production_shaped_canonical_source_projection_succeeds_17_to_1(tmp_path: Path):
    oracle_storage = Storage(str(tmp_path / "oracle-projection.db"))
    oracle = ClaimPipeline(oracle_storage, pace_seconds=0)
    oracle_result = wait(oracle_storage, oracle.create("DEF-027-E0-DEMO"))["result"]
    proposals = provider_fact_proposals(oracle_result["facts"])
    text_grounded_fact_ids = {
        value["fact_id"]
        for value in oracle_result["facts"]
        if any(ref["locator_kind"] == "text_quote" for ref in value["source_refs"])
    }
    for proposal in proposals:
        if proposal["fact_id"] in text_grounded_fact_ids:
            proposal["source_ref_ids"] = []
    next(
        value for value in proposals if value["fact_id"] == "fact_date_conflict"
    )["state"] = "known"

    def transport(_url, _headers, _payload, _timeout):
        return {
            "id": "mock-production-shaped-projection",
            "model": OPENROUTER_MODEL,
            "provider": "mock-upstream-provider",
            "choices": [
                {
                    "finish_reason": "stop",
                    "message": {"content": json.dumps({"facts": proposals})},
                }
            ],
            "usage": {
                "prompt_tokens": 23141,
                "completion_tokens": 1931,
                "total_tokens": 25072,
                "cost": 0.0157931,
            },
        }

    model_storage = Storage(str(tmp_path / "model-projection.db"))
    pipeline = ClaimPipeline(
        model_storage,
        model_mode=MODEL_MODE_OPENROUTER,
        canonicalizer=OpenRouterNemotronCanonicalizer(
            model_storage,
            transport=transport,
            api_key_provider=lambda: "runtime-only-test-value",
        ),
        agent_orchestrator=StubAgentOrchestrator(),
        pace_seconds=0,
    )
    run = wait(model_storage, pipeline.create("DEF-027-E0-DEMO"))
    assert run["status"] == "complete", run.get("error")
    diagnostics = run["result"]["audit"]["canonicalization"]["diagnostics"]
    assert diagnostics["accepted_fact_count"] == 17
    assert diagnostics["rejected_facts"] == [
        {"fact_id": "fact_date_conflict", "invariant": "canonical_state"}
    ]
    assert diagnostics["rejected_fact_count"] == 1
    expected_projections = sorted(text_grounded_fact_ids - {"fact_date_conflict"})
    assert sorted(diagnostics["source_reference_projection_fact_ids"]) == (
        expected_projections
    )
    assert diagnostics["source_reference_projection_count"] == 10
    oracle_by_id = {value["fact_id"]: value for value in oracle_result["facts"]}
    model_by_id = {value["fact_id"]: value for value in run["result"]["facts"]}
    for fact_id in expected_projections:
        assert sorted(
            json.dumps(ref, sort_keys=True) for ref in model_by_id[fact_id]["source_refs"]
        ) == sorted(
            json.dumps(ref, sort_keys=True) for ref in oracle_by_id[fact_id]["source_refs"]
        )
    assert "projected 10 authoritative citation sets" in run["result"]["summary"]
    ledger = model_storage.model_calls()[0]
    assert ledger["outcome"] == "succeeded_with_guarded_fallback"
    assert ledger["accepted_fact_count"] == 17
    assert ledger["source_reference_projection_count"] == 10


def test_hybrid_rejected_controlling_fact_uses_exact_oracle_fallback(tmp_path: Path):
    oracle_storage = Storage(str(tmp_path / "oracle.db"))
    oracle = ClaimPipeline(oracle_storage, pace_seconds=0)
    oracle_result = wait(oracle_storage, oracle.create("DEF-027-E0-DEMO"))["result"]
    proposals = provider_fact_proposals(oracle_result["facts"])
    rejected_proposal = next(value for value in proposals if value["fact_id"] == "fact_dispute")
    rejected_proposal["state"] = "unknown"
    accepted_proposal = next(value for value in proposals if value["fact_id"] == "fact_tenancy")
    accepted_proposal["confidence"] = 0.41

    def transport(_url, _headers, _payload, _timeout):
        return {
            "id": "mock-hybrid-fallback-call",
            "model": OPENROUTER_MODEL,
            "provider": "mock-upstream-provider",
            "choices": [
                {
                    "finish_reason": "stop",
                    "message": {"content": json.dumps({"facts": proposals})},
                }
            ],
            "usage": {
                "prompt_tokens": 1000,
                "completion_tokens": 2400,
                "total_tokens": 3400,
                "cost": 0.01,
            },
        }

    model_storage = Storage(str(tmp_path / "model.db"))
    pipeline = ClaimPipeline(
        model_storage,
        model_mode=MODEL_MODE_OPENROUTER,
        canonicalizer=OpenRouterNemotronCanonicalizer(
            model_storage,
            transport=transport,
            api_key_provider=lambda: "runtime-only-test-value",
        ),
        agent_orchestrator=StubAgentOrchestrator(),
        pace_seconds=0,
    )
    run = wait(model_storage, pipeline.create("DEF-027-E0-DEMO"))
    assert run["status"] == "complete", run.get("error")
    result = run["result"]
    oracle_facts = {value["fact_id"]: value for value in oracle_result["facts"]}
    hybrid_facts = {value["fact_id"]: value for value in result["facts"]}
    assert hybrid_facts["fact_dispute"] == oracle_facts["fact_dispute"]
    assert hybrid_facts["fact_tenancy"]["confidence"] == 0.41
    assert {
        ref["agent"]
        for ref in hybrid_facts["fact_tenancy"]["source_refs"]
        if ref["locator_kind"] == "text_quote"
    } == {"OpenRouter Nemotron Canonicalizer"}
    assert result["process"]["current_overlay"] == oracle_result["process"]["current_overlay"]
    assert [
        (item["source"], item["target"], item["state"])
        for item in result["process"]["edges"]
    ] == [
        (item["source"], item["target"], item["state"])
        for item in oracle_result["process"]["edges"]
    ]
    assert result["process"]["agent_contribution"]["deterministic_route_unchanged"] is True
    assert result["checklist"]["agent_contribution"]["deterministic_statuses_unchanged"] is True
    assert result["verification"]["valid"] is True
    assert result["verification"]["computed"] is True
    assert len(result["verification"]["checks"]) == 8
    diagnostics = result["audit"]["canonicalization"]["diagnostics"]
    assert diagnostics["authority_mode"] == "hybrid_guarded"
    assert diagnostics["accepted_fact_count"] == len(proposals) - 1
    assert diagnostics["rejected_facts"] == [
        {"fact_id": "fact_dispute", "invariant": "canonical_state"}
    ]
    assert diagnostics["rejected_fact_count"] == 1
    assert "Model-assisted hybrid canonicalization" in result["summary"]
    assert "deterministic fallback replaced 1 rejected proposals" in result["summary"]
    ledger = model_storage.model_calls()[0]
    assert ledger["outcome"] == "succeeded_with_guarded_fallback"
    assert ledger["authority_mode"] == "hybrid_guarded"
    assert ledger["rejected_facts"] == diagnostics["rejected_facts"]


def test_late_specialist_failure_keeps_bounded_partial_truth_and_no_final_result(
    tmp_path: Path,
):
    oracle_storage = Storage(str(tmp_path / "oracle-late.db"))
    oracle_pipeline = ClaimPipeline(oracle_storage, pace_seconds=0)
    oracle_result = wait(
        oracle_storage, oracle_pipeline.create("DEF-027-E0-DEMO")
    )["result"]
    raw_facts = provider_fact_proposals(oracle_result["facts"])

    def transport(*_args):
        return {
            "id": "gen-late-failure",
            "model": OPENROUTER_MODEL,
            "provider": "MockProvider",
            "choices": [
                {
                    "finish_reason": "stop",
                    "message": {"content": json.dumps({"facts": raw_facts})},
                }
            ],
            "usage": {
                "prompt_tokens": 100,
                "completion_tokens": 200,
                "total_tokens": 300,
                "cost": 0.002,
            },
        }

    class FailingOrchestrator:
        def invoke(self, **values):
            failure = AgentInvocationFailure(
                "evidence_checklist",
                "invalid_provenance",
                safe_context={
                    "call_id": "modelcall-failed-specialist",
                    "parent_call_id": "modelcall-plan",
                    "response_id": "gen-failed-specialist",
                    "response_model": OPENROUTER_MODEL,
                    "upstream_provider": "MockProvider",
                    "usage_source": "response",
                    "finish_reason": "stop",
                    "outcome": "failed",
                    "invalid_provenance_field": "response_model",
                    "invalid_provenance_value_hash": "2" * 64,
                },
            )
            values["progress_sink"](
                    {
                        "receipt_type": "agent_failed",
                        "acceptance_scope": "pre_review_model_output",
                        "agent_id": "evidence_checklist",
                    "role": "Evidence and Checklist Agent",
                    "actor_type": "nemotron_agent",
                    "status": "failed",
                    "delegation_id": "dlg-failed",
                    "call_id": "modelcall-failed-specialist",
                    "parent_call_id": "modelcall-plan",
                    "response_id": "gen-failed-specialist",
                    "response_model": OPENROUTER_MODEL,
                    "upstream_provider": "MockProvider",
                    "usage_source": "response",
                    "outcome": "failed",
                    "error_type": "AgentInvocationFailure",
                    "error_invariant": "invalid_provenance",
                    "invalid_provenance_field": "response_model",
                    "invalid_provenance_value_hash": "2" * 64,
                    "input_artifact_hash": "1" * 64,
                    "handoff_from": "deterministic_process_gate",
                    "handoff_to": "failure_boundary",
                }
            )
            raise failure

    storage = Storage(str(tmp_path / "late.db"))
    pipeline = ClaimPipeline(
        storage,
        model_mode=MODEL_MODE_OPENROUTER,
        canonicalizer=OpenRouterNemotronCanonicalizer(
            storage,
            transport=transport,
            api_key_provider=lambda: "runtime-only-test-value",
        ),
        agent_orchestrator=FailingOrchestrator(),
        pace_seconds=0,
    )
    run = wait(storage, pipeline.create("DEF-027-E0-DEMO"))
    assert run["status"] == "failed"
    assert "result" not in run
    assert run["accepted_state"] == {
        "canonical_state_prepared": True,
        "process_candidate_prepared": True,
        "evidence_candidate_prepared": True,
        "final_playbook_accepted": False,
    }
    assert "process_candidate" in run and "checklist_candidate" in run
    failed_receipt = next(
        item
        for item in run["events"]
        if item.get("receipt_type") == "agent_failed"
        and item.get("agent_id") == "evidence_checklist"
    )
    assert failed_receipt["headline"] == "Bounded specialist call failed closed"
    assert failed_receipt["acceptance_scope"] == "pre_review_model_output"
    assert failed_receipt["call_id"] == "modelcall-failed-specialist"
    assert failed_receipt["error_invariant"] == "invalid_provenance"
    assert failed_receipt["invalid_provenance_field"] == "response_model"
    assert failed_receipt["invalid_provenance_value_hash"] == "2" * 64
    terminal = run["events"][-1]
    assert terminal["headline"] == "No final playbook was accepted"
    assert terminal["accepted_state"] == run["accepted_state"]
    assert "raw-provider-detail" not in json.dumps(run).lower()


def test_canonical_paid_failure_emits_joinable_safe_agent_receipt(tmp_path: Path):
    def transport(*_args):
        return {
            "id": "gen-canonical-wrong-model",
            "model": "different/model",
            "provider": "MockProvider",
            "choices": [
                {
                    "finish_reason": "stop",
                    "message": {"content": json.dumps({"facts": []})},
                }
            ],
            "usage": {
                "prompt_tokens": 20,
                "completion_tokens": 10,
                "total_tokens": 30,
                "cost": 0.003,
            },
        }

    storage = Storage(str(tmp_path / "canonical-failure.db"))
    pipeline = ClaimPipeline(
        storage,
        model_mode=MODEL_MODE_OPENROUTER,
        canonicalizer=OpenRouterNemotronCanonicalizer(
            storage,
            transport=transport,
            api_key_provider=lambda: "runtime-only-test-value",
        ),
        agent_orchestrator=StubAgentOrchestrator(),
        pace_seconds=0,
    )
    run = wait(storage, pipeline.create("DEF-027-E0-DEMO"))
    assert run["status"] == "failed"
    ledger = storage.model_calls()[0]
    receipt = next(
        item
        for item in run["events"]
        if item.get("receipt_type") == "agent_failed"
        and item.get("agent_id") == "canonical_facts"
    )
    assert receipt["call_id"] == ledger["call_id"]
    assert receipt["response_id"] == ledger["response_id"]
    assert receipt["response_model"] is None
    assert "response_model" not in ledger
    assert receipt["upstream_provider"] == ledger["upstream_provider"]
    assert receipt["usage_source"] == ledger["usage_source"] == "response"
    assert receipt["outcome"] == ledger["outcome"] == "failed"
    assert receipt["error_invariant"] == ledger["error_invariant"] == "invalid_provenance"
    assert receipt["invalid_provenance_field"] == ledger[
        "invalid_provenance_field"
    ] == "response_model"
    assert receipt["invalid_provenance_value_hash"] == ledger[
        "invalid_provenance_value_hash"
    ]
    assert len(receipt["invalid_provenance_value_hash"]) == 64
    assert receipt["failure_scope"] == "root_canonical_facts"
    assert receipt["root_agent"] is True
    assert receipt["input_artifact"] == "observable_claim_package"
    assert receipt["input_artifact_hash"] == digest(
        observable_claim_package(CLAIMS["DEF-027-E0-DEMO"])
    )
    assert receipt["orchestration_id"] == ledger["orchestration_id"]
    assert receipt["parent_call_id"] is None
    assert receipt["delegation_id"] is None
    assert receipt["provider"] == "openrouter"
    assert receipt["requested_model"] == OPENROUTER_MODEL
    assert receipt["call_count"] == 1
    assert receipt["handoff_from"] == "observable_claim_package"
    assert receipt["handoff_to"] == "failure_boundary"
    specialist_failures = [
        item
        for item in run["events"]
        if item.get("receipt_type") == "agent_failed"
        and item.get("failure_scope") != "root_canonical_facts"
    ]
    assert specialist_failures == []
    terminal = run["events"][-1]
    assert terminal.get("receipt_type") is None
    assert terminal["actor_type"] == "deterministic_gate"
    assert ledger["actual_cost_usd"] == pytest.approx(0.003)
    serialized = json.dumps(run)
    assert "different/model" not in run["error"]
    assert "different/model" not in serialized
    assert "different/model" not in json.dumps(ledger)
    for forbidden in (
        "raw_output",
        "provider_payload",
        "messages",
        "reasoning",
        "runtime-only-test-value",
    ):
        assert forbidden not in serialized


def test_canonical_root_blocked_receipt_has_explicit_safe_invariant(tmp_path: Path):
    storage = Storage(str(tmp_path / "canonical-blocked.db"))
    pipeline = ClaimPipeline(
        storage,
        model_mode=MODEL_MODE_OPENROUTER,
        canonicalizer=OpenRouterNemotronCanonicalizer(
            storage,
            transport=lambda *_args: (_ for _ in ()).throw(
                AssertionError("credential gate must prevent transport")
            ),
            api_key_provider=lambda: None,
        ),
        agent_orchestrator=StubAgentOrchestrator(),
        pace_seconds=0,
    )
    run = wait(storage, pipeline.create("DEF-027-E0-DEMO"))
    receipt = next(
        item
        for item in run["events"]
        if item.get("failure_scope") == "root_canonical_facts"
    )
    assert receipt["error_invariant"] == "missing_credential"
    assert receipt["outcome"] == "blocked_missing_credential"
    assert receipt["call_count"] == 0
    assert receipt["response_id"] is None
    assert receipt["parent_call_id"] is None
    assert receipt["delegation_id"] is None
    assert run["failure_stage"] == "canonical_facts"
    assert run["error"].endswith(": missing_credential")


def test_flagship_fact_contract_fits_single_bounded_model_response(runtime):
    storage, pipeline = runtime
    run = wait(storage, pipeline.create("DEF-027-E0-DEMO"))
    facts = run["result"]["facts"]
    compact = json.dumps({"facts": facts}, ensure_ascii=False, separators=(",", ":"))
    conservative_tokens = math.ceil(len(compact.encode("utf-8")) / 3)
    assert len(facts) == 18
    assert conservative_tokens < MAX_OUTPUT_TOKENS == 4000
