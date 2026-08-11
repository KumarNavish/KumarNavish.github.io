from __future__ import annotations

from copy import deepcopy
from hashlib import sha256
import json
import os
import threading
import time
from typing import Any, Literal, TypedDict

from .canonicalizer import (
    CANONICALIZER_VERSION,
    CanonicalizerError,
    MODEL_MODE_OPENROUTER,
    MODEL_MODE_REFERENCE,
    OPENROUTER_MODEL,
    OPENROUTER_PROVIDER,
    OpenRouterNemotronCanonicalizer,
    configured_model_mode,
)
from .data import ARTIFACTS, CLAIMS, HISTORICAL_CASES, LAW_SOURCES, observable_claim_package
from .multi_agent import (
    AGENT_RUNTIME_PROFILE,
    MULTI_AGENT_AUTHORITY_MODE,
    MULTI_AGENT_IMPLEMENTATION,
    MULTI_AGENT_VERSION,
    NemotronMultiAgentOrchestrator,
    accepted_artifact_hash,
)
from .storage import Storage
from .validation import validate_playbook, validate_review_operations


RELEASE = "15.2.0"
ORCHESTRATOR = "casepath-langgraph-orchestrator/15.2"
PROFILE = "nemotron-langgraph-multi-agent-hybrid-guarded"
DETERMINISTIC_PROFILE = "deterministic-reference-playbook"
COMPONENT_VERSIONS = {
    "api": "15.2.0",
    "pipeline": "15.2.0",
    "contracts": "1.3.0",
    "canonicalizer": CANONICALIZER_VERSION,
    "agent_graph": MULTI_AGENT_VERSION,
    "storage": "1.3.0",
}

DECISION_OPTIONS = {
    "scope": {
        "supported_in_scope": "in_scope",
        "supported_out_of_scope": "out_of_scope",
        "unverified": "scope_unverified",
    },
    "dispute": {
        "present": "dispute_present",
        "absent": "no_dispute",
        "unverified": "dispute_unverified",
    },
    "urgency": {
        "urgent": "urgent",
        "not_urgent": "not_urgent",
        "unverified": "urgency_unverified",
    },
    "notification": {
        "notified": "notified",
        "not_notified": "not_notified",
        "unverified": "notification_unverified",
    },
    "recurrence": {
        "supported": "recurrence_supported",
        "not_supported": "recurrence_not_supported",
        "unverified": "recurrence_unverified",
    },
    "causation": {
        "building": "cause_building",
        "tenant_use": "cause_tenant_use",
        "mixed": "cause_mixed",
        "unresolved": "cause_unresolved",
    },
}
PROCESS_DECISION_KEYS = ("scope", "dispute", "urgency", "notification", "recurrence", "causation")


class ReviewOperation(TypedDict):
    component: Literal["process_graph", "evidence_model"]
    operation: Literal["add", "replace", "remove"]
    pointer: str
    old_value: Any
    new_value: Any
    reason: str

VISIBLE_STAGES = [
    ("read", "Read the submission", "Attachment Parsing Tool"),
    ("understand", "Build the claim state", "Canonical Claim Preparation Tool"),
    ("research", "Research Swiss tenant law", "Swiss Legal Source Tool"),
    ("process", "Discover the full handling process", "Process Projection Tool"),
    ("evidence", "Derive the complete evidence model", "Evidence Checklist Tool"),
    ("experience", "Retrieve organizational experience", "Historical Retrieval Tool"),
    ("verify", "Verify the complete playbook", "Whole-Playbook Verification Gate"),
]


def digest(value: Any) -> str:
    return sha256(
        json.dumps(
            value,
            sort_keys=True,
            ensure_ascii=False,
            separators=(",", ":"),
            default=str,
        ).encode("utf-8")
    ).hexdigest()


def _accepted_agent_lineage(value: dict[str, Any]) -> dict[str, Any]:
    """Keep accepted artifacts float-free while retaining an audit join key."""

    return {
        key: value[key]
        for key in (
            "agent_id",
            "call_id",
            "origin_call_id",
            "response_id",
            "delegation_id",
            "parent_call_id",
            "outcome",
            "accepted_ids",
            "accepted_count",
            "rejected_count",
            "deterministic_fallback_applied",
        )
        if key in value
    }


def fact(
    fact_id: str,
    label: str,
    value: str,
    state: str,
    explanation: str,
    source_refs: list[dict[str, Any]],
    confidence: float = 1.0,
    *,
    decision_key: str | None = None,
    normalized_value: str | None = None,
) -> dict[str, Any]:
    if (decision_key is None) != (normalized_value is None):
        raise ValueError("decision_key and normalized_value must be provided together")
    decision_value = None
    if decision_key is not None:
        try:
            decision_value = DECISION_OPTIONS[decision_key][normalized_value]
        except KeyError as exc:
            raise ValueError("unsupported normalized decision value") from exc
    return {
        "fact_id": fact_id,
        "label": label,
        "value": value,
        "state": state,
        "explanation": explanation,
        "source_refs": source_refs,
        "confidence": confidence,
        "controls_process": decision_key is not None,
        "decision_key": decision_key,
        "normalized_value": normalized_value,
        "decision_value": decision_value,
    }


def decision_projection(facts: list[dict[str, Any]]) -> dict[str, Any]:
    """Project the active process route from typed fact decisions only."""

    grouped: dict[str, list[str]] = {key: [] for key in PROCESS_DECISION_KEYS}
    for value in facts:
        key = value.get("decision_key")
        if key in grouped and value.get("controls_process") is True:
            grouped[key].append(value.get("decision_value"))
    invalid = [key for key, values in grouped.items() if len(values) != 1]
    if invalid:
        raise ValueError(f"Process projection requires exactly one controlling fact for {invalid}")
    decisions = {key: values[0] for key, values in grouped.items()}

    route = ["intake", "scope"]
    if decisions["scope"] == "out_of_scope":
        return _projection(decisions, route + ["out_of_scope"], "scope", "out_of_scope", "out-of-scope")
    if decisions["scope"] == "scope_unverified":
        return _projection(decisions, route, "scope", "scope", "scope-unverified")
    if decisions["scope"] != "in_scope":
        raise ValueError(f"Unsupported scope decision {decisions['scope']!r}")

    route.append("dispute")
    if decisions["dispute"] == "no_dispute":
        return _projection(decisions, route + ["no_dispute"], "dispute", "no_dispute", "no-dispute")
    if decisions["dispute"] == "dispute_unverified":
        return _projection(decisions, route, "dispute", "dispute", "dispute-unverified")
    if decisions["dispute"] != "dispute_present":
        raise ValueError(f"Unsupported dispute decision {decisions['dispute']!r}")

    route.append("urgency")
    if decisions["urgency"] == "urgent":
        return _projection(decisions, route + ["urgent_escalation"], "urgency", "urgent_escalation", "urgent")
    if decisions["urgency"] == "urgency_unverified":
        return _projection(decisions, route, "urgency", "urgency", "urgency-unverified")
    if decisions["urgency"] != "not_urgent":
        raise ValueError(f"Unsupported urgency decision {decisions['urgency']!r}")

    route.append("notification")
    if decisions["notification"] in {"not_notified", "notification_unverified"}:
        return _projection(decisions, route + ["formal_notice"], "notification", "formal_notice", "notice-gap")
    if decisions["notification"] != "notified":
        raise ValueError(f"Unsupported notification decision {decisions['notification']!r}")

    route.append("defect")
    if decisions["recurrence"] in {"recurrence_not_supported", "recurrence_unverified"}:
        return _projection(decisions, route, "defect", "defect", "recurrence-gap")
    if decisions["recurrence"] != "recurrence_supported":
        raise ValueError(f"Unsupported recurrence decision {decisions['recurrence']!r}")

    route.append("causation")
    cause_routes = {
        "cause_building": ("building_defect", "building-defect"),
        "cause_tenant_use": ("tenant_use", "tenant-use"),
        "cause_mixed": ("mixed_cause", "mixed-cause"),
        "cause_unresolved": ("evidence_gap", "insufficient"),
    }
    if decisions["causation"] not in cause_routes:
        raise ValueError(f"Unsupported causation decision {decisions['causation']!r}")
    target, branch_id = cause_routes[decisions["causation"]]
    return _projection(decisions, route + [target], "causation", target, branch_id)


def _projection(
    decisions: dict[str, str],
    selected_path: list[str],
    current_node: str,
    next_action_node: str,
    selected_branch_id: str,
) -> dict[str, Any]:
    return {
        "decisions": decisions,
        "selected_path": selected_path,
        "current_node": current_node,
        "next_action_node": next_action_node,
        "selected_branch_id": selected_branch_id,
    }


def apply_process_projection(
    nodes: list[dict[str, Any]],
    edges: list[dict[str, Any]],
    projection: dict[str, Any],
    main_spine: list[str],
) -> dict[str, Any]:
    """Apply one fail-closed decision projection to the fixed graph template."""

    current = projection["current_node"]
    next_action = projection["next_action_node"]
    selected_path = projection["selected_path"]
    selected_pairs = set(zip(selected_path, selected_path[1:]))
    completed = selected_path[: selected_path.index(current)]
    spine_position = main_spine.index(current) if current in main_spine else len(main_spine)
    blocked = [node_id for node_id in main_spine[spine_position + 1 :] if node_id in {"responsibility", "remedy"}]

    branch_targets: set[str] = set()
    answer_by_node = {
        "scope": {
            "in_scope": "In scope",
            "out_of_scope": "Outside scope",
            "scope_unverified": "Unverified",
        }[projection["decisions"]["scope"]],
        "dispute": {
            "dispute_present": "Dispute established",
            "no_dispute": "No dispute established",
            "dispute_unverified": "Unverified",
        }[projection["decisions"]["dispute"]],
        "urgency": {
            "urgent": "Urgent",
            "not_urgent": "No acute concern reported",
            "urgency_unverified": "Unverified",
        }[projection["decisions"]["urgency"]],
        "notification": {
            "notified": "Notification established",
            "not_notified": "Not notified",
            "notification_unverified": "Unverified",
        }[projection["decisions"]["notification"]],
        "defect": {
            "recurrence_supported": "Recurrence supported",
            "recurrence_not_supported": "Recurrence not supported",
            "recurrence_unverified": "Unverified",
        }[projection["decisions"]["recurrence"]],
        "causation": {
            "cause_building": "Building-related cause supported",
            "cause_tenant_use": "Use-related cause supported",
            "cause_mixed": "Mixed cause supported",
            "cause_unresolved": "Unresolved",
        }[projection["decisions"]["causation"]],
    }
    for node in nodes:
        branch_targets.update(branch["target"] for branch in node.get("branches", []))
        if node["node_id"] in completed:
            node["state"] = "complete"
        elif node["node_id"] == current:
            node["state"] = "current"
        elif node["node_id"] == next_action:
            node["state"] = "next"
        elif node["node_id"] in blocked:
            node["state"] = "blocked"
        elif node["main_spine"]:
            node["state"] = "future"
        else:
            node["state"] = "inactive"
        if node["node_id"] in answer_by_node:
            node["answer"] = answer_by_node[node["node_id"]]
        elif node["main_spine"] and node["state"] in {"blocked", "future"}:
            node["answer"] = "Not reached"
        for branch in node.get("branches", []):
            branch["state"] = "selected" if branch["branch_id"] == projection["selected_branch_id"] else "possible"

    for value in edges:
        pair = (value["source"], value["target"])
        if pair in selected_pairs:
            value["state"] = "selected"
        elif pair == ("evidence_gap", "causation"):
            value["state"] = "loop"
        elif value["source"] in {"remedy", "escalation"}:
            value["state"] = "future"
        else:
            value["state"] = "possible"

    inactive_targets = sorted(branch_targets - {next_action, current})
    return {
        "completed_node_ids": completed,
        "current_node_id": current,
        "selected_branch_id": projection["selected_branch_id"],
        "blocked_node_ids": blocked,
        "inactive_branch_ids": inactive_targets,
        "next_action_node_id": next_action,
        "decisions": projection["decisions"],
    }


def apply_evidence_projection(
    items: list[dict[str, Any]],
    process: dict[str, Any],
) -> None:
    """Project checklist relevance and statuses from the same typed decisions."""

    decisions = process["current_overlay"]["decisions"]
    by_id = {item["item_id"]: item for item in items}

    if decisions["urgency"] == "urgency_unverified":
        by_id["health_safety_statement"]["status"] = "missing"
        by_id["health_safety_statement"]["artifact_ids"] = []
        by_id["health_safety_statement"]["why"] = (
            "Current health, safety and deadline information is absent and must be established before ordinary handling continues."
        )

    if decisions["notification"] == "not_notified":
        for item_id in ("defect_notice", "proof_of_delivery"):
            by_id[item_id]["status"] = "missing"
            by_id[item_id]["artifact_ids"] = []
    elif decisions["notification"] == "notification_unverified":
        by_id["defect_notice"]["status"] = (
            "provided_insufficient" if by_id["defect_notice"]["artifact_ids"] else "missing"
        )
        by_id["proof_of_delivery"]["status"] = "missing"
        by_id["proof_of_delivery"]["artifact_ids"] = []

    if decisions["recurrence"] in {"recurrence_unverified", "recurrence_not_supported"}:
        by_id["dated_photos"]["status"] = (
            "provided_insufficient" if by_id["dated_photos"]["artifact_ids"] else "missing"
        )
        by_id["recurrence_chronology"]["status"] = "missing"

    cause = decisions["causation"]
    if cause == "cause_building":
        by_id["building_envelope"]["status"] = "missing"
        by_id["building_envelope"]["required_level"] = "mandatory"
        by_id["use_evidence"]["status"] = "not_applicable"
    elif cause == "cause_tenant_use":
        by_id["building_envelope"]["status"] = "not_applicable"
        by_id["use_evidence"]["status"] = "missing"
        by_id["use_evidence"]["required_level"] = "mandatory"
    elif cause == "cause_mixed":
        for item_id in ("building_envelope", "use_evidence"):
            by_id[item_id]["status"] = "missing"
            by_id[item_id]["required_level"] = "mandatory"

    active_nodes = set(process["selected_path"]) | {process["current_overlay"]["next_action_node_id"]}
    for value in items:
        value["current_path"] = value["node_id"] in active_nodes
        if not value["current_path"] and value["status"] == "missing":
            value["status"] = "conditional"
            value["required_level"] = "conditional"
            value["applies_when"] = f"The {value['node_id']} process node is reached"
    if decisions["urgency"] == "urgency_unverified":
        by_id["health_safety_statement"]["status"] = "missing"
        by_id["health_safety_statement"]["artifact_ids"] = []
        by_id["health_safety_statement"]["required_level"] = "mandatory"


def text_ref(artifact_id: str, page: int, excerpt: str, agent: str) -> dict[str, Any]:
    return {
        "artifact_id": artifact_id,
        "locator_kind": "text_quote",
        "page": page,
        "excerpt": excerpt,
        "agent": agent,
    }


def visual_ref(
    artifact_id: str,
    region: list[float],
    observation: str,
) -> dict[str, Any]:
    return {
        "artifact_id": artifact_id,
        "locator_kind": "visual_observation",
        "region": region,
        "observation": observation,
        "agent": "Visual Evidence Agent",
    }


