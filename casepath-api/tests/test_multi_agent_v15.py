from __future__ import annotations

from collections import defaultdict
import json
from pathlib import Path
import threading
import time
from typing import Any

import httpx
from langchain_core.messages import AIMessage, HumanMessage
from langsmith.run_helpers import tracing_context
from openrouter import OpenRouter, components, errors
from openrouter.utils.unmarshal_json_response import unmarshal_json_response
import pytest

from casepath_api import canonicalizer as canonicalizer_module
from casepath_api import langchain_runtime
from casepath_api.canonicalizer import OPENROUTER_MODEL
from casepath_api.canonicalizer import resolve_observable_source_reference_id
from casepath_api.data import CLAIMS, observable_claim_package
from casepath_api.multi_agent import (
    AI_AGENT_IDS,
    AgentBoundaryError,
    AgentInvocationFailure,
    DETERMINISTIC_GATE_IDS,
    EVIDENCE_STATUS_CANDIDATES,
    InstrumentedStructuredAgent,
    NemotronMultiAgentOrchestrator,
    OrchestratorPlan,
    ROLE_OUTPUT_TOKENS,
    _evidence_provider_payload,
    _final_brief_provider_payload,
    _plan_validator,
    _source_registry,
    accepted_artifact_hash,
)
from casepath_api.pipeline_v15 import ClaimPipeline
from casepath_api.storage import Storage


def wait(storage: Storage, run_id: str) -> dict[str, Any]:
    for _ in range(500):
        run = storage.get_run(run_id)
        if run and run["status"] in {"complete", "failed"}:
            return run
        time.sleep(0.01)
    raise AssertionError("run timeout")


def oracle_result(tmp_path: Path) -> dict[str, Any]:
    storage = Storage(str(tmp_path / "oracle.db"))
    pipeline = ClaimPipeline(storage, pace_seconds=0)
    run = wait(storage, pipeline.create("DEF-027-E0-DEMO"))
    assert run["status"] == "complete", run.get("error")
    return run["result"]


class FakeStructuredRunnable:
    def __init__(
        self,
        *,
        agent_id: str,
        schema,
        response: dict[str, Any],
        captures: dict[str, list[dict[str, Any]]],
        fanout_barrier: threading.Barrier,
    ):
        self.agent_id = agent_id
        self.schema = schema
        self.response = response
        self.captures = captures
        self.fanout_barrier = fanout_barrier

    def invoke(self, messages, config=None):
        payload = json.loads(messages[-1].content)
        self.captures[self.agent_id].append(payload)
        if self.agent_id in {"document_source_integrity", "process_decision_mapping"}:
            self.fanout_barrier.wait(timeout=2)
            time.sleep(0.02)
        parsed = self.schema.model_validate(self.response)
        raw = AIMessage(
            content="",
            response_metadata={
                "id": f"gen-{self.agent_id}",
                "model_name": OPENROUTER_MODEL,
                "finish_reason": "stop",
                "provider_name": "DeepInfra",
                "usage": {
                    "prompt_tokens": 100,
                    "completion_tokens": 40,
                    "total_tokens": 140,
                    "cost": 0.001,
                },
            },
            usage_metadata={"input_tokens": 100, "output_tokens": 40, "total_tokens": 140},
        )
        return {"raw": raw, "parsed": parsed, "parsing_error": None}


def graph_fixture(tmp_path: Path):
    result = oracle_result(tmp_path)
    facts = result["facts"]
    process = result["process"]
    checklist = result["checklist"]
    package = observable_claim_package(CLAIMS["DEF-027-E0-DEMO"])
    registry = _source_registry(package)
    refs_by_artifact: dict[str, list[str]] = defaultdict(list)
    for ref in registry:
        refs_by_artifact[ref["artifact_id"]].append(ref["source_ref_id"])
    source_proposals = []
    for artifact in package["artifacts"]:
        source_proposals.append(
            {
                "artifact_id": artifact["artifact_id"],
                "integrity_class": (
                    "visual_only"
                    if artifact["media_type"].startswith("image/")
                    else "text_grounded"
                ),
                "source_ref_ids": (
                    sorted(refs_by_artifact[artifact["artifact_id"]])[:1]
                    if not artifact["media_type"].startswith("image/")
                    else []
                ),
                "confidence": 0.81,
            }
        )
    controlling = [fact for fact in facts if fact["controls_process"] is True]
    process_proposals = [
        {
            "fact_id": fact["fact_id"],
            "state": fact["state"],
            "normalized_value": fact["normalized_value"],
            "source_ref_ids": sorted(
                resolve_observable_source_reference_id(ref, registry)
                for ref in fact["source_refs"]
                if ref["locator_kind"] == "text_quote"
            ),
            "confidence": 0.82,
        }
        for fact in controlling
    ]
    facts_by_id = {fact["fact_id"]: fact for fact in facts}
    evidence_proposals = [
        {
            "item_id": item["item_id"],
            "status": item["status"],
            "artifact_ids": sorted(item.get("artifact_ids", [])),
            "source_ref_ids": sorted(
                resolve_observable_source_reference_id(ref, registry)
                for ref in facts_by_id[item["fact_id"]]["source_refs"]
                if ref["locator_kind"] == "text_quote"
            ),
            "confidence": 0.83,
        }
        for item in checklist["items"]
    ]
    current = process["current_overlay"]
    current_node = next(
        node for node in process["nodes"] if node["node_id"] == current["current_node_id"]
    )
    final_source_ids = sorted(
        {
            resolve_observable_source_reference_id(ref, registry)
            for fact in facts
            if fact["fact_id"] in current_node.get("fact_ids", [])
            for ref in fact["source_refs"]
            if ref["locator_kind"] == "text_quote"
        }
    )
    responses = {
        "orchestrator_plan": {
            "priority_fact_ids": [fact["fact_id"] for fact in facts[:6]],
            "priority_task_codes": [
                "source_integrity",
                "process_decisions",
                "evidence_gaps",
                "final_brief",
            ],
        },
        "document_source_integrity": {"proposals": source_proposals},
        "process_decision_mapping": {"proposals": process_proposals},
        "evidence_checklist": {"proposals": evidence_proposals},
        "final_claim_brief_audit": {
            "proposal": {
                "current_node_id": current["current_node_id"],
                "next_action_node_id": current["next_action_node_id"],
                "source_ref_ids": final_source_ids,
                "confidence": 0.84,
            }
        },
    }
    captures: dict[str, list[dict[str, Any]]] = defaultdict(list)
    barrier = threading.Barrier(2)

    def factory(agent_id, schema, _key, _orchestration_id, _max_tokens):
        return FakeStructuredRunnable(
            agent_id=agent_id,
            schema=schema,
            response=responses[agent_id],
            captures=captures,
            fanout_barrier=barrier,
        )

    storage = Storage(str(tmp_path / "agents.db"))
    runner = InstrumentedStructuredAgent(
        storage,
        runnable_factory=factory,
        api_key_provider=lambda: "runtime-only-test-value",
    )
    orchestrator = NemotronMultiAgentOrchestrator(storage, agent_runner=runner)
    canonicalization = {
        "model": OPENROUTER_MODEL,
        "call_id": "modelcall-canonical",
        "cache_hit": False,
        "origin_call_id": "modelcall-canonical",
        "response_id": "gen-canonical",
        "response_model": OPENROUTER_MODEL,
        "upstream_provider": "DeepInfra",
        "usage_source": "response",
        "finish_reason": "stop",
        "usage": {
            "prompt_tokens": 100,
            "completion_tokens": 40,
            "total_tokens": 140,
            "actual_cost_usd": 0.001,
            "usage_source": "response",
        },
        "diagnostics": {
            "accepted_fact_ids": [fact["fact_id"] for fact in facts],
            "accepted_fact_count": len(facts),
            "rejected_facts": [],
            "rejected_fact_count": 0,
        },
    }
    return orchestrator, storage, captures, responses, package, canonicalization, result


