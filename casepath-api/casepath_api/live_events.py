from __future__ import annotations

from copy import deepcopy
import json
from typing import Any, Iterable


LIVE_EVENT_CONTRACT = "casepath.run-events/1.0.0"
TERMINAL_RUN_STATUSES = frozenset({"complete", "failed"})


def _actor(
    actor_type: str,
    actor_id: str,
    label: str,
    *,
    model: str | None = None,
    call_id: str | None = None,
) -> dict[str, Any]:
    value: dict[str, Any] = {
        "type": actor_type,
        "id": actor_id,
        "label": label,
        "model": model,
    }
    if call_id:
        value["call_id"] = call_id
    return value


def activity_event(audit_event: dict[str, Any]) -> dict[str, Any]:
    """Mirror the already-safe persisted audit event without rewriting its claims."""

    event = deepcopy(audit_event)
    return {
        "dedupe_key": f"activity:{event['event_id']}",
        "type": "run.activity",
        "stage": event.get("stage", "orchestrator"),
        "actor": _actor(
            str(event.get("actor_type") or "deterministic_tool"),
            str(event.get("agent_id") or event.get("agent") or "casepath"),
            str(event.get("agent") or event.get("label") or "CasePath"),
            model=event.get("model"),
            call_id=event.get("call_id"),
        ),
        "acceptance": {
            "state": event.get("status"),
            "scope": event.get("acceptance_scope"),
            "receipt_type": event.get("receipt_type"),
        },
        "entity": {
            "kind": "audit_event",
            "id": event["event_id"],
        },
        "links": {},
        "audit_event": event,
    }


def terminal_event(status: str) -> dict[str, Any]:
    if status not in TERMINAL_RUN_STATUSES:
        raise ValueError("unsupported terminal run status")
    event_type = "run.completed" if status == "complete" else "run.failed"
    return {
        "dedupe_key": f"terminal:{status}",
        "type": event_type,
        "status": status,
        "stage": status,
        "actor": _actor(
            "deterministic_gate",
            "run_terminal_boundary",
            "Run terminal boundary",
        ),
        "acceptance": {"state": status},
        "entity": {"kind": "run", "id": None, "status": status},
        "links": {},
    }


def fact_events(understanding: dict[str, Any]) -> list[dict[str, Any]]:
    canonicalization = understanding.get("canonicalization", {})
    diagnostics = canonicalization.get("diagnostics", {})
    accepted_ids = set(diagnostics.get("accepted_fact_ids", []))
    model = canonicalization.get("model")
    actor_type = "nemotron_agent" if model else "deterministic_tool"
    actor = _actor(
        actor_type,
        "canonical_facts",
        (
            "Guarded Canonical Facts Agent"
            if model
            else "Canonical Fact Projection Tool"
        ),
        model=model,
        call_id=canonicalization.get("call_id"),
    )
    events: list[dict[str, Any]] = []
    for fact in understanding.get("facts", []):
        fact_id = str(fact["fact_id"])
        events.append(
            {
                "dedupe_key": f"fact:{fact_id}",
                "type": "fact.accepted",
                "stage": "understand",
                "actor": actor,
                "acceptance": {
                    "state": "accepted",
                    "authority": (
                        "hybrid_guarded"
                        if model
                        else "deterministic_reference"
                    ),
                    "model_contribution_accepted": fact_id in accepted_ids,
                    "deterministic_fallback_applied": bool(model)
                    and fact_id not in accepted_ids,
                },
                "entity": {
                    "kind": "fact",
                    "id": fact_id,
                    "value": deepcopy(fact),
                },
                "links": {
                    "source_refs": deepcopy(fact.get("source_refs", [])),
                },
            }
        )
    return events


def legal_source_events(legal: dict[str, Any]) -> list[dict[str, Any]]:
    questions = legal.get("questions", [])
    actor = _actor(
        "deterministic_tool",
        "official_law_registry",
        "Swiss Legal Source Tool",
    )
    events: list[dict[str, Any]] = []
    for source_kind, sources in (
        ("official_source", legal.get("sources", [])),
        ("handling_principle", legal.get("handling_principles", [])),
    ):
        for source in sources:
            source_id = str(source["source_id"])
            matching_questions = [
                question
                for question in questions
                if source_id
                in [
                    *question.get("source_ids", []),
                    *question.get("interpretation_ids", []),
                ]
            ]
            events.append(
                {
                    "dedupe_key": f"legal_source:{source_id}",
                    "type": "legal_source.linked",
                    "stage": "research",
                    "actor": actor,
                    "acceptance": {
                        "state": "linked",
                        "authority": legal.get("lookup_method"),
                        "registry_version": legal.get("registry_version"),
                    },
                    "entity": {
                        "kind": source_kind,
                        "id": source_id,
                        "value": deepcopy(source),
                    },
                    "links": {
                        "question_ids": [
                            question["question_id"] for question in matching_questions
                        ],
                        "process_node_ids": sorted(
                            {
                                node_id
                                for question in matching_questions
                                for node_id in question.get("process_node_ids", [])
                            }
                        ),
                    },
                }
            )
    return events