def metadata_ref(
    artifact_id: str,
    field: str,
    value: str | int | float | bool,
    agent: str,
) -> dict[str, Any]:
    return {
        "artifact_id": artifact_id,
        "locator_kind": "metadata_field",
        "field": field,
        "value": value,
        "agent": agent,
    }


def process_node(
    node_id: str,
    title: str,
    question: str,
    state: str,
    *,
    answer: str = "",
    why: str = "",
    kind: str = "decision",
    main_spine: bool = True,
    fact_ids: list[str] | None = None,
    legal_source_ids: list[str] | None = None,
    evidence_requirement_ids: list[str] | None = None,
    branches: list[dict[str, Any]] | None = None,
    activation: str = "always",
) -> dict[str, Any]:
    return {
        "node_id": node_id,
        "title": title,
        "question": question,
        "state": state,
        "answer": answer,
        "why": why,
        "kind": kind,
        "main_spine": main_spine,
        "fact_ids": fact_ids or [],
        "legal_source_ids": legal_source_ids or [],
        "evidence_requirement_ids": evidence_requirement_ids or [],
        "branches": branches or [],
        "activation": activation,
    }


def edge(source: str, target: str, condition: str, state: str = "available") -> dict[str, Any]:
    return {"source": source, "target": target, "condition": condition, "state": state}