def test_compiled_langgraph_fanout_join_and_bounded_payloads(tmp_path: Path):
    (
        orchestrator,
        storage,
        captures,
        responses,
        package,
        canonicalization,
        result,
    ) = graph_fixture(tmp_path)
    receipts: list[dict[str, Any]] = []
    audit = orchestrator.invoke(
        run_id="run-graph-test",
        orchestration_id="orch-graph-test",
        observable_package=package,
        canonicalization=canonicalization,
        facts=result["facts"],
        process=result["process"],
        checklist=result["checklist"],
        verification=result["verification"],
        progress_sink=receipts.append,
    )

    assert audit["all_required_agents_contributed"] is True
    assert {item["agent_id"] for item in audit["agents"]} == set(AI_AGENT_IDS)
    assert {item["agent_id"] for item in audit["deterministic_gates"]} == set(
        DETERMINISTIC_GATE_IDS
    )
    assert all(item["actor_type"] == "nemotron_agent" for item in audit["agents"])
    assert all(
        item["acceptance_scope"] == "pre_review_model_output"
        for item in audit["agents"]
    )
    assert all(item["provider"] == "openrouter" for item in audit["agents"])
    assert all(item["requested_model"] == OPENROUTER_MODEL for item in audit["agents"])
    assert all(item["response_id"] for item in audit["agents"])
    assert all(item["finish_reason"] == "stop" for item in audit["agents"])
    assert all(item["usage"]["total_tokens"] > 0 for item in audit["agents"])
    assert audit["execution_topology"] == {
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
            ["document_source_integrity", "process_decision_mapping"]
        ],
    }
    plan_artifact = audit["specialist_artifacts"]["orchestrator_plan"]
    fact_ids = [item["fact_id"] for item in result["facts"]]
    assert len(fact_ids) == 18
    assert plan_artifact["contribution_type"] == "constrained_focus_prioritization"
    assert plan_artifact["model_priority_fact_ids"] == fact_ids[:6]
    assert plan_artifact["model_priority_attribution"] == "Nemotron Orchestrator"
    assert plan_artifact["model_priority_task_codes"] == plan_artifact[
        "priority_task_codes"
    ]
    assert "attribution" not in plan_artifact
    assert plan_artifact["focus_fact_ids"] == fact_ids
    assert len(plan_artifact["focus_source_ref_ids"]) == 5
    assert plan_artifact["deterministic_coverage"] == {
        "fact_ids": fact_ids[6:],
        "source_ref_ids": plan_artifact["focus_source_ref_ids"],
        "required_text_artifact_ids": [
            "art_delivery",
            "art_lease",
            "art_management_reply",
            "art_notification",
            "art_timeline",
        ],
        "attribution": "deterministic_application",
    }
    plan_audit = next(
        item for item in audit["agents"] if item["agent_id"] == "orchestrator_plan"
    )
    assert plan_audit["model_priority_fact_ids"] == fact_ids[:6]
    assert plan_audit["model_priority_task_codes"] == plan_artifact[
        "priority_task_codes"
    ]
    assert plan_audit["derived_focus_fact_ids"] == fact_ids
    assert plan_audit["derived_focus_source_ref_ids"] == plan_artifact[
        "focus_source_ref_ids"
    ]
    assert plan_audit["deterministic_coverage"] == plan_artifact[
        "deterministic_coverage"
    ]
    assert "delegations" not in plan_artifact
    assert "parallel_groups" not in plan_artifact
    assert audit["external_tracing"] is False
    assert set(audit["specialist_artifacts"]) == {
        "orchestrator_plan",
        "document_source_integrity",
        "process_decision_mapping",
        "evidence_checklist",
        "final_claim_brief_audit",
    }
    assert any(item["receipt_type"] == "gate_passed" for item in receipts)
    assert all("reasoning" not in json.dumps(item).lower() for item in receipts)
    completed_receipts = [
        item for item in receipts if item.get("receipt_type") == "agent_completed"
    ]
    assert len(completed_receipts) == 5
    assert all(
        item["acceptance_scope"] == "pre_review_model_output"
        for item in completed_receipts
    )

    process_payload = captures["process_decision_mapping"][0]
    assert all("state" not in item and "normalized_value" not in item for item in process_payload["fact_candidates"])
    assert all(len(item["allowed_normalized_values"]) > 1 for item in process_payload["fact_candidates"])
    evidence_payload = captures["evidence_checklist"][0]
    assert evidence_payload["allowed_statuses"] == EVIDENCE_STATUS_CANDIDATES
    assert all("status" not in item and "artifact_ids" not in item for item in evidence_payload["evidence_candidates"])
    final_payload = captures["final_claim_brief_audit"][0]
    assert "current_node_id" not in final_payload
    assert "next_action_node_id" not in final_payload
    assert "checklist_artifacts" not in final_payload
    assert "verification_artifacts" not in final_payload
    topology = final_payload["static_process_topology"]
    assert all("answer" not in item and "state" not in item for item in topology["nodes"])
    assert all("state" not in branch for item in topology["nodes"] for branch in item["branches"])
    assert all("state" not in item for item in topology["edges"])
    assert len(topology["edges"]) == len(result["process"]["edges"]) == 22
    assert len(
        {
            (item["source"], item["target"], item["condition"])
            for item in topology["edges"]
        }
    ) == 22
    serialized_payloads = json.dumps(captures, sort_keys=True)
    plan_payload = captures["orchestrator_plan"][0]
    assert set(responses["orchestrator_plan"]) == {
        "priority_fact_ids",
        "priority_task_codes",
    }
    plan_schema = OrchestratorPlan.model_json_schema()
    assert set(plan_schema["properties"]) == {
        "priority_fact_ids",
        "priority_task_codes",
    }
    assert plan_schema["properties"]["priority_fact_ids"] == {
        "items": {"type": "string"},
        "maxItems": 6,
        "minItems": 1,
        "title": "Priority Fact Ids",
        "type": "array",
        "uniqueItems": True,
    }
    assert plan_schema["properties"]["priority_task_codes"]["maxItems"] == 4
    assert plan_schema["properties"]["priority_task_codes"]["minItems"] == 4
    assert plan_schema["properties"]["priority_task_codes"]["uniqueItems"] is True
    assert set(plan_payload) == {
        "schema_version",
        "max_priority_fact_count",
        "fact_candidates",
        "task_codes",
    }
    assert len(plan_payload["fact_candidates"]) == 18
    assert len(_source_registry(package)) == 356
    assert "source_reference_candidates" not in plan_payload
    assert "source_ref_id" not in json.dumps(plan_payload, sort_keys=True)
    assert len(json.dumps(plan_payload, separators=(",", ":")).encode()) < 2_000
    for private_name in (
        "expected_state",
        "canonical_value",
        "canonical_explanation",
        "required_text_reference_count",
        "required_source_reference_count",
        "expected_status",
        "expected_artifact_ids",
        "expected_current_node_id",
        "expected_next_action_node_id",
    ):
        assert private_name not in serialized_payloads

    specialist_artifacts = audit["specialist_artifacts"]
    assert specialist_artifacts["process_decision_mapping"]["decisions"][0][
        "confidence_basis_points"
    ] == 8200
    assert specialist_artifacts["evidence_checklist"]["items"][0][
        "confidence_basis_points"
    ] == 8300
    assert specialist_artifacts["final_claim_brief_audit"][
        "confidence_basis_points"
    ] == 8400
    assert specialist_artifacts["final_claim_brief_audit"][
        "input_contribution_ids"
    ] == [
        "document_source_integrity",
        "process_decision_mapping",
        "evidence_checklist",
    ]
    assert specialist_artifacts["final_claim_brief_audit"][
        "lineage_authority"
    ] == "deterministic_application"

    calls = storage.model_calls()
    assert len(calls) == 5
    assert all(item["call_count"] == 1 for item in calls)
    plan_call = next(item for item in calls if item["agent_id"] == "orchestrator_plan")
    workers = [item for item in calls if item["agent_id"] != "orchestrator_plan"]
    assert all(item["parent_call_id"] == plan_call["call_id"] for item in workers)
    assert all(item["delegation_id"].startswith("dlg_") for item in calls)
    assert all(item["actual_cost_usd"] == 0.001 for item in calls)


def test_evidence_payload_omits_poisoned_private_answers_and_plan_changes_order(
    tmp_path: Path,
):
    (
        _orchestrator,
        _storage,
        _captures,
        _responses,
        package,
        _canonicalization,
        result,
    ) = graph_fixture(tmp_path)
    registry = _source_registry(package)
    text_artifacts = {
        item["artifact_id"]
        for item in package["artifacts"]
        if item["media_type"] in {"application/pdf", "message/rfc822"}
    }
    focused_sources: list[str] = []
    for artifact_id in sorted(text_artifacts):
        focused_sources.append(
            next(
                item["source_ref_id"]
                for item in registry
                if item["artifact_id"] == artifact_id
            )
        )
    poisoned = json.loads(json.dumps(result["checklist"]))
    for item in poisoned["items"]:
        item["why"] = "PRIVATE_WHY_SENTINEL"
        item["status"] = "PRIVATE_STATUS_SENTINEL"
        item["node_id"] = "PRIVATE_PATH_SENTINEL"
        item["current_path"] = "PRIVATE_APPLICABILITY_SENTINEL"
        item["artifact_ids"] = ["PRIVATE_EXPECTED_ARTIFACT_SENTINEL"]
    fact_ids = [item["fact_id"] for item in result["facts"]]
    task_codes = [
        "source_integrity",
        "process_decisions",
        "evidence_gaps",
        "final_brief",
    ]

    def payload(fact_order, task_order):
        return _evidence_provider_payload(
            {
                "orchestrator_plan": {
                    "focus_fact_ids": fact_order,
                    "focus_source_ref_ids": focused_sources,
                    "priority_task_codes": task_order,
                },
                "checklist": poisoned,
                "facts": result["facts"],
                "source_registry": registry,
                "observable_package": package,
            }
        )

    forward = payload(fact_ids, task_codes)
    reverse = payload(list(reversed(fact_ids)), list(reversed(task_codes)))
    serialized = json.dumps(forward, sort_keys=True)
    for sentinel in (
        "PRIVATE_WHY_SENTINEL",
        "PRIVATE_STATUS_SENTINEL",
        "PRIVATE_PATH_SENTINEL",
        "PRIVATE_APPLICABILITY_SENTINEL",
        "PRIVATE_EXPECTED_ARTIFACT_SENTINEL",
    ):
        assert sentinel not in serialized
    assert all(
        set(item) == {"item_id", "title", "fact_id"}
        for item in forward["evidence_candidates"]
    )
    assert {
        item["item_id"] for item in forward["evidence_candidates"]
    } == {item["item_id"] for item in reverse["evidence_candidates"]}
    assert forward["evidence_candidates"] != reverse["evidence_candidates"]
    assert forward["orchestrator_focus"]["task_code"] == "evidence_gaps"
    assert forward["orchestrator_focus"]["priority_rank"] == 2
    assert reverse["orchestrator_focus"]["priority_rank"] == 1


def test_final_audit_payload_ignores_applied_answers_but_tracks_prior_contributions(
    tmp_path: Path,
):
    (
        orchestrator,
        _storage,
        _captures,
        _responses,
        package,
        canonicalization,
        result,
    ) = graph_fixture(tmp_path)
    audit = orchestrator.invoke(
        run_id="run-final-payload",
        orchestration_id="orch-final-payload",
        observable_package=package,
        canonicalization=canonicalization,
        facts=result["facts"],
        process=result["process"],
        checklist=result["checklist"],
        verification=result["verification"],
    )
    artifacts = audit["specialist_artifacts"]
    state = {
        "orchestrator_plan": artifacts["orchestrator_plan"],
        "source_integrity": artifacts["document_source_integrity"],
        "process_mapping": artifacts["process_decision_mapping"],
        "evidence_checklist": artifacts["evidence_checklist"],
        "facts": result["facts"],
        "process": result["process"],
        "checklist": result["checklist"],
        "verification": result["verification"],
        "source_registry": _source_registry(package),
    }
    baseline = _final_brief_provider_payload(state)
    assert set(baseline) == {
        "orchestrator_focus",
        "static_process_topology",
        "canonical_fact_handoff",
        "prior_accepted_contributions",
        "source_reference_registry",
    }
    assert set(baseline["static_process_topology"]) == {
        "nodes",
        "edges",
        "evidence_bindings",
    }
    assert all(
        set(item) == {
            "node_id",
            "title",
            "kind",
            "main_spine",
            "fact_ids",
            "activation",
            "branches",
        }
        for item in baseline["static_process_topology"]["nodes"]
    )
    assert all(
        set(item) == {"source", "target", "condition"}
        for item in baseline["static_process_topology"]["edges"]
    )
    assert all(
        set(item) == {"item_id", "fact_id", "node_id"}
        for item in baseline["static_process_topology"]["evidence_bindings"]
    )
    poisoned = json.loads(json.dumps(state))
    poison_values = {
        "state": "PRIVATE_APPLIED_STATE_SENTINEL",
        "answer": "PRIVATE_APPLIED_ANSWER_SENTINEL",
        "why": "PRIVATE_APPLIED_WHY_SENTINEL",
        "status": "PRIVATE_APPLIED_STATUS_SENTINEL",
        "current_path": "PRIVATE_CURRENT_PATH_SENTINEL",
        "artifact_ids": ["PRIVATE_EXPECTED_ARTIFACT_SENTINEL"],
        "name": "PRIVATE_VERIFICATION_NAME_SENTINEL",
    }

    def recursively_poison(value):
        if isinstance(value, dict):
            return {
                key: poison_values[key]
                if key in poison_values
                else recursively_poison(item)
                for key, item in value.items()
            }
        if isinstance(value, list):
            return [recursively_poison(item) for item in value]
        return value

    poisoned["process"] = recursively_poison(poisoned["process"])
    poisoned["process"]["current_overlay"] = {
        "current_node_id": "PRIVATE_CURRENT_NODE_SENTINEL",
        "next_action_node_id": "PRIVATE_NEXT_NODE_SENTINEL",
    }
    poisoned["process"]["current_node"] = "PRIVATE_CURRENT_NODE_SENTINEL"
    poisoned["process"]["selected_path"] = ["PRIVATE_SELECTED_PATH_SENTINEL"]
    poisoned["checklist"] = recursively_poison(poisoned["checklist"])
    poisoned["verification"] = {
        "PRIVATE_VERIFICATION_OBJECT_SENTINEL": recursively_poison(
            poisoned["verification"]
        )
    }

    poisoned_payload = _final_brief_provider_payload(poisoned)
    assert poisoned_payload == baseline
    serialized = json.dumps(poisoned_payload, sort_keys=True)
    assert all(
        sentinel not in serialized
        for value in poison_values.values()
        for sentinel in ([value] if isinstance(value, str) else value)
    )
    for sentinel in (
        "PRIVATE_VERIFICATION_OBJECT_SENTINEL",
        "PRIVATE_CURRENT_NODE_SENTINEL",
        "PRIVATE_NEXT_NODE_SENTINEL",
        "PRIVATE_SELECTED_PATH_SENTINEL",
    ):
        assert sentinel not in serialized
    assert all("state" not in item for item in baseline["static_process_topology"]["nodes"])
    assert all("state" not in item for item in baseline["static_process_topology"]["edges"])
    assert all(
        "state" not in branch
        for item in baseline["static_process_topology"]["nodes"]
        for branch in item["branches"]
    )
    assert set(baseline["prior_accepted_contributions"]["evidence_checklist"]) == {
        "item_ids",
        "source_ref_ids",
        "fallback_item_ids",
    }
    assert "contribution_candidates" not in baseline
    assert "relied_on_contribution_ids" not in serialized

    unreferenced = json.loads(json.dumps(state))
    unreferenced["source_registry"].append(
        {
            "source_ref_id": "src_unreferenced_private_sentinel",
            "artifact_id": "PRIVATE_UNREFERENCED_ARTIFACT_SENTINEL",
            "page": 1,
            "excerpt": "PRIVATE_UNREFERENCED_EXCERPT_SENTINEL",
        }
    )
    assert _final_brief_provider_payload(unreferenced) == baseline

    counterfactual = json.loads(json.dumps(state))
    counterfactual["process_mapping"]["decisions"][0][
        "normalized_value"
    ] = "counterfactual_bounded_value"
    counterfactual_payload = _final_brief_provider_payload(counterfactual)
    assert counterfactual_payload["prior_accepted_contributions"][
        "process_decision_mapping"
    ] != baseline["prior_accepted_contributions"]["process_decision_mapping"]
    assert {
        key: value
        for key, value in counterfactual_payload.items()
        if key != "prior_accepted_contributions"
    } == {
        key: value
        for key, value in baseline.items()
        if key != "prior_accepted_contributions"
    }


