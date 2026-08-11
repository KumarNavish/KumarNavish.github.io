from __future__ import annotations

from collections.abc import Callable, Mapping
from dataclasses import dataclass
from hashlib import sha256
import json
import math
import operator
import os
import threading
from time import perf_counter, sleep
from typing import Annotated, Any, Literal, Protocol, TypedDict

from langchain_core.messages import HumanMessage, SystemMessage
from langgraph.config import get_stream_writer
from langgraph.graph import END, START, StateGraph
from pydantic import BaseModel, ConfigDict, Field

from .canonicalizer import (
    GENERATION_METADATA_POLL_ATTEMPTS,
    GENERATION_METADATA_POLL_INTERVAL_SECONDS,
    GENERATION_METADATA_TIMEOUT_SECONDS,
    INPUT_USD_PER_MILLION_TOKENS,
    OPENROUTER_ACCEPTED_RESPONSE_MODELS,
    OPENROUTER_MODEL,
    OPENROUTER_PROVIDER,
    OPENROUTER_URL,
    OUTPUT_USD_PER_MILLION_TOKENS,
    MetadataTransport,
    ModelCostGuardError,
    ModelResponseError,
    _default_metadata_transport,
    _generation_metadata_ledger_patch,
    cumulative_usd_cap,
    observable_source_reference_registry,
    resolve_observable_source_reference_id,
    source_reference_id,
)
from .storage import Storage
from .langchain_runtime import (
    OpenRouterProtocolError,
    assert_external_tracing_disabled,
    sanitize_provider_provenance,
    structured_nemotron_runnable,
)


MULTI_AGENT_VERSION = "1.0.2"
MULTI_AGENT_SCHEMA_VERSION = "casepath.nemotron-agent-dag/1.0.0"
MULTI_AGENT_AUTHORITY_MODE = "multi_agent_hybrid_guarded"
MULTI_AGENT_IMPLEMENTATION = "langgraph_stategraph_langchain_openrouter"
AGENT_RUNTIME_PROFILE = "nemotron_langgraph_multi_agent_hybrid_guarded"
LANGCHAIN_VERSION = "1.3.14"
LANGGRAPH_VERSION = "1.2.9"
LANGCHAIN_OPENROUTER_VERSION = "0.2.7"

AI_AGENT_IDS = (
    "canonical_facts",
    "orchestrator_plan",
    "document_source_integrity",
    "process_decision_mapping",
    "evidence_checklist",
    "final_claim_brief_audit",
)
MODEL_AGENT_IDS = AI_AGENT_IDS[1:]
DETERMINISTIC_GATE_IDS = (
    "deterministic_process_gate",
    "deterministic_evidence_gate",
    "whole_playbook_gate",
)
PARALLEL_GROUP = ("document_source_integrity", "process_decision_mapping")
EXECUTION_DELEGATIONS = (
    {"agent_id": "document_source_integrity", "dependencies": ["orchestrator_plan"]},
    {"agent_id": "process_decision_mapping", "dependencies": ["orchestrator_plan"]},
    {"agent_id": "evidence_checklist", "dependencies": ["deterministic_process_gate"]},
    {"agent_id": "final_claim_brief_audit", "dependencies": ["deterministic_evidence_gate"]},
)
DECISION_NORMALIZED_CANDIDATES = {
    "scope": ["supported_in_scope", "supported_out_of_scope", "unverified"],
    "dispute": ["present", "absent", "unverified"],
    "urgency": ["urgent", "not_urgent", "unverified"],
    "notification": ["notified", "not_notified", "unverified"],
    "recurrence": ["supported", "not_supported", "unverified"],
    "causation": ["building", "tenant_use", "mixed", "unresolved"],
}
EVIDENCE_STATUS_CANDIDATES = [
    "provided_sufficient",
    "provided_insufficient",
    "missing",
    "conditional",
    "not_applicable",
]

ROLE_OUTPUT_TOKENS = {
    "orchestrator_plan": 400,
    "document_source_integrity": 900,
    "process_decision_mapping": 900,
    "evidence_checklist": 2_000,
    "final_claim_brief_audit": 900,
}
ROLE_PURPOSES = {
    "orchestrator_plan": "bounded claim-agent focus and priority plan",
    "document_source_integrity": "bounded source-integrity proposals",
    "process_decision_mapping": "bounded process-decision proposals",
    "evidence_checklist": "bounded evidence-checklist proposals",
    "final_claim_brief_audit": "bounded final-claim-brief audit proposal",
}
ROLE_LABELS = {
    "orchestrator_plan": "Nemotron Orchestrator",
    "document_source_integrity": "Document and Source Integrity Agent",
    "process_decision_mapping": "Process Decision Mapping Agent",
    "evidence_checklist": "Evidence and Checklist Agent",
    "final_claim_brief_audit": "Final Claim Brief Agent",
}
ROLE_OUTPUT_ARTIFACTS = {
    "orchestrator_plan": "bounded_orchestration_focus",
    "document_source_integrity": "source_integrity_contribution",
    "process_decision_mapping": "process_mapping_contribution",
    "evidence_checklist": "evidence_checklist_contribution",
    "final_claim_brief_audit": "final_claim_brief_contribution",
}
ROLE_HANDOFFS = {
    "orchestrator_plan": ("canonical_facts", "document_source_integrity+process_decision_mapping"),
    "document_source_integrity": ("orchestrator_plan", "deterministic_process_gate"),
    "process_decision_mapping": ("orchestrator_plan", "deterministic_process_gate"),
    "evidence_checklist": ("deterministic_process_gate", "deterministic_evidence_gate"),
    "final_claim_brief_audit": ("deterministic_evidence_gate", "whole_playbook_gate"),
}


class AgentBoundaryError(RuntimeError):
    """Safe role/invariant-only error for a bounded model contribution."""

    def __init__(self, agent_id: str, invariant: str):
        super().__init__(f"{agent_id}: {invariant} invariant failed")
        self.agent_id = agent_id
        self.invariant = invariant


class AgentInvocationFailure(AgentBoundaryError):
    """Failed agent call carrying only ledger-safe provider provenance."""

    def __init__(
        self,
        agent_id: str,
        invariant: str,
        *,
        safe_context: Mapping[str, Any],
    ):
        super().__init__(agent_id, invariant)
        self.safe_context = dict(safe_context)


class _StrictModel(BaseModel):
    model_config = ConfigDict(extra="forbid")


class OrchestratorPlan(_StrictModel):
    focus_fact_ids: list[str]
    focus_source_ref_ids: list[str]
    priority_task_codes: list[
        Literal["source_integrity", "process_decisions", "evidence_gaps", "final_brief"]
    ]


class SourceIntegrityProposal(_StrictModel):
    artifact_id: str
    integrity_class: Literal["text_grounded", "visual_only", "metadata_only"]
    source_ref_ids: list[str]
    confidence: float = Field(ge=0, le=1)


class SourceIntegrityResponse(_StrictModel):
    proposals: list[SourceIntegrityProposal]


class ProcessDecisionProposal(_StrictModel):
    fact_id: str
    state: Literal["known", "unknown", "conflicting", "not_applicable"]
    normalized_value: str | None
    source_ref_ids: list[str]
    confidence: float = Field(ge=0, le=1)


class ProcessDecisionResponse(_StrictModel):
    proposals: list[ProcessDecisionProposal]


class EvidenceChecklistProposal(_StrictModel):
    item_id: str
    status: str
    artifact_ids: list[str]
    source_ref_ids: list[str]
    confidence: float = Field(ge=0, le=1)


class EvidenceChecklistResponse(_StrictModel):
    proposals: list[EvidenceChecklistProposal]


class FinalClaimBriefProposal(_StrictModel):
    current_node_id: str
    next_action_node_id: str
    source_ref_ids: list[str]
    confidence: float = Field(ge=0, le=1)


class FinalClaimBriefResponse(_StrictModel):
    proposal: FinalClaimBriefProposal


class AgentGraphState(TypedDict, total=False):
    run_id: str
    orchestration_id: str
    observable_package: dict[str, Any]
    canonicalization: dict[str, Any]
    facts: list[dict[str, Any]]
    process: dict[str, Any]
    checklist: dict[str, Any]
    verification: dict[str, Any]
    source_registry: list[dict[str, Any]]
    orchestrator_plan: dict[str, Any]
    orchestrator_call_id: str
    source_integrity: dict[str, Any]
    process_mapping: dict[str, Any]
    evidence_checklist: dict[str, Any]
    final_brief: dict[str, Any]
    audit_entries: Annotated[list[dict[str, Any]], operator.add]
    orchestration_audit: dict[str, Any]


class StructuredRunnable(Protocol):
    def invoke(self, value: Any, config: dict[str, Any] | None = None) -> Any: ...


RunnableFactory = Callable[[str, type[BaseModel], str, str, int], StructuredRunnable]
ContributionValidator = Callable[[dict[str, Any]], tuple[dict[str, Any], dict[str, Any]]]


_LOCKS_GUARD = threading.Lock()
_CACHE_KEY_LOCKS: dict[str, threading.Lock] = {}