class ClaimPipeline:
    """Reference implementation of the full CasePath lifecycle.

    Specialist agents share one claim-level orchestrator context. The public profile is
    intentionally deterministic and typed; the audit record names this explicitly. The
    same canonical artifacts can later be produced by a live model profile.
    """

    def __init__(
        self,
        storage: Storage,
        *,
        model_mode: str | None = None,
        canonicalizer: OpenRouterNemotronCanonicalizer | None = None,
        agent_orchestrator: NemotronMultiAgentOrchestrator | None = None,
        pace_seconds: float = 1.0,
    ):
        self.storage = storage
        configured_from_environment = model_mode is None
        self.model_mode = model_mode or configured_model_mode()
        if self.model_mode not in {MODEL_MODE_REFERENCE, MODEL_MODE_OPENROUTER}:
            raise ValueError(f"Unsupported model mode {self.model_mode!r}")
        if configured_from_environment and self.model_mode == MODEL_MODE_OPENROUTER:
            configured_profile = os.getenv("CASEPATH_AGENT_RUNTIME_PROFILE", "").strip()
            if configured_profile != AGENT_RUNTIME_PROFILE:
                raise ValueError(
                    "CASEPATH_AGENT_RUNTIME_PROFILE must match the compiled LangGraph runtime"
                )
        self.canonicalizer = canonicalizer or (
            OpenRouterNemotronCanonicalizer(storage) if self.model_mode == MODEL_MODE_OPENROUTER else None
        )
        self.agent_orchestrator = agent_orchestrator or (
            NemotronMultiAgentOrchestrator(storage)
            if self.model_mode == MODEL_MODE_OPENROUTER
            else None
        )
        self.pace_seconds = max(0.0, float(pace_seconds))
        self.review_lock = threading.RLock()

    def create(self, claim_id: str, *, knowledge_mode: str = "current", session_id: str = "public") -> str:
        if claim_id not in CLAIMS:
            raise KeyError(claim_id)
        if knowledge_mode not in {"current", "baseline"}:
            raise ValueError("Unsupported knowledge mode")
        run_id = self.storage.create_run(claim_id, session_id=session_id)
        threading.Thread(target=self._execute, args=(run_id, claim_id, knowledge_mode, session_id), daemon=True).start()
        return run_id

    def pause(self, seconds: float) -> None:
        if self.pace_seconds:
            time.sleep(seconds * self.pace_seconds)

    def emit(self, run_id: str, stage: str, label: str, agent: str, status: str, **payload: Any):
        return self.storage.add_event(
            run_id,
            {
                "stage": stage,
                "label": label,
                "agent": agent,
                "status": status,
                "implementation": "deterministic_application_tool",
                "model": None,
                "actor_type": "deterministic_tool",
                "orchestrator": ORCHESTRATOR,
                "shared_context": f"claim-context:{run_id}",
                "validator": f"{stage}-validator/15.2",
                "prompt_version": f"{stage}/15.2",
                **payload,
            },
        )

    def _execute(self, run_id: str, claim_id: str, knowledge_mode: str, session_id: str):
        claim = CLAIMS[claim_id]
        memories = [] if knowledge_mode == "baseline" else self.storage.memories(session_id=session_id)
        knowledge = self._active_knowledge(session_id=session_id)
        self.storage.patch_run(
            run_id,
            status="running",
            patch={
                "profile": (
                    PROFILE
                    if self.model_mode == MODEL_MODE_OPENROUTER
                    else DETERMINISTIC_PROFILE
                ),
                "release": RELEASE,
                "orchestrator": ORCHESTRATOR,
                "shared_context": {"claim_id": claim_id, "version": 1, "artifacts": []},
                "knowledge_version": knowledge["version"],
                "knowledge_mode": knowledge_mode,
                "model_mode": self.model_mode,
                "model": OPENROUTER_MODEL if self.model_mode == MODEL_MODE_OPENROUTER else None,
            },
        )
        self.storage.add_event(
            run_id,
            {
                "stage": "orchestrator",
                "label": "Orchestrator opened one shared claim context",
                "agent": "Claim Context Initialization Tool",
                "actor_type": "deterministic_tool",
                "status": "started",
                "headline": "Specialists will build one claim-handling playbook",
                "detail": "Each specialist receives the same claim context and contributes a typed artifact for the next specialist.",
                "implementation": "deterministic_application_tool",
                "model": None,
                "orchestrator": ORCHESTRATOR,
                "validator": "orchestrator-state/15.2",
                "prompt_version": None,
                "output_artifact": "shared_claim_context",
            },
        )
        try:
            parsed = self._read_stage(run_id, claim)
            understanding = self._understand_stage(run_id, claim, parsed)
            legal = self._research_stage(run_id, claim, understanding)
            process = self._process_stage(run_id, claim, understanding, legal, memories, knowledge)
            checklist = self._evidence_stage(run_id, claim, understanding, process, legal, memories, knowledge)
            precedents = self._experience_stage(run_id, claim, understanding, process, checklist, memories)
            verification = self._verify_stage(run_id, claim, understanding, legal, process, checklist, precedents)
            agent_orchestration = self._agent_orchestration_stage(
                run_id,
                claim,
                understanding,
                process,
                checklist,
                verification,
            )
            if self.model_mode == MODEL_MODE_OPENROUTER:
                verification = self._verification_report(
                    claim,
                    understanding,
                    legal,
                    process,
                    checklist,
                    precedents,
                )
                self.storage.patch_run(
                    run_id,
                    patch={
                        "process": process,
                        "checklist": checklist,
                        "verification": verification,
                        "agent_orchestration": agent_orchestration,
                    },
                )
                gate_by_id = {
                    item["agent_id"]: item
                    for item in agent_orchestration["deterministic_gates"]
                }
                accepted_artifacts = [
                    (
                        "deterministic_process_gate",
                        "process_graph",
                        process,
                        "Process graph accepted after the Nemotron mapping contribution and deterministic gate",
                    ),
                    (
                        "deterministic_evidence_gate",
                        "evidence_model",
                        checklist,
                        "Evidence model accepted after the Nemotron checklist contribution and deterministic gate",
                    ),
                    (
                        "whole_playbook_gate",
                        "final_claim_brief",
                        agent_orchestration["final_claim_brief"],
                        "Final claim brief and recomputed verification accepted after the Nemotron critic and whole-playbook gate",
                    ),
                ]
                for gate_id, artifact_name, artifact_value, headline in accepted_artifacts:
                    gate = gate_by_id[gate_id]
                    gate["output_artifact_hash"] = accepted_artifact_hash(artifact_value)
                    if gate_id == "whole_playbook_gate":
                        gate["verification_report_hash"] = digest(verification)
                        gate["accepted_verification_ids"] = [
                            item["name"] for item in verification["checks"]
                        ]
                    self.storage.add_event(
                        run_id,
                        {
                            "stage": "agent_orchestration",
                            "label": f"Accepted {artifact_name.replace('_', ' ')}",
                            "agent": gate["role"],
                            "agent_id": gate_id,
                            "source_agent_id": gate["source_agent_id"],
                            "actor_type": "deterministic_gate",
                            "status": "completed",
                            "receipt_type": "accepted_artifact",
                            "acceptance_scope": "pre_review_model_output",
                            "headline": headline,
                            "detail": "The retained hash covers the exact final DTO, including bound advisory provenance.",
                            "implementation": MULTI_AGENT_IMPLEMENTATION,
                            "model": None,
                            "source_model": OPENROUTER_MODEL,
                            "source_call_id": gate["source_call_id"],
                            "delegation_id": gate.get("delegation_id"),
                            "accepted_ids": gate.get("accepted_ids", []),
                            "accepted_count": gate.get("accepted_count", 0),
                            "output_artifact": artifact_name,
                            "output_artifact_hash": gate["output_artifact_hash"],
                            **(
                                {
                                    "verification_report_hash": gate["verification_report_hash"],
                                    "accepted_verification_ids": gate["accepted_verification_ids"],
                                }
                                if gate_id == "whole_playbook_gate"
                                else {}
                            ),
                            "external_tracing": False,
                        },
                    )
            result = self._final_result(
                claim,
                parsed,
                understanding,
                legal,
                process,
                checklist,
                precedents,
                verification,
                knowledge,
                knowledge_mode,
                agent_orchestration,
            )
            self.storage.add_event(
                run_id,
                {
                    "stage": "complete",
                    "label": "Final acceptance gate assembled the playbook",
                    "agent": "Final Playbook Acceptance Gate",
                    "actor_type": "deterministic_gate",
                    "status": "completed",
                    "headline": f"{len(process['nodes'])} process nodes and {len(checklist['items'])} evidence relationships ready",
                    "detail": "The full process, evidence model, current claim overlay, precedents and verification record now form one reviewable artifact.",
                    "implementation": (
                        MULTI_AGENT_IMPLEMENTATION
                        if self.model_mode == MODEL_MODE_OPENROUTER
                        else "deterministic_acceptance_gate"
                    ),
                    "model": None,
                    "orchestrator": ORCHESTRATOR,
                    "validator": "whole-playbook-validator/15.2",
                    "prompt_version": None,
                    "input_artifacts": ["canonical_claim_state", "legal_context", "process_graph", "evidence_model", "precedents"],
                    "output_artifact": "claim_handling_playbook",
                    "output_hash": digest(result),
                },
            )
            self.storage.patch_run(run_id, status="complete", patch={"result": result, "completed_at": time.time()})
        except Exception as exc:  # pragma: no cover - fail-safe path
            partial = self.storage.get_run(run_id, session_id=session_id) or {}
            safe_context = getattr(exc, "safe_context", {})
            failure_stage = (
                getattr(exc, "agent_id", None)
                or safe_context.get("agent_id")
                or "deterministic_failure_boundary"
            )
            failure_invariant = (
                getattr(exc, "invariant", None)
                or safe_context.get("error_invariant")
                or "execution_failed"
            )
            accepted_state = {
                "canonical_state_prepared": isinstance(partial.get("understanding"), dict),
                "process_candidate_prepared": isinstance(
                    partial.get("process_candidate") or partial.get("process"), dict
                ),
                "evidence_candidate_prepared": isinstance(
                    partial.get("checklist_candidate") or partial.get("checklist"), dict
                ),
                "final_playbook_accepted": False,
            }
            self.storage.add_event(
                run_id,
                {
                    "stage": "failed",
                    "label": "Analysis stopped safely",
                    "agent": "Failure boundary",
                    "status": "failed",
                    "headline": "No final playbook was accepted",
                    "detail": "Partial candidate artifacts may remain visible for audit, but the terminal acceptance boundary failed closed.",
                    "implementation": "deterministic",
                    "model": None,
                    "actor_type": "deterministic_gate",
                    "failure_stage": failure_stage,
                    "failure_invariant": failure_invariant,
                    "accepted_state": accepted_state,
                    "validator": "fail-closed/15.2",
                    "prompt_version": None,
                },
            )
            self.storage.patch_run(
                run_id,
                status="failed",
                patch={
                    "error": f"{type(exc).__name__}: {failure_invariant}",
                    "failure_stage": failure_stage,
                    "accepted_state": accepted_state,
                },
            )

    def _read_stage(self, run_id: str, claim: dict[str, Any]) -> dict[str, Any]:
        stage, label, agent = VISIBLE_STAGES[0]
        self.emit(
            run_id,
            stage,
            label,
            agent,
            "started",
            headline=f"Reading the message and {len(claim['artifact_ids'])} source files",
            detail="The originals remain separate from every machine representation.",
            question="What did the customer actually submit?",
            input_artifacts=["observable_claim_package"],
            output_artifact="parsed_submission",
            handoff_to="Canonical Claim Preparation Tool",
        )
        self.pause(.35)
        files = []
        page_count = 0
        image_count = 0
        correspondence_count = 1
        for artifact_id in claim["artifact_ids"]:
            artifact = ARTIFACTS[artifact_id]
            page_count += artifact.get("page_count", 1) if artifact["media_type"] == "application/pdf" else 0
            image_count += int(artifact["media_type"].startswith("image/"))
            correspondence_count += int(artifact["media_type"] == "message/rfc822")
            if artifact["media_type"] == "application/pdf":
                read_detail = f"{artifact['page_count']} rendered pages and extracted text"
            elif artifact["media_type"] == "message/rfc822":
                read_detail = f"Correspondence from {artifact['email']['from']}"
            else:
                read_detail = "Original pixels, dimensions and checksum recorded"
            files.append(
                {
                    "artifact_id": artifact_id,
                    "title": artifact["title"],
                    "filename": artifact["filename"],
                    "read_detail": read_detail,
                }
            )
        parsed = {
            "message_chars": len(claim["message"]),
            "files": files,
            "source_count": len(files) + 1,
            "pdf_pages": page_count,
            "images": image_count,
            "correspondence": correspondence_count,
            "input_hash": digest(
                {
                    "claim": claim,
                    "artifact_hashes": [ARTIFACTS[item]["sha256"] for item in claim["artifact_ids"]],
                }
            ),
        }
        self.storage.patch_run(run_id, patch={"parsed_submission": parsed})
        self.emit(
            run_id,
            stage,
            label,
            agent,
            "completed",
            headline=f"{parsed['source_count']} sources read",
            detail=f"{page_count} PDF pages, {image_count} photograph and {correspondence_count} correspondence records entered the shared context.",
            question="What did the customer actually submit?",
            items=[f"{item['title']}: {item['read_detail']}" for item in files],
            metrics={"sources": parsed["source_count"], "pdf_pages": page_count, "images": image_count},
            input_hash=parsed["input_hash"],
            output_hash=digest(parsed),
            input_artifacts=["observable_claim_package"],
            output_artifact="parsed_submission",
            handoff_to="Canonical Claim Preparation Tool",
        )
        self.pause(.25)
        return parsed

    def _understand_stage(self, run_id: str, claim: dict[str, Any], parsed: dict[str, Any]) -> dict[str, Any]:
        stage, label, agent = VISIBLE_STAGES[1]
        self.emit(
            run_id,
            stage,
            label,
            agent,
            "started",
            headline="Reconciling claims across the message and attachments",
            detail="Supported facts, allegations, conflicts and unknowns remain distinct.",
            question="What claim state is supported by the observable evidence?",
            input_artifacts=["parsed_submission"],
            output_artifact="canonical_claim_state",
            handoff_to="Swiss Legal Source Tool",
        )
        self.pause(.4)
        primary = claim["claim_id"] == "DEF-027-E0-DEMO"
        if primary:
            facts = [
                fact(
                    "fact_tenancy",
                    "Residential tenancy",
                    "Established",
                    "known",
                    "The document is a residential lease agreement, identifies Alex Morgan as the tenant and states that the apartment is rented for residential use.",
                    [
                        text_ref("art_lease", 1, "Residential Lease Agreement", agent),
                        text_ref("art_lease", 1, "Tenant Alex Morgan, Feldbergstrasse 114, 4057 Basel", agent),
                        text_ref("art_lease", 1, "The apartment is rented for residential use.", agent),
                    ],
                    decision_key="scope",
                    normalized_value="supported_in_scope",
                ),
                fact(
                    "fact_policy_route",
                    "Legal-protection policy reference",
                    "Present",
                    "known",
                    "The intake contains a policy reference. This demo does not decide coverage terms.",
                    [metadata_ref("intake", "policy_reference", claim["customer"]["policy"], "Intake Metadata Agent")],
                ),
                fact(
                    "fact_dispute",
                    "Concrete disagreement",
                    "Established",
                    "known",
                    "The customer states disagreement and asks for cause clarification and repair; management says the marks appear consistent with insufficient ventilation and does not plan a technical inspection.",
                    [
                        text_ref("message", 1, "I disagree because the problem keeps returning.", agent),
                        text_ref("message", 1, "I want the cause clarified and the defect repaired.", agent),
                        text_ref("art_management_reply", 1, "the marks appear consistent with insufficient ventilation", agent),
                        text_ref("art_management_reply", 1, "We do not currently plan a technical inspection.", agent),
                    ],
                    decision_key="dispute",
                    normalized_value="present",
                ),
                fact(
                    "fact_recurrence",
                    "Recurring mould",
                    "Established",
                    "known",
                    "The message, photograph and timeline describe recurrence after cleaning.",
                    [
                        text_ref("message", 1, "keeps coming back", agent),
                        visual_ref("art_photo", [0.42, 0.10, 0.20, 0.70], "Visible dark spotting is concentrated along the external wall corner."),
                        text_ref("art_timeline", 1, "spots returned within approximately two weeks", agent),
                    ],
                    decision_key="recurrence",
                    normalized_value="supported",
                ),
                fact(
                    "fact_notification",
                    "Landlord notified",
                    "Established",
                    "known",
                    "The original email is dated 15 July 2026 and asks for inspection and repair; the delivery record says the recipient mail server accepted it.",
                    [
                        text_ref("art_notification", 1, "Wed, 15 Jul 2026 08:32:00 +0200", agent),
                        text_ref("art_notification", 1, "Please arrange an inspection and repair.", agent),
                        text_ref("art_delivery", 1, "Accepted by recipient mail server", agent),
                    ],
                    decision_key="notification",
                    normalized_value="notified",
                ),
                fact(
                    "fact_ventilation_allegation",
                    "Management alleges insufficient ventilation",
                    "Established as an allegation",
                    "known",
                    "The reply contains the allegation but no technical proof.",
                    [text_ref("art_management_reply", 1, "consistent with insufficient ventilation", agent)],
                ),
                fact(
                    "fact_cause",
                    "Cause of mould",
                    "Unresolved",
                    "unknown",
                    "No neutral assessment establishes a building defect, tenant-use cause or mixed cause.",
                    [
                        text_ref("art_management_reply", 1, "Based on the photograph", agent),
                        text_ref("art_timeline", 1, "No independent inspection has been carried out.", agent),
                    ],
                    confidence=.92,
                    decision_key="causation",
                    normalized_value="unresolved",
                ),
                fact(
                    "fact_health",
                    "Immediate health or safety concern",
                    "Not reported",
                    "known",
                    "The customer reports no current symptoms or emergency.",
                    [text_ref("message", 1, "There are no current health symptoms and no urgent deadline.", agent)],
                    decision_key="urgency",
                    normalized_value="not_urgent",
                ),
                fact(
                    "fact_date_conflict",
                    "First-observation date",
                    "Conflicting",
                    "conflicting",
                    "The customer says around 20 March; the timeline says 12 March.",
                    [
                        text_ref("message", 1, "around 20 March", agent),
                        text_ref("art_timeline", 1, "12 Mar 2026", agent),
                    ],
                    confidence=.99,
                ),
            ]
            summary = "Recurring bedroom mould in a Basel tenancy. Written notice and a concrete dispute are established. Management blames ventilation, but technical causation remains unresolved."
            issues = [
                {"issue": "Technical cause remains unresolved", "severity": "controlling", "why": "Responsibility and remedy branches depend on competent causation evidence."},
                {"issue": "First-observation date conflicts", "severity": "clarify", "why": "The message and chronology give different March dates."},
            ]
        else:
            facts = [
                fact(
                    "later_fact_tenancy",
                    "Residential tenancy",
                    "Unverified",
                    "unknown",
                    "The observable package does not state that the premises are rented or supply tenancy proof.",
                    [],
                    decision_key="scope",
                    normalized_value="unverified",
                ),
                fact(
                    "later_fact_dispute",
                    "Concrete disagreement",
                    "Reported but original management message missing",
                    "known",
                    "The customer reports that management blames airing; the original allegation is not attached.",
                    [text_ref("art_later_email", 1, "management says I do not air enough", agent)],
                    confidence=.86,
                    decision_key="dispute",
                    normalized_value="present",
                ),
                fact(
                    "later_fact_recurrence",
                    "Recurring dark spots after window work",
                    "Established",
                    "known",
                    "The email and photograph describe recurrence beside the replaced window.",
                    [
                        text_ref("art_later_email", 1, "dark spots have appeared around the bedroom window", agent),
                        visual_ref("art_later_photo", [0.08, 0.40, 0.82, 0.42], "Visible condensation crosses the lower glazing and dark spotting appears beside the window reveal."),
                    ],
                    decision_key="recurrence",
                    normalized_value="supported",
                ),
                fact(
                    "later_fact_recent_window_work",
                    "Recent window replacement",
                    "Established",
                    "known",
                    "The contractor notice confirms replacement in May 2026.",
                    [text_ref("art_window_notice", 1, "replaced between 18 and 22 May 2026", agent)],
                ),
                fact(
                    "later_fact_ventilation_allegation",
                    "Management alleges insufficient airing",
                    "Reported by customer",
                    "known",
                    "The allegation is observable, but the original correspondence and technical basis are absent.",
                    [text_ref("art_later_email", 1, "management says I do not air enough", agent)],
                    confidence=.84,
                ),
                fact(
                    "later_fact_cause",
                    "Cause around replaced window",
                    "Unresolved",
                    "unknown",
                    "No inspection links the condition to use, seals, insulation or another building cause.",
                    [text_ref("art_later_email", 1, "No technician has inspected the window or wall.", agent)],
                    confidence=.94,
                    decision_key="causation",
                    normalized_value="unresolved",
                ),
                fact(
                    "later_fact_health",
                    "Immediate health or safety concern",
                    "Unverified",
                    "unknown",
                    "The submission does not state whether an emergency or acute symptoms exist.",
                    [],
                    decision_key="urgency",
                    normalized_value="unverified",
                ),
            ]
            summary = "Recurring dark spots beside a recently replaced window. Management allegedly blames airing. The allegation and technical cause remain unverified."
            issues = [
                {"issue": "Technical cause remains unresolved", "severity": "controlling", "why": "The timing after window work and the ventilation allegation require competent evidence."},
                {"issue": "Original management allegation is missing", "severity": "evidence", "why": "The exact allegation and its stated basis cannot yet be inspected."},
            ]
        if primary:
            facts.extend(
                [
                    fact("fact_source_integrity", "Source package integrity", "Recorded", "known", "Source hashes and media metadata were recorded before reasoning.", [metadata_ref("art_lease", "sha256", ARTIFACTS["art_lease"]["sha256"], "Source Integrity Agent")]),
                    fact("fact_customer_objective", "Customer objective", "Clarify cause and repair the defect", "known", "The customer asks for the cause to be clarified and the defect repaired.", [text_ref("message", 1, "I want the cause clarified and the defect repaired.", agent)]),
                    fact("fact_repair_history", "Inspection and repair history", "No technical inspection reported", "known", "Management states that it does not plan a technical inspection.", [text_ref("art_management_reply", 1, "We do not currently plan a technical inspection.", agent)]),
                    fact("fact_tenant_use_cause", "Supported use-related cause", "Unresolved", "unknown", "A ventilation allegation is present, but no competent evidence establishes a use-related cause.", [text_ref("art_management_reply", 1, "appear consistent with insufficient ventilation", agent)]),
                    fact("fact_remedy_plan", "Supported remedy plan", "Not reached", "unknown", "A remedy plan depends on supported causation and responsibility.", []),
                    fact("fact_financial_remedy", "Supported financial remedy", "Not reached", "unknown", "No financial remedy branch has been selected.", []),
                    fact("fact_settlement_proposal", "Settlement position", "Not reached", "unknown", "No settlement branch has been reached.", []),
                    fact("fact_escalation_ready", "Escalation readiness", "Not reached", "unknown", "Escalation depends on the supported remedy and dispute state.", []),
                    fact("fact_resolution_complete", "Resolution complete", "Not reached", "unknown", "No terminal outcome has been reached.", []),
                ]
            )
        else:
            facts.extend(
                [
                    fact("later_fact_source_integrity", "Source package integrity", "Recorded", "known", "Source hashes and media metadata were recorded before reasoning.", [metadata_ref("art_later_email", "sha256", ARTIFACTS["art_later_email"]["sha256"], "Source Integrity Agent")]),
                    fact("later_fact_policy_route", "Legal-protection policy reference", "Present", "known", "The intake contains a policy reference without deciding coverage.", [metadata_ref("intake", "policy_reference", claim["customer"]["policy"], "Intake Metadata Agent")]),
                    fact("later_fact_customer_objective", "Customer objective", "Obtain next-step guidance", "known", "The customer asks what to do next.", [text_ref("art_later_email", 1, "What should I do next?", agent)]),
                    fact("later_fact_notification", "Landlord notification", "Reported; original notice not supplied", "known", "The customer reports sending management an email, but the original is absent.", [text_ref("art_later_email", 1, "I sent the management an email last week.", agent)], decision_key="notification", normalized_value="unverified"),
                    fact("later_fact_remedy_plan", "Supported remedy plan", "Not reached", "unknown", "A remedy plan depends on supported causation and responsibility.", []),
                    fact("later_fact_financial_remedy", "Supported financial remedy", "Not reached", "unknown", "No financial remedy branch has been selected.", []),
                    fact("later_fact_settlement_proposal", "Settlement position", "Not reached", "unknown", "No settlement branch has been reached.", []),
                    fact("later_fact_escalation_ready", "Escalation readiness", "Not reached", "unknown", "Escalation depends on the supported remedy and dispute state.", []),
                    fact("later_fact_resolution_complete", "Resolution complete", "Not reached", "unknown", "No terminal outcome has been reached.", []),
                ]
            )
        canonicalization = {
            "implementation": "deterministic_reference_oracle",
            "model": None,
            "provider": None,
            "mode": MODEL_MODE_REFERENCE,
        }
        if self.model_mode == MODEL_MODE_OPENROUTER:
            if self.canonicalizer is None:  # pragma: no cover - constructor invariant
                raise RuntimeError("OpenRouter model mode requires a canonicalizer")
            catalog = [
                {
                    "fact_id": value["fact_id"],
                    "label": value["label"],
                    "controls_process": value["controls_process"],
                    "decision_key": value["decision_key"],
                    "normalized_options": DECISION_OPTIONS.get(value["decision_key"], {}),
                    "admissible_normalized_values": (
                        [value["normalized_value"]] if value["controls_process"] else []
                    ),
                    "expected_state": value["state"],
                    "canonical_value": value["value"],
                    "canonical_explanation": value["explanation"],
                    "deterministic_confidence": value["confidence"],
                    "admissible_text_refs": [
                        {
                            "artifact_id": source_ref["artifact_id"],
                            "page": source_ref["page"],
                            "excerpt": source_ref["excerpt"],
                        }
                        for source_ref in value["source_refs"]
                        if source_ref["locator_kind"] == "text_quote"
                    ],
                    "deterministic_text_refs": [
                        source_ref
                        for source_ref in value["source_refs"]
                        if source_ref["locator_kind"] == "text_quote"
                    ],
                    "bounded_enrichments": [
                        source_ref
                        for source_ref in value["source_refs"]
                        if source_ref["locator_kind"] in {"visual_observation", "metadata_field"}
                    ],
                }
                for value in facts
            ]
            canonical_input = observable_claim_package(claim)
            canonical_input_hash = digest(canonical_input)
            try:
                model_result = self.canonicalizer.canonicalize(
                    canonical_input,
                    run_id=run_id,
                    allowed_fact_catalog=catalog,
                )
            except CanonicalizerError as exc:
                safe_context = exc.safe_context
                outcome = safe_context.get("outcome", "failed")
                error_invariant = (
                    getattr(exc, "invariant", None)
                    or safe_context.get("error_invariant")
                    or {
                        "blocked_missing_credential": "missing_credential",
                        "blocked_cost_guard": "cost_guard",
                        "actual_cost_overrun": "actual_cost_overrun",
                    }.get(outcome)
                    or "canonicalization_failed"
                )
                self.emit(
                    run_id,
                    stage,
                    label,
                    "Guarded Canonical Facts Agent",
                    "failed",
                    headline="Canonical facts were not accepted",
                    detail="The bounded provider call failed a local invariant; no final playbook was accepted.",
                    implementation="hybrid_guarded_openrouter_canonicalizer",
                    model=OPENROUTER_MODEL,
                    actor_type="nemotron_agent",
                    agent_id="canonical_facts",
                    receipt_type="agent_failed",
                    failure_scope="root_canonical_facts",
                    root_agent=True,
                    acceptance_scope="pre_review_model_output",
                    error_type=type(exc).__name__,
                    error_invariant=error_invariant,
                    input_artifact="observable_claim_package",
                    input_artifact_hash=canonical_input_hash,
                    provider=OPENROUTER_PROVIDER,
                    requested_model=OPENROUTER_MODEL,
                    call_count=(
                        0
                        if outcome
                        in {"blocked_missing_credential", "blocked_cost_guard"}
                        else 1
                    ),
                    parent_call_id=None,
                    delegation_id=None,
                    response_id=safe_context.get("response_id"),
                    response_model=safe_context.get("response_model"),
                    upstream_provider=safe_context.get("upstream_provider"),
                    usage_source=safe_context.get("usage_source"),
                    finish_reason=safe_context.get("finish_reason"),
                    outcome=outcome,
                    handoff_from="observable_claim_package",
                    handoff_to="failure_boundary",
                    **{
                        key: safe_context[key]
                        for key in (
                            "call_id",
                            "orchestration_id",
                            "invalid_provenance_field",
                            "invalid_provenance_value_hash",
                        )
                        if key in safe_context
                    },
                    external_tracing=False,
                )
                raise
            facts = model_result["facts"]
            diagnostics = model_result["diagnostics"]
            unresolved = [value["label"] for value in facts if value["state"] in {"unknown", "conflicting"}]
            summary = (
                "Model-assisted hybrid canonicalization accepted "
                f"{diagnostics['accepted_fact_count']} bounded fact contributions; deterministic fallback "
                f"replaced {diagnostics['rejected_fact_count']} rejected proposals, and the deterministic source "
                f"gate projected {diagnostics['source_reference_projection_count']} authoritative citation sets. "
                "Consequential uncertainty "
                "remains explicit."
            )
            issues = [
                {
                    "issue": label,
                    "severity": "requires_review",
                    "why": "The hybrid canonical fact remains unknown or conflicting after deterministic verification.",
                }
                for label in unresolved
            ]
            canonicalization = {
                **model_result,
                "mode": MODEL_MODE_OPENROUTER,
                "authority_mode": "hybrid_guarded",
            }
        understanding = {
            "summary": summary,
            "category": (
                "Rental defect - mould and moisture"
                if primary
                else "Moisture and condensation report"
            ),
            "subcategory": "Recurring moisture with disputed causation",
            "scope": (
                "Swiss residential tenancy"
                if primary
                else "Residential-tenancy scope unverified"
            ),
            "dispute": "Concrete dispute appears to exist",
            "facts": facts,
            "issues": issues,
            "observable_only": True,
            "canonicalization": canonicalization,
        }
        self.storage.patch_run(run_id, patch={"understanding": understanding})
        unknowns = sum(item["state"] == "unknown" for item in facts)
        conflicts = sum(item["state"] == "conflicting" for item in facts)
        completed_actor = (
            "Guarded Canonical Facts Agent"
            if self.model_mode == MODEL_MODE_OPENROUTER
            else "Canonical Fact Projection Tool"
        )
        self.emit(
            run_id,
            stage,
            label,
            completed_actor,
            "completed",
            headline=f"{len(facts)} supported claim facts assembled",
            detail=f"{unknowns} controlling unknown and {conflicts} conflict remain explicit.",
            question="What claim state is supported by the observable evidence?",
            items=[f"{item['label']}: {item['value']}" for item in facts],
            metrics={"facts": len(facts), "unknowns": unknowns, "conflicts": conflicts},
            input_hash=parsed["input_hash"],
            output_hash=digest(understanding),
            input_artifacts=["parsed_submission"],
            output_artifact="canonical_claim_state",
            handoff_to="Swiss Legal Source Tool",
            implementation=canonicalization["implementation"],
            model=canonicalization["model"],
            actor_type=(
                "nemotron_agent"
                if self.model_mode == MODEL_MODE_OPENROUTER
                else "deterministic_tool"
            ),
            agent_id="canonical_facts",
            receipt_type=(
                "agent_completed"
                if self.model_mode == MODEL_MODE_OPENROUTER
                else "deterministic_stage_completed"
            ),
            acceptance_scope=(
                "pre_review_model_output"
                if self.model_mode == MODEL_MODE_OPENROUTER
                else "deterministic_reference_output"
            ),
            **(
                {
                    "call_id": canonicalization.get("call_id"),
                    "parent_call_id": None,
                    "delegation_id": None,
                    "origin_call_id": canonicalization.get("origin_call_id"),
                    "response_id": canonicalization.get("response_id"),
                    "response_model": canonicalization.get("response_model"),
                    "upstream_provider": canonicalization.get("upstream_provider"),
                    "usage_source": canonicalization.get("usage_source"),
                    "provider": canonicalization.get("provider"),
                    "requested_model": OPENROUTER_MODEL,
                    "call_count": 0 if canonicalization.get("cache_hit") else 1,
                    "finish_reason": canonicalization.get("finish_reason")
                    or canonicalization.get("origin_finish_reason"),
                    "usage": canonicalization.get("usage")
                    or canonicalization.get("origin_usage"),
                }
                if self.model_mode == MODEL_MODE_OPENROUTER
                else {}
            ),
            accepted_ids=canonicalization.get("diagnostics", {}).get("accepted_fact_ids", []),
            accepted_count=canonicalization.get("diagnostics", {}).get("accepted_fact_count"),
            rejected_count=canonicalization.get("diagnostics", {}).get("rejected_fact_count"),
            source_reference_projection_fact_ids=canonicalization.get(
                "diagnostics", {}
            ).get("source_reference_projection_fact_ids", []),
            source_reference_projection_count=canonicalization.get(
                "diagnostics", {}
            ).get("source_reference_projection_count", 0),
            deterministic_fallback_applied=canonicalization.get(
                "diagnostics", {}
            ).get("deterministic_fallback_applied", False),
            input_artifact="observable_claim_package",
            external_tracing=False,
        )
        self.pause(.25)
        return understanding

    def _research_stage(self, run_id: str, claim: dict[str, Any], understanding: dict[str, Any]) -> dict[str, Any]:
        stage, label, agent = VISIBLE_STAGES[2]
        questions = [
            "Does the submission fall within Swiss residential-tenancy defect handling?",
            "Was the landlord notified of the alleged defect?",
            "Is there a concrete disagreement rather than a purely advisory question?",
            "Which facts must be established before responsibility and remedies can be assessed?",
            "When would conciliation or another escalation route become relevant?",
        ]
        self.emit(
            run_id,
            stage,
            label,
            agent,
            "started",
            headline="Turning legal sources into claim-handling questions",
            detail="The agent retrieves only sources that create or constrain a process decision.",
            question="Which legal questions shape the complete handling process?",
            input_artifacts=["canonical_claim_state"],
            output_artifact="legal_context",
            handoff_to="Process Projection Tool",
        )
        self.pause(.4)
        legal = {
            "questions": questions,
            "sources": deepcopy(LAW_SOURCES),
            "handling_principles": [
                {
                    "source_id": "handling-causation",
                    "title": "Generated handling proposal: preserve disputed causation",
                    "source_type": "operational_interpretation",
                    "role": "A party allegation does not establish technical cause. Responsibility remains open until competent evidence distinguishes plausible explanations.",
                    "validation_status": "generated_reference_not_expert_approved",
                },
                {
                    "source_id": "handling-evidence-order",
                    "title": "Candidate handling proposal: least-burdensome competent evidence first",
                    "source_type": "operational_interpretation",
                    "role": "Request the first competent assessment before broader or more invasive tests unless current evidence already justifies them.",
                    "validation_status": "candidate_not_expert_approved",
                },
            ],
            "node_links": {
                "scope": ["fedlex-or-256"],
                "notification": ["fedlex-or-257g"],
                "defect": ["fedlex-or-256"],
                "causation": ["fedlex-or-256", "handling-causation"],
                "responsibility": ["fedlex-or-256", "fedlex-or-259a", "handling-causation"],
                "remedy": ["fedlex-or-259a"],
                "escalation": ["bwo-conciliation"],
            },
            "review_status": "Operational translation not yet approved by a qualified Swiss tenant-law reviewer",
        }
        self.storage.patch_run(run_id, patch={"legal_research": legal})
        self.emit(
            run_id,
            stage,
            label,
            agent,
            "completed",
            headline=f"{len(questions)} legal questions and {len(LAW_SOURCES)} official sources linked",
            detail="Every retained source affects at least one process node or evidence requirement.",
            question="Which legal questions shape the complete handling process?",
            items=[f"{source['title']}: {source['role']}" for source in LAW_SOURCES],
            metrics={"questions": len(questions), "official_sources": len(LAW_SOURCES), "handling_principles": 2},
            input_hash=digest(understanding),
            output_hash=digest(legal),
            input_artifacts=["canonical_claim_state"],
            output_artifact="legal_context",
            handoff_to="Process Projection Tool",
            retrieval_method="question-led official-source registry search",
        )
        self.pause(.25)
        return legal

    def _process_stage(
        self,
        run_id: str,
        claim: dict[str, Any],
        understanding: dict[str, Any],
        legal: dict[str, Any],
        memories: list[dict[str, Any]],
        knowledge: dict[str, Any],
    ) -> dict[str, Any]:
        stage, label, agent = VISIBLE_STAGES[3]
        self.emit(
            run_id,
            stage,
            label,
            agent,
            "started",
            headline="Synthesizing the full claim-handling decision graph",
            detail="The agent instantiates entry checks, factual decisions, evidence loops, remedy branches, escalation and closure.",
            question="How should this claim type be handled from intake to resolution?",
            input_artifacts=["canonical_claim_state", "legal_context"],
            output_artifact="process_graph",
            handoff_to="Evidence Checklist Tool",
        )
        self.pause(.45)
        later = claim["claim_id"] == "DEMO-MOULD-002"
        notification_answer = "Written notice and receipt established" if not later else "Customer reports notice; original message not attached"
        notification_state = "complete" if not later else "supported"
        node_facts = {
            "scope": ["fact_tenancy"] if not later else ["later_fact_tenancy"],
            "dispute": ["fact_dispute"] if not later else ["later_fact_dispute"],
            "urgency": ["fact_health"] if not later else ["later_fact_health"],
            "notification": ["fact_notification"] if not later else ["later_fact_notification"],
            "defect": ["fact_recurrence"] if not later else ["later_fact_recurrence", "later_fact_recent_window_work"],
            "causation": ["fact_cause", "fact_ventilation_allegation"] if not later else ["later_fact_cause", "later_fact_ventilation_allegation", "later_fact_recent_window_work"],
        }
        branches = [
            {"branch_id": "building-defect", "label": "Building or installation defect", "condition": "Competent evidence supports a building-related cause", "target": "building_defect", "state": "possible"},
            {"branch_id": "tenant-use", "label": "Use-related cause", "condition": "Competent evidence supports a use-related cause", "target": "tenant_use", "state": "possible"},
            {"branch_id": "mixed-cause", "label": "Mixed contribution", "condition": "Evidence supports more than one contributing cause", "target": "mixed_cause", "state": "possible"},
            {"branch_id": "insufficient", "label": "Evidence still insufficient", "condition": "No competent evidence yet distinguishes the plausible causes", "target": "evidence_gap", "state": "selected"},
        ]
        nodes = [
            process_node("intake", "Claim intake", "Are the message and source files readable and attributable?", "complete", answer="Yes", why="Handling starts from the exact observable package.", kind="entry", evidence_requirement_ids=["claim_message", "source_integrity"]),
            process_node("scope", "Tenant-law scope", "Is this a Swiss residential-tenancy matter?", "complete", answer="Yes", why="The applicable process depends on legal scope and jurisdiction.", fact_ids=node_facts["scope"], legal_source_ids=["fedlex-or-256"], evidence_requirement_ids=["lease", "policy_reference"], branches=[{"branch_id": "out-of-scope", "label": "Outside scope", "condition": "Observable facts establish a route outside Swiss residential tenancy", "target": "out_of_scope", "state": "possible"}, {"branch_id": "scope-unverified", "label": "Scope unverified", "condition": "Observable facts do not yet establish scope", "target": "scope", "state": "possible"}]),
            process_node("dispute", "Existence of a dispute", "Is there a concrete disagreement requiring legal handling?", "complete", answer="Yes", why="A legal-protection process should not start for a purely advisory or unsupported complaint.", fact_ids=node_facts["dispute"], evidence_requirement_ids=["customer_objective", "management_position"], branches=[{"branch_id": "no-dispute", "label": "No dispute", "condition": "Observable facts establish no concrete disagreement", "target": "no_dispute", "state": "possible"}, {"branch_id": "dispute-unverified", "label": "Dispute unverified", "condition": "Observable facts do not establish whether a concrete disagreement exists", "target": "dispute", "state": "possible"}]),
            process_node("urgency", "Urgency and safety", "Is immediate health, safety or deadline action required?", "complete", answer="No acute concern reported", why="Urgent risks can bypass the ordinary evidence sequence.", fact_ids=node_facts["urgency"], evidence_requirement_ids=["health_safety_statement"], branches=[{"branch_id": "urgent", "label": "Urgent", "condition": "Observable facts establish an acute risk or deadline", "target": "urgent_escalation", "state": "possible"}, {"branch_id": "urgency-unverified", "label": "Urgency unverified", "condition": "Observable facts do not establish urgency", "target": "urgency", "state": "possible"}]),
            process_node("notification", "Landlord notification", "Was the landlord told about the defect?", notification_state, answer=notification_answer, why="Notification affects later remedy and escalation steps.", fact_ids=node_facts["notification"], legal_source_ids=["fedlex-or-257g"], evidence_requirement_ids=["defect_notice", "proof_of_delivery"], branches=[{"branch_id": "notice-gap", "label": "Notification gap", "condition": "Notification is absent or unverified", "target": "formal_notice", "state": "possible"}]),
            process_node("defect", "Defect and recurrence", "Is a recurring condition sufficiently documented?", "complete", answer="Visible recurrence supported", why="The process must distinguish a recurring condition from a one-off observation.", fact_ids=node_facts["defect"], legal_source_ids=["fedlex-or-256"], evidence_requirement_ids=["dated_photos", "recurrence_chronology"], branches=[{"branch_id": "recurrence-gap", "label": "Recurrence gap", "condition": "Observable facts do not establish recurrence", "target": "defect", "state": "possible"}]),
            process_node("causation", "Causation assessment", "What caused the recurring moisture condition?", "current", answer="Unresolved", why="Responsibility and remedy depend on competent evidence that distinguishes plausible causes.", fact_ids=node_facts["causation"], legal_source_ids=["fedlex-or-256", "handling-causation"], evidence_requirement_ids=["technical_assessment", "moisture_measurements", "building_envelope", "use_evidence"], branches=branches),
            process_node("responsibility", "Responsibility", "Who is responsible for the established cause?", "blocked", answer="Waits for causation", why="The system must not convert an allegation into responsibility.", legal_source_ids=["fedlex-or-256", "fedlex-or-259a", "handling-causation"], evidence_requirement_ids=["technical_assessment", "repair_history"]),
            process_node("remedy", "Remedy selection", "Which repair, reduction, settlement or other remedy branch applies?", "blocked", answer="Waits for responsibility", why="Remedies follow the supported facts and the customer's objective.", legal_source_ids=["fedlex-or-259a"], evidence_requirement_ids=["remediation_plan", "financial_impact", "settlement_proposal"]),
            process_node("escalation", "Escalation", "Is conciliation or another legal escalation required?", "future", answer="Not reached", why="Escalation becomes relevant only if the supported remedy branch does not resolve the dispute.", legal_source_ids=["bwo-conciliation"], evidence_requirement_ids=["conciliation_bundle"]),
            process_node("resolution", "Resolution and closure", "Has the agreed remedy been completed and documented?", "future", answer="Not reached", why="Closure requires a recorded outcome and completion evidence.", kind="outcome", evidence_requirement_ids=["completion_record"]),
            process_node("out_of_scope", "Route outside tenant law", "Which service should receive the matter?", "inactive", answer="Not applicable", why="Used only when the scope check fails.", kind="outcome", main_spine=False, activation="scope = no"),
            process_node("no_dispute", "Advice or closure", "Can the matter be resolved without a legal dispute process?", "inactive", answer="Not applicable", why="Used when no concrete disagreement exists.", kind="outcome", main_spine=False, activation="dispute = no"),
            process_node("urgent_escalation", "Immediate protective action", "What must happen before ordinary handling continues?", "inactive", answer="Not applicable", why="Used only for acute safety, health or deadline risk.", kind="action", main_spine=False, activation="urgency = yes"),
            process_node("formal_notice", "Complete the notification record", "What notification or proof gap should be addressed before later remedies are considered?", "inactive" if not later else "possible", answer="No current gap for the primary claim", why="Notification is relevant; written evidence can help establish it, without treating Article 257g as a statutory writing requirement.", kind="action", main_spine=False, legal_source_ids=["fedlex-or-257g"], evidence_requirement_ids=["defect_notice", "proof_of_delivery"], activation="notification = no or unverified"),
            process_node("building_defect", "Building-defect branch", "Which building condition caused the defect and what remediation is required?", "unresolved", answer="Possible", why="Activated only when competent evidence supports a building or installation cause.", main_spine=False, legal_source_ids=["fedlex-or-256", "fedlex-or-259a"], evidence_requirement_ids=["technical_assessment", "building_envelope", "remediation_plan"], activation="causation = building defect"),
            process_node("tenant_use", "Use-related branch", "Which use factor is supported and what response is proportionate?", "unresolved", answer="Possible", why="Activated only when competent evidence supports a use-related cause.", main_spine=False, evidence_requirement_ids=["technical_assessment", "use_evidence"], activation="causation = tenant use"),
            process_node("mixed_cause", "Mixed-cause branch", "How should responsibility and remedy reflect multiple contributing causes?", "unresolved", answer="Possible", why="Activated when evidence supports both building and use-related contributions.", main_spine=False, evidence_requirement_ids=["technical_assessment", "building_envelope", "use_evidence", "settlement_proposal"], activation="causation = mixed"),
            process_node("evidence_gap", "Causation evidence loop", "Which competent evidence can distinguish the plausible causes?", "next", answer="Neutral technical assessment first", why="The selected interim branch gathers evidence and returns to the causation decision.", kind="action", main_spine=False, legal_source_ids=["handling-causation", "handling-evidence-order"], evidence_requirement_ids=["technical_assessment", "moisture_measurements", "building_envelope"], activation="causation = insufficient evidence"),
        ]
        edges = [
            edge("intake", "scope", "source package readable", "selected"),
            edge("scope", "dispute", "tenant-law scope confirmed", "selected"),
            edge("scope", "out_of_scope", "outside tenant law", "inactive"),
            edge("dispute", "urgency", "concrete dispute exists", "selected"),
            edge("dispute", "no_dispute", "no concrete dispute", "inactive"),
            edge("urgency", "urgent_escalation", "acute risk or deadline", "inactive"),
            edge("urgency", "notification", "ordinary handling", "selected"),
            edge("notification", "defect", "notice established", "selected" if not later else "possible"),
            edge("notification", "formal_notice", "notice missing or unverified", "inactive" if not later else "possible"),
            edge("defect", "causation", "recurring condition supported", "selected"),
            edge("causation", "building_defect", "building cause supported", "possible"),
            edge("causation", "tenant_use", "use-related cause supported", "possible"),
            edge("causation", "mixed_cause", "mixed cause supported", "possible"),
            edge("causation", "evidence_gap", "evidence insufficient", "selected"),
            edge("evidence_gap", "causation", "new evidence received", "loop"),
            edge("building_defect", "responsibility", "cause established", "possible"),
            edge("tenant_use", "responsibility", "cause established", "possible"),
            edge("mixed_cause", "responsibility", "contributions established", "possible"),
            edge("responsibility", "remedy", "responsibility established", "blocked"),
            edge("remedy", "resolution", "remedy accepted and completed", "future"),
            edge("remedy", "escalation", "remedy disputed or refused", "future"),
            edge("escalation", "resolution", "settlement, decision or withdrawal", "future"),
        ]
        main_spine = ["intake", "scope", "dispute", "urgency", "notification", "defect", "causation", "responsibility", "remedy", "escalation", "resolution"]
        projection = decision_projection(understanding["facts"])
        current_overlay = apply_process_projection(nodes, edges, projection, main_spine)
        process = {
            "process_id": f"process-{claim['claim_id'].lower()}",
            "title": "Recurring mould and moisture handling playbook",
            "scope": "claim-specific instance of the mould and moisture process library",
            "nodes": nodes,
            "edges": edges,
            "main_spine": main_spine,
            "current_node": projection["current_node"],
            "selected_path": projection["selected_path"],
            "current_overlay": current_overlay,
            "playbook_version": knowledge["version"],
            "memory_used": False,
            "shared_rule_applied": False,
            "validator": {
                "valid": True,
                "checks": [
                    "one current node",
                    "all selected edges connect",
                    "entry, scope, dispute, evidence, remedy and closure represented",
                    "unknown causation not treated as false",
                    "blocked remedy not marked complete",
                    "every evidence-bearing node has requirement links",
                    "inactive branches remain inspectable but do not control the current claim",
                ],
            },
        }
        self.storage.patch_run(
            run_id,
            patch={
                "process_candidate" if self.model_mode == MODEL_MODE_OPENROUTER else "process": process
            },
        )
        branch_count = sum(len(node.get("branches", [])) for node in nodes)
        self.emit(
            run_id,
            stage,
            label,
            agent,
            "candidate_prepared" if self.model_mode == MODEL_MODE_OPENROUTER else "completed",
            headline=f"{len(nodes)} decision and branch nodes proposed",
            detail=f"The full path contains entry checks, {branch_count} causation outcomes, an evidence loop, remedy, escalation and closure.",
            question="How should this claim type be handled from intake to resolution?",
            items=[f"{node['title']}: {node['state']}" for node in nodes if node["main_spine"]],
            metrics={"nodes": len(nodes), "edges": len(edges), "conditional_branches": branch_count + 5, "main_spine_nodes": len(main_spine)},
            input_hash=digest({"understanding": understanding, "legal": legal, "knowledge": knowledge["version"]}),
            output_hash=digest(process),
            input_artifacts=["canonical_claim_state", "legal_context"],
            output_artifact=(
                "candidate_process_graph"
                if self.model_mode == MODEL_MODE_OPENROUTER
                else "process_graph"
            ),
            handoff_to="Evidence Checklist Tool",
            playbook_version=knowledge["version"],
        )
        self.pause(.25)
        return process

    def _evidence_stage(
        self,
        run_id: str,
        claim: dict[str, Any],
        understanding: dict[str, Any],
        process: dict[str, Any],
        legal: dict[str, Any],
        memories: list[dict[str, Any]],
        knowledge: dict[str, Any],
    ) -> dict[str, Any]:
        stage, label, agent = VISIBLE_STAGES[4]
        self.emit(
            run_id,
            stage,
            label,
            agent,
            "started",
            headline="Deriving evidence requirements across the full graph",
            detail="Each requirement must establish a fact required by a reached or possible process branch.",
            question="What complete evidence model does this process require?",
            input_artifacts=["canonical_claim_state", "legal_context", "process_graph"],
            output_artifact="evidence_model",
            handoff_to="Historical Retrieval Tool",
        )
        self.pause(.45)
        later = claim["claim_id"] == "DEMO-MOULD-002"

        def item(
            item_id: str,
            title: str,
            status: str,
            node_id: str,
            fact_id: str,
            why: str,
            *,
            legal_basis_ids: list[str] | None = None,
            artifact_ids: list[str] | None = None,
            acceptable_alternatives: list[str] | None = None,
            applies_when: str = "always",
            required_level: str = "mandatory",
        ) -> dict[str, Any]:
            return {
                "item_id": item_id,
                "title": title,
                "status": status,
                "node_id": node_id,
                "fact_id": fact_id,
                "why": why,
                "legal_basis_ids": legal_basis_ids or [],
                "artifact_ids": artifact_ids or [],
                "acceptable_alternatives": acceptable_alternatives or [],
                "applies_when": applies_when,
                "required_level": required_level,
                "current_path": node_id in process["selected_path"] or node_id in {"responsibility", "remedy"},
            }

        if not later:
            items = [
                item("claim_message", "Original claim message", "provided_sufficient", "intake", "fact_customer_objective", "Defines the customer's account, objective and first observable claim state.", artifact_ids=["message"]),
                item("source_integrity", "Source-file checksums and metadata", "provided_sufficient", "intake", "fact_source_integrity", "Keeps original files distinct from derived representations.", artifact_ids=claim["artifact_ids"]),
                item("lease", "Residential lease agreement", "provided_sufficient", "scope", "fact_tenancy", "Establishes the parties, premises and residential-tenancy relationship.", legal_basis_ids=["fedlex-or-256"], artifact_ids=["art_lease"]),
                item("policy_reference", "Policy and routing reference", "provided_sufficient", "scope", "fact_policy_route", "Routes the case to the correct legal-protection workflow without deciding coverage.", artifact_ids=["intake"]),
                item("customer_objective", "Customer's requested outcome", "provided_sufficient", "dispute", "fact_customer_objective", "Distinguishes a concrete repair dispute from a general advisory question.", artifact_ids=["message"]),
                item("management_position", "Management reply or refusal", "provided_sufficient", "dispute", "fact_dispute", "Establishes the opposing position and the existence of a concrete disagreement.", artifact_ids=["art_management_reply"]),
                item("health_safety_statement", "Current health and safety information", "provided_sufficient", "urgency", "fact_health", "Supports the present non-emergency triage while leaving escalation available if facts change.", artifact_ids=["message"]),
                item("defect_notice", "Evidence of landlord notification", "provided_sufficient", "notification", "fact_notification", "Shows that the landlord was told about the alleged defect; the available evidence happens to be written.", legal_basis_ids=["fedlex-or-257g"], artifact_ids=["art_notification"]),
                item("proof_of_delivery", "Proof that the notice was received", "provided_sufficient", "notification", "fact_notification", "Supports when and how the written notice reached management.", legal_basis_ids=["fedlex-or-257g"], artifact_ids=["art_delivery"]),
                item("dated_photos", "Dated photographs of the condition", "provided_sufficient", "defect", "fact_recurrence", "Shows the visible condition and helps establish recurrence, but not technical cause.", artifact_ids=["art_photo"]),
                item("recurrence_chronology", "Chronology of recurrence and prior action", "provided_insufficient", "defect", "fact_date_conflict", "The chronology supports recurrence but conflicts with the message on the first-observation date.", artifact_ids=["art_timeline"], acceptable_alternatives=["Corrected chronology", "Clarifying customer statement"]),
                item("technical_assessment", "Independent technical assessment", "missing", "causation", "fact_cause", "Competent evidence is needed to distinguish building, use-related and mixed causes before responsibility is assigned.", legal_basis_ids=["fedlex-or-256", "handling-causation"], acceptable_alternatives=["Independent building-physics report", "Qualified moisture inspection", "Landlord inspection accepted by both parties"]),
                item("moisture_measurements", "Moisture and environmental measurements", "conditional", "causation", "fact_cause", "Measurements may support the technical assessment when the source cannot be identified visually.", legal_basis_ids=["handling-causation"], acceptable_alternatives=["Moisture mapping", "Humidity and surface-temperature log", "Thermal imaging"], applies_when="The first inspection needs quantitative confirmation", required_level="conditional"),
                item("building_envelope", "Building-envelope assessment", "conditional", "causation", "fact_cause", "Broader testing is justified only if the neutral first assessment cannot establish the moisture source.", legal_basis_ids=["handling-evidence-order"], acceptable_alternatives=["Facade inspection", "Window-seal assessment", "Thermal-bridge analysis"], applies_when="The neutral first assessment is inconclusive or indicates an envelope issue", required_level="conditional"),
                item("repair_history", "Landlord inspection and repair records", "conditional", "responsibility", "fact_repair_history", "Shows what the landlord investigated or repaired and whether prior action addressed the supported cause.", legal_basis_ids=["fedlex-or-256"], artifact_ids=["art_management_reply"], acceptable_alternatives=["Inspection report", "Work order", "Contractor correspondence"], applies_when="The landlord states that inspection or remediation occurred", required_level="conditional"),
                item("use_evidence", "Use-related evidence", "not_applicable", "tenant_use", "fact_tenant_use_cause", "This becomes relevant only if competent evidence points to ventilation, heating or another use-related factor.", acceptable_alternatives=["Ventilation log", "Heating records", "Occupancy/use information"], applies_when="The tenant-use branch becomes supported", required_level="conditional"),
                item("remediation_plan", "Repair or remediation plan", "not_applicable", "remedy", "fact_remedy_plan", "Needed only after a building-related responsibility branch is supported.", legal_basis_ids=["fedlex-or-259a"], acceptable_alternatives=["Landlord repair commitment", "Contractor scope of work"], applies_when="Building responsibility is established", required_level="conditional"),
                item("financial_impact", "Evidence supporting a financial remedy", "conditional", "remedy", "fact_financial_remedy", "Needed only if the selected remedy includes rent reduction, reimbursement or loss evidence.", legal_basis_ids=["fedlex-or-259a"], acceptable_alternatives=["Invoices", "Rent records", "Documented loss"], applies_when="A financial remedy is pursued", required_level="conditional"),
                item("settlement_proposal", "Settlement proposal and response", "conditional", "remedy", "fact_settlement_proposal", "A settlement record becomes relevant only if the parties negotiate a supported remedy.", legal_basis_ids=["fedlex-or-259a"], acceptable_alternatives=["Written proposal", "Recorded mediation position"], applies_when="A settlement branch is pursued", required_level="conditional"),
                item("conciliation_bundle", "Conciliation evidence bundle", "conditional", "escalation", "fact_escalation_ready", "A concise record of notice, disputed facts, technical evidence and requested remedy supports escalation.", legal_basis_ids=["bwo-conciliation"], acceptable_alternatives=["Conciliation application with indexed exhibits"], applies_when="The remedy is refused or remains disputed", required_level="conditional"),
                item("completion_record", "Repair, settlement or closure record", "not_applicable", "resolution", "fact_resolution_complete", "Closure should record what resolved the claim and whether the agreed action was completed.", acceptable_alternatives=["Repair completion record", "Settlement", "Decision", "Reasoned closure note"], applies_when="The claim reaches a terminal outcome", required_level="conditional"),
            ]
        else:
            items = [
                item("claim_message", "Original claim message", "provided_sufficient", "intake", "later_fact_customer_objective", "Defines the customer's account and objective.", artifact_ids=["art_later_email"]),
                item("source_integrity", "Source-file checksums and metadata", "provided_sufficient", "intake", "later_fact_source_integrity", "Keeps original files distinct from derived representations.", artifact_ids=claim["artifact_ids"]),
                item("lease", "Residential lease or equivalent tenancy proof", "missing", "scope", "later_fact_tenancy", "The current package does not establish a residential-tenancy relationship; tenancy proof is required before scope can be confirmed.", legal_basis_ids=["fedlex-or-256"], acceptable_alternatives=["Lease", "Current rent statement naming the premises", "Accepted policy record"]),
                item("policy_reference", "Policy and routing reference", "provided_sufficient", "scope", "later_fact_policy_route", "Routes the case without deciding coverage.", artifact_ids=["intake"]),
                item("customer_objective", "Customer's requested outcome", "provided_sufficient", "dispute", "later_fact_customer_objective", "Distinguishes the requested guidance from any inferred legal remedy.", artifact_ids=["art_later_email"]),
                item("management_position", "Original management ventilation allegation", "missing", "dispute", "later_fact_dispute", "The customer reports the allegation, but the exact wording and stated basis are absent.", acceptable_alternatives=["Management email", "Letter", "Inspection note"]),
                item("health_safety_statement", "Current health and safety information", "provided_sufficient", "urgency", "later_fact_health", "Supports the present non-emergency triage.", artifact_ids=["art_later_email"]),
                item("defect_notice", "Evidence of landlord notification", "provided_insufficient", "notification", "later_fact_notification", "Notification is relevant; written evidence helps establish what was sent and received, but Article 257g does not itself impose a writing form.", legal_basis_ids=["fedlex-or-257g"], artifact_ids=["art_later_email"], acceptable_alternatives=["Notice email", "Registered letter", "Management acknowledgement", "Other reliable notification evidence"]),
                item("proof_of_delivery", "Evidence that notification reached management", "missing", "notification", "later_fact_notification", "The customer reports notification, while receipt remains unverified.", legal_basis_ids=["fedlex-or-257g"], acceptable_alternatives=["Management acknowledgement", "Delivery record", "Other reliable receipt evidence"]),
                item("dated_photos", "Dated photograph of the condition", "provided_sufficient", "defect", "later_fact_recurrence", "Shows the visible condition beside the replaced window.", artifact_ids=["art_later_photo"]),
                item("recurrence_chronology", "Chronology of recurrence", "missing", "defect", "later_fact_recurrence", "A chronology would help test recurrence and timing without deciding causation.", acceptable_alternatives=["Dated messages", "Inspection chronology", "Clarifying customer statement"]),
                item("repair_history", "Window replacement record", "provided_sufficient", "defect", "later_fact_recent_window_work", "Makes installation condition relevant to the causation branch.", artifact_ids=["art_window_notice"]),
                item("technical_assessment", "Independent technical assessment", "missing", "causation", "later_fact_cause", "Competent evidence is needed to distinguish seals, insulation, use factors and mixed causes.", legal_basis_ids=["fedlex-or-256", "handling-causation"], acceptable_alternatives=["Independent moisture inspection", "Building-physics report"]),
                item("moisture_measurements", "Moisture and environmental measurements", "conditional", "causation", "later_fact_cause", "Measurements support the assessment when visual inspection is inconclusive.", legal_basis_ids=["handling-causation"], applies_when="The first assessment needs quantitative confirmation", required_level="conditional"),
                item("building_envelope", "Building-envelope assessment", "missing", "causation", "later_fact_cause", "The v3 reference requests the broader assessment immediately; no quarantined candidate is applied.", legal_basis_ids=["handling-evidence-order"], applies_when="Immediate under the v3 reference", required_level="mandatory"),
                item("use_evidence", "Use-related evidence", "conditional", "tenant_use", "later_fact_ventilation_allegation", "Use-related evidence is requested only after competent assessment makes the allegation relevant.", acceptable_alternatives=["Ventilation record", "Heating data", "Inspection observations"], applies_when="The neutral assessment leaves a plausible use-related branch", required_level="conditional"),
                item("remediation_plan", "Repair or remediation plan", "not_applicable", "remedy", "later_fact_remedy_plan", "Needed only after responsibility is supported.", legal_basis_ids=["fedlex-or-259a"], applies_when="Building responsibility is established", required_level="conditional"),
                item("financial_impact", "Evidence supporting a financial remedy", "conditional", "remedy", "later_fact_financial_remedy", "Needed only if a supported financial remedy is pursued.", legal_basis_ids=["fedlex-or-259a"], applies_when="A financial remedy is pursued", required_level="conditional"),
                item("settlement_proposal", "Settlement proposal and response", "conditional", "remedy", "later_fact_settlement_proposal", "Relevant only if the parties negotiate a supported remedy.", legal_basis_ids=["fedlex-or-259a"], applies_when="A settlement branch is pursued", required_level="conditional"),
                item("conciliation_bundle", "Conciliation evidence bundle", "conditional", "escalation", "later_fact_escalation_ready", "Used only if the supported remedy remains disputed.", legal_basis_ids=["bwo-conciliation"], applies_when="Remedy refused or disputed", required_level="conditional"),
                item("completion_record", "Repair, settlement or closure record", "not_applicable", "resolution", "later_fact_resolution_complete", "Records the terminal outcome.", applies_when="Claim resolved", required_level="conditional"),
            ]
        apply_evidence_projection(items, process)
        present = []
        required = []
        for evidence in items:
            if evidence["status"].startswith("provided"):
                present.append(
                    {
                        "item_id": evidence["item_id"],
                        "title": evidence["title"],
                        "status": "available" if evidence["status"] == "provided_sufficient" else "insufficient",
                        "node_id": evidence["node_id"],
                        "fact": evidence["fact_id"],
                        "why": evidence["why"],
                        "artifact_id": evidence["artifact_ids"][0] if evidence["artifact_ids"] else None,
                    }
                )
            elif evidence["status"] in {"missing", "conditional"} and evidence["current_path"]:
                required.append(
                    {
                        "item_id": evidence["item_id"],
                        "title": evidence["title"],
                        "status": "still_needed" if evidence["status"] == "missing" else "conditional",
                        "node_id": evidence["node_id"],
                        "fact": evidence["fact_id"],
                        "why": evidence["why"],
                        "mandatory": "now" if evidence["status"] == "missing" else evidence["applies_when"],
                        "already_supplied": False,
                    }
                )
        summary = {
            "provided_sufficient": sum(item["status"] == "provided_sufficient" for item in items),
            "provided_insufficient": sum(item["status"] == "provided_insufficient" for item in items),
            "missing": sum(item["status"] == "missing" for item in items),
            "conditional": sum(item["status"] == "conditional" for item in items),
            "not_applicable": sum(item["status"] == "not_applicable" for item in items),
            "process_nodes_covered": len({item["node_id"] for item in items}),
        }
        checklist = {
            "title": "Complete process-grounded evidence model",
            "items": items,
            "present": present,
            "required": required,
            "summary": summary,
            "playbook_version": knowledge["version"],
            "memory_used": False,
            "shared_rule_applied": False,
            "validator": {
                "valid": True,
                "checks": [
                    "every requirement linked to a process node",
                    "every requirement linked to a fact",
                    "every requirement explains why the fact matters",
                    "provided evidence not requested again",
                    "conditionality explicit",
                    "inactive-branch evidence marked conditional or not applicable",
                    "document alternatives preserved",
                ],
            },
        }
        self.storage.patch_run(
            run_id,
            patch={
                "checklist_candidate"
                if self.model_mode == MODEL_MODE_OPENROUTER
                else "checklist": checklist
            },
        )
        self.emit(
            run_id,
            stage,
            label,
            agent,
            "candidate_prepared" if self.model_mode == MODEL_MODE_OPENROUTER else "completed",
            headline=f"{len(items)} evidence relationships linked to {summary['process_nodes_covered']} process nodes",
            detail=f"{summary['provided_sufficient']} sufficient, {summary['provided_insufficient']} insufficient, {summary['missing']} missing, {summary['conditional']} conditional and {summary['not_applicable']} not currently applicable.",
            question="What complete evidence model does this process require?",
            items=[f"{item['title']}: {item['status']} → {item['node_id']}" for item in items],
            metrics={"requirements": len(items), **summary},
            input_hash=digest({"process": process, "artifacts": claim["artifact_ids"], "legal": legal}),
            output_hash=digest(checklist),
            input_artifacts=["canonical_claim_state", "legal_context", "process_graph"],
            output_artifact=(
                "candidate_evidence_model"
                if self.model_mode == MODEL_MODE_OPENROUTER
                else "evidence_model"
            ),
            handoff_to="Historical Retrieval Tool",
            playbook_version=knowledge["version"],
        )
        self.pause(.25)
        return checklist

    def _experience_stage(
        self,
        run_id: str,
        claim: dict[str, Any],
        understanding: dict[str, Any],
        process: dict[str, Any],
        checklist: dict[str, Any],
        memories: list[dict[str, Any]],
    ) -> list[dict[str, Any]]:
        stage, label, agent = VISIBLE_STAGES[5]
        self.emit(
            run_id,
            stage,
            label,
            agent,
            "started",
            headline="Searching provenance-labelled organizational experience",
            detail="Ranking uses legal question, process branch, unresolved fact and evidence need while preserving each record's review status.",
            question="Which provenance-labelled cases can inform this handling plan?",
            input_artifacts=["canonical_claim_state", "process_graph", "evidence_model"],
            output_artifact="precedents",
            handoff_to="Whole-Playbook Verification Gate",
        )
        self.pause(.4)
        results: list[dict[str, Any]] = []
        for memory in memories:
            if memory.get("claim_id") == claim["claim_id"]:
                continue
            results.append(
                {
                    "claim_id": memory["claim_id"],
                    "title": memory.get("title", "Unverified demo recurring-mould memory"),
                    "review_status": memory.get("review_status", "unverified_demo_memory"),
                    "why_useful": "Unverified generated-demo memory with the same disputed-causation branch; it may inform retrieval but has no shared-rule authority.",
                    "shared_features": ["recurrence", "ventilation allegation", "cause unresolved"],
                    "process_branch": "causation → evidence gap → neutral inspection",
                    "evidence_that_resolved": ["neutral technical assessment"],
                    "final_process": memory.get("final_process", []),
                    "evidence": memory.get("final_checklist", []),
                    "reviewer_note": memory.get("reviewer_explanation", ""),
                    "outcome": "Unverified demo memory",
                    "memory_id": memory["memory_id"],
                }
            )
        for historical in HISTORICAL_CASES:
            if len(results) >= 3:
                break
            item = deepcopy(historical)
            item["process_branch"] = "causation dispute → competent evidence → remedy"
            item["evidence_that_resolved"] = item.get("evidence", [])[-2:]
            results.append(item)
        results = results[:3]
        self.storage.patch_run(run_id, patch={"precedents": results})
        self.emit(
            run_id,
            stage,
            label,
            agent,
            "completed",
            headline=f"{len(results)} provenance-labelled precedents retrieved",
            detail="Each result explains the process branch and evidence lesson while declaring whether it is generated reference data or unverified demo memory.",
            question="Which provenance-labelled cases can inform this handling plan?",
            items=[f"{item['claim_id']}: {item['why_useful']}" for item in results],
            metrics={
                "precedents": len(results),
                "qualified_expert_reviewed": sum(item.get("review_status") == "qualified_expert_reviewed" for item in results),
                "unverified_demo_memory": sum(item.get("review_status") == "unverified_demo_memory" for item in results),
                "generated_reference": sum(item.get("review_status") == "generated_reference" for item in results),
            },
            input_hash=digest({"process": process, "checklist": checklist}),
            output_hash=digest(results),
            input_artifacts=["canonical_claim_state", "process_graph", "evidence_model"],
            output_artifact="precedents",
            handoff_to="Whole-Playbook Verification Gate",
            ranking_dimensions=["legal question", "process branch", "unresolved fact", "evidence need", "declared provenance"],
        )
        self.pause(.2)
        return results

    def _verification_report(
        self,
        claim: dict[str, Any],
        understanding: dict[str, Any],
        legal: dict[str, Any],
        process: dict[str, Any],
        checklist: dict[str, Any],
        precedents: list[dict[str, Any]],
    ) -> dict[str, Any]:
        checks = validate_playbook(
            claim_id=claim["claim_id"],
            understanding=understanding,
            legal=legal,
            process=process,
            checklist=checklist,
            precedents=precedents,
            allowed_artifact_ids=set(claim["artifact_ids"]),
            artifact_page_counts={
                artifact_id: int(ARTIFACTS[artifact_id]["page_count"])
                for artifact_id in claim["artifact_ids"]
            },
            artifact_media_types={
                artifact_id: ARTIFACTS[artifact_id]["media_type"]
                for artifact_id in claim["artifact_ids"]
            },
            observable_package=observable_claim_package(claim),
        )
        process_checks = [
            check["name"]
            for check in checks
            if check["name"] in {"Graph integrity", "Current-state safety", "Law-to-process linkage"}
        ]
        evidence_checks = [
            check["name"]
            for check in checks
            if check["name"] in {"Process-to-evidence linkage", "Current-state safety", "Law-to-process linkage"}
        ]
        process["validator"] = {"valid": True, "computed": True, "checks": process_checks}
        checklist["validator"] = {"valid": True, "computed": True, "checks": evidence_checks}
        return {
            "valid": True,
            "computed": True,
            "contract_version": "casepath.playbook-contracts/1.2.0",
            "checks": checks,
            "rejected_proposals": [],
            "accepted_artifacts": ["canonical_claim_state", "legal_context", "process_graph", "evidence_model", "precedents"],
            "whole_playbook_hash": digest(
                {
                    "understanding": understanding,
                    "legal": legal,
                    "process": process,
                    "checklist": checklist,
                    "precedents": precedents,
                }
            ),
        }

    def _verify_stage(
        self,
        run_id: str,
        claim: dict[str, Any],
        understanding: dict[str, Any],
        legal: dict[str, Any],
        process: dict[str, Any],
        checklist: dict[str, Any],
        precedents: list[dict[str, Any]],
    ) -> dict[str, Any]:
        stage, label, agent = VISIBLE_STAGES[6]
        self.emit(
            run_id,
            stage,
            label,
            agent,
            "started",
            headline="Checking grounding, graph integrity and evidence links",
            detail="Agent proposals cannot enter canonical state until deterministic checks pass.",
            question="Is the complete playbook internally consistent and source-grounded?",
            input_artifacts=["canonical_claim_state", "legal_context", "process_graph", "evidence_model", "precedents"],
            output_artifact="verification_report",
            handoff_to="LangGraph Orchestration Boundary",
        )
        self.pause(.35)
        report = self._verification_report(claim, understanding, legal, process, checklist, precedents)
        checks = report["checks"]
        self.storage.patch_run(
            run_id,
            patch={
                "verification_candidate"
                if self.model_mode == MODEL_MODE_OPENROUTER
                else "verification": report
            },
        )
        self.emit(
            run_id,
            stage,
            label,
            agent,
            "candidate_prepared" if self.model_mode == MODEL_MODE_OPENROUTER else "completed",
            headline=f"{len(checks)} executable contract checks passed",
            detail="The final graph, sources, facts, evidence relationships and precedent provenance passed the fail-closed contract gate.",
            question="Is the complete playbook internally consistent and source-grounded?",
            items=[f"{item['name']}: {item['status']}" for item in checks],
            metrics={"checks_passed": len(checks), "canonical_artifacts": 5},
            input_hash=digest({"process": process, "checklist": checklist}),
            output_hash=digest(report),
            input_artifacts=["canonical_claim_state", "legal_context", "process_graph", "evidence_model", "precedents"],
            output_artifact=(
                "candidate_verification_report"
                if self.model_mode == MODEL_MODE_OPENROUTER
                else "verification_report"
            ),
            handoff_to="LangGraph Orchestration Boundary",
            implementation="deterministic_verification_agent",
            model=None,
        )
        self.pause(.2)
        return report

    def _agent_orchestration_stage(
        self,
        run_id: str,
        claim: dict[str, Any],
        understanding: dict[str, Any],
        process: dict[str, Any],
        checklist: dict[str, Any],
        verification: dict[str, Any],
    ) -> dict[str, Any]:
        if self.model_mode != MODEL_MODE_OPENROUTER:
            return {
                "executed": False,
                "authority_mode": MODEL_MODE_REFERENCE,
                "model": None,
                "external_tracing": False,
                "deterministic_safety_authority": True,
            }
        if self.agent_orchestrator is None:  # pragma: no cover - constructor invariant
            raise RuntimeError("OpenRouter model mode requires the LangGraph agent orchestrator")
        canonicalization = understanding["canonicalization"]

        def persist_receipt(receipt: dict[str, Any]) -> None:
            actor_type = receipt.get("actor_type")
            is_model = actor_type == "nemotron_agent"
            self.storage.add_event(
                run_id,
                {
                    "stage": "agent_orchestration",
                    "label": receipt.get("role", receipt["agent_id"]),
                    "agent": receipt.get("role", receipt["agent_id"]),
                    "agent_id": receipt["agent_id"],
                    "actor_type": actor_type,
                    "status": receipt["status"],
                    "headline": (
                        "Bounded specialist call failed closed"
                        if receipt["status"] == "failed"
                        else
                        f"{receipt.get('accepted_count', 0)} bounded contributions accepted"
                        if receipt["status"] == "completed" and is_model
                        else "Deterministic contract gate passed"
                        if receipt.get("receipt_type") == "gate_passed"
                        else "Bounded specialist call started"
                    ),
                    "detail": (
                        "Safe call identity and invariant class were retained; prompts, raw output and reasoning were not persisted."
                        if receipt["status"] == "failed"
                        else "Only accepted IDs and artifact hashes are streamed; prompts, raw output and reasoning are not persisted."
                        if is_model
                        else "This gate is application code and is not represented as an AI agent."
                    ),
                    "implementation": MULTI_AGENT_IMPLEMENTATION,
                    "model": OPENROUTER_MODEL if is_model else None,
                    "orchestrator": ORCHESTRATOR,
                    "validator": f"{receipt['agent_id']}-contract/{MULTI_AGENT_VERSION}",
                    "prompt_version": (
                        f"{receipt['agent_id']}/{MULTI_AGENT_VERSION}" if is_model else None
                    ),
                    **{
                        key: receipt[key]
                        for key in (
                            "receipt_type",
                            "acceptance_scope",
                            "delegation_id",
                            "parent_call_id",
                            "call_id",
                            "response_id",
                            "outcome",
                            "response_model",
                            "upstream_provider",
                            "usage_source",
                            "accepted_ids",
                            "accepted_count",
                            "rejected_count",
                            "deterministic_fallback_applied",
                            "source_agent_id",
                            "source_call_id",
                            "handoff_from",
                            "handoff_to",
                            "input_artifact",
                            "input_artifact_hash",
                            "output_artifact",
                            "output_artifact_hash",
                            "error_type",
                            "error_invariant",
                            "invalid_provenance_field",
                            "invalid_provenance_value_hash",
                        )
                        if key in receipt
                    },
                    "external_tracing": False,
                },
            )

        audit = self.agent_orchestrator.invoke(
            run_id=run_id,
            orchestration_id=canonicalization["orchestration_id"],
            observable_package=observable_claim_package(claim),
            canonicalization=canonicalization,
            facts=understanding["facts"],
            process=process,
            checklist=checklist,
            verification=verification,
            progress_sink=persist_receipt,
        )
        if audit.get("all_required_agents_contributed") is not True:
            raise RuntimeError("Required Nemotron specialist contribution is incomplete")
        artifacts = audit["specialist_artifacts"]
        agents = {entry["agent_id"]: entry for entry in audit["agents"]}
        process["agent_contribution"] = {
            "authority": "advisory_model_proposal",
            "deterministic_route_unchanged": True,
            "artifact": artifacts["process_decision_mapping"],
            "provenance": _accepted_agent_lineage(agents["process_decision_mapping"]),
            "source_integrity_artifact": artifacts["document_source_integrity"],
            "source_integrity_provenance": _accepted_agent_lineage(
                agents["document_source_integrity"]
            ),
        }
        decision_contributions = {
            item["fact_id"]: item
            for item in artifacts["process_decision_mapping"]["decisions"]
        }
        for node in process["nodes"]:
            bound = [
                decision_contributions[fact_id]
                for fact_id in node.get("fact_ids", [])
                if fact_id in decision_contributions
            ]
            if bound:
                node["agent_decision_contributions"] = bound
        checklist["agent_contribution"] = {
            "authority": "advisory_model_proposal",
            "deterministic_statuses_unchanged": True,
            "artifact": artifacts["evidence_checklist"],
            "provenance": _accepted_agent_lineage(agents["evidence_checklist"]),
        }
        evidence_contributions = {
            item["item_id"]: item for item in artifacts["evidence_checklist"]["items"]
        }
        for item in checklist["items"]:
            item["agent_contribution"] = evidence_contributions[item["item_id"]]
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
                audit["final_claim_brief"],
                "final_claim_brief_audit",
            ),
        }
        for gate in audit["deterministic_gates"]:
            output_artifact, artifact_value, source_agent_id = gate_bindings[gate["agent_id"]]
            source_agent = agents[source_agent_id]
            gate.update(
                {
                    "receipt_type": "accepted_artifact",
                    "acceptance_scope": "pre_review_model_output",
                    "output_artifact": output_artifact,
                    "output_artifact_hash": accepted_artifact_hash(artifact_value),
                    "source_agent_id": source_agent_id,
                    "source_call_id": source_agent["call_id"],
                    "delegation_id": source_agent.get("delegation_id"),
                    "accepted_ids": source_agent.get("accepted_ids", []),
                    "accepted_count": source_agent.get("accepted_count", 0),
                }
            )
        understanding["summary"] = (
            f"{understanding['summary']} Nemotron specialists contributed source-integrity, process-mapping, "
            "evidence-checklist and final-brief proposals through a guarded LangGraph DAG; deterministic "
            "contract gates remained authoritative."
        )
        self.storage.patch_run(run_id, patch={"agent_orchestration": audit})
        return audit

    def _final_result(
        self,
        claim: dict[str, Any],
        parsed: dict[str, Any],
        understanding: dict[str, Any],
        legal: dict[str, Any],
        process: dict[str, Any],
        checklist: dict[str, Any],
        precedents: list[dict[str, Any]],
        verification: dict[str, Any],
        knowledge: dict[str, Any],
        knowledge_mode: str,
        agent_orchestration: dict[str, Any],
    ) -> dict[str, Any]:
        reviewed_memory_used = any(
            precedent.get("review_status") == "unverified_demo_memory"
            for precedent in precedents
        )
        current_overlay = process["current_overlay"]
        nodes_by_id = {node["node_id"]: node for node in process["nodes"]}
        current_node = nodes_by_id[current_overlay["current_node_id"]]
        next_node = nodes_by_id[current_overlay["next_action_node_id"]]
        return {
            "claim_id": claim["claim_id"],
            "summary": understanding["summary"],
            "scope": understanding["scope"],
            "category": understanding["category"],
            "subcategory": understanding["subcategory"],
            "dispute": understanding["dispute"],
            "facts": understanding["facts"],
            "issues": understanding["issues"],
            "legal_research": legal,
            "process": process,
            "checklist": checklist,
            "precedents": precedents,
            "verification": verification,
            "agent_orchestration": agent_orchestration,
            "current_overlay": current_overlay,
            "current_blocker": current_node["question"],
            "why_blocked": current_node["why"],
            "next_action": {
                "title": next_node["title"],
                "detail": next_node["why"],
                "requires_expert_approval": True,
                "process_node_id": next_node["node_id"],
                "agent_brief_contribution": agent_orchestration.get("final_claim_brief"),
            },
            "playbook": {
                "title": process["title"],
                "version": process["playbook_version"],
                "full_process_nodes": len(process["nodes"]),
                "main_spine_nodes": len(process["main_spine"]),
                "evidence_relationships": len(checklist["items"]),
                "current_claim_overlay": current_overlay,
            },
            "memory_used": reviewed_memory_used,
            "reviewed_memory_used": reviewed_memory_used,
            "shared_rule_applied": False,
            "knowledge": {
                "mode": knowledge_mode,
                "reviewed_memory_used": reviewed_memory_used,
                "shared_playbook_version": knowledge["version"],
                "shared_rule_applied": False,
            },
            "audit": {
                "input_hash": parsed["input_hash"],
                "profile": (
                    PROFILE
                    if self.model_mode == MODEL_MODE_OPENROUTER
                    else DETERMINISTIC_PROFILE
                ),
                "orchestrator": ORCHESTRATOR,
                "schema": "casepath.claim-handling-playbook/15.2",
                "accepted": verification["valid"],
                "verification_computed": verification.get("computed") is True,
                "canonicalization": understanding.get("canonicalization"),
                "agent_orchestration": agent_orchestration,
                "authority_mode": (
                    MULTI_AGENT_AUTHORITY_MODE
                    if self.model_mode == MODEL_MODE_OPENROUTER
                    else MODEL_MODE_REFERENCE
                ),
                "warnings": [
                    "Fictional generated claim package",
                    "Legal and operational translations require qualified review",
                    "No autonomous customer contact or legal decision",
                ],
            },
        }

    def review(self, run_id: str, payload: dict[str, Any], *, session_id: str = "public") -> dict[str, Any]:
        decision = payload.get("decision", "approve_with_edit")
        mode = payload.get("building_envelope_mode", "conditional")
        if decision not in {"approve_with_edit", "reject"}:
            raise ValueError("Unsupported review decision")
        if mode not in {"conditional", "required_now"}:
            raise ValueError("Unsupported evidence mode")
        request = {
            "decision": decision,
            "building_envelope_mode": mode,
            "confidence": float(payload.get("confidence", .9)),
            "justification": payload.get("justification", "").strip(),
        }
        reviewer = {"type": "unverified_demo_user", "qualification_status": "not_verified"}

        with self.review_lock:
            run = self.storage.get_run(run_id, session_id=session_id)
            if not run or run.get("status") != "complete":
                raise ValueError("A completed analysis is required")
            if run["claim_id"] != "DEF-027-E0-DEMO":
                raise ValueError("The public lifecycle demo reviews the flagship claim")
            existing = self.storage.get_review_for_run(run_id, session_id=session_id)
            if existing:
                if existing.get("request") == request and isinstance(existing.get("response"), dict):
                    return deepcopy(existing["response"])
                raise ValueError("This run already has a different review")

            original_result = deepcopy(run["result"])
            if decision == "reject":
                response = {
                    "accepted": False,
                    "review_id": None,
                    "memory_id": None,
                    "reviewer": reviewer,
                    "candidate": None,
                    "result": original_result,
                    "review": {"decision": decision, "operations": []},
                    "changes": {"process_nodes": {"before": len(original_result["process"]["nodes"]), "after": len(original_result["process"]["nodes"]), "added": []}, "evidence_relationships": {"before": len(original_result["checklist"]["items"]), "after": len(original_result["checklist"]["items"]), "changed": []}},
                    "knowledge": {
                        "reviewed_memory_available": False,
                        "shared_playbook_version": "mould-playbook-v3",
                        "candidate_status": None,
                        "shared_knowledge_changed": False,
                    },
                }
                review_id = self.storage.save_review(
                    run_id,
                    run["claim_id"],
                    {"request": request, "reviewer": reviewer, "accepted": False},
                    session_id=session_id,
                )
                response["review_id"] = review_id
                self.storage.update_review(
                    review_id,
                    {"request": request, "reviewer": reviewer, "accepted": False, "response": response},
                    session_id=session_id,
                )
                self.storage.patch_run(run_id, patch={"review_id": review_id, "review_response": response})
                self.storage.add_event(
                    run_id,
                    {
                        "stage": "review",
                        "label": "Generated-demo review rejected",
                        "agent": "Demo Review Boundary",
                        "status": "completed",
                        "headline": "No memory, candidate, or shared knowledge was created",
                        "detail": "The original computed result remains unchanged.",
                        "implementation": "unverified_demo_review",
                        "model": None,
                        "orchestrator": ORCHESTRATOR,
                        "validator": "review-contract/15.2",
                        "prompt_version": None,
                        "input_artifacts": ["claim_handling_playbook", "demo_review"],
                        "output_artifact": "rejected_review_record",
                    },
                )
                return response

            result = deepcopy(original_result)
            process = result["process"]
            checklist = result["checklist"]
            process_before = len(process["nodes"])
            evidence_before = len(checklist["items"])
            operations: list[ReviewOperation] = []

            ventilation_node = process_node(
                "ventilation_dispute",
                "Test the ventilation allegation",
                "What exactly is alleged, and does competent evidence support it?",
                "possible",
                answer="Preserve as disputed; test only when competent assessment leaves a plausible use-related branch",
                why="Unverified demo edit: represent the allegation as a question, not as established technical cause.",
                kind="action",
                main_spine=False,
                fact_ids=["fact_ventilation_allegation"],
                legal_source_ids=["handling-causation", "handling-evidence-order"],
                evidence_requirement_ids=["management_position", "use_evidence"],
                activation="recurrence + ventilation allegation + cause unresolved",
            )
            process["nodes"].append(ventilation_node)
            operations.append(
                {
                    "component": "process_graph",
                    "operation": "add",
                    "pointer": "/nodes/ventilation_dispute",
                    "old_value": None,
                    "new_value": ventilation_node,
                    "reason": "Keep the reported ventilation allegation explicit and unresolved.",
                }
            )
            for value in (
                edge("evidence_gap", "ventilation_dispute", "neutral inspection leaves a plausible use-related factor", "possible"),
                edge("ventilation_dispute", "causation", "allegation evidence assessed", "loop"),
            ):
                process["edges"].append(value)
                operations.append(
                    {
                        "component": "process_graph",
                        "operation": "add",
                        "pointer": f"/edges/{value['source']}->{value['target']}",
                        "old_value": None,
                        "new_value": value,
                        "reason": "Connect the proposed question without changing the selected path.",
                    }
                )

            changed_evidence: list[str] = []
            for evidence in checklist["items"]:
                if evidence["item_id"] == "building_envelope":
                    before = deepcopy(evidence)
                    evidence["status"] = "conditional" if mode == "conditional" else "missing"
                    evidence["required_level"] = "conditional" if mode == "conditional" else "mandatory"
                    evidence["applies_when"] = (
                        "The neutral first assessment is inconclusive or indicates an envelope issue"
                        if mode == "conditional"
                        else "Immediate in this unverified demo edit"
                    )
                    evidence["why"] = (
                        "Unverified demo edit: broader building-envelope testing remains conditional on the first competent assessment."
                        if mode == "conditional"
                        else "Unverified demo edit: retain broader building-envelope testing as an immediate request."
                    )
                    if evidence != before:
                        changed_evidence.append(evidence["item_id"])
                        operations.append(
                            {
                                "component": "evidence_model",
                                "operation": "replace",
                                "pointer": "/items/building_envelope",
                                "old_value": before,
                                "new_value": deepcopy(evidence),
                                "reason": "Apply the selected generated-demo evidence-order edit.",
                            }
                        )
                elif evidence["item_id"] == "use_evidence":
                    before = deepcopy(evidence)
                    evidence["status"] = "conditional"
                    evidence["required_level"] = "conditional"
                    evidence["node_id"] = "ventilation_dispute"
                    evidence["applies_when"] = "A competent assessment leaves a plausible use-related branch"
                    evidence["why"] = "Unverified demo edit: use-related evidence becomes relevant only after competent assessment leaves a plausible use-related branch."
                    changed_evidence.append(evidence["item_id"])
                    operations.append(
                        {
                            "component": "evidence_model",
                            "operation": "replace",
                            "pointer": "/items/use_evidence",
                            "old_value": before,
                            "new_value": deepcopy(evidence),
                            "reason": "Move the conditional request to the explicit allegation question.",
                        }
                    )

            checklist["present"] = [
                {
                    "item_id": evidence["item_id"],
                    "title": evidence["title"],
                    "status": "available" if evidence["status"] == "provided_sufficient" else "insufficient",
                    "node_id": evidence["node_id"],
                    "fact": evidence["fact_id"],
                    "why": evidence["why"],
                    "artifact_id": evidence["artifact_ids"][0] if evidence["artifact_ids"] else None,
                }
                for evidence in checklist["items"]
                if evidence["status"].startswith("provided")
            ]
            checklist["required"] = [
                {
                    "item_id": evidence["item_id"],
                    "title": evidence["title"],
                    "status": "still_needed" if evidence["status"] == "missing" else "conditional",
                    "node_id": evidence["node_id"],
                    "fact": evidence["fact_id"],
                    "why": evidence["why"],
                    "mandatory": "now" if evidence["status"] == "missing" else evidence["applies_when"],
                    "already_supplied": False,
                }
                for evidence in checklist["items"]
                if evidence["status"] in {"missing", "conditional"} and evidence["current_path"]
            ]
            checklist["summary"] = {
                "provided_sufficient": sum(value["status"] == "provided_sufficient" for value in checklist["items"]),
                "provided_insufficient": sum(value["status"] == "provided_insufficient" for value in checklist["items"]),
                "missing": sum(value["status"] == "missing" for value in checklist["items"]),
                "conditional": sum(value["status"] == "conditional" for value in checklist["items"]),
                "not_applicable": sum(value["status"] == "not_applicable" for value in checklist["items"]),
                "process_nodes_covered": len({value["node_id"] for value in checklist["items"]}),
            }
            process["playbook_version"] = "mould-playbook-v3"
            checklist["playbook_version"] = "mould-playbook-v3"
            result["playbook"]["version"] = "mould-playbook-v3"
            result["playbook"]["full_process_nodes"] = len(process["nodes"])
            result["playbook"]["evidence_relationships"] = len(checklist["items"])
            result["next_action"]["detail"] = (
                "Arrange one neutral technical assessment first; keep building-envelope and use-related evidence conditional on what it finds."
                if mode == "conditional"
                else "Arrange a neutral technical assessment and retain the broader building-envelope request in this unverified demo edit."
            )
            review_record = {
                **request,
                "reviewer": reviewer,
                "operations": operations,
                "authority": "generated_demo_only",
            }
            result["review"] = review_record
            result["knowledge"] = {
                "mode": result.get("knowledge", {}).get("mode", "current"),
                "reviewed_memory_used": False,
                "shared_playbook_version": "mould-playbook-v3",
                "shared_rule_applied": False,
            }
            result["reviewed_memory_used"] = False
            result["shared_rule_applied"] = False
            review_operation_checks = validate_review_operations(operations)
            verification = self._verification_report(
                CLAIMS[run["claim_id"]],
                {"facts": result["facts"]},
                result["legal_research"],
                process,
                checklist,
                result["precedents"],
            )
            verification["checks"].extend(review_operation_checks)
            verification["review_operations_hash"] = digest(operations)
            result["verification"] = verification
            result["audit"]["accepted"] = verification["valid"]
            result["audit"]["verification_computed"] = verification["computed"]
            for gate in result.get("agent_orchestration", {}).get(
                "deterministic_gates", []
            ):
                if gate.get("receipt_type") == "accepted_artifact":
                    gate["acceptance_scope"] = "pre_review_model_output"
            review_transform = {
                "acceptance_scope": "post_review_unverified_transform",
                "authority": reviewer["type"],
                "qualification_status": reviewer["qualification_status"],
                "input_run_id": run_id,
                "input_process_hash": digest(original_result["process"]),
                "input_checklist_hash": digest(original_result["checklist"]),
                "output_process_hash": digest(process),
                "output_checklist_hash": digest(checklist),
                "model_acceptance_reused": False,
            }
            result["review_transform"] = review_transform
            result["audit"]["review_transform"] = review_transform

            review_id = self.storage.save_review(
                run_id,
                run["claim_id"],
                {"request": request, "reviewer": reviewer, "accepted": True},
                session_id=session_id,
            )
            candidate_id = "candidate_disputed_ventilation_v4"
            memory = {
                "title": "Generated-demo edit: disputed ventilation allegation and evidence ordering",
                "review_status": "unverified_demo_memory",
                "reviewer": reviewer,
                "source_run_id": run_id,
                "review_id": review_id,
                "candidate_id": candidate_id,
                "category": result["category"],
                "current_blocker": result["current_blocker"],
                "canonical_facts": deepcopy(result["facts"]),
                "reviewed_process": deepcopy(process),
                "reviewed_checklist": deepcopy(checklist),
                "final_process": [node["title"] for node in process["nodes"]],
                "final_checklist": [
                    {"title": evidence["title"], "status": evidence["status"], "why": evidence["why"], "node_id": evidence["node_id"]}
                    for evidence in checklist["items"]
                ],
                "verification": deepcopy(verification),
                "operations": deepcopy(operations),
                "next_action": deepcopy(result["next_action"]),
                "reviewer_explanation": request["justification"],
                "confidence": request["confidence"],
                "playbook_version": "mould-playbook-v3",
                "source_result_hash": digest(original_result),
                "reviewed_result_hash": digest(result),
                "shared_rule_authority": False,
            }
            memory_id = self.storage.save_memory(run["claim_id"], memory, session_id=session_id)
            supporting_claims = sorted(
                {
                    value["claim_id"]
                    for value in self.storage.memories(session_id=session_id)
                    if value.get("candidate_id") == candidate_id
                    and value.get("review_status") == "unverified_demo_memory"
                }
            )
            candidate = {
                "candidate_id": candidate_id,
                "title": "Candidate disputed-ventilation evidence-order branch",
                "status": "quarantined",
                "supporting_claims": supporting_claims,
                "support_count": len(supporting_claims),
                "required_support": 3,
                "base_version": "mould-playbook-v3",
                "proposed_version": "mould-playbook-v4",
                "previous_version": "mould-playbook-v3",
                "new_version": "mould-playbook-v4",
                "proposed_change": (
                    "Represent the disputed ventilation allegation explicitly and make broader testing conditional on a neutral first assessment."
                    if mode == "conditional"
                    else "Represent the disputed ventilation allegation explicitly while retaining immediate broader testing."
                ),
                "delta": {
                    "process_nodes_added": 1,
                    "edges_added": 2,
                    "evidence_relationships_changed": len(changed_evidence),
                    "node_ids": ["ventilation_dispute"],
                    "evidence_item_ids": changed_evidence,
                },
                "target_tests": {"status": "not_run", "passed": 0, "failed": 0},
                "protected_regression": {"status": "not_run", "passed": 0, "failed": 0},
                "approval": {"status": "pending", "qualified_reviewer": False},
                "shared_knowledge_changed": False,
                "rollback_target": "mould-playbook-v3",
                "provenance": "one unverified generated-demo review",
            }
            self.storage.save_candidate(candidate_id, candidate, session_id=session_id)
            result["knowledge_update"] = deepcopy(candidate)
            result["knowledge"]["reviewed_memory_available"] = True
            result["knowledge"]["candidate_status"] = "quarantined"
            result["knowledge"]["shared_knowledge_changed"] = False
            changes = {
                "process_nodes": {
                    "before": process_before,
                    "after": len(process["nodes"]),
                    "added": ["ventilation_dispute"],
                },
                "evidence_relationships": {
                    "before": evidence_before,
                    "after": len(checklist["items"]),
                    "changed": changed_evidence,
                },
            }
            response = {
                "accepted": True,
                "review_id": review_id,
                "memory_id": memory_id,
                "reviewer": reviewer,
                "candidate": candidate,
                "result": result,
                "review": review_record,
                "verification": verification,
                "changes": changes,
                "review_transform": review_transform,
                "knowledge": {
                    "reviewed_memory_available": True,
                    "shared_playbook_version": "mould-playbook-v3",
                    "candidate_status": "quarantined",
                    "shared_knowledge_changed": False,
                },
            }
            self.storage.update_review(
                review_id,
                {"request": request, "reviewer": reviewer, "accepted": True, "response": response},
                session_id=session_id,
            )
            self.storage.patch_run(
                run_id,
                patch={
                    "result": result,
                    "review_id": review_id,
                    "memory_id": memory_id,
                    "candidate": candidate,
                    "review_response": response,
                },
            )
            self.storage.add_event(
                run_id,
                {
                    "stage": "review",
                    "label": "Unverified generated-demo edit recorded",
                    "agent": "Demo Review Boundary",
                    "status": "completed",
                    "headline": f"{len(operations)} typed operations passed post-review verification",
                    "detail": "The reviewed result is retrievable as unverified demo memory; its candidate remains quarantined and shared playbook v3 is unchanged.",
                    "implementation": "unverified_demo_review",
                    "model": None,
                    "orchestrator": ORCHESTRATOR,
                    "validator": "review-contract/15.2",
                    "prompt_version": None,
                    "input_artifacts": ["claim_handling_playbook", "demo_review"],
                    "output_artifact": "unverified_demo_memory",
                    "receipt_type": "review_transform",
                    **review_transform,
                    "metrics": {
                        "support_count": candidate["support_count"],
                        "required_support": candidate["required_support"],
                        "shared_knowledge_changed": False,
                    },
                },
            )
            return response

    def _active_knowledge(self, *, session_id: str = "public") -> dict[str, Any]:
        return {
            "version": "mould-playbook-v3",
            "previous_version": "mould-playbook-v2",
            "status": "current_reference",
            "candidate": None,
            "shared_knowledge_changed": False,
            "qualified_release_evidence": False,
        }

    def knowledge(self, *, session_id: str = "public") -> dict[str, Any]:
        active = self._active_knowledge(session_id=session_id)
        versions = [
            {
                "version": "mould-playbook-v3",
                "status": "current_reference",
                "description": "General recurring-mould process without an explicit disputed-ventilation evidence-order branch.",
                "qualified_review_status": "pending",
            }
        ]
        return {
            "active_playbook": active,
            "playbook_versions": versions,
            "memories": self.storage.memories(session_id=session_id),
            "candidates": self.storage.candidates(session_id=session_id),
            "shared_knowledge_changed": False,
        }

    @staticmethod
    def _learning_snapshot(run: dict[str, Any]) -> dict[str, Any]:
        result = run["result"]
        return {
            "run_id": run["run_id"],
            "completed_at": run.get("completed_at"),
            "result_hash": digest(result),
            "verification_hash": result["verification"]["whole_playbook_hash"],
            "verification_valid": result["verification"].get("valid") is True,
            "process_node_ids": [node["node_id"] for node in result["process"]["nodes"]],
            "current_node_id": result["process"]["current_node"],
            "required_now_item_ids": [
                item["item_id"]
                for item in result["checklist"]["required"]
                if item["status"] == "still_needed"
            ],
            "conditional_item_ids": [
                item["item_id"]
                for item in result["checklist"]["required"]
                if item["status"] == "conditional"
            ],
            "precedents": [
                {
                    "claim_id": item["claim_id"],
                    "memory_id": item.get("memory_id"),
                    "review_status": item["review_status"],
                }
                for item in result["precedents"]
            ],
            "reviewed_memory_used": result.get("reviewed_memory_used") is True,
            "shared_rule_applied": result.get("shared_rule_applied") is True,
            "playbook_version": result["playbook"]["version"],
        }

    def learning_proof(self, baseline_run_id: str, later_run_id: str, *, session_id: str = "public") -> dict[str, Any]:
        if baseline_run_id == later_run_id:
            raise ValueError("Learning proof requires two distinct completed runs")
        baseline_run = self.storage.get_run(baseline_run_id, session_id=session_id)
        later_run = self.storage.get_run(later_run_id, session_id=session_id)
        if not baseline_run or not later_run:
            raise ValueError("Both bound runs must exist")
        if baseline_run.get("status") != "complete" or later_run.get("status") != "complete":
            raise ValueError("Both bound runs must be complete")
        if baseline_run.get("claim_id") != "DEMO-MOULD-002" or later_run.get("claim_id") != "DEMO-MOULD-002":
            raise ValueError("Both bound runs must analyze the later demo claim")
        if baseline_run.get("knowledge_mode") != "baseline":
            raise ValueError("The baseline run must use baseline knowledge mode")
        if later_run.get("knowledge_mode") != "current":
            raise ValueError("The later run must use current knowledge mode")
        before = self._learning_snapshot(baseline_run)
        after = self._learning_snapshot(later_run)
        before_precedents = {item["claim_id"] for item in before["precedents"]}
        after_precedents = {item["claim_id"] for item in after["precedents"]}
        memory_ids = {
            item["memory_id"]
            for item in after["precedents"]
            if item.get("review_status") == "unverified_demo_memory" and item.get("memory_id")
        }
        candidate = next(
            (value for value in self.storage.candidates(session_id=session_id) if value.get("candidate_id") == "candidate_disputed_ventilation_v4"),
            None,
        )
        return {
            "ready": True,
            "computed": True,
            "claim_id": "DEMO-MOULD-002",
            "baseline_run_id": baseline_run_id,
            "later_run_id": later_run_id,
            "before": before,
            "after": after,
            "changes": {
                "process_node_ids_added": sorted(set(after["process_node_ids"]) - set(before["process_node_ids"])),
                "process_node_ids_removed": sorted(set(before["process_node_ids"]) - set(after["process_node_ids"])),
                "required_now_added": sorted(set(after["required_now_item_ids"]) - set(before["required_now_item_ids"])),
                "required_now_removed": sorted(set(before["required_now_item_ids"]) - set(after["required_now_item_ids"])),
                "conditional_added": sorted(set(after["conditional_item_ids"]) - set(before["conditional_item_ids"])),
                "conditional_removed": sorted(set(before["conditional_item_ids"]) - set(after["conditional_item_ids"])),
                "precedent_claim_ids_added": sorted(after_precedents - before_precedents),
                "precedent_claim_ids_removed": sorted(before_precedents - after_precedents),
            },
            "reviewed_memory_proof": {
                "used": after["reviewed_memory_used"],
                "memory_ids": sorted(memory_ids),
                "present_in_baseline": any(item.get("review_status") == "unverified_demo_memory" for item in before["precedents"]),
                "present_in_later_run": bool(memory_ids),
            },
            "candidate": candidate,
            "shared_rule": {
                "applied": False,
                "version_before": before["playbook_version"],
                "version_after": after["playbook_version"],
                "shared_knowledge_changed": False,
                "candidate_status": candidate.get("status") if candidate else None,
            },
            "interpretation": "This run-bound proof reports observed result differences only; it does not establish quality improvement, expert validation, or shared-rule promotion.",
        }