def test_shared_langchain_adapter_has_exact_nonretrying_private_configuration(monkeypatch):
    sdk_kwargs: dict[str, Any] = {}
    chat_kwargs: dict[str, Any] = {}
    structured_kwargs: dict[str, Any] = {}

    class FakeProviderClient:
        def __init__(self, **kwargs):
            sdk_kwargs.update(kwargs)
            self.chat = object()

    class FakeChatOpenRouter:
        def __init__(self, **kwargs):
            chat_kwargs.update(kwargs)

        def with_structured_output(self, schema, **kwargs):
            structured_kwargs.update({"schema": schema, **kwargs})
            return object()

    monkeypatch.setattr(langchain_runtime, "OpenRouter", FakeProviderClient)
    monkeypatch.setattr(langchain_runtime, "ChatOpenRouter", FakeChatOpenRouter)
    schema = {"type": "object", "properties": {}, "additionalProperties": False}
    langchain_runtime.structured_nemotron_runnable(
        schema=schema,
        api_key="runtime-only-test-value",
        orchestration_id="orch-adapter",
        max_tokens=777,
    )

    assert sdk_kwargs["retry_config"] is None
    assert sdk_kwargs["timeout_ms"] == 180_000
    assert sdk_kwargs["x_open_router_title"] == "CasePath"
    assert "client" not in sdk_kwargs
    assert langchain_runtime.OPENROUTER_ENDPOINT_TAG == "deepinfra/fp4"
    assert chat_kwargs["model"] == OPENROUTER_MODEL
    assert chat_kwargs["max_retries"] == 0
    assert chat_kwargs["timeout"] == 180_000
    assert chat_kwargs["max_tokens"] == 777
    assert chat_kwargs["reasoning"] == {"effort": "medium"}
    assert set(chat_kwargs["reasoning"]) == {"effort"}
    assert chat_kwargs["openrouter_provider"] == {
        "only": ["deepinfra/fp4"],
        "allow_fallbacks": False,
        "require_parameters": True,
        "data_collection": "deny",
    }
    assert "model_kwargs" not in chat_kwargs
    assert chat_kwargs["openrouter_provider"] is not langchain_runtime.OPENROUTER_PROVIDER_POLICY
    assert (
        chat_kwargs["openrouter_provider"]["only"]
        is not langchain_runtime.OPENROUTER_PROVIDER_POLICY["only"]
    )
    assert components.ProviderPreferences.model_validate(
        chat_kwargs["openrouter_provider"]
    ).model_dump(exclude_none=True, by_alias=True) == {
        "only": ["deepinfra/fp4"],
        "allow_fallbacks": False,
        "require_parameters": True,
        "data_collection": "deny",
    }
    assert isinstance(chat_kwargs["client"], langchain_runtime._OpenRouterClientBridge)
    assert chat_kwargs["client"].chat._chat.__class__ is object
    assert "trace" not in chat_kwargs
    assert structured_kwargs == {
        "schema": schema,
        "method": "json_schema",
        "strict": True,
        "include_raw": True,
    }


def test_shared_runnable_forwards_exact_private_route_in_one_sdk_send(monkeypatch):
    requests: list[httpx.Request] = []
    sdk_clients: list[httpx.Client] = []
    real_client = httpx.Client
    real_openrouter = OpenRouter

    def handler(request: httpx.Request) -> httpx.Response:
        requests.append(request)
        return httpx.Response(
            200,
            headers={"content-type": "application/json"},
            json={
                "id": "gen-exact-route-1",
                "model": OPENROUTER_MODEL,
                "object": "chat.completion",
                "created": 1786483159,
                "system_fingerprint": None,
                "openrouter_metadata": {
                    "attempt": 1,
                    "endpoints": {
                        "available": [
                            {
                                "model": OPENROUTER_MODEL,
                                "provider": "DeepInfra",
                                "selected": True,
                            }
                        ],
                        "total": 1,
                    },
                    "is_byok": False,
                    "region": None,
                    "requested": OPENROUTER_MODEL,
                    "strategy": "direct",
                    "summary": "RAW_ROUTER_SUMMARY_SENTINEL",
                },
                "choices": [
                    {
                        "index": 0,
                        "finish_reason": "stop",
                        "message": {
                            "role": "assistant",
                            "content": json.dumps({"answer": "bounded"}),
                        },
                    }
                ],
                "usage": {
                    "prompt_tokens": 10,
                    "completion_tokens": 2,
                    "total_tokens": 12,
                    "cost": 0.001,
                },
            },
        )

    def instrumented_openrouter(**kwargs):
        client = real_client(transport=httpx.MockTransport(handler))
        sdk_clients.append(client)
        return real_openrouter(client=client, **kwargs)

    monkeypatch.setattr(langchain_runtime, "OpenRouter", instrumented_openrouter)
    runnable = langchain_runtime.structured_nemotron_runnable(
        schema={
            "title": "exact_route_test",
            "type": "object",
            "properties": {"answer": {"type": "string"}},
            "required": ["answer"],
            "additionalProperties": False,
        },
        api_key="runtime-only-test-value",
        orchestration_id="orch-exact-route",
        max_tokens=100,
    )

    envelope = runnable.invoke(
        [HumanMessage(content="Return the bounded object")],
        config={"callbacks": []},
    )

    assert envelope["parsed"] == {"answer": "bounded"}
    assert envelope["raw"].response_metadata["provider_name"] == "DeepInfra"
    assert "RAW_ROUTER_SUMMARY_SENTINEL" not in repr(
        envelope["raw"].response_metadata
    )
    assert len(requests) == 1
    body = json.loads(requests[0].content)
    assert body["model"] == OPENROUTER_MODEL
    assert body["provider"] == {
        "only": ["deepinfra/fp4"],
        "allow_fallbacks": False,
        "require_parameters": True,
        "data_collection": "deny",
    }
    assert body["reasoning"] == {"effort": "medium"}
    assert "max_tokens" not in body["reasoning"]
    assert "exclude" not in body["reasoning"]
    assert "x_open_router_metadata" not in body
    assert "models" not in body
    assert "trace" not in body
    assert requests[0].headers["X-OpenRouter-Metadata"] == "enabled"
    assert len(sdk_clients) == 1
    sdk_clients[0].close()


def _native_response_payload() -> dict[str, Any]:
    return {
        "id": "gen-response-bridge-123",
        "model": OPENROUTER_MODEL,
        "object": "chat.completion",
        "created": 1786479000,
        # OpenRouter legitimately omits this nullable field; openrouter==0.11.46
        # nevertheless declares it required in its generated ChatResult model.
        "choices": [
            {
                "index": 0,
                "finish_reason": "stop",
                "message": {
                    "role": "assistant",
                    "content": json.dumps({"answer": "bounded"}),
                },
            }
        ],
        "usage": {
            "prompt_tokens": 120,
            "completion_tokens": 30,
            "total_tokens": 150,
            "cost": 0.0042,
            "cost_details": {"provider_authored_extra": "RAW_USAGE_SENTINEL"},
        },
    }


def _http_response(
    body: str,
    *,
    status: int = 200,
    content_type: str = "application/json",
    headers: dict[str, str] | None = None,
):
    return httpx.Response(
        status,
        headers={"content-type": content_type, **(headers or {})},
        content=body.encode("utf-8"),
        request=httpx.Request("POST", "https://openrouter.ai/api/v1/chat/completions"),
    )


def test_response_bridge_recovers_sdk_schema_drift_through_langchain_once():
    payload = _native_response_payload()

    class GeneratedSdkChat:
        calls = 0

        def send(self, **kwargs):
            self.calls += 1
            response = _http_response(json.dumps(payload))
            return unmarshal_json_response(components.ChatResult, response)

    chat = GeneratedSdkChat()
    client = type("ProviderClient", (), {"chat": chat})()
    model = langchain_runtime.ChatOpenRouter(
        model=OPENROUTER_MODEL,
        api_key="runtime-only-test-value",
        client=langchain_runtime._OpenRouterClientBridge(client),
        temperature=0,
        max_tokens=100,
        max_retries=0,
    )
    runnable = model.with_structured_output(
        {
            "title": "response_bridge_test",
            "type": "object",
            "properties": {"answer": {"type": "string"}},
            "required": ["answer"],
            "additionalProperties": False,
        },
        method="json_schema",
        strict=True,
        include_raw=True,
    )

    envelope = runnable.invoke(
        [HumanMessage(content="Return the bounded test object")],
        config={"callbacks": []},
    )

    assert chat.calls == 1
    assert envelope["parsed"] == {"answer": "bounded"}
    assert envelope["parsing_error"] is None
    raw = envelope["raw"]
    assert raw.response_metadata["id"] == payload["id"]
    assert raw.response_metadata["model_name"] == OPENROUTER_MODEL
    assert raw.response_metadata["finish_reason"] == "stop"
    assert raw.response_metadata["cost"] == 0.0042
    assert raw.usage_metadata == {
        "input_tokens": 120,
        "output_tokens": 30,
        "total_tokens": 150,
    }
    assert "cost_details" not in raw.response_metadata
    assert "RAW_USAGE_SENTINEL" not in repr(raw.response_metadata)