def _cache_lock(cache_key: str) -> threading.Lock:
    with _LOCKS_GUARD:
        return _CACHE_KEY_LOCKS.setdefault(cache_key, threading.Lock())


def _json(value: Any) -> str:
    return json.dumps(value, sort_keys=True, ensure_ascii=False, separators=(",", ":"))


def _safe_hash(value: Any) -> str:
    return sha256(_json(value).encode("utf-8")).hexdigest()


def _reject_floats(value: Any, *, path: str = "$") -> None:
    if isinstance(value, float):
        raise AgentBoundaryError("accepted_artifact", f"float_at_{path}")
    if isinstance(value, Mapping):
        for key, child in value.items():
            _reject_floats(child, path=f"{path}.{key}")
    elif isinstance(value, list):
        for index, child in enumerate(value):
            _reject_floats(child, path=f"{path}[{index}]")


def accepted_artifact_hash(value: Any) -> str:
    """Hash a cross-runtime DTO only after excluding JSON float ambiguity."""

    _reject_floats(value)
    return _safe_hash(value)


def _confidence_basis_points(value: Any) -> int:
    if (
        not isinstance(value, (int, float))
        or isinstance(value, bool)
        or not math.isfinite(float(value))
        or not 0 <= float(value) <= 1
    ):
        raise AgentBoundaryError("provider", "confidence")
    return int(math.floor(float(value) * 10_000 + 0.5))


def _input_token_estimate(value: str) -> int:
    return max(1, math.ceil(len(value.encode("utf-8")) / 3))


def _estimated_cost(input_tokens: int, output_tokens: int) -> float:
    return round(
        input_tokens * INPUT_USD_PER_MILLION_TOKENS / 1_000_000
        + output_tokens * OUTPUT_USD_PER_MILLION_TOKENS / 1_000_000,
        8,
    )


def _ref_id(ref: Mapping[str, Any]) -> str:
    if ref.get("locator_kind") == "text_quote":
        return source_reference_id(dict(ref))
    public_locator = {
        key: ref[key]
        for key in (
            "artifact_id",
            "locator_kind",
            "page",
            "region",
            "observation",
            "field",
            "value",
        )
        if key in ref
    }
    return f"src_{_safe_hash(public_locator)[:24]}"


def _source_registry(package: dict[str, Any]) -> list[dict[str, Any]]:
    return observable_source_reference_registry(package)


def _integrity_class(media_type: str) -> str:
    if media_type.startswith("image/"):
        return "visual_only"
    if media_type in {"application/pdf", "message/rfc822"}:
        return "text_grounded"
    return "metadata_only"


def _expected_text_ref_ids(
    refs: list[dict[str, Any]],
    registry: list[dict[str, Any]],
) -> list[str]:
    return sorted(
        resolve_observable_source_reference_id(ref, registry)
        for ref in refs
        if ref.get("locator_kind") == "text_quote"
    )


def _assigned_focus(plan: Mapping[str, Any], task_code: str) -> dict[str, Any]:
    task_codes = plan["priority_task_codes"]
    return {
        "fact_ids": plan["focus_fact_ids"],
        "source_ref_ids": plan["focus_source_ref_ids"],
        "task_code": task_code,
        "priority_rank": task_codes.index(task_code),
    }


def _evidence_provider_payload(state: AgentGraphState) -> dict[str, Any]:
    focus_rank = {
        fact_id: index
        for index, fact_id in enumerate(state["orchestrator_plan"]["focus_fact_ids"])
    }
    return {
        "orchestrator_focus": _assigned_focus(
            state["orchestrator_plan"], "evidence_gaps"
        ),
        "evidence_candidates": [
            {
                "item_id": item["item_id"],
                "title": item["title"],
                "fact_id": item["fact_id"],
            }
            for item in sorted(
                state["checklist"]["items"],
                key=lambda value: (focus_rank[value["fact_id"]], value["item_id"]),
            )
        ],
        "allowed_statuses": EVIDENCE_STATUS_CANDIDATES,
        "fact_handoff": [
            {
                "fact_id": fact["fact_id"],
                "state": fact["state"],
                "source_ref_ids": _expected_text_ref_ids(
                    fact.get("source_refs", []), state["source_registry"]
                ),
            }
            for fact in sorted(
                state["facts"], key=lambda value: focus_rank[value["fact_id"]]
            )
        ],
        "artifact_candidates": [
            {"artifact_id": "message", "media_type": "text/plain"},
            {
                "artifact_id": "intake",
                "media_type": "application/casepath-intake+json",
            },
            *[
                {
                    "artifact_id": artifact["artifact_id"],
                    "media_type": artifact["media_type"],
                }
                for artifact in state["observable_package"].get("artifacts", [])
            ],
        ],
        "source_reference_registry": state["source_registry"],
    }


def _final_brief_provider_payload(state: AgentGraphState) -> dict[str, Any]:
    """Expose static topology and accepted upstream work, never applied answers."""

    source_items = state.get("source_integrity", {}).get("artifacts", [])
    process_items = state.get("process_mapping", {}).get("decisions", [])
    evidence_items = state.get("evidence_checklist", {}).get("items", [])
    focus_rank = {
        fact_id: index
        for index, fact_id in enumerate(state["orchestrator_plan"]["focus_fact_ids"])
    }
    canonical_items = sorted(
        state["facts"], key=lambda item: focus_rank[item["fact_id"]]
    )
    process_items = sorted(
        process_items, key=lambda item: focus_rank[item["fact_id"]]
    )
    relevant_source_ids = set(state["orchestrator_plan"]["focus_source_ref_ids"])
    for fact in canonical_items:
        relevant_source_ids.update(
            _expected_text_ref_ids(fact.get("source_refs", []), state["source_registry"])
        )
    for item in [*source_items, *process_items, *evidence_items]:
        relevant_source_ids.update(item.get("source_ref_ids", []))
    return {
        "orchestrator_focus": _assigned_focus(
            state["orchestrator_plan"], "final_brief"
        ),
        "static_process_topology": {
            "nodes": [
                {
                    "node_id": node["node_id"],
                    "title": node["title"],
                    "kind": node["kind"],
                    "main_spine": node["main_spine"],
                    "fact_ids": list(node.get("fact_ids", [])),
                    "activation": node.get("activation", "always"),
                    "branches": [
                        {
                            key: branch[key]
                            for key in ("branch_id", "label", "condition", "target")
                            if key in branch
                        }
                        for branch in node.get("branches", [])
                    ],
                }
                for node in state["process"]["nodes"]
            ],
            "edges": [
                {
                    key: edge[key]
                    for key in ("source", "target", "condition")
                    if key in edge
                }
                for edge in state["process"]["edges"]
            ],
            "evidence_bindings": [
                {
                    "item_id": item["item_id"],
                    "fact_id": item["fact_id"],
                    "node_id": item["node_id"],
                }
                for item in state["checklist"]["items"]
            ],
        },
        "canonical_fact_handoff": [
            {
                "fact_id": fact["fact_id"],
                "label": fact["label"],
                "state": fact["state"],
                "normalized_value": fact.get("normalized_value"),
                "source_ref_ids": _expected_text_ref_ids(
                    fact.get("source_refs", []), state["source_registry"]
                ),
            }
            for fact in canonical_items
        ],
        "prior_accepted_contributions": {
            "document_source_integrity": {
                "artifact_ids": [item["artifact_id"] for item in source_items],
                "source_ref_ids": sorted(
                    {
                        source_id
                        for item in source_items
                        for source_id in item.get("source_ref_ids", [])
                    }
                ),
                "fallback_artifact_ids": [
                    item["artifact_id"]
                    for item in source_items
                    if item.get("deterministic_fallback_applied") is True
                ],
            },
            "process_decision_mapping": {
                "decisions": [
                    {
                        key: item[key]
                        for key in (
                            "fact_id",
                            "state",
                            "normalized_value",
                            "source_ref_ids",
                            "confidence_basis_points",
                            "deterministic_fallback_applied",
                        )
                        if key in item
                    }
                    for item in process_items
                ]
            },
            "evidence_checklist": {
                "item_ids": [item["item_id"] for item in evidence_items],
                "source_ref_ids": sorted(
                    {
                        source_id
                        for item in evidence_items
                        for source_id in item.get("source_ref_ids", [])
                    }
                ),
                "fallback_item_ids": [
                    item["item_id"]
                    for item in evidence_items
                    if item.get("deterministic_fallback_applied") is True
                ],
            },
        },
        "source_reference_registry": [
            item
            for item in state["source_registry"]
            if item["source_ref_id"] in relevant_source_ids
        ],
    }
def _raw_metadata(raw: Any) -> tuple[dict[str, Any], dict[str, Any]]:
    if isinstance(raw, Mapping):
        response_metadata = raw.get("response_metadata")
        usage_metadata = raw.get("usage_metadata")
    else:
        response_metadata = getattr(raw, "response_metadata", None)
        usage_metadata = getattr(raw, "usage_metadata", None)
    return (
        dict(response_metadata) if isinstance(response_metadata, Mapping) else {},
        dict(usage_metadata) if isinstance(usage_metadata, Mapping) else {},
    )