def precedent_events(
    precedents: Iterable[dict[str, Any]], ranking_receipt: dict[str, Any]
) -> list[dict[str, Any]]:
    actor = _actor(
        "deterministic_tool",
        "historical_claims_retrieval",
        "Historical Retrieval Tool",
    )
    return [
        {
            "dedupe_key": f"precedent:{item['claim_id']}",
            "type": "precedent.selected",
            "stage": "experience",
            "actor": actor,
            "acceptance": {
                "state": "selected",
                "authority": "deterministic_precedent_ranking",
            },
            "entity": {
                "kind": "precedent",
                "id": item["claim_id"],
                "value": deepcopy(item),
            },
            "links": {"ranking_receipt": deepcopy(ranking_receipt)},
        }
        for item in precedents
    ]


def accepted_artifact_events(
    understanding: dict[str, Any],
    process: dict[str, Any],
    checklist: dict[str, Any],
    orchestration: dict[str, Any],
    verification: dict[str, Any],
) -> list[dict[str, Any]]:
    """Project only the graph and checklist that survived deterministic gates."""

    agents = {
        item.get("agent_id"): item for item in orchestration.get("agents", [])
    }
    gates = {
        item.get("agent_id"): item
        for item in orchestration.get("deterministic_gates", [])
    }
    process_agent = agents.get("process_decision_mapping", {})
    evidence_agent = agents.get("evidence_checklist", {})
    final_agent = agents.get("final_claim_brief_audit", {})
    process_gate = gates.get("deterministic_process_gate", {})
    evidence_gate = gates.get("deterministic_evidence_gate", {})
    final_gate = gates.get("whole_playbook_gate", {})

    def accepted_actor(
        source: dict[str, Any], fallback_id: str, label: str
    ) -> dict[str, Any]:
        model = orchestration.get("model") if source else None
        return _actor(
            "nemotron_agent" if model else "deterministic_tool",
            str(source.get("agent_id") or fallback_id),
            label,
            model=model,
            call_id=source.get("call_id"),
        )

    process_actor = accepted_actor(
        process_agent, "process_projection", "Process Decision Mapping Agent"
    )
    evidence_actor = accepted_actor(
        evidence_agent, "evidence_projection", "Evidence and Checklist Agent"
    )
    final_actor = accepted_actor(
        final_agent,
        "verification_projection",
        "Final Claim Brief Audit Agent",
    )
    process_acceptance = {
        "state": "accepted",
        "gate_id": process_gate.get("agent_id") or "reference_process_validator",
        "artifact_hash": process_gate.get("output_artifact_hash"),
        "source_call_id": process_gate.get("source_call_id"),
    }
    evidence_acceptance = {
        "state": "accepted",
        "gate_id": evidence_gate.get("agent_id") or "reference_evidence_validator",
        "artifact_hash": evidence_gate.get("output_artifact_hash"),
        "source_call_id": evidence_gate.get("source_call_id"),
    }
    final_acceptance = {
        "state": "accepted",
        "gate_id": final_gate.get("agent_id") or "reference_verification_validator",
        "artifact_hash": final_gate.get("output_artifact_hash"),
        "source_call_id": final_gate.get("source_call_id"),
    }
    events: list[dict[str, Any]] = []
    for node in process.get("nodes", []):
        node_id = str(node["node_id"])
        events.append(
            {
                "dedupe_key": f"process_node:{node_id}",
                "type": "process_node.created",
                "stage": "process",
                "actor": process_actor,
                "acceptance": process_acceptance,
                "entity": {
                    "kind": "process_node",
                    "id": node_id,
                    "value": deepcopy(node),
                },
                "links": {
                    "incoming_edges": [
                        deepcopy(edge)
                        for edge in process.get("edges", [])
                        if edge.get("target") == node_id
                    ],
                    "legal_source_ids": deepcopy(
                        node.get("legal_source_ids", [])
                    ),
                    "fact_ids": deepcopy(node.get("fact_ids", [])),
                },
            }
        )
        for index, branch in enumerate(node.get("branches", [])):
            branch_id = str(
                branch.get("branch_id")
                or branch.get("node_id")
                or branch.get("target")
                or index
            )
            events.append(
                {
                    "dedupe_key": f"branch:{node_id}:{branch_id}",
                    "type": "branch.created",
                    "stage": "process",
                    "actor": process_actor,
                    "acceptance": process_acceptance,
                    "entity": {
                        "kind": "process_branch",
                        "id": f"{node_id}:{branch_id}",
                        "value": deepcopy(branch),
                    },
                    "links": {"process_node_id": node_id},
                }
            )
    for item in checklist.get("items", []):
        item_id = str(item["item_id"])
        events.append(
            {
                "dedupe_key": f"evidence_requirement:{item_id}",
                "type": "evidence_requirement.linked",
                "stage": "evidence",
                "actor": evidence_actor,
                "acceptance": evidence_acceptance,
                "entity": {
                    "kind": "evidence_requirement",
                    "id": item_id,
                    "value": deepcopy(item),
                },
                "links": {
                    "process_node_id": item.get("node_id"),
                    "fact_id": item.get("fact_id"),
                    "legal_source_ids": deepcopy(item.get("legal_basis_ids", [])),
                },
            }
        )

    events.append(
        {
            "dedupe_key": "verification:whole_playbook_verification",
            "type": "verification.accepted",
            "stage": "verify",
            "actor": final_actor,
            "acceptance": final_acceptance,
            "entity": {
                "kind": "verification",
                "id": "whole_playbook_verification",
                "value": {
                    "status": verification.get("status"),
                    "checks_total": len(verification.get("checks", [])),
                    "rejected_count": len(
                        verification.get("rejected_proposals", [])
                    ),
                },
            },
            "links": {
                "process_node_id": process.get("current_node"),
                "next_action_node_id": process.get("next_action_node"),
            },
        }
    )

    rejected: list[dict[str, Any]] = []
    diagnostics = understanding.get("canonicalization", {}).get("diagnostics", {})
    rejected.extend(diagnostics.get("rejected_facts", []))
    for agent in orchestration.get("agents", []):
        for item in agent.get("rejected", []):
            rejected.append({"agent_id": agent.get("agent_id"), **item})
    rejected.extend(verification.get("rejected_proposals", []))
    for index, item in enumerate(rejected):
        rejection_id = str(
            item.get("fact_id")
            or item.get("item_id")
            or item.get("proposal_id")
            or item.get("contribution_id")
            or index
        )
        safe_rejection = {
            key: deepcopy(item[key])
            for key in (
                "fact_id",
                "item_id",
                "proposal_id",
                "contribution_id",
                "agent_id",
                "invariant",
                "reason",
            )
            if key in item
        }
        events.append(
            {
                "dedupe_key": f"verification_rejection:{index}:{rejection_id}",
                "type": "verification.rejected",
                "stage": "verify",
                "actor": _actor(
                    "deterministic_gate",
                    "verification_gate",
                    "Deterministic Verification Gate",
                ),
                "acceptance": {"state": "rejected"},
                "entity": {
                    "kind": "rejected_proposal",
                    "id": rejection_id,
                    "value": safe_rejection,
                },
                "links": {},
            }
        )
    return events


def encode_sse(event: dict[str, Any]) -> str:
    return (
        f"id: {event['sequence']}\n"
        f"event: {event['type']}\n"
        f"data: {json.dumps(event, ensure_ascii=False, separators=(',', ':'))}\n\n"
    )


def validate_event_draft(value: dict[str, Any]) -> None:
    required = {
        "dedupe_key",
        "type",
        "stage",
        "actor",
        "acceptance",
        "entity",
        "links",
    }
    if not required <= value.keys():
        raise ValueError("invalid live event draft")
    if not isinstance(value["dedupe_key"], str) or not value["dedupe_key"]:
        raise ValueError("invalid live event dedupe key")


__all__ = [
    "LIVE_EVENT_CONTRACT",
    "TERMINAL_RUN_STATUSES",
    "accepted_artifact_events",
    "activity_event",
    "encode_sse",
    "fact_events",
    "legal_source_events",
    "precedent_events",
    "terminal_event",
    "validate_event_draft",
]