def test_response_bridge_projects_text_content_parts_through_langchain_once():
    payload = _native_response_payload()
    payload["choices"][0]["message"]["content"] = [
        {"type": "text", "text": json.dumps({"answer": "bounded-parts"})}
    ]

    class GeneratedSdkChat:
        calls = 0

        def send(self, **_kwargs):
            self.calls += 1
            response = _http_response(json.dumps(payload))
            return unmarshal_json_response(components.ChatResult, response)

    chat = GeneratedSdkChat()
    client = type("ProviderClient", (), {"chat": chat})()
    model = langchain_runtime.ChatOpenRouter(
        model=OPENROUTER_MODEL,
        api_key="runtime-only-test-value",
        client=langchain_runtime._OpenRouterClientBridge(client),
        temperature=0,
        max_tokens=100,
        max_retries=0,
    )
    runnable = model.with_structured_output(
        {
            "title": "response_bridge_text_parts_test",
            "type": "object",
            "properties": {"answer": {"type": "string"}},
            "required": ["answer"],
            "additionalProperties": False,
        },
        method="json_schema",
        strict=True,
        include_raw=True,
    )

    envelope = runnable.invoke(
        [HumanMessage(content="Return the bounded test object")],
        config={"callbacks": []},
    )

    assert chat.calls == 1
    assert envelope["parsed"] == {"answer": "bounded-parts"}
    assert envelope["parsing_error"] is None
    assert envelope["raw"].response_metadata["id"] == payload["id"]
    assert envelope["raw"].usage_metadata == {
        "input_tokens": 120,
        "output_tokens": 30,
        "total_tokens": 150,
    }


def test_response_bridge_recovers_nullable_content_as_bounded_failed_finish():
    payload = _native_response_payload()
    payload["choices"][0]["finish_reason"] = "error"
    payload["choices"][0]["message"]["content"] = None
    payload["choices"][0]["error"] = {"message": "RAW_NULL_CONTENT_SENTINEL"}

    class GeneratedSdkChat:
        calls = 0

        def send(self, **_kwargs):
            self.calls += 1
            response = _http_response(json.dumps(payload))
            return unmarshal_json_response(components.ChatResult, response)

    chat = GeneratedSdkChat()
    client = type("ProviderClient", (), {"chat": chat})()
    recovered = langchain_runtime._OpenRouterClientBridge(client).chat.send(messages=[])

    assert chat.calls == 1
    assert recovered["id"] == payload["id"]
    assert recovered["model"] == payload["model"]
    assert recovered["choices"][0]["finish_reason"] == "error"
    assert recovered["choices"][0]["message"]["content"] == ""
    assert recovered["usage"] == {
        "prompt_tokens": 120,
        "completion_tokens": 30,
        "total_tokens": 150,
        "cost": 0.0042,
    }
    assert "RAW_NULL_CONTENT_SENTINEL" not in repr(recovered)


def test_response_bridge_passes_through_sdk_validated_results_by_identity():
    payload = {**_native_response_payload(), "system_fingerprint": None}
    expected = unmarshal_json_response(
        components.ChatResult,
        _http_response(json.dumps(payload)),
    )

    class PassingChat:
        calls = 0

        def send(self, **kwargs):
            self.calls += 1
            return expected

    chat = PassingChat()
    bridge = langchain_runtime._ChatSendBridge(chat)

    assert bridge.send(messages=[]) is expected
    assert chat.calls == 1


@pytest.mark.parametrize("variant", ["missing", "odd"])
def test_response_bridge_ignores_nonconsumed_envelope_field_drift(variant):
    payload = _native_response_payload()
    if variant == "missing":
        payload.pop("created")
        payload.pop("object")
        payload["choices"][0].pop("index")
    else:
        payload["created"] = "RAW_CREATED_SENTINEL"
        payload["object"] = {"raw": "RAW_OBJECT_SENTINEL"}
        payload["choices"][0]["index"] = True
    body = json.dumps(payload)

    class RejectingSdkChat:
        calls = 0

        def send(self, **_kwargs):
            self.calls += 1
            response = _http_response(body)
            raise errors.ResponseValidationError(
                "RAW_FIELD_DRIFT_SENTINEL",
                response,
                ValueError("RAW_FIELD_DRIFT_SENTINEL"),
                body,
            )

    chat = RejectingSdkChat()
    recovered = langchain_runtime._ChatSendBridge(chat).send(messages=[])

    assert chat.calls == 1
    assert recovered["id"] == payload["id"]
    assert recovered["model"] == payload["model"]
    assert "created" not in recovered
    assert "object" not in recovered
    assert "index" not in recovered["choices"][0]
    assert "RAW_" not in repr(recovered)


@pytest.mark.parametrize(
    ("generation_id", "error_code", "expected_context"),
    [
        (
            "gen-1786483159-hyYthqPv76o6PHXpGLzl",
            400,
            {
                "response_id": "gen-1786483159-hyYthqPv76o6PHXpGLzl",
                "provider_error_code": 400,
            },
        ),
        ("DEF-027-E0-DEMO", 400, {"provider_error_code": 400}),
        ("DOC-8842-INSPECTION", 400, {"provider_error_code": 400}),
        ("REVGLTAyNy1FMC1ERU1P", 400, {"provider_error_code": 400}),
        ("Bearer RAW_HEADER_SENTINEL", 100_000, {}),
    ],
)
def test_response_bridge_classifies_top_level_upstream_rejection_without_raw(
    generation_id,
    error_code,
    expected_context,
):
    body = json.dumps(
        {
            "error": {
                "code": error_code,
                "message": "RAW_UPSTREAM_REJECTION_SENTINEL",
                "metadata": {"raw": "RAW_UPSTREAM_METADATA_SENTINEL"},
            }
        }
    )

    class RejectingSdkChat:
        calls = 0

        def send(self, **_kwargs):
            self.calls += 1
            response = _http_response(
                body,
                headers={"X-Generation-Id": generation_id},
            )
            return unmarshal_json_response(components.ChatResult, response)

    chat = RejectingSdkChat()
    with pytest.raises(
        langchain_runtime.OpenRouterUpstreamRejectionError
    ) as captured:
        langchain_runtime._ChatSendBridge(chat).send(messages=[])

    assert chat.calls == 1
    assert captured.value.invariant == "provider_upstream_rejection"
    assert captured.value.safe_context == expected_context
    assert captured.value.__cause__ is None
    assert captured.value.__context__ is None
    assert "RAW_" not in str(captured.value)
    assert "RAW_" not in repr(captured.value)
    assert "RAW_" not in repr(captured.value.safe_context)


@pytest.mark.parametrize(
    ("body", "status", "content_type"),
    [
        ("RAW_PROTOCOL_SENTINEL", 200, "application/json"),
        ('{"id":"a","id":"b"}', 200, "application/json"),
        ('{"value":NaN}', 200, "application/json"),
        (json.dumps({**_native_response_payload(), "choices": []}), 200, "application/json"),
        (
            json.dumps(
                {
                    **_native_response_payload(),
                    "choices": [
                        {
                            **_native_response_payload()["choices"][0],
                            "message": {
                                "role": "assistant",
                                "content": [
                                    {
                                        "type": "image_url",
                                        "image_url": {
                                            "url": "RAW_MULTIMODAL_SENTINEL"
                                        },
                                    }
                                ],
                            },
                        }
                    ],
                }
            ),
            200,
            "application/json",
        ),
        (
            json.dumps(
                {
                    **_native_response_payload(),
                    "choices": [
                        {
                            **_native_response_payload()["choices"][0],
                            "message": {
                                "role": "assistant",
                                "content": [
                                    {"type": "text", "text": "x"}
                                    for _ in range(
                                        langchain_runtime.OPENROUTER_RESPONSE_TEXT_PART_LIMIT
                                        + 1
                                    )
                                ],
                            },
                        }
                    ],
                }
            ),
            200,
            "application/json",
        ),
        (json.dumps({key: value for key, value in _native_response_payload().items() if key != "id"}), 200, "application/json"),
        (json.dumps({key: value for key, value in _native_response_payload().items() if key != "model"}), 200, "application/json"),
        (json.dumps(_native_response_payload()), 200, "text/plain"),
        (json.dumps(_native_response_payload()), 500, "application/json"),
        ("x" * (langchain_runtime.OPENROUTER_RESPONSE_BODY_LIMIT_BYTES + 1), 200, "application/json"),
        ("[" * 20_000 + "0" + "]" * 20_000, 200, "application/json"),
    ],
)
def test_response_bridge_fails_bounded_without_raw_exception_chain(
    body: str,
    status: int,
    content_type: str,
):
    class RejectingSdkChat:
        calls = 0

        def send(self, **kwargs):
            self.calls += 1
            response = _http_response(body, status=status, content_type=content_type)
            raise errors.ResponseValidationError(
                "RAW_PROTOCOL_SENTINEL",
                response,
                ValueError("RAW_PROTOCOL_SENTINEL"),
                body,
            )

    chat = RejectingSdkChat()
    bridge = langchain_runtime._ChatSendBridge(chat)

    with pytest.raises(langchain_runtime.OpenRouterProtocolError) as captured:
        bridge.send(messages=[])

    assert chat.calls == 1
    assert captured.value.invariant == "provider_response_envelope"
    assert captured.value.__cause__ is None
    assert captured.value.__context__ is None
    assert "RAW_PROTOCOL_SENTINEL" not in str(captured.value)
    assert "RAW_PROTOCOL_SENTINEL" not in repr(captured.value)


@pytest.mark.parametrize(
    "finish_reason",
    [None, "length", "content_filter", "tool_calls", "error", "cancelled"],
)
def test_response_bridge_retains_bounded_nonstop_identity_and_usage(finish_reason):
    payload = _native_response_payload()
    payload["choices"][0]["finish_reason"] = finish_reason
    payload["choices"][0]["message"]["content"] = ""
    body = json.dumps(payload)

    class RejectingSdkChat:
        calls = 0

        def send(self, **_kwargs):
            self.calls += 1
            response = _http_response(body)
            raise errors.ResponseValidationError(
                "RAW_NONSTOP_SENTINEL",
                response,
                ValueError("RAW_NONSTOP_SENTINEL"),
                body,
            )

    chat = RejectingSdkChat()
    recovered = langchain_runtime._ChatSendBridge(chat).send(messages=[])

    assert chat.calls == 1
    assert recovered["id"] == payload["id"]
    assert recovered["model"] == payload["model"]
    assert recovered["choices"][0]["finish_reason"] == finish_reason
    assert recovered["choices"][0]["message"]["content"] == ""
    assert recovered["usage"] == {
        "prompt_tokens": 120,
        "completion_tokens": 30,
        "total_tokens": 150,
        "cost": 0.0042,
    }
    assert "RAW_NONSTOP_SENTINEL" not in repr(recovered)


def test_response_bridge_projects_choice_error_to_bounded_failed_finish():
    payload = _native_response_payload()
    payload["choices"][0]["error"] = {"message": "RAW_CHOICE_ERROR_SENTINEL"}
    body = json.dumps(payload)

    class RejectingSdkChat:
        calls = 0

        def send(self, **_kwargs):
            self.calls += 1
            response = _http_response(body)
            raise errors.ResponseValidationError(
                "RAW_CHOICE_ERROR_SENTINEL",
                response,
                ValueError("RAW_CHOICE_ERROR_SENTINEL"),
                body,
            )

    chat = RejectingSdkChat()
    recovered = langchain_runtime._ChatSendBridge(chat).send(messages=[])

    assert chat.calls == 1
    assert recovered["choices"][0]["finish_reason"] == "error"
    assert "error" not in recovered["choices"][0]
    assert "RAW_CHOICE_ERROR_SENTINEL" not in repr(recovered)