def _partial_provider_identity(raw: Any) -> dict[str, Any]:
    response_metadata, _ = _raw_metadata(raw)
    sanitized, violation = sanitize_provider_provenance(
        response_id=response_metadata.get("id"),
        response_model=response_metadata.get("model_name") or response_metadata.get("model"),
        upstream_provider=response_metadata.get("provider_name")
        or response_metadata.get("upstream_provider"),
        finish_reason=response_metadata.get("finish_reason"),
    )
    return {
        "response_id": sanitized["response_id"],
        "response_model": sanitized["response_model"],
        "response_finish_reason": sanitized["finish_reason"],
        "upstream_provider": sanitized["upstream_provider"],
        "provenance_violation": violation,
    }


def _validate_provider_identity(identity: Mapping[str, Any]) -> None:
    if identity.get("provenance_violation") is not None:
        raise AgentBoundaryError("provider", "invalid_provenance")
    if identity.get("response_id") is None:
        raise AgentBoundaryError("provider", "response_identity")
    if identity.get("response_model") not in OPENROUTER_ACCEPTED_RESPONSE_MODELS:
        raise AgentBoundaryError("provider", "response_model")


def _response_usage(raw: Any, *, identity: dict[str, Any], latency_ms: float) -> dict[str, Any] | None:
    response_metadata, usage_metadata = _raw_metadata(raw)
    usage = response_metadata.get("usage")
    if not isinstance(usage, Mapping):
        usage = response_metadata.get("token_usage")
    usage = dict(usage) if isinstance(usage, Mapping) else {}
    prompt_tokens = usage.get("prompt_tokens", usage_metadata.get("input_tokens"))
    completion_tokens = usage.get("completion_tokens", usage_metadata.get("output_tokens"))
    total_tokens = usage.get("total_tokens", usage_metadata.get("total_tokens"))
    cost = usage.get("cost", response_metadata.get("cost"))
    upstream_provider = identity.get("upstream_provider")
    if (
        not isinstance(prompt_tokens, int)
        or isinstance(prompt_tokens, bool)
        or prompt_tokens <= 0
        or not isinstance(completion_tokens, int)
        or isinstance(completion_tokens, bool)
        or completion_tokens <= 0
        or not isinstance(total_tokens, int)
        or isinstance(total_tokens, bool)
        or total_tokens < prompt_tokens + completion_tokens
        or not isinstance(cost, (int, float))
        or isinstance(cost, bool)
        or not math.isfinite(float(cost))
        or float(cost) <= 0
    ):
        return None
    patch = {
        "latency_ms": latency_ms,
        "prompt_tokens": prompt_tokens,
        "completion_tokens": completion_tokens,
        "total_tokens": total_tokens,
        "actual_cost_usd": float(cost),
        "usage_source": "response",
        "finish_reason": identity["response_finish_reason"],
    }
    if upstream_provider is not None:
        patch["upstream_provider"] = upstream_provider
    if identity.get("response_id") is not None:
        patch["response_id"] = identity["response_id"]
    if identity.get("response_model") is not None:
        patch["response_model"] = identity["response_model"]
    return patch


def _model_dump(value: Any) -> dict[str, Any]:
    if isinstance(value, BaseModel):
        return value.model_dump(mode="json")
    if isinstance(value, Mapping):
        return dict(value)
    raise AgentBoundaryError("provider", "structured_response")


def _default_runnable_factory(
    agent_id: str,
    schema: type[BaseModel],
    api_key: str,
    orchestration_id: str,
    max_tokens: int,
) -> StructuredRunnable:
    # A structured runnable is used instead of a tool-loop agent so each graph node
    # makes exactly one provider-native schema call with no parsing/tool retries.
    return structured_nemotron_runnable(
        schema=schema,
        api_key=api_key,
        orchestration_id=orchestration_id,
        max_tokens=max_tokens,
    )


def _diagnostics(
    accepted_ids: list[str],
    rejected: list[dict[str, str]],
    *,
    ignored_count: int = 0,
) -> dict[str, Any]:
    return {
        "authority_mode": MULTI_AGENT_AUTHORITY_MODE,
        "accepted_item_ids": accepted_ids,
        "accepted_item_count": len(accepted_ids),
        "rejected_items": rejected,
        "rejected_item_count": len(rejected),
        "ignored_proposal_count": ignored_count,
        "deterministic_fallback_applied": bool(rejected),
    }


def _require_contribution_majority(agent_id: str, diagnostics: Mapping[str, Any]) -> None:
    accepted = diagnostics.get("accepted_item_count")
    rejected = diagnostics.get("rejected_item_count")
    if (
        not isinstance(accepted, int)
        or isinstance(accepted, bool)
        or not isinstance(rejected, int)
        or isinstance(rejected, bool)
        or accepted <= rejected
    ):
        raise AgentBoundaryError(agent_id, "model_contribution_majority")


@dataclass
class InstrumentedStructuredAgent:
    storage: Storage
    runnable_factory: RunnableFactory = _default_runnable_factory
    metadata_transport: MetadataTransport = _default_metadata_transport
    api_key_provider: Callable[[], str | None] = lambda: os.getenv("OPENROUTER_API_KEY")
    metadata_sleep: Callable[[float], None] = sleep

    def invoke(
        self,
        *,
        run_id: str,
        orchestration_id: str,
        agent_id: str,
        schema: type[BaseModel],
        system_prompt: str,
        provider_payload: dict[str, Any],
        validator: ContributionValidator,
        private_contract_hash: str,
        parent_call_id: str | None = None,
        delegation_id: str | None = None,
    ) -> dict[str, Any]:
        if agent_id not in MODEL_AGENT_IDS:
            raise AgentBoundaryError(agent_id, "registered_agent")
        cache_key = _safe_hash(
            {
                "implementation": MULTI_AGENT_IMPLEMENTATION,
                "version": MULTI_AGENT_VERSION,
                "model": OPENROUTER_MODEL,
                "agent_id": agent_id,
                "schema": schema.model_json_schema(),
                "payload": provider_payload,
                "private_contract_hash": private_contract_hash,
            }
        )
        with _cache_lock(cache_key):
            cached = self.storage.cached_model_output(cache_key)
            if isinstance(cached, dict):
                contribution = cached.get("contribution")
                diagnostics = cached.get("diagnostics")
                origin = cached.get("origin")
                if isinstance(contribution, dict) and isinstance(diagnostics, dict):
                    _require_contribution_majority(agent_id, diagnostics)
                    origin = origin if isinstance(origin, dict) else {}
                    call_id = self.storage.create_model_call(
                        run_id=run_id,
                        provider=OPENROUTER_PROVIDER,
                        model=OPENROUTER_MODEL,
                        cache_key=cache_key,
                        purpose=ROLE_PURPOSES[agent_id],
                        call_count=0,
                        estimated_cost_usd=0,
                        outcome="cache_hit",
                        provider_endpoint=OPENROUTER_URL,
                        implementation=MULTI_AGENT_IMPLEMENTATION,
                        orchestration_id=orchestration_id,
                        agent_id=agent_id,
                        agent_role=ROLE_LABELS[agent_id],
                        parent_call_id=parent_call_id,
                        delegation_id=delegation_id,
                    )
                    cache_provenance = {
                        key: origin[key]
                        for key in (
                            "origin_call_id",
                            "response_id",
                            "response_model",
                            "upstream_provider",
                            "origin_usage",
                            "origin_finish_reason",
                        )
                        if key in origin
                    }
                    self.storage.finish_model_call(
                        call_id,
                        outcome="cache_hit",
                        **diagnostics,
                        **cache_provenance,
                        usage_source="cache",
                        finish_reason=origin.get("origin_finish_reason"),
                    )
                    return {
                        "contribution": contribution,
                        "diagnostics": diagnostics,
                        "call_id": call_id,
                        "cache_key": cache_key,
                        "cache_hit": True,
                        "outcome": "cache_hit",
                        **cache_provenance,
                        "usage_source": "cache",
                    }
            return self._invoke_uncached(
                run_id=run_id,
                orchestration_id=orchestration_id,
                agent_id=agent_id,
                schema=schema,
                system_prompt=system_prompt,
                provider_payload=provider_payload,
                validator=validator,
                cache_key=cache_key,
                parent_call_id=parent_call_id,
                delegation_id=delegation_id,
            )

    def _invoke_uncached(
        self,
        *,
        run_id: str,
        orchestration_id: str,
        agent_id: str,
        schema: type[BaseModel],
        system_prompt: str,
        provider_payload: dict[str, Any],
        validator: ContributionValidator,
        cache_key: str,
        parent_call_id: str | None,
        delegation_id: str | None,
    ) -> dict[str, Any]:
        assert_external_tracing_disabled()
        user_prompt = _json(provider_payload)
        max_tokens = ROLE_OUTPUT_TOKENS[agent_id]
        estimated_tokens = _input_token_estimate(system_prompt + "\n" + user_prompt)
        estimated_cost = _estimated_cost(estimated_tokens, max_tokens)
        cap = cumulative_usd_cap()
        key = self.api_key_provider()
        with self.storage.lock:
            if self.storage.model_cost_committed_or_reserved() + estimated_cost > cap:
                blocked_call_id = self.storage.create_model_call(
                    run_id=run_id,
                    provider=OPENROUTER_PROVIDER,
                    model=OPENROUTER_MODEL,
                    cache_key=cache_key,
                    purpose=ROLE_PURPOSES[agent_id],
                    call_count=0,
                    estimated_cost_usd=estimated_cost,
                    outcome="blocked_cost_guard",
                    provider_endpoint=OPENROUTER_URL,
                    implementation=MULTI_AGENT_IMPLEMENTATION,
                    orchestration_id=orchestration_id,
                    agent_id=agent_id,
                    agent_role=ROLE_LABELS[agent_id],
                    parent_call_id=parent_call_id,
                    delegation_id=delegation_id,
                )
                raise AgentInvocationFailure(
                    agent_id,
                    "cost_guard",
                    safe_context={
                        "call_id": blocked_call_id,
                        "parent_call_id": parent_call_id,
                        "delegation_id": delegation_id,
                        "outcome": "blocked_cost_guard",
                    },
                )
            if not key:
                blocked_call_id = self.storage.create_model_call(
                    run_id=run_id,
                    provider=OPENROUTER_PROVIDER,
                    model=OPENROUTER_MODEL,
                    cache_key=cache_key,
                    purpose=ROLE_PURPOSES[agent_id],
                    call_count=0,
                    estimated_cost_usd=estimated_cost,
                    outcome="blocked_missing_credential",
                    provider_endpoint=OPENROUTER_URL,
                    implementation=MULTI_AGENT_IMPLEMENTATION,
                    orchestration_id=orchestration_id,
                    agent_id=agent_id,
                    agent_role=ROLE_LABELS[agent_id],
                    parent_call_id=parent_call_id,
                    delegation_id=delegation_id,
                )
                raise AgentInvocationFailure(
                    agent_id,
                    "missing_credential",
                    safe_context={
                        "call_id": blocked_call_id,
                        "parent_call_id": parent_call_id,
                        "delegation_id": delegation_id,
                        "outcome": "blocked_missing_credential",
                    },
                )
            call_id = self.storage.create_model_call(
                run_id=run_id,
                provider=OPENROUTER_PROVIDER,
                model=OPENROUTER_MODEL,
                cache_key=cache_key,
                purpose=ROLE_PURPOSES[agent_id],
                call_count=1,
                estimated_cost_usd=estimated_cost,
                outcome="started",
                provider_endpoint=OPENROUTER_URL,
                implementation=MULTI_AGENT_IMPLEMENTATION,
                orchestration_id=orchestration_id,
                agent_id=agent_id,
                agent_role=ROLE_LABELS[agent_id],
                parent_call_id=parent_call_id,
                delegation_id=delegation_id,
            )
        started = perf_counter()
        provider_patch: dict[str, Any] = {}
        finished = False
        try:
            runnable = self.runnable_factory(agent_id, schema, key, orchestration_id, max_tokens)
            assert_external_tracing_disabled()
            response = runnable.invoke(
                [SystemMessage(content=system_prompt), HumanMessage(content=user_prompt)],
                # Empty callbacks prevent LangSmith/global callback persistence. The
                # sanitized SQLite model-call ledger is the sole audit sink.
                config={"callbacks": []},
            )
            if not isinstance(response, Mapping):
                raise AgentBoundaryError(agent_id, "structured_response_envelope")
            raw = response.get("raw")
            latency_ms = round((perf_counter() - started) * 1000, 3)
            identity = _partial_provider_identity(raw)
            provider_patch = {"latency_ms": latency_ms}
            if identity["response_id"] is not None:
                provider_patch["response_id"] = identity["response_id"]
            if identity["response_model"] is not None:
                provider_patch["response_model"] = identity["response_model"]
            if identity["response_finish_reason"] is not None:
                provider_patch["finish_reason"] = identity["response_finish_reason"]
            if identity["provenance_violation"] is not None:
                provider_patch.update(identity["provenance_violation"])
            usage = _response_usage(raw, identity=identity, latency_ms=latency_ms)
            if usage is not None:
                provider_patch.update(usage)
            needs_metadata = usage is None or (
                identity["provenance_violation"] is None
                and (
                    identity.get("response_finish_reason") is None
                    or identity.get("upstream_provider") is None
                )
            )
            if needs_metadata and identity["response_id"] is not None:
                metadata_patch = _generation_metadata_ledger_patch(
                    identity=identity,
                    headers={"Authorization": f"Bearer {key}"},
                    metadata_transport=self.metadata_transport,
                    metadata_sleep=self.metadata_sleep,
                    timeout_seconds=GENERATION_METADATA_TIMEOUT_SECONDS,
                    poll_attempts=GENERATION_METADATA_POLL_ATTEMPTS,
                    poll_interval_seconds=GENERATION_METADATA_POLL_INTERVAL_SECONDS,
                    latency_ms=latency_ms,
                )
                provider_patch.update(metadata_patch)
                if identity["response_finish_reason"] is not None:
                    provider_patch["finish_reason"] = identity[
                        "response_finish_reason"
                    ]
            if "actual_cost_usd" in provider_patch:
                with self.storage.lock:
                    self.storage.finish_model_call(
                        call_id, outcome="provider_succeeded", **provider_patch
                    )
                    actual_overrun = self.storage.model_actual_cost_total() > cap
            else:
                actual_overrun = False
            _validate_provider_identity(identity)
            if (
                provider_patch.get("generation_model") is not None
                and provider_patch["generation_model"]
                not in OPENROUTER_ACCEPTED_RESPONSE_MODELS
            ):
                raise AgentBoundaryError(agent_id, "generation_metadata_model")
            if "actual_cost_usd" not in provider_patch:
                raise AgentBoundaryError(agent_id, "generation_metadata_completeness")
            if provider_patch.get("finish_reason") != "stop":
                raise AgentBoundaryError(agent_id, "provider_finish_reason")
            if response.get("parsing_error") is not None or response.get("parsed") is None:
                raise AgentBoundaryError(agent_id, "provider_native_schema")
            parsed = _model_dump(response["parsed"])
            contribution, diagnostics = validator(parsed)
            _require_contribution_majority(agent_id, diagnostics)
            outcome = (
                "succeeded"
                if diagnostics.get("rejected_item_count") == 0
                else "succeeded_with_guarded_fallback"
            )
            with self.storage.lock:
                self.storage.finish_model_call(
                    call_id,
                    outcome="actual_cost_overrun" if actual_overrun else outcome,
                    **provider_patch,
                    **diagnostics,
                    canonical_output={
                        "contribution": contribution,
                        "diagnostics": diagnostics,
                        "origin": {
                            "origin_call_id": call_id,
                            "response_id": provider_patch["response_id"],
                            "response_model": provider_patch["response_model"],
                            "upstream_provider": provider_patch["upstream_provider"],
                            "usage_source": provider_patch["usage_source"],
                            "origin_finish_reason": provider_patch["finish_reason"],
                            "origin_usage": {
                                "prompt_tokens": provider_patch["prompt_tokens"],
                                "completion_tokens": provider_patch["completion_tokens"],
                                "total_tokens": provider_patch["total_tokens"],
                                "actual_cost_usd": provider_patch["actual_cost_usd"],
                                "usage_source": provider_patch["usage_source"],
                            },
                        },
                    },
                )
            finished = True
            if actual_overrun:
                raise AgentInvocationFailure(
                    agent_id,
                    "actual_cost_overrun",
                    safe_context={
                        "call_id": call_id,
                        "parent_call_id": parent_call_id,
                        "delegation_id": delegation_id,
                        "outcome": "actual_cost_overrun",
                        **{
                            key: provider_patch[key]
                            for key in (
                                "response_id",
                                "response_model",
                                "upstream_provider",
                                "usage_source",
                                "finish_reason",
                            )
                        },
                    },
                )
            return {
                "contribution": contribution,
                "diagnostics": diagnostics,
                "call_id": call_id,
                "cache_key": cache_key,
                "cache_hit": False,
                "outcome": outcome,
                "origin_call_id": call_id,
                "response_id": provider_patch["response_id"],
                "response_model": provider_patch["response_model"],
                "upstream_provider": provider_patch["upstream_provider"],
                "usage_source": provider_patch["usage_source"],
                "finish_reason": provider_patch["finish_reason"],
                "usage": {
                    "prompt_tokens": provider_patch["prompt_tokens"],
                    "completion_tokens": provider_patch["completion_tokens"],
                    "total_tokens": provider_patch["total_tokens"],
                    "actual_cost_usd": provider_patch["actual_cost_usd"],
                    "usage_source": provider_patch["usage_source"],
                },
            }
        except Exception as exc:
            if isinstance(exc, ModelResponseError):
                for key in (
                    "latency_ms",
                    "metadata_latency_ms",
                    "metadata_poll_count",
                    "prompt_tokens",
                    "completion_tokens",
                    "total_tokens",
                    "actual_cost_usd",
                    "usage_source",
                    "response_id",
                    "response_model",
                    "upstream_provider",
                    "finish_reason",
                    "invalid_provenance_field",
                    "invalid_provenance_value_hash",
                ):
                    if key in exc.safe_context:
                        provider_patch[key] = exc.safe_context[key]
            if not finished:
                patch = {
                    **provider_patch,
                    "latency_ms": provider_patch.get(
                        "latency_ms", round((perf_counter() - started) * 1000, 3)
                    ),
                    "error_type": type(exc).__name__,
                    "error_agent_id": agent_id,
                }
                if isinstance(exc, (AgentBoundaryError, ModelResponseError, OpenRouterProtocolError)):
                    patch["error_invariant"] = exc.invariant
                self.storage.finish_model_call(call_id, outcome="failed", **patch)
            if isinstance(exc, (ModelCostGuardError, AgentInvocationFailure)):
                raise
            invariant = (
                exc.invariant
                if isinstance(exc, (AgentBoundaryError, ModelResponseError, OpenRouterProtocolError))
                else "provider_invocation"
            )
            safe_context = {
                "call_id": call_id,
                "parent_call_id": parent_call_id,
                "delegation_id": delegation_id,
                "outcome": "failed",
                **{
                    key: provider_patch[key]
                    for key in (
                        "response_id",
                        "response_model",
                        "upstream_provider",
                        "usage_source",
                        "finish_reason",
                        "invalid_provenance_field",
                        "invalid_provenance_value_hash",
                    )
                    if key in provider_patch
                },
            }
            raise AgentInvocationFailure(
                agent_id,
                invariant,
                safe_context=safe_context,
            ) from None