def test_provider_provenance_field_grammars_accept_real_ids_and_hash_credentials():
    for response_model in (
        OPENROUTER_MODEL,
        f"{OPENROUTER_MODEL}-20260604",
    ):
        sanitized, violation = langchain_runtime.sanitize_provider_provenance(
            response_id="gen-1786460163-SVSIhqiSG3ko4ZbBb0IS",
            response_model=response_model,
            upstream_provider="DeepInfra",
            finish_reason="stop",
        )
        assert violation is None
        assert sanitized == {
            "response_id": "gen-1786460163-SVSIhqiSG3ko4ZbBb0IS",
            "response_model": response_model,
            "upstream_provider": "DeepInfra",
            "finish_reason": "stop",
        }

    for field, invalid_value in (
        ("response_id", "sk-or-v1-credential-material"),
        ("response_id", "tenant-reported-moisture"),
        ("upstream_provider", "Deep Infra"),
        ("upstream_provider", "landlord-claim"),
        ("response_model", "different/model"),
        ("finish_reason", "tenant stopped payment"),
    ):
        values = {
            "response_id": "gen-safe-id",
            "response_model": OPENROUTER_MODEL,
            "upstream_provider": "DeepInfra",
            "finish_reason": "stop",
        }
        values[field] = invalid_value
        sanitized, violation = langchain_runtime.sanitize_provider_provenance(
            **values
        )
        assert violation is not None
        assert violation["invalid_provenance_field"] == field
        assert len(violation["invalid_provenance_value_hash"]) == 64
        assert sanitized[field] is None
        assert invalid_value not in json.dumps(
            {"sanitized": sanitized, "violation": violation}
        )


def test_openrouter_sdk_explicit_none_retry_config_makes_one_http_attempt():
    class CountingClient:
        def __init__(self):
            self.delegate = httpx.Client()
            self.attempts = 0

        def build_request(self, *args, **kwargs):
            return self.delegate.build_request(*args, **kwargs)

        def send(self, request, **_kwargs):
            self.attempts += 1
            return httpx.Response(503, request=request, json={"error": {"message": "safe"}})

        def close(self):
            self.delegate.close()

    client = CountingClient()
    sdk = OpenRouter(
        api_key="runtime-only-test-value",
        client=client,
        retry_config=None,
        timeout_ms=180_000,
    )
    with pytest.raises(Exception):
        sdk.chat.send(
            model=OPENROUTER_MODEL,
            messages=[{"role": "user", "content": "bounded test"}],
            max_tokens=1,
        )
    assert client.attempts == 1


def test_external_tracing_blocks_runner_and_graph_before_invocation(
    tmp_path: Path, monkeypatch
):
    factory_calls = 0

    def forbidden_factory(*_args):
        nonlocal factory_calls
        factory_calls += 1
        raise AssertionError("provider runnable must not be created")

    runner = InstrumentedStructuredAgent(
        Storage(str(tmp_path / "trace-runner.db")),
        runnable_factory=forbidden_factory,
        api_key_provider=lambda: "runtime-only-test-value",
    )
    with tracing_context(enabled=True), pytest.raises(
        RuntimeError, match="Inherited LangChain tracing"
    ):
        runner.invoke(
            run_id="run-trace",
            orchestration_id="orch-trace",
            agent_id="orchestrator_plan",
            schema=OrchestratorPlan,
            system_prompt="bounded",
            provider_payload={"fact_candidates": []},
            validator=lambda value: (value, {}),
            private_contract_hash="0" * 64,
        )
    assert factory_calls == 0

    (
        orchestrator,
        _storage,
        _captures,
        _responses,
        package,
        canonicalization,
        result,
    ) = graph_fixture(tmp_path)

    class SpyGraph:
        entered = False

        def stream(self, *_args, **_kwargs):
            self.entered = True
            return iter(())

    spy = SpyGraph()
    orchestrator.graph = spy
    with tracing_context(enabled=True), pytest.raises(
        RuntimeError, match="Inherited LangChain tracing"
    ):
        orchestrator.invoke(
            run_id="run-trace-graph",
            orchestration_id="orch-trace-graph",
            observable_package=package,
            canonicalization=canonicalization,
            facts=result["facts"],
            process=result["process"],
            checklist=result["checklist"],
            verification=result["verification"],
        )
    assert spy.entered is False

    monkeypatch.setattr(
        langchain_runtime,
        "get_tracing_context",
        lambda: {"enabled": "local"},
    )
    with pytest.raises(RuntimeError, match="Inherited LangChain tracing"):
        orchestrator.invoke(
            run_id="run-trace-graph-nonboolean",
            orchestration_id="orch-trace-graph-nonboolean",
            observable_package=package,
            canonicalization=canonicalization,
            facts=result["facts"],
            process=result["process"],
            checklist=result["checklist"],
            verification=result["verification"],
        )
    assert spy.entered is False


def test_specialist_requires_strict_accepted_majority_and_never_caches_minority(
    tmp_path: Path,
):
    calls = 0

    class Runnable:
        def invoke(self, _messages, config=None):
            nonlocal calls
            calls += 1
            return {
                "raw": AIMessage(
                    content="",
                    response_metadata={
                        "id": f"gen-majority-{calls}",
                        "model_name": OPENROUTER_MODEL,
                        "finish_reason": "stop",
                        "provider_name": "DeepInfra",
                        "usage": {
                            "prompt_tokens": 10,
                            "completion_tokens": 5,
                            "total_tokens": 15,
                            "cost": 0.001,
                        },
                    },
                ),
                "parsed": OrchestratorPlan(
                    priority_fact_ids=["fact"],
                    priority_task_codes=[
                        "source_integrity",
                        "process_decisions",
                        "evidence_gaps",
                        "final_brief",
                    ],
                ),
                "parsing_error": None,
            }

    storage = Storage(str(tmp_path / "majority.db"))
    runner = InstrumentedStructuredAgent(
        storage,
        runnable_factory=lambda *_args: Runnable(),
        api_key_provider=lambda: "runtime-only-test-value",
    )
    diagnostics = {
        "authority_mode": "multi_agent_hybrid_guarded",
        "accepted_item_ids": ["accepted"],
        "accepted_item_count": 1,
        "rejected_items": [{"item_id": "rejected", "invariant": "bounded"}],
        "rejected_item_count": 1,
        "ignored_proposal_count": 0,
        "deterministic_fallback_applied": True,
    }
    for index in range(2):
        with pytest.raises(
            AgentInvocationFailure, match="model_contribution_majority"
        ):
            runner.invoke(
                run_id=f"run-majority-{index}",
                orchestration_id="orch-majority",
                agent_id="orchestrator_plan",
                schema=OrchestratorPlan,
                system_prompt="bounded",
                provider_payload={"stable": True},
                validator=lambda value: (value, diagnostics),
                private_contract_hash="1" * 64,
            )
    assert calls == 2
    assert [item["outcome"] for item in storage.model_calls()] == ["failed", "failed"]


@pytest.mark.parametrize("value", [1.0, -0.0, 1e-7, float("inf"), float("nan")])
def test_accepted_artifact_hash_rejects_all_floats(value: float):
    with pytest.raises(AgentBoundaryError, match="float_at"):
        accepted_artifact_hash({"bounded": [1, value]})


def test_evidence_role_reserves_large_answer_headroom(tmp_path: Path):
    (
        orchestrator,
        _storage,
        _captures,
        _responses,
        package,
        canonicalization,
        result,
    ) = graph_fixture(tmp_path)
    audit = orchestrator.invoke(
        run_id="run-size-test",
        orchestration_id="orch-size-test",
        observable_package=package,
        canonicalization=canonicalization,
        facts=result["facts"],
        process=result["process"],
        checklist=result["checklist"],
        verification=result["verification"],
    )
    proposals = audit["specialist_artifacts"]["evidence_checklist"]["items"]
    assert len(proposals) == len(result["checklist"]["items"]) == 21
    conservative_tokens = (
        len(json.dumps({"proposals": proposals}, separators=(",", ":")).encode()) + 2
    ) // 3
    assert conservative_tokens * 2 < ROLE_OUTPUT_TOKENS["evidence_checklist"] == 8_192


def test_all_production_specialist_artifacts_leave_half_completion_budget(
    tmp_path: Path,
):
    assert ROLE_OUTPUT_TOKENS == {
        "orchestrator_plan": 4_096,
        "document_source_integrity": 4_096,
        "process_decision_mapping": 4_096,
        "evidence_checklist": 8_192,
        "final_claim_brief_audit": 4_096,
    }
    (
        orchestrator,
        _storage,
        _captures,
        responses,
        package,
        canonicalization,
        result,
    ) = graph_fixture(tmp_path)
    audit = orchestrator.invoke(
        run_id="run-answer-headroom",
        orchestration_id="orch-answer-headroom",
        observable_package=package,
        canonicalization=canonicalization,
        facts=result["facts"],
        process=result["process"],
        checklist=result["checklist"],
        verification=result["verification"],
    )

    assert audit["all_required_agents_contributed"] is True
    assert set(responses) == set(ROLE_OUTPUT_TOKENS)
    for role, response in responses.items():
        conservative_answer_tokens = (
            len(json.dumps(response, separators=(",", ":")).encode()) + 2
        ) // 3
        assert conservative_answer_tokens * 2 < ROLE_OUTPUT_TOKENS[role], (
            role,
            conservative_answer_tokens,
            ROLE_OUTPUT_TOKENS[role],
        )


@pytest.mark.parametrize(
    ("priority_fact_ids", "task_codes"),
    [
        ([], ["source_integrity", "process_decisions", "evidence_gaps", "final_brief"]),
        (["fact_1", "fact_1"], ["source_integrity", "process_decisions", "evidence_gaps", "final_brief"]),
        (["unknown"], ["source_integrity", "process_decisions", "evidence_gaps", "final_brief"]),
        (
            [f"fact_{index}" for index in range(1, 8)],
            ["source_integrity", "process_decisions", "evidence_gaps", "final_brief"],
        ),
        (["fact_1"], ["source_integrity", "process_decisions", "evidence_gaps"]),
        (
            ["fact_1"],
            ["source_integrity", "source_integrity", "evidence_gaps", "final_brief"],
        ),
        (
            ["fact_1"],
            ["source_integrity", "process_decisions", "evidence_gaps", "unknown"],
        ),
    ],
)
def test_plan_validator_rejects_unbounded_or_incomplete_priorities(
    priority_fact_ids: list[str], task_codes: list[str]
):
    canonical_fact_ids = [f"fact_{index}" for index in range(1, 19)]
    validator = _plan_validator(
        canonical_fact_ids=canonical_fact_ids,
        deterministic_focus_source_ref_ids=[f"src_{index}" for index in range(5)],
        required_text_artifact_ids=[f"artifact_{index}" for index in range(5)],
    )

    contribution, diagnostics = validator(
        {
            "priority_fact_ids": priority_fact_ids,
            "priority_task_codes": task_codes,
        }
    )

    assert diagnostics["accepted_item_count"] == 0
    assert diagnostics["rejected_item_count"] == 1
    assert diagnostics["rejected_items"][0]["invariant"] == (
        "bounded_priority_selection"
    )
    assert contribution["model_priority_fact_ids"] == []
    assert contribution["focus_fact_ids"] == []
    assert contribution["focus_source_ref_ids"] == []


def test_model_fact_priority_changes_derived_downstream_order_without_losing_coverage(
    tmp_path: Path,
):
    (
        _orchestrator,
        _storage,
        _captures,
        _responses,
        package,
        _canonicalization,
        result,
    ) = graph_fixture(tmp_path)
    canonical_fact_ids = [item["fact_id"] for item in result["facts"]]
    required_artifacts = sorted(
        item["artifact_id"]
        for item in package["artifacts"]
        if item["media_type"] in {"application/pdf", "message/rfc822"}
    )
    registry = _source_registry(package)
    deterministic_sources = [
        min(
            item["source_ref_id"]
            for item in registry
            if item["artifact_id"] == artifact_id
        )
        for artifact_id in required_artifacts
    ]
    validator = _plan_validator(
        canonical_fact_ids=canonical_fact_ids,
        deterministic_focus_source_ref_ids=deterministic_sources,
        required_text_artifact_ids=required_artifacts,
    )
    task_codes = ["source_integrity", "process_decisions", "evidence_gaps", "final_brief"]

    forward, forward_diagnostics = validator(
        {
            "priority_fact_ids": canonical_fact_ids[:2],
            "priority_task_codes": task_codes,
        }
    )
    reverse, reverse_diagnostics = validator(
        {
            "priority_fact_ids": list(reversed(canonical_fact_ids[-2:])),
            "priority_task_codes": task_codes,
        }
    )

    assert forward_diagnostics["accepted_item_count"] == 1
    assert reverse_diagnostics["accepted_item_count"] == 1
    assert forward["focus_fact_ids"][:2] == canonical_fact_ids[:2]
    assert reverse["focus_fact_ids"][:2] == list(reversed(canonical_fact_ids[-2:]))
    assert set(forward["focus_fact_ids"]) == set(reverse["focus_fact_ids"]) == set(
        canonical_fact_ids
    )
    assert len(forward["focus_fact_ids"]) == len(reverse["focus_fact_ids"]) == 18
    assert forward["focus_source_ref_ids"] == reverse["focus_source_ref_ids"]
    assert len(forward["focus_source_ref_ids"]) == 5

    def evidence_order(plan: dict[str, Any]) -> list[str]:
        payload = _evidence_provider_payload(
            {
                "orchestrator_plan": plan,
                "checklist": result["checklist"],
                "facts": result["facts"],
                "source_registry": registry,
                "observable_package": package,
            }
        )
        return [item["fact_id"] for item in payload["fact_handoff"]]

    assert evidence_order(forward) != evidence_order(reverse)


def _accepted_plan_validator(value: dict[str, Any]):
    return value, {
        "authority_mode": "multi_agent_hybrid_guarded",
        "accepted_item_ids": ["orchestration_focus"],
        "accepted_item_count": 1,
        "rejected_items": [],
        "rejected_item_count": 0,
        "ignored_proposal_count": 0,
        "deterministic_fallback_applied": False,
    }


def _plan_envelope(
    *,
    response_id: str | None = "gen-plan",
    response_model: str = OPENROUTER_MODEL,
    provider_name: str | None = "DeepInfra",
    finish_reason: str | None = "stop",
    usage: dict[str, Any] | None = None,
    parsed: bool = True,
):
    metadata: dict[str, Any] = {
        "model_name": response_model,
        "provider_name": provider_name,
        "finish_reason": finish_reason,
    }
    if response_id is not None:
        metadata["id"] = response_id
    if usage is not None:
        metadata["usage"] = usage
    return {
        "raw": AIMessage(content="", response_metadata=metadata),
        "parsed": (
            OrchestratorPlan(
                priority_fact_ids=["fact"],
                priority_task_codes=[
                    "source_integrity",
                    "process_decisions",
                    "evidence_gaps",
                    "final_brief",
                ],
            )
            if parsed
            else None
        ),
        "parsing_error": None if parsed else ValueError("raw-provider-detail"),
    }


def _invoke_plan(
    runner: InstrumentedStructuredAgent,
    *,
    run_id: str = "run-plan",
    agent_id: str = "orchestrator_plan",
):
    return runner.invoke(
        run_id=run_id,
        orchestration_id="orch-plan",
        agent_id=agent_id,
        schema=OrchestratorPlan,
        system_prompt="bounded",
        provider_payload={"observable": True},
        validator=_accepted_plan_validator,
        private_contract_hash="2" * 64,
    )


def test_orchestrator_plan_accepts_completion_above_legacy_ceiling_with_exact_new_cap(
    tmp_path: Path,
):
    provider_calls = 0
    received_ceilings: list[int] = []

    class Runnable:
        def invoke(self, *_args, **_kwargs):
            nonlocal provider_calls
            provider_calls += 1
            return _plan_envelope(
                usage={
                    "prompt_tokens": 700,
                    "completion_tokens": 3_500,
                    "total_tokens": 4_200,
                    "cost": 0.008,
                }
            )

    def factory(_agent_id, _schema, _key, _orchestration_id, max_tokens):
        received_ceilings.append(max_tokens)
        return Runnable()

    storage = Storage(str(tmp_path / "expanded-plan-ceiling.db"))
    runner = InstrumentedStructuredAgent(
        storage,
        runnable_factory=factory,
        api_key_provider=lambda: "runtime-only-test-value",
    )

    result = _invoke_plan(runner, run_id="run-expanded-plan-ceiling")

    assert ROLE_OUTPUT_TOKENS["orchestrator_plan"] == 4_096
    assert received_ceilings == [4_096]
    assert provider_calls == 1
    assert result["cache_hit"] is False
    assert result["outcome"] == "succeeded"
    assert result["usage"]["completion_tokens"] == 3_500 > 800
    ledger = storage.model_calls()
    assert len(ledger) == 1
    assert ledger[0]["call_count"] == 1
    assert ledger[0]["outcome"] == "succeeded"


@pytest.mark.parametrize(
    ("agent_id", "ceiling"),
    [
        ("orchestrator_plan", 4_096),
        ("document_source_integrity", 4_096),
        ("process_decision_mapping", 4_096),
        ("evidence_checklist", 8_192),
        ("final_claim_brief_audit", 4_096),
    ],
)
def test_each_specialist_length_at_new_ceiling_is_billed_and_never_cached(
    tmp_path: Path, agent_id: str, ceiling: int
):
    provider_calls = 0
    received_ceilings: list[int] = []

    class Runnable:
        def invoke(self, *_args, **_kwargs):
            nonlocal provider_calls
            provider_calls += 1
            return _plan_envelope(
                finish_reason="length",
                usage={
                    "prompt_tokens": 700,
                    "completion_tokens": ceiling,
                    "total_tokens": 700 + ceiling,
                    "cost": 0.009,
                },
            )

    def factory(_agent_id, _schema, _key, _orchestration_id, max_tokens):
        received_ceilings.append(max_tokens)
        return Runnable()

    storage = Storage(str(tmp_path / f"length-at-{agent_id}-ceiling.db"))
    runner = InstrumentedStructuredAgent(
        storage,
        runnable_factory=factory,
        api_key_provider=lambda: "runtime-only-test-value",
    )

    for run_id in ("run-length-at-new-cap-1", "run-length-at-new-cap-2"):
        with pytest.raises(AgentInvocationFailure, match="provider_finish_reason"):
            _invoke_plan(runner, run_id=run_id, agent_id=agent_id)

    assert ROLE_OUTPUT_TOKENS[agent_id] == ceiling
    assert received_ceilings == [ceiling, ceiling]
    assert provider_calls == 2
    ledger = storage.model_calls()
    assert len(ledger) == 2
    assert all(item["call_count"] == 1 for item in ledger)
    assert all(item["outcome"] == "failed" for item in ledger)
    assert all(item["error_invariant"] == "provider_finish_reason" for item in ledger)
    assert all(item["finish_reason"] == "length" for item in ledger)
    assert all(item["completion_tokens"] == ceiling for item in ledger)
    assert all(storage.cached_model_output(item["cache_key"]) is None for item in ledger)


def test_specialist_wrong_model_metadata_billing_and_missing_id_sync_billing_are_retained(
    tmp_path: Path,
):
    metadata_calls = 0

    class WrongModelRunnable:
        def invoke(self, *_args, **_kwargs):
            return _plan_envelope(response_model="different/model", usage=None)

    def metadata_transport(*_args):
        nonlocal metadata_calls
        metadata_calls += 1
        return {
            "data": {
                "id": "gen-plan",
                "model": "nvidia/nemotron-3-ultra-550b-a55b-20260604",
                "provider_name": "DeepInfra",
                "native_tokens_prompt": 41,
                "native_tokens_completion": 17,
                "total_cost": 0.0041,
                "usage": 0.0041,
                "finish_reason": "stop",
            }
        }

    wrong_storage = Storage(str(tmp_path / "wrong-model.db"))
    wrong_runner = InstrumentedStructuredAgent(
        wrong_storage,
        runnable_factory=lambda *_args: WrongModelRunnable(),
        metadata_transport=metadata_transport,
        api_key_provider=lambda: "runtime-only-test-value",
    )
    with pytest.raises(AgentInvocationFailure, match="invalid_provenance") as caught:
        _invoke_plan(wrong_runner, run_id="run-wrong-model")
    assert metadata_calls == 1
    assert caught.value.safe_context["response_id"] == "gen-plan"
    wrong_ledger = wrong_storage.model_calls()[0]
    assert wrong_ledger["outcome"] == "failed"
    assert wrong_ledger["actual_cost_usd"] == pytest.approx(0.0041)
    assert wrong_ledger["prompt_tokens"] == 41
    assert wrong_ledger["completion_tokens"] == 17
    assert "response_model" not in wrong_ledger
    assert wrong_ledger["invalid_provenance_field"] == "response_model"
    assert len(wrong_ledger["invalid_provenance_value_hash"]) == 64
    assert wrong_ledger["generation_model"].endswith("-20260604")
    assert "different/model" not in json.dumps(wrong_ledger)

    class MissingIdRunnable:
        def invoke(self, *_args, **_kwargs):
            return _plan_envelope(
                response_id=None,
                usage={
                    "prompt_tokens": 31,
                    "completion_tokens": 11,
                    "total_tokens": 42,
                    "cost": 0.0031,
                },
            )

    missing_storage = Storage(str(tmp_path / "missing-id.db"))
    missing_runner = InstrumentedStructuredAgent(
        missing_storage,
        runnable_factory=lambda *_args: MissingIdRunnable(),
        metadata_transport=lambda *_args: (_ for _ in ()).throw(
            AssertionError("metadata lookup requires a valid response ID")
        ),
        api_key_provider=lambda: "runtime-only-test-value",
    )
    with pytest.raises(AgentInvocationFailure, match="response_identity"):
        _invoke_plan(missing_runner, run_id="run-missing-id")
    missing_ledger = missing_storage.model_calls()[0]
    assert missing_ledger["actual_cost_usd"] == pytest.approx(0.0031)
    assert missing_ledger["prompt_tokens"] == 31
    assert "response_id" not in missing_ledger


def test_specialist_missing_upstream_provider_uses_generation_metadata(
    tmp_path: Path,
):
    metadata_calls = 0
    inference_calls = 0

    class Runnable:
        def invoke(self, *_args, **_kwargs):
            nonlocal inference_calls
            inference_calls += 1
            return _plan_envelope(
                provider_name=None,
                usage={
                    "prompt_tokens": 31,
                    "completion_tokens": 11,
                    "total_tokens": 42,
                    "cost": 0.0031,
                },
            )

    def metadata_transport(*_args):
        nonlocal metadata_calls
        metadata_calls += 1
        return {
            "data": {
                "id": "gen-plan",
                "model": "nvidia/nemotron-3-ultra-550b-a55b-20260604",
                "provider_name": "DeepInfra",
                "native_tokens_prompt": 41,
                "native_tokens_completion": 17,
                "total_cost": 0.0041,
                "usage": 0.0041,
                "finish_reason": "stop",
            }
        }

    storage = Storage(str(tmp_path / "missing-specialist-provider.db"))
    runner = InstrumentedStructuredAgent(
        storage,
        runnable_factory=lambda *_args: Runnable(),
        metadata_transport=metadata_transport,
        api_key_provider=lambda: "runtime-only-test-value",
    )
    result = _invoke_plan(runner, run_id="run-missing-specialist-provider")

    assert inference_calls == metadata_calls == 1
    assert result["upstream_provider"] == "DeepInfra"
    assert result["usage_source"] == "generation_metadata"
    ledger = storage.sanitized_model_ledger()[0]
    assert ledger["outcome"] == "succeeded"
    assert ledger["upstream_provider"] == "DeepInfra"
    assert ledger["usage_source"] == "generation_metadata"