def _proposal_map(values: Any, key: str, agent_id: str) -> tuple[dict[str, dict[str, Any]], int]:
    if not isinstance(values, list):
        raise AgentBoundaryError(agent_id, "proposal_list")
    mapped: dict[str, dict[str, Any]] = {}
    duplicates = 0
    for value in values:
        if not isinstance(value, dict) or not isinstance(value.get(key), str):
            raise AgentBoundaryError(agent_id, "proposal_shape")
        item_id = value[key]
        if item_id in mapped:
            duplicates += 1
        else:
            mapped[item_id] = value
    return mapped, duplicates


def _plan_validator(
    *,
    allowed_fact_ids: set[str],
    allowed_source_ids: set[str],
    source_artifact_by_id: Mapping[str, str],
    required_text_artifact_ids: set[str],
) -> ContributionValidator:
    allowed_task_codes = {
        "source_integrity",
        "process_decisions",
        "evidence_gaps",
        "final_brief",
    }

    def validate(value: dict[str, Any]) -> tuple[dict[str, Any], dict[str, Any]]:
        fact_ids = value.get("focus_fact_ids")
        source_ids = value.get("focus_source_ref_ids")
        task_codes = value.get("priority_task_codes")
        accepted = (
            isinstance(fact_ids, list)
            and bool(fact_ids)
            and len(set(fact_ids)) == len(fact_ids)
            and set(fact_ids) == allowed_fact_ids
            and isinstance(source_ids, list)
            and bool(source_ids)
            and len(set(source_ids)) == len(source_ids)
            and set(source_ids) <= allowed_source_ids
            and {
                source_artifact_by_id[source_id]
                for source_id in source_ids
            }
            >= required_text_artifact_ids
            and isinstance(task_codes, list)
            and len(task_codes) == len(allowed_task_codes)
            and len(set(task_codes)) == len(task_codes)
            and set(task_codes) == allowed_task_codes
        )
        contribution = {
            "focus_fact_ids": list(fact_ids) if accepted else [],
            "focus_source_ref_ids": list(source_ids) if accepted else [],
            "priority_task_codes": task_codes if accepted else [],
            "contribution_type": "constrained_focus_prioritization",
            "attribution": "Nemotron Orchestrator" if accepted else "deterministic_application",
        }
        return contribution, _diagnostics(
            ["orchestration_focus"] if accepted else [],
            []
            if accepted
            else [{"item_id": "orchestration_focus", "invariant": "bounded_focus_selection"}],
        )

    return validate