def test_specialist_generation_metadata_eventual_consistency_uses_bounded_backoff(
    tmp_path: Path,
):
    metadata_calls = 0
    inference_calls = 0
    sleeps: list[float] = []

    class Runnable:
        def invoke(self, *_args, **_kwargs):
            nonlocal inference_calls
            inference_calls += 1
            return _plan_envelope(
                provider_name=None,
                usage={
                    "prompt_tokens": 31,
                    "completion_tokens": 11,
                    "total_tokens": 42,
                    "cost": 0.0031,
                },
            )

    def metadata_transport(*_args):
        nonlocal metadata_calls
        metadata_calls += 1
        if metadata_calls < canonicalizer_module.GENERATION_METADATA_POLL_ATTEMPTS:
            return {"data": {}}
        return {
            "data": {
                "id": "gen-plan",
                "model": "nvidia/nemotron-3-ultra-550b-a55b-20260604",
                "provider_name": "DeepInfra",
                "native_tokens_prompt": 31,
                "native_tokens_completion": 11,
                "total_cost": 0.0031,
                "usage": 0.0031,
                "finish_reason": "stop",
            }
        }

    storage = Storage(str(tmp_path / "delayed-specialist-provider.db"))
    runner = InstrumentedStructuredAgent(
        storage,
        runnable_factory=lambda *_args: Runnable(),
        metadata_transport=metadata_transport,
        metadata_sleep=sleeps.append,
        api_key_provider=lambda: "runtime-only-test-value",
    )
    result = _invoke_plan(runner, run_id="run-delayed-specialist-provider")

    assert inference_calls == 1
    assert metadata_calls == 8
    assert sleeps == [0.5, 1.0, 2.0, 4.0, 8.0, 8.0, 8.0]
    assert result["upstream_provider"] == "DeepInfra"
    assert result["usage_source"] == "generation_metadata"
    ledger = storage.sanitized_model_ledger()[0]
    assert ledger["outcome"] == "succeeded"
    assert ledger["metadata_poll_count"] == 8
    assert ledger["actual_cost_usd"] == pytest.approx(0.0031)


def test_specialist_missing_upstream_provider_fails_closed_without_metadata(
    tmp_path: Path,
):
    inference_calls = 0
    metadata_calls = 0

    class Runnable:
        def invoke(self, *_args, **_kwargs):
            nonlocal inference_calls
            inference_calls += 1
            return _plan_envelope(
                provider_name=None,
                usage={
                    "prompt_tokens": 31,
                    "completion_tokens": 11,
                    "total_tokens": 42,
                    "cost": 0.0031,
                },
            )

    def incomplete_metadata(*_args):
        nonlocal metadata_calls
        metadata_calls += 1
        return {"data": {}}

    storage = Storage(str(tmp_path / "missing-specialist-provider-incomplete.db"))
    runner = InstrumentedStructuredAgent(
        storage,
        runnable_factory=lambda *_args: Runnable(),
        metadata_transport=incomplete_metadata,
        metadata_sleep=lambda _seconds: None,
        api_key_provider=lambda: "runtime-only-test-value",
    )
    with pytest.raises(
        AgentInvocationFailure,
        match="generation_metadata_completeness",
    ):
        _invoke_plan(runner, run_id="run-missing-specialist-provider-incomplete")

    assert inference_calls == 1
    assert metadata_calls == 8
    ledger = storage.sanitized_model_ledger()[0]
    assert ledger["outcome"] == "failed"
    assert ledger["error_invariant"] == "generation_metadata_completeness"
    assert ledger["actual_cost_usd"] == pytest.approx(0.0031)
    assert ledger["usage_source"] == "response"
    assert ledger["response_id"] == "gen-plan"
    assert ledger["response_model"] == OPENROUTER_MODEL
    assert ledger["finish_reason"] == "stop"
    assert ledger["prompt_tokens"] == 31
    assert ledger["completion_tokens"] == 11
    assert ledger["total_tokens"] == 42
    assert ledger["metadata_poll_count"] == 8
    assert ledger["metadata_latency_ms"] >= 0
    assert ledger["error_type"] != "KeyError"
    assert storage.cached_model_output(ledger["cache_key"]) is None


def test_specialist_invalid_generation_usage_retains_bounded_poll_evidence(
    tmp_path: Path,
):
    inference_calls = 0
    metadata_calls = 0

    class Runnable:
        def invoke(self, *_args, **_kwargs):
            nonlocal inference_calls
            inference_calls += 1
            return _plan_envelope(
                provider_name=None,
                usage={
                    "prompt_tokens": 31,
                    "completion_tokens": 11,
                    "total_tokens": 42,
                    "cost": 0.0031,
                },
            )

    def invalid_metadata(*_args):
        nonlocal metadata_calls
        metadata_calls += 1
        return {
            "data": {
                "id": "gen-plan",
                "model": "nvidia/nemotron-3-ultra-550b-a55b-20260604",
                "provider_name": "DeepInfra",
                "native_tokens_prompt": 31,
                "native_tokens_completion": 11,
                "total_cost": 0.0,
                "usage": 0.0,
                "finish_reason": "stop",
            }
        }

    storage = Storage(str(tmp_path / "invalid-specialist-generation-usage.db"))
    runner = InstrumentedStructuredAgent(
        storage,
        runnable_factory=lambda *_args: Runnable(),
        metadata_transport=invalid_metadata,
        metadata_sleep=lambda _seconds: None,
        api_key_provider=lambda: "runtime-only-test-value",
    )
    with pytest.raises(AgentInvocationFailure, match="generation_metadata_usage"):
        _invoke_plan(runner, run_id="run-invalid-specialist-generation-usage")

    assert inference_calls == metadata_calls == 1
    ledger = storage.sanitized_model_ledger()[0]
    assert ledger["outcome"] == "failed"
    assert ledger["error_invariant"] == "generation_metadata_usage"
    assert ledger["response_id"] == "gen-plan"
    assert ledger["response_model"] == OPENROUTER_MODEL
    assert ledger["finish_reason"] == "stop"
    assert ledger["prompt_tokens"] == 31
    assert ledger["completion_tokens"] == 11
    assert ledger["total_tokens"] == 42
    assert ledger["actual_cost_usd"] == pytest.approx(0.0031)
    assert ledger["usage_source"] == "response"
    assert ledger["metadata_poll_count"] == 1
    assert ledger["metadata_latency_ms"] >= 0
    assert storage.cached_model_output(ledger["cache_key"]) is None


@pytest.mark.parametrize(
    "envelope_overrides",
    [
        {"response_id": "gen-" + "x" * 200},
        {"provider_name": "SECRET_SENTINEL_PROVIDER"},
        {"finish_reason": "SECRET_SENTINEL_FINISH"},
    ],
)
def test_specialist_provider_provenance_is_bounded_before_ledger_and_failure_context(
    tmp_path: Path,
    envelope_overrides: dict[str, Any],
):
    invalid_value = next(iter(envelope_overrides.values()))

    class Runnable:
        def invoke(self, *_args, **_kwargs):
            return _plan_envelope(
                **envelope_overrides,
                usage={
                    "prompt_tokens": 31,
                    "completion_tokens": 11,
                    "total_tokens": 42,
                    "cost": 0.0031,
                    "secret_usage_sentinel": "must-not-be-stored",
                },
            )

    storage = Storage(str(tmp_path / "invalid-provenance.db"))
    runner = InstrumentedStructuredAgent(
        storage,
        runnable_factory=lambda *_args: Runnable(),
        metadata_transport=lambda *_args: (_ for _ in ()).throw(
            AssertionError("invalid provenance must not trigger metadata polling")
        ),
        api_key_provider=lambda: "runtime-only-test-value",
    )
    with pytest.raises(AgentInvocationFailure, match="invalid_provenance") as caught:
        _invoke_plan(runner, run_id="run-invalid-provenance")
    ledger = storage.model_calls()[0]
    serialized = json.dumps(ledger)
    assert ledger["outcome"] == "failed"
    assert ledger["error_invariant"] == "invalid_provenance"
    assert ledger["actual_cost_usd"] == pytest.approx(0.0031)
    assert len(ledger["invalid_provenance_value_hash"]) == 64
    assert invalid_value not in serialized
    assert "secret_usage_sentinel" not in serialized
    assert "must-not-be-stored" not in serialized
    assert caught.value.safe_context["invalid_provenance_value_hash"] == ledger[
        "invalid_provenance_value_hash"
    ]


def test_specialist_schema_failure_retains_billing_without_raw_error(tmp_path: Path):
    class Runnable:
        def invoke(self, *_args, **_kwargs):
            return _plan_envelope(
                parsed=False,
                usage={
                    "prompt_tokens": 21,
                    "completion_tokens": 9,
                    "total_tokens": 30,
                    "cost": 0.0021,
                },
            )

    storage = Storage(str(tmp_path / "schema-failure.db"))
    runner = InstrumentedStructuredAgent(
        storage,
        runnable_factory=lambda *_args: Runnable(),
        api_key_provider=lambda: "runtime-only-test-value",
    )
    with pytest.raises(AgentInvocationFailure, match="provider_native_schema") as caught:
        _invoke_plan(runner)
    assert caught.value.safe_context["call_id"] == storage.model_calls()[0]["call_id"]
    ledger = storage.model_calls()[0]
    assert ledger["actual_cost_usd"] == pytest.approx(0.0021)
    assert ledger["outcome"] == "failed"
    assert ledger["error_invariant"] == "provider_native_schema"
    assert "raw-provider-detail" not in json.dumps(storage.sanitized_model_ledger())


def test_nonstop_specialist_response_cannot_be_accepted_or_cached(tmp_path: Path):
    class Runnable:
        def invoke(self, *_args, **_kwargs):
            return _plan_envelope(
                finish_reason="length",
                usage={
                    "prompt_tokens": 21,
                    "completion_tokens": 9,
                    "total_tokens": 30,
                    "cost": 0.0021,
                },
            )

    storage = Storage(str(tmp_path / "nonstop-specialist.db"))
    runner = InstrumentedStructuredAgent(
        storage,
        runnable_factory=lambda *_args: Runnable(),
        api_key_provider=lambda: "runtime-only-test-value",
    )

    with pytest.raises(AgentInvocationFailure, match="provider_finish_reason"):
        _invoke_plan(runner, run_id="run-nonstop-specialist")

    ledger = storage.model_calls()[0]
    assert ledger["outcome"] == "failed"
    assert ledger["error_invariant"] == "provider_finish_reason"
    assert ledger["finish_reason"] == "length"
    assert ledger["actual_cost_usd"] == pytest.approx(0.0021)
    assert storage.cached_model_output(ledger["cache_key"]) is None


def test_specialist_sdk_drift_nonstop_retains_billing_before_rejection(
    tmp_path: Path,
    monkeypatch,
):
    provider_calls = 0
    metadata_calls = 0
    provider_payload = {
        "id": "gen-plan-drift",
        "model": OPENROUTER_MODEL,
        "object": "chat.completion",
        "created": 1786479000,
        "choices": [
            {
                "index": 0,
                "finish_reason": "length",
                "message": {
                    "role": "assistant",
                    "content": json.dumps(
                        {
                            "priority_fact_ids": ["fact"],
                            "priority_task_codes": [
                                "source_integrity",
                                "process_decisions",
                                "evidence_gaps",
                                "final_brief",
                            ],
                        }
                    ),
                },
            }
        ],
        "usage": {
            "prompt_tokens": 21,
            "completion_tokens": 9,
            "total_tokens": 30,
            "cost": 0.0021,
        },
    }

    class GeneratedSdkChat:
        def send(self, **_kwargs):
            nonlocal provider_calls
            provider_calls += 1
            response_value = _http_response(json.dumps(provider_payload))
            return unmarshal_json_response(components.ChatResult, response_value)

    class FakeOpenRouter:
        def __init__(self, **_kwargs):
            self.chat = GeneratedSdkChat()

    def metadata_transport(*_args):
        nonlocal metadata_calls
        metadata_calls += 1
        return {
            "data": {
                "id": "gen-plan-drift",
                "model": OPENROUTER_MODEL,
                "provider_name": "DeepInfra",
                "native_tokens_prompt": 31,
                "native_tokens_completion": 11,
                "total_cost": 0.0033,
                "usage": 0.0033,
                "finish_reason": "stop",
            }
        }

    monkeypatch.setattr(langchain_runtime, "OpenRouter", FakeOpenRouter)
    storage = Storage(str(tmp_path / "sdk-drift-specialist-nonstop.db"))
    runner = InstrumentedStructuredAgent(
        storage,
        metadata_transport=metadata_transport,
        api_key_provider=lambda: "runtime-only-test-value",
    )

    with pytest.raises(AgentInvocationFailure, match="provider_finish_reason"):
        _invoke_plan(runner, run_id="run-sdk-drift-specialist-nonstop")

    assert provider_calls == 1
    assert metadata_calls == 1
    ledger = storage.sanitized_model_ledger()[0]
    assert ledger["outcome"] == "failed"
    assert ledger["error_invariant"] == "provider_finish_reason"
    assert ledger["response_id"] == "gen-plan-drift"
    assert ledger["finish_reason"] == "length"
    assert ledger["actual_cost_usd"] == pytest.approx(0.0033)
    assert storage.cached_model_output(ledger["cache_key"]) is None


def test_specialist_protocol_failure_has_bounded_invariant_and_ledger(tmp_path: Path):
    class Runnable:
        def invoke(self, *_args, **_kwargs):
            raise langchain_runtime.OpenRouterProtocolError()

    storage = Storage(str(tmp_path / "protocol-failure.db"))
    runner = InstrumentedStructuredAgent(
        storage,
        runnable_factory=lambda *_args: Runnable(),
        api_key_provider=lambda: "runtime-only-test-value",
    )

    with pytest.raises(AgentInvocationFailure, match="provider_response_envelope") as caught:
        _invoke_plan(runner, run_id="run-protocol-failure")

    ledger = storage.model_calls()[0]
    assert ledger["outcome"] == "failed"
    assert ledger["error_type"] == "OpenRouterProtocolError"
    assert ledger["error_invariant"] == "provider_response_envelope"
    assert caught.value.safe_context["call_id"] == ledger["call_id"]
    assert "response envelope" not in json.dumps(storage.sanitized_model_ledger())


def test_specialist_upstream_rejection_retains_only_safe_unknown_cost_evidence(
    tmp_path: Path,
):
    inference_calls = 0

    class Runnable:
        def invoke(self, *_args, **_kwargs):
            nonlocal inference_calls
            inference_calls += 1
            raise langchain_runtime.OpenRouterUpstreamRejectionError(
                response_id="gen-1786483162-CCCCCCCCCCCCCCCCCCCC",
                provider_error_code=400,
            )

    storage = Storage(str(tmp_path / "specialist-upstream-rejection.db"))
    runner = InstrumentedStructuredAgent(
        storage,
        runnable_factory=lambda *_args: Runnable(),
        api_key_provider=lambda: "runtime-only-test-value",
    )

    with pytest.raises(
        AgentInvocationFailure,
        match="provider_upstream_rejection",
    ) as captured:
        _invoke_plan(runner, run_id="run-specialist-upstream-rejection")

    assert inference_calls == 1
    assert captured.value.safe_context["response_id"] == (
        "gen-1786483162-CCCCCCCCCCCCCCCCCCCC"
    )
    assert captured.value.safe_context["provider_error_code"] == 400
    ledger = storage.sanitized_model_ledger()[0]
    assert ledger["outcome"] == "failed"
    assert ledger["error_invariant"] == "provider_upstream_rejection"
    assert ledger["response_id"] == "gen-1786483162-CCCCCCCCCCCCCCCCCCCC"
    assert ledger["provider_error_code"] == 400
    assert ledger["actual_cost_usd"] is None
    assert "usage_source" not in ledger
    assert "prompt_tokens" not in ledger
    assert storage.cached_model_output(ledger["cache_key"]) is None
    assert storage.model_call_summary()["actual_cost_complete"] is False
    assert storage.model_call_summary()["unknown_cost_call_count"] == 1


def test_specialist_upstream_rejection_receipt_exposes_only_bounded_status(
    tmp_path: Path,
):
    _, _, _, _, package, canonicalization, result = graph_fixture(tmp_path)
    receipts: list[dict[str, Any]] = []

    class FailingRunner:
        calls = 0

        def invoke(self, **values):
            self.calls += 1
            raise AgentInvocationFailure(
                values["agent_id"],
                "provider_upstream_rejection",
                safe_context={
                    "call_id": "modelcall-specialist-rejected",
                    "parent_call_id": values["parent_call_id"],
                    "delegation_id": values["delegation_id"],
                    "response_id": "gen-1786483163-DDDDDDDDDDDDDDDDDDDD",
                    "provider_error_code": 400,
                    "outcome": "failed",
                },
            )

    runner = FailingRunner()
    orchestrator = NemotronMultiAgentOrchestrator(
        Storage(str(tmp_path / "specialist-receipt.db")),
        agent_runner=runner,
    )

    with pytest.raises(AgentInvocationFailure, match="provider_upstream_rejection"):
        orchestrator.invoke(
            run_id="run-specialist-receipt",
            orchestration_id="orch-specialist-receipt",
            observable_package=package,
            canonicalization=canonicalization,
            facts=result["facts"],
            process=result["process"],
            checklist=result["checklist"],
            verification=result["verification"],
            progress_sink=receipts.append,
        )

    assert runner.calls == 1
    failure = next(item for item in receipts if item.get("receipt_type") == "agent_failed")
    assert failure["agent_id"] == "orchestrator_plan"
    assert failure["error_invariant"] == "provider_upstream_rejection"
    assert failure["response_id"] == "gen-1786483163-DDDDDDDDDDDDDDDDDDDD"
    assert failure["provider_error_code"] == 400
    assert "response_model" not in failure
    assert "upstream_provider" not in failure
    assert "usage_source" not in failure


def test_specialist_success_rejects_nonpinned_upstream_after_retaining_billing(
    tmp_path: Path,
):
    inference_calls = 0

    class Runnable:
        def invoke(self, *_args, **_kwargs):
            nonlocal inference_calls
            inference_calls += 1
            return _plan_envelope(
                provider_name="Together",
                usage={
                    "prompt_tokens": 31,
                    "completion_tokens": 11,
                    "total_tokens": 42,
                    "cost": 0.0031,
                },
            )

    storage = Storage(str(tmp_path / "specialist-wrong-upstream.db"))
    runner = InstrumentedStructuredAgent(
        storage,
        runnable_factory=lambda *_args: Runnable(),
        api_key_provider=lambda: "runtime-only-test-value",
    )

    with pytest.raises(
        AgentInvocationFailure,
        match="upstream_provider_policy",
    ):
        _invoke_plan(runner, run_id="run-specialist-wrong-upstream")

    assert inference_calls == 1
    ledger = storage.sanitized_model_ledger()[0]
    assert ledger["outcome"] == "failed"
    assert ledger["error_invariant"] == "upstream_provider_policy"
    assert ledger["response_id"] == "gen-plan"
    assert ledger["response_model"] == OPENROUTER_MODEL
    assert ledger["upstream_provider"] == "Together"
    assert ledger["actual_cost_usd"] == pytest.approx(0.0031)
    assert ledger["usage_source"] == "response"
    assert storage.cached_model_output(ledger["cache_key"]) is None


def test_specialist_blocked_and_actual_overrun_failures_keep_safe_ledger_lineage(
    tmp_path: Path,
):
    factory_calls = 0

    def forbidden_factory(*_args):
        nonlocal factory_calls
        factory_calls += 1
        raise AssertionError("missing credential must block before provider construction")

    blocked_storage = Storage(str(tmp_path / "blocked.db"))
    blocked_runner = InstrumentedStructuredAgent(
        blocked_storage,
        runnable_factory=forbidden_factory,
        api_key_provider=lambda: None,
    )
    with pytest.raises(AgentInvocationFailure, match="missing_credential") as blocked:
        _invoke_plan(blocked_runner, run_id="run-blocked")
    assert factory_calls == 0
    assert blocked.value.safe_context["outcome"] == "blocked_missing_credential"
    assert blocked_storage.model_calls()[0]["outcome"] == "blocked_missing_credential"

    cost_storage = Storage(str(tmp_path / "blocked-cost.db"))
    committed_call = cost_storage.create_model_call(
        run_id="prior",
        provider="openrouter",
        model=OPENROUTER_MODEL,
        cache_key="prior",
        purpose="prior paid call",
        call_count=1,
        estimated_cost_usd=25.0,
        outcome="started",
    )
    cost_storage.finish_model_call(
        committed_call, outcome="failed", actual_cost_usd=25.0
    )
    cost_runner = InstrumentedStructuredAgent(
        cost_storage,
        runnable_factory=forbidden_factory,
        api_key_provider=lambda: "runtime-only-test-value",
    )
    with pytest.raises(AgentInvocationFailure, match="cost_guard") as blocked_cost:
        _invoke_plan(cost_runner, run_id="run-blocked-cost")
    assert blocked_cost.value.safe_context["outcome"] == "blocked_cost_guard"
    assert cost_storage.model_calls()[-1]["outcome"] == "blocked_cost_guard"

    class ExpensiveRunnable:
        def invoke(self, *_args, **_kwargs):
            return _plan_envelope(
                usage={
                    "prompt_tokens": 20,
                    "completion_tokens": 10,
                    "total_tokens": 30,
                    "cost": 26.0,
                }
            )

    overrun_storage = Storage(str(tmp_path / "overrun.db"))
    overrun_runner = InstrumentedStructuredAgent(
        overrun_storage,
        runnable_factory=lambda *_args: ExpensiveRunnable(),
        api_key_provider=lambda: "runtime-only-test-value",
    )
    with pytest.raises(AgentInvocationFailure, match="actual_cost_overrun") as overrun:
        _invoke_plan(overrun_runner, run_id="run-overrun")
    assert overrun.value.safe_context["outcome"] == "actual_cost_overrun"
    assert overrun.value.safe_context["response_id"] == "gen-plan"
    ledger = overrun_storage.model_calls()[0]
    assert ledger["outcome"] == "actual_cost_overrun"
    assert ledger["actual_cost_usd"] == 26.0