@dataclass
class NemotronMultiAgentOrchestrator:
    storage: Storage
    agent_runner: InstrumentedStructuredAgent | None = None

    def __post_init__(self) -> None:
        self.agent_runner = self.agent_runner or InstrumentedStructuredAgent(self.storage)
        builder = StateGraph(AgentGraphState)
        builder.add_node("canonical_facts", self._canonical_facts_node)
        builder.add_node("orchestrator_plan", self._orchestrator_plan_node)
        builder.add_node("document_source_integrity", self._source_integrity_node)
        builder.add_node("process_decision_mapping", self._process_mapping_node)
        builder.add_node("deterministic_process_gate", self._process_gate_node)
        builder.add_node("evidence_checklist", self._evidence_node)
        builder.add_node("deterministic_evidence_gate", self._evidence_gate_node)
        builder.add_node("final_claim_brief_audit", self._final_brief_node)
        builder.add_node("whole_playbook_gate", self._whole_playbook_gate_node)
        builder.add_edge(START, "canonical_facts")
        builder.add_edge("canonical_facts", "orchestrator_plan")
        builder.add_edge("orchestrator_plan", "document_source_integrity")
        builder.add_edge("orchestrator_plan", "process_decision_mapping")
        builder.add_edge(
            ["document_source_integrity", "process_decision_mapping"],
            "deterministic_process_gate",
        )
        builder.add_edge("deterministic_process_gate", "evidence_checklist")
        builder.add_edge("evidence_checklist", "deterministic_evidence_gate")
        builder.add_edge("deterministic_evidence_gate", "final_claim_brief_audit")
        builder.add_edge("final_claim_brief_audit", "whole_playbook_gate")
        builder.add_edge("whole_playbook_gate", END)
        self.graph = builder.compile()

    def invoke(
        self,
        *,
        run_id: str,
        orchestration_id: str,
        observable_package: dict[str, Any],
        canonicalization: dict[str, Any],
        facts: list[dict[str, Any]],
        process: dict[str, Any],
        checklist: dict[str, Any],
        verification: dict[str, Any],
        progress_sink: Callable[[dict[str, Any]], None] | None = None,
    ) -> dict[str, Any]:
        input_state: AgentGraphState = {
            "run_id": run_id,
            "orchestration_id": orchestration_id,
            "observable_package": observable_package,
            "canonicalization": canonicalization,
            "facts": facts,
            "process": process,
            "checklist": checklist,
            "verification": verification,
            "source_registry": _source_registry(observable_package),
            "audit_entries": [],
        }
        audit: dict[str, Any] | None = None
        assert_external_tracing_disabled()
        for chunk in self.graph.stream(
            input_state,
            {"max_concurrency": 2, "callbacks": []},
            stream_mode=["updates", "custom"],
            version="v2",
        ):
            if chunk.get("type") == "custom":
                receipt = chunk.get("data")
                if progress_sink is not None and isinstance(receipt, dict):
                    progress_sink(receipt)
                continue
            data = chunk.get("data")
            if not isinstance(data, dict):
                continue
            update = data.get("whole_playbook_gate")
            if isinstance(update, dict) and isinstance(update.get("orchestration_audit"), dict):
                audit = update["orchestration_audit"]
        if audit is None:
            raise AgentBoundaryError("whole_playbook_gate", "stream_completion")
        return audit

    @staticmethod
    def _canonical_facts_node(state: AgentGraphState) -> dict[str, Any]:
        canonicalization = state["canonicalization"]
        diagnostics = canonicalization.get("diagnostics", {})
        if (
            canonicalization.get("model") != OPENROUTER_MODEL
            or diagnostics.get("accepted_fact_count", 0)
            <= diagnostics.get("rejected_fact_count", 0)
        ):
            raise AgentBoundaryError("canonical_facts", "model_contribution")
        return {
            "audit_entries": [
                {
                    "stage": "understand",
                    "acceptance_scope": "pre_review_model_output",
                    "agent_id": "canonical_facts",
                    "role": "Guarded Canonical Facts Agent",
                    "actor_type": "nemotron_agent",
                    "model": OPENROUTER_MODEL,
                    "provider": OPENROUTER_PROVIDER,
                    "requested_model": OPENROUTER_MODEL,
                    "call_count": 0 if canonicalization.get("cache_hit") else 1,
                    "parent_call_id": None,
                    "delegation_id": None,
                    "call_id": canonicalization.get("call_id"),
                    "origin_call_id": canonicalization.get(
                        "origin_call_id", canonicalization.get("call_id")
                    ),
                    "response_id": canonicalization.get("response_id"),
                    "response_model": canonicalization.get("response_model"),
                    "upstream_provider": canonicalization.get("upstream_provider"),
                    "usage_source": canonicalization.get("usage_source"),
                    "finish_reason": canonicalization.get("finish_reason")
                    or canonicalization.get("origin_finish_reason"),
                    "usage": canonicalization.get("usage")
                    or canonicalization.get("origin_usage"),
                    "output_artifact": "canonical_claim_state",
                    "cache_hit": canonicalization.get("cache_hit", False),
                    "outcome": (
                        "cache_hit"
                        if canonicalization.get("cache_hit") is True
                        else "succeeded_with_guarded_fallback"
                        if diagnostics.get("rejected_fact_count")
                        else "succeeded"
                    ),
                    "accepted_count": diagnostics.get("accepted_fact_count"),
                    "accepted_ids": diagnostics.get("accepted_fact_ids", []),
                    "rejected_count": diagnostics.get("rejected_fact_count"),
                    "source_reference_projection_fact_ids": diagnostics.get(
                        "source_reference_projection_fact_ids", []
                    ),
                    "source_reference_projection_count": diagnostics.get(
                        "source_reference_projection_count", 0
                    ),
                    "deterministic_fallback_applied": bool(
                        diagnostics.get("deterministic_fallback_applied")
                    ),
                    "input_artifact_hash": _safe_hash(state["observable_package"]),
                    "output_artifact_hash": _safe_hash(state["facts"]),
                }
            ]
        }

    def _run_agent(
        self,
        state: AgentGraphState,
        *,
        agent_id: str,
        schema: type[BaseModel],
        system_prompt: str,
        provider_payload: dict[str, Any],
        validator: ContributionValidator,
        private_contract: Any,
    ) -> tuple[dict[str, Any], dict[str, Any]]:
        assert self.agent_runner is not None
        writer = get_stream_writer()
        delegation_id = f"dlg_{_safe_hash({'orchestration_id': state['orchestration_id'], 'agent_id': agent_id})[:20]}"
        parent_call_id = (
            state["canonicalization"].get("call_id")
            if agent_id == "orchestrator_plan"
            else state.get("orchestrator_call_id")
        )
        writer(
            {
                "receipt_type": "agent_started",
                "agent_id": agent_id,
                "role": ROLE_LABELS[agent_id],
                "actor_type": "nemotron_agent",
                "delegation_id": delegation_id,
                "parent_call_id": parent_call_id,
                "status": "started",
                "handoff_from": ROLE_HANDOFFS[agent_id][0],
                "handoff_to": ROLE_HANDOFFS[agent_id][1],
                "input_artifact": "bounded_provider_payload",
                "input_artifact_hash": _safe_hash(provider_payload),
            }
        )
        try:
            result = self.agent_runner.invoke(
                run_id=state["run_id"],
                orchestration_id=state["orchestration_id"],
                agent_id=agent_id,
                schema=schema,
                system_prompt=system_prompt,
                provider_payload=provider_payload,
                validator=validator,
                private_contract_hash=_safe_hash(private_contract),
                parent_call_id=parent_call_id,
                delegation_id=delegation_id,
            )
        except Exception as exc:
            safe_context = (
                exc.safe_context
                if isinstance(exc, AgentInvocationFailure)
                else {}
            )
            writer(
                {
                    "receipt_type": "agent_failed",
                    "acceptance_scope": "pre_review_model_output",
                    "agent_id": agent_id,
                    "role": ROLE_LABELS[agent_id],
                    "actor_type": "nemotron_agent",
                    "delegation_id": delegation_id,
                    "status": "failed",
                    "error_type": type(exc).__name__,
                    "error_invariant": getattr(exc, "invariant", None),
                    **{
                        key: safe_context[key]
                        for key in (
                            "call_id",
                            "parent_call_id",
                            "response_id",
                            "response_model",
                            "upstream_provider",
                            "usage_source",
                            "finish_reason",
                            "outcome",
                            "invalid_provenance_field",
                            "invalid_provenance_value_hash",
                        )
                        if key in safe_context
                    },
                    "handoff_from": ROLE_HANDOFFS[agent_id][0],
                    "handoff_to": "failure_boundary",
                    "input_artifact_hash": _safe_hash(provider_payload),
                }
            )
            raise
        diagnostics = result["diagnostics"]
        usage = result.get("usage") or result.get("origin_usage")
        audit = {
            "stage": agent_id,
            "acceptance_scope": "pre_review_model_output",
            "agent_id": agent_id,
            "role": ROLE_LABELS[agent_id],
            "actor_type": "nemotron_agent",
            "model": OPENROUTER_MODEL,
            "provider": OPENROUTER_PROVIDER,
            "requested_model": OPENROUTER_MODEL,
            "call_count": 0 if result["cache_hit"] else 1,
            "delegation_id": delegation_id,
            "parent_call_id": parent_call_id,
            "call_id": result["call_id"],
            "origin_call_id": result.get("origin_call_id", result["call_id"]),
            "cache_hit": result["cache_hit"],
            "outcome": result["outcome"],
            "response_model": result.get("response_model"),
            "upstream_provider": result.get("upstream_provider"),
            "usage_source": result.get("usage_source"),
            "response_id": result.get("response_id"),
            "finish_reason": result.get("finish_reason")
            or result.get("origin_finish_reason"),
            "usage": usage,
            "output_artifact": ROLE_OUTPUT_ARTIFACTS[agent_id],
            "accepted_ids": diagnostics["accepted_item_ids"],
            "accepted_count": diagnostics["accepted_item_count"],
            "rejected": diagnostics["rejected_items"],
            "rejected_count": diagnostics["rejected_item_count"],
            "deterministic_fallback_applied": diagnostics["deterministic_fallback_applied"],
            "input_artifact_hash": _safe_hash(provider_payload),
            "output_artifact_hash": _safe_hash(result["contribution"]),
        }
        writer(
            {
                "receipt_type": "agent_completed",
                "acceptance_scope": "pre_review_model_output",
                "agent_id": agent_id,
                "role": ROLE_LABELS[agent_id],
                "actor_type": "nemotron_agent",
                "delegation_id": delegation_id,
                "status": "completed",
                "call_id": result["call_id"],
                "parent_call_id": parent_call_id,
                "response_id": result.get("response_id"),
                "outcome": result["outcome"],
                "response_model": result.get("response_model"),
                "upstream_provider": result.get("upstream_provider"),
                "usage_source": result.get("usage_source"),
                "accepted_count": diagnostics["accepted_item_count"],
                "rejected_count": diagnostics["rejected_item_count"],
                "deterministic_fallback_applied": diagnostics[
                    "deterministic_fallback_applied"
                ],
                "accepted_ids": diagnostics["accepted_item_ids"],
                "output_artifact": ROLE_OUTPUT_ARTIFACTS[agent_id],
                "handoff_from": ROLE_HANDOFFS[agent_id][0],
                "handoff_to": ROLE_HANDOFFS[agent_id][1],
                "output_artifact_hash": _safe_hash(result["contribution"]),
            }
        )
        return result["contribution"], audit

    def _orchestrator_plan_node(self, state: AgentGraphState) -> dict[str, Any]:
        allowed_fact_ids = {fact["fact_id"] for fact in state["facts"]}
        allowed_source_ids = {item["source_ref_id"] for item in state["source_registry"]}
        source_artifact_by_id = {
            item["source_ref_id"]: item["artifact_id"] for item in state["source_registry"]
        }
        required_text_artifact_ids = {
            item["artifact_id"]
            for item in state["observable_package"].get("artifacts", [])
            if _integrity_class(item["media_type"]) == "text_grounded"
        }
        contribution, audit = self._run_agent(
            state,
            agent_id="orchestrator_plan",
            schema=OrchestratorPlan,
            system_prompt=(
                "Select every supplied observable fact ID, the smallest source-reference focus that includes at "
                "least one passage for every text-bearing artifact, and every supplied task code for the "
                "specialist workflow. Do not return topology, expected decisions, legal conclusions, or prose."
            ),
            provider_payload={
                "schema_version": MULTI_AGENT_SCHEMA_VERSION,
                "fact_candidates": [
                    {"fact_id": fact["fact_id"], "label": fact["label"]}
                    for fact in state["facts"]
                ],
                "source_reference_candidates": state["source_registry"],
                "task_codes": [
                    "source_integrity",
                    "process_decisions",
                    "evidence_gaps",
                    "final_brief",
                ],
            },
            validator=_plan_validator(
                allowed_fact_ids=allowed_fact_ids,
                allowed_source_ids=allowed_source_ids,
                source_artifact_by_id=source_artifact_by_id,
                required_text_artifact_ids=required_text_artifact_ids,
            ),
            private_contract={
                "allowed_fact_ids": sorted(allowed_fact_ids),
                "allowed_source_ids": sorted(allowed_source_ids),
            },
        )
        return {
            "orchestrator_plan": contribution,
            "orchestrator_call_id": audit["call_id"],
            "audit_entries": [audit],
        }

    def _source_integrity_node(self, state: AgentGraphState) -> dict[str, Any]:
        registry = state["source_registry"]
        registry_by_id = {item["source_ref_id"]: item for item in registry}
        focused_source_order = state["orchestrator_plan"]["focus_source_ref_ids"]
        focused_source_ids = set(focused_source_order)
        focused_refs_by_artifact: dict[str, list[str]] = {}
        for source_id in focused_source_order:
            ref = registry_by_id[source_id]
            focused_refs_by_artifact.setdefault(ref["artifact_id"], []).append(source_id)
        expected: dict[str, dict[str, Any]] = {}
        for artifact in state["observable_package"].get("artifacts", []):
            integrity_class = _integrity_class(artifact["media_type"])
            fallback_refs = focused_refs_by_artifact.get(artifact["artifact_id"], [])
            if integrity_class == "text_grounded" and not fallback_refs:
                raise AgentBoundaryError(
                    "document_source_integrity", "orchestrator_text_source_coverage"
                )
            expected[artifact["artifact_id"]] = {
                "artifact_id": artifact["artifact_id"],
                "integrity_class": integrity_class,
                # Private fallback is bounded to one plan-selected observable ref.
                "source_ref_ids": fallback_refs[:1] if integrity_class == "text_grounded" else [],
            }

        def validate(value: dict[str, Any]) -> tuple[dict[str, Any], dict[str, Any]]:
            proposed, duplicates = _proposal_map(
                value.get("proposals"), "artifact_id", "document_source_integrity"
            )
            accepted: list[str] = []
            rejected: list[dict[str, str]] = []
            output: list[dict[str, Any]] = []
            for item_id, oracle in expected.items():
                proposal = proposed.get(item_id)
                source_ids = proposal.get("source_ref_ids") if proposal is not None else None
                matches = (
                    proposal is not None
                    and proposal.get("artifact_id") == item_id
                    and proposal.get("integrity_class") == oracle["integrity_class"]
                    and isinstance(source_ids, list)
                    and len(set(source_ids)) == len(source_ids)
                    and set(source_ids) <= focused_source_ids
                    and all(
                        source_id in registry_by_id
                        and registry_by_id[source_id]["artifact_id"] == item_id
                        for source_id in source_ids
                    )
                    and (
                        bool(source_ids)
                        if oracle["integrity_class"] == "text_grounded"
                        else not source_ids
                    )
                )
                if matches:
                    accepted.append(item_id)
                else:
                    rejected.append({"item_id": item_id, "invariant": "source_integrity_contract"})
                output.append(
                    {
                        **oracle,
                        "source_ref_ids": source_ids if matches else oracle["source_ref_ids"],
                        "confidence_basis_points": _confidence_basis_points(
                            proposal["confidence"] if matches else 1
                        ),
                        "attribution": ROLE_LABELS["document_source_integrity"] if matches else "deterministic_application",
                        "deterministic_fallback_applied": not matches,
                    }
                )
            ignored = len(set(proposed) - set(expected)) + duplicates
            return {"artifacts": output}, _diagnostics(accepted, rejected, ignored_count=ignored)

        contribution, audit = self._run_agent(
            state,
            agent_id="document_source_integrity",
            schema=SourceIntegrityResponse,
            system_prompt=(
                "Assess every supplied artifact using only its observable media class and a small nonempty "
                "subset of the orchestrator-selected source-reference IDs for each text artifact. Text IDs "
                "must belong to that artifact; visual and metadata-only artifacts use no text IDs. "
                "Return no prose, legal conclusions, process decisions, or hidden metadata."
            ),
            provider_payload={
                "orchestrator_focus": _assigned_focus(
                    state["orchestrator_plan"], "source_integrity"
                ),
                "artifact_candidates": [
                    {"artifact_id": item["artifact_id"], "media_type": item["media_type"]}
                    for item in state["observable_package"].get("artifacts", [])
                ],
                "source_reference_registry": [
                    registry_by_id[source_id] for source_id in focused_source_order
                ],
            },
            validator=validate,
            private_contract=expected,
        )
        return {"source_integrity": contribution, "audit_entries": [audit]}

    def _process_mapping_node(self, state: AgentGraphState) -> dict[str, Any]:
        focus_rank = {
            fact_id: index
            for index, fact_id in enumerate(
                state["orchestrator_plan"]["focus_fact_ids"]
            )
        }
        expected: dict[str, dict[str, Any]] = {}
        for fact in state["facts"]:
            if fact.get("controls_process") is True:
                expected[fact["fact_id"]] = {
                    "fact_id": fact["fact_id"],
                    "state": fact["state"],
                    "normalized_value": fact["normalized_value"],
                    "source_ref_ids": _expected_text_ref_ids(
                        fact.get("source_refs", []), state["source_registry"]
                    ),
                }

        def validate(value: dict[str, Any]) -> tuple[dict[str, Any], dict[str, Any]]:
            proposed, duplicates = _proposal_map(
                value.get("proposals"), "fact_id", "process_decision_mapping"
            )
            accepted: list[str] = []
            rejected: list[dict[str, str]] = []
            output: list[dict[str, Any]] = []
            for item_id, oracle in expected.items():
                proposal = proposed.get(item_id)
                matches = proposal is not None and all(
                    proposal.get(key) == oracle[key]
                    for key in ("fact_id", "state", "normalized_value", "source_ref_ids")
                )
                if matches:
                    accepted.append(item_id)
                else:
                    rejected.append({"item_id": item_id, "invariant": "process_decision_contract"})
                output.append(
                    {
                        **oracle,
                        "confidence_basis_points": _confidence_basis_points(
                            proposal["confidence"] if matches else 1
                        ),
                        "attribution": ROLE_LABELS["process_decision_mapping"] if matches else "deterministic_application",
                        "deterministic_fallback_applied": not matches,
                    }
                )
            ignored = len(set(proposed) - set(expected)) + duplicates
            return {"decisions": output}, _diagnostics(accepted, rejected, ignored_count=ignored)

        contribution, audit = self._run_agent(
            state,
            agent_id="process_decision_mapping",
            schema=ProcessDecisionResponse,
            system_prompt=(
                "Propose only bounded fact states, normalized values, confidence, and source-reference IDs. "
                "The application privately owns routing and rejects every mismatch; return no node or edge mapping."
            ),
            provider_payload={
                "orchestrator_focus": _assigned_focus(
                    state["orchestrator_plan"], "process_decisions"
                ),
                "fact_candidates": [
                    {
                        "fact_id": fact["fact_id"],
                        "label": fact["label"],
                        "allowed_states": ["known", "unknown", "conflicting", "not_applicable"],
                        "allowed_normalized_values": DECISION_NORMALIZED_CANDIDATES[
                            fact["decision_key"]
                        ],
                    }
                    for fact in sorted(
                        state["facts"], key=lambda item: focus_rank[item["fact_id"]]
                    )
                    if fact.get("controls_process") is True
                ],
                "source_reference_registry": state["source_registry"],
            },
            validator=validate,
            private_contract=expected,
        )
        return {"process_mapping": contribution, "audit_entries": [audit]}

    @staticmethod
    def _process_gate_node(state: AgentGraphState) -> dict[str, Any]:
        writer = get_stream_writer()
        if not state.get("source_integrity", {}).get("artifacts"):
            raise AgentBoundaryError("deterministic_process_gate", "source_contribution")
        if not state.get("process_mapping", {}).get("decisions"):
            raise AgentBoundaryError("deterministic_process_gate", "process_contribution")
        current = state["process"]["current_overlay"]["current_node_id"]
        if current != state["process"]["current_node"]:
            raise AgentBoundaryError("deterministic_process_gate", "current_node")
        input_hash = _safe_hash(
            {"source_integrity": state["source_integrity"], "process_mapping": state["process_mapping"]}
        )
        output_hash = accepted_artifact_hash(state["process"])
        writer(
            {
                "receipt_type": "gate_passed",
                "agent_id": "deterministic_process_gate",
                "role": "Deterministic Process Contract Gate",
                "actor_type": "deterministic_gate",
                "status": "completed",
                "handoff_from": "document_source_integrity+process_decision_mapping",
                "handoff_to": "evidence_checklist",
                "input_artifact": "parallel_specialist_contributions",
                "output_artifact": "verified_process_graph",
                "input_artifact_hash": input_hash,
                "output_artifact_hash": output_hash,
            }
        )
        return {
            "audit_entries": [
                {
                    "agent_id": "deterministic_process_gate",
                    "role": "Deterministic Process Contract Gate",
                    "actor_type": "deterministic_gate",
                    "model": None,
                    "outcome": "passed",
                    "input_artifact_hash": input_hash,
                    "output_artifact_hash": output_hash,
                }
            ]
        }

    def _evidence_node(self, state: AgentGraphState) -> dict[str, Any]:
        facts = {fact["fact_id"]: fact for fact in state["facts"]}
        expected: dict[str, dict[str, Any]] = {}
        for item in state["checklist"]["items"]:
            fact = facts[item["fact_id"]]
            expected[item["item_id"]] = {
                "item_id": item["item_id"],
                "status": item["status"],
                "artifact_ids": sorted(item.get("artifact_ids", [])),
                "source_ref_ids": _expected_text_ref_ids(
                    fact.get("source_refs", []), state["source_registry"]
                ),
            }

        def validate(value: dict[str, Any]) -> tuple[dict[str, Any], dict[str, Any]]:
            proposed, duplicates = _proposal_map(
                value.get("proposals"), "item_id", "evidence_checklist"
            )
            accepted: list[str] = []
            rejected: list[dict[str, str]] = []
            output: list[dict[str, Any]] = []
            for item_id, oracle in expected.items():
                proposal = proposed.get(item_id)
                matches = proposal is not None and all(
                    proposal.get(key) == oracle[key]
                    for key in ("item_id", "status", "artifact_ids", "source_ref_ids")
                )
                if matches:
                    accepted.append(item_id)
                else:
                    rejected.append({"item_id": item_id, "invariant": "evidence_contract"})
                output.append(
                    {
                        **oracle,
                        "confidence_basis_points": _confidence_basis_points(
                            proposal["confidence"] if matches else 1
                        ),
                        "attribution": ROLE_LABELS["evidence_checklist"] if matches else "deterministic_application",
                        "deterministic_fallback_applied": not matches,
                    }
                )
            ignored = len(set(proposed) - set(expected)) + duplicates
            return {"items": output}, _diagnostics(accepted, rejected, ignored_count=ignored)

        contribution, audit = self._run_agent(
            state,
            agent_id="evidence_checklist",
            schema=EvidenceChecklistResponse,
            system_prompt=(
                "Check only bounded evidence item, artifact, status, and source-reference IDs. The deterministic "
                "evidence contract remains authoritative. Return no requests, prose, or legal conclusions."
            ),
            provider_payload=_evidence_provider_payload(state),
            validator=validate,
            private_contract=expected,
        )
        return {"evidence_checklist": contribution, "audit_entries": [audit]}

    @staticmethod
    def _evidence_gate_node(state: AgentGraphState) -> dict[str, Any]:
        writer = get_stream_writer()
        if not state.get("evidence_checklist", {}).get("items"):
            raise AgentBoundaryError("deterministic_evidence_gate", "evidence_contribution")
        if state["verification"].get("valid") is not True:
            raise AgentBoundaryError("deterministic_evidence_gate", "playbook_verification")
        input_hash = _safe_hash(state["evidence_checklist"])
        output_hash = accepted_artifact_hash(state["checklist"])
        writer(
            {
                "receipt_type": "gate_passed",
                "agent_id": "deterministic_evidence_gate",
                "role": "Deterministic Evidence Contract Gate",
                "actor_type": "deterministic_gate",
                "status": "completed",
                "handoff_from": "evidence_checklist",
                "handoff_to": "final_claim_brief_audit",
                "input_artifact": "evidence_checklist_contribution",
                "output_artifact": "verified_evidence_model",
                "input_artifact_hash": input_hash,
                "output_artifact_hash": output_hash,
            }
        )
        return {
            "audit_entries": [
                {
                    "agent_id": "deterministic_evidence_gate",
                    "role": "Deterministic Evidence Contract Gate",
                    "actor_type": "deterministic_gate",
                    "model": None,
                    "outcome": "passed",
                    "input_artifact_hash": input_hash,
                    "output_artifact_hash": output_hash,
                }
            ]
        }

    def _final_brief_node(self, state: AgentGraphState) -> dict[str, Any]:
        current = state["process"]["current_overlay"]
        current_node = next(
            node for node in state["process"]["nodes"] if node["node_id"] == current["current_node_id"]
        )
        source_ids = sorted(
            {
                resolve_observable_source_reference_id(ref, state["source_registry"])
                for fact in state["facts"]
                if fact["fact_id"] in current_node.get("fact_ids", [])
                for ref in fact.get("source_refs", [])
                if ref.get("locator_kind") == "text_quote"
            }
        )
        expected = {
            "current_node_id": current["current_node_id"],
            "next_action_node_id": current["next_action_node_id"],
            "source_ref_ids": source_ids,
        }

        def validate(value: dict[str, Any]) -> tuple[dict[str, Any], dict[str, Any]]:
            proposal = value.get("proposal")
            matches = isinstance(proposal, dict) and all(
                proposal.get(key) == expected[key] for key in expected
            )
            return {
                **expected,
                "input_contribution_ids": [
                    "document_source_integrity",
                    "process_decision_mapping",
                    "evidence_checklist",
                ],
                "lineage_authority": "deterministic_application",
                "confidence_basis_points": _confidence_basis_points(
                    proposal["confidence"] if matches else 1
                ),
                "attribution": ROLE_LABELS["final_claim_brief_audit"] if matches else "deterministic_application",
                "deterministic_fallback_applied": not matches,
            }, _diagnostics(
                ["final_claim_brief"] if matches else [],
                []
                if matches
                else [{"item_id": "final_claim_brief", "invariant": "final_brief_contract"}],
            )

        contribution, audit = self._run_agent(
            state,
            agent_id="final_claim_brief_audit",
            schema=FinalClaimBriefResponse,
            system_prompt=(
                "Independently audit the bounded current and next process nodes from the static topology, canonical "
                "fact handoff, and accepted specialist contributions. Cite only supplied source-reference IDs and "
                "return only the audited node IDs, source IDs, and confidence. The application binds contribution "
                "lineage separately. Return no generated prose, legal conclusion, remedy, or new action."
            ),
            provider_payload=_final_brief_provider_payload(state),
            validator=validate,
            private_contract=expected,
        )
        return {"final_brief": contribution, "audit_entries": [audit]}

    @staticmethod
    def _whole_playbook_gate_node(state: AgentGraphState) -> dict[str, Any]:
        writer = get_stream_writer()
        if state["verification"].get("valid") is not True or not state.get("final_brief"):
            raise AgentBoundaryError("whole_playbook_gate", "whole_playbook")
        input_hash = _safe_hash(
            {"final_brief": state["final_brief"], "verification": state["verification"]}
        )
        output_hash = accepted_artifact_hash(
            {"process": state["process"], "checklist": state["checklist"], "final_brief": state["final_brief"]}
        )
        gate = {
            "agent_id": "whole_playbook_gate",
            "role": "Deterministic Whole-Playbook Gate",
            "actor_type": "deterministic_gate",
            "model": None,
            "outcome": "passed",
            "input_artifact_hash": input_hash,
            "output_artifact_hash": output_hash,
        }
        writer(
            {
                "receipt_type": "gate_passed",
                "agent_id": "whole_playbook_gate",
                "role": "Deterministic Whole-Playbook Gate",
                "actor_type": "deterministic_gate",
                "status": "completed",
                "handoff_from": "final_claim_brief_audit",
                "handoff_to": "complete",
                "input_artifact": "final_claim_brief_contribution",
                "output_artifact": "verified_claim_playbook",
                "input_artifact_hash": input_hash,
                "output_artifact_hash": output_hash,
            }
        )
        entries = [*state["audit_entries"], gate]
        agent_entries = [item for item in entries if item["actor_type"] == "nemotron_agent"]
        return {
            "audit_entries": [gate],
            "orchestration_audit": {
                "schema_version": MULTI_AGENT_SCHEMA_VERSION,
                "implementation": MULTI_AGENT_IMPLEMENTATION,
                "framework": {
                    "langchain": LANGCHAIN_VERSION,
                    "langgraph": LANGGRAPH_VERSION,
                    "langchain_openrouter": LANGCHAIN_OPENROUTER_VERSION,
                },
                "orchestration_id": state["orchestration_id"],
                "model": OPENROUTER_MODEL,
                "authority_mode": MULTI_AGENT_AUTHORITY_MODE,
                "model_assisted": True,
                "deterministic_safety_authority": True,
                "external_tracing": False,
                "prompt_storage": False,
                "raw_output_storage": False,
                "execution_topology": {
                    "authority": "deterministic_application",
                    "implementation": "compiled_langgraph_stategraph",
                    "delegations": [dict(value) for value in EXECUTION_DELEGATIONS],
                    "parallel_groups": [list(PARALLEL_GROUP)],
                },
                "agents": agent_entries,
                "deterministic_gates": [
                    item for item in entries if item["actor_type"] == "deterministic_gate"
                ],
                "all_required_agents_contributed": {
                    item["agent_id"] for item in agent_entries
                }
                == set(AI_AGENT_IDS)
                and all(
                    item.get("accepted_count", 0) > item.get("rejected_count", 0)
                    for item in agent_entries
                ),
                "guarded_fallback_count": sum(
                    int(item.get("deterministic_fallback_applied", False)) for item in agent_entries
                ),
                "specialist_artifacts": {
                    "orchestrator_plan": state["orchestrator_plan"],
                    "document_source_integrity": state["source_integrity"],
                    "process_decision_mapping": state["process_mapping"],
                    "evidence_checklist": state["evidence_checklist"],
                    "final_claim_brief_audit": state["final_brief"],
                },
                "final_claim_brief": state["final_brief"],
            },
        }


__all__ = [
    "AI_AGENT_IDS",
    "AGENT_RUNTIME_PROFILE",
    "AgentBoundaryError",
    "accepted_artifact_hash",
    "AgentGraphState",
    "DETERMINISTIC_GATE_IDS",
    "EvidenceChecklistResponse",
    "FinalClaimBriefResponse",
    "InstrumentedStructuredAgent",
    "MULTI_AGENT_AUTHORITY_MODE",
    "MULTI_AGENT_IMPLEMENTATION",
    "MULTI_AGENT_SCHEMA_VERSION",
    "MULTI_AGENT_VERSION",
    "NemotronMultiAgentOrchestrator",
    "OrchestratorPlan",
    "ProcessDecisionResponse",
    "SourceIntegrityResponse",
]
