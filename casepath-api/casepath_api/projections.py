from __future__ import annotations

from typing import Any


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
PROCESS_DECISION_KEYS = (
    "scope",
    "dispute",
    "urgency",
    "notification",
    "recurrence",
    "causation",
)


def decision_projection(facts: list[dict[str, Any]]) -> dict[str, Any]:
    """Project the active process route from typed fact decisions only."""

    grouped: dict[str, list[str]] = {key: [] for key in PROCESS_DECISION_KEYS}
    for value in facts:
        key = value.get("decision_key")
        if key in grouped and value.get("controls_process") is True:
            grouped[key].append(value.get("decision_value"))
    invalid = [key for key, values in grouped.items() if len(values) != 1]
    if invalid:
        raise ValueError(
            f"Process projection requires exactly one controlling fact for {invalid}"
        )
    decisions = {key: values[0] for key, values in grouped.items()}

    route = ["intake", "scope"]
    if decisions["scope"] == "out_of_scope":
        return _projection(
            decisions,
            route + ["out_of_scope"],
            "scope",
            "out_of_scope",
            "out-of-scope",
        )
    if decisions["scope"] == "scope_unverified":
        return _projection(
            decisions, route, "scope", "scope", "scope-unverified"
        )
    if decisions["scope"] != "in_scope":
        raise ValueError(f"Unsupported scope decision {decisions['scope']!r}")

    route.append("dispute")
    if decisions["dispute"] == "no_dispute":
        return _projection(
            decisions,
            route + ["no_dispute"],
            "dispute",
            "no_dispute",
            "no-dispute",
        )
    if decisions["dispute"] == "dispute_unverified":
        return _projection(
            decisions, route, "dispute", "dispute", "dispute-unverified"
        )
    if decisions["dispute"] != "dispute_present":
        raise ValueError(f"Unsupported dispute decision {decisions['dispute']!r}")

    route.append("urgency")
    if decisions["urgency"] == "urgent":
        return _projection(
            decisions,
            route + ["urgent_escalation"],
            "urgency",
            "urgent_escalation",
            "urgent",
        )
    if decisions["urgency"] == "urgency_unverified":
        return _projection(
            decisions, route, "urgency", "urgency", "urgency-unverified"
        )
    if decisions["urgency"] != "not_urgent":
        raise ValueError(f"Unsupported urgency decision {decisions['urgency']!r}")

    route.append("notification")
    if decisions["notification"] in {"not_notified", "notification_unverified"}:
        return _projection(
            decisions,
            route + ["formal_notice"],
            "notification",
            "formal_notice",
            "notice-gap",
        )
    if decisions["notification"] != "notified":
        raise ValueError(
            f"Unsupported notification decision {decisions['notification']!r}"
        )

    route.append("defect")
    if decisions["recurrence"] in {
        "recurrence_not_supported",
        "recurrence_unverified",
    }:
        return _projection(
            decisions, route, "defect", "defect", "recurrence-gap"
        )
    if decisions["recurrence"] != "recurrence_supported":
        raise ValueError(
            f"Unsupported recurrence decision {decisions['recurrence']!r}"
        )

    route.append("causation")
    cause_routes = {
        "cause_building": ("building_defect", "building-defect"),
        "cause_tenant_use": ("tenant_use", "tenant-use"),
        "cause_mixed": ("mixed_cause", "mixed-cause"),
        "cause_unresolved": ("evidence_gap", "insufficient"),
    }
    if decisions["causation"] not in cause_routes:
        raise ValueError(
            f"Unsupported causation decision {decisions['causation']!r}"
        )
    target, branch_id = cause_routes[decisions["causation"]]
    return _projection(
        decisions,
        route + [target],
        "causation",
        target,
        branch_id,
    )


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
    spine_position = (
        main_spine.index(current) if current in main_spine else len(main_spine)
    )
    blocked = [
        node_id
        for node_id in main_spine[spine_position + 1 :]
        if node_id in {"responsibility", "remedy"}
    ]

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
        branch_targets.update(
            branch["target"] for branch in node.get("branches", [])
        )
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
            branch["state"] = (
                "selected"
                if branch["branch_id"] == projection["selected_branch_id"]
                else "possible"
            )

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
            "Current health, safety and deadline information is absent and must "
            "be established before ordinary handling continues."
        )

    if decisions["notification"] == "not_notified":
        for item_id in ("defect_notice", "proof_of_delivery"):
            by_id[item_id]["status"] = "missing"
            by_id[item_id]["artifact_ids"] = []
    elif decisions["notification"] == "notification_unverified":
        by_id["defect_notice"]["status"] = (
            "provided_insufficient"
            if by_id["defect_notice"]["artifact_ids"]
            else "missing"
        )
        by_id["proof_of_delivery"]["status"] = "missing"
        by_id["proof_of_delivery"]["artifact_ids"] = []

    if decisions["recurrence"] in {
        "recurrence_unverified",
        "recurrence_not_supported",
    }:
        by_id["dated_photos"]["status"] = (
            "provided_insufficient"
            if by_id["dated_photos"]["artifact_ids"]
            else "missing"
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

    active_nodes = set(process["selected_path"]) | {
        process["current_overlay"]["next_action_node_id"]
    }
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


def checklist_derived_sections(
    items: list[dict[str, Any]],
) -> dict[str, Any]:
    """Build the exact public checklist projections from authoritative items."""

    present: list[dict[str, Any]] = []
    required: list[dict[str, Any]] = []
    for evidence in items:
        if evidence["status"].startswith("provided"):
            present.append(
                {
                    "item_id": evidence["item_id"],
                    "title": evidence["title"],
                    "status": (
                        "available"
                        if evidence["status"] == "provided_sufficient"
                        else "insufficient"
                    ),
                    "node_id": evidence["node_id"],
                    "fact": evidence["fact_id"],
                    "why": evidence["why"],
                    "artifact_id": (
                        evidence["artifact_ids"][0]
                        if evidence["artifact_ids"]
                        else None
                    ),
                }
            )
        elif (
            evidence["status"] in {"missing", "conditional"}
            and evidence["current_path"]
        ):
            required.append(
                {
                    "item_id": evidence["item_id"],
                    "title": evidence["title"],
                    "status": (
                        "still_needed"
                        if evidence["status"] == "missing"
                        else "conditional"
                    ),
                    "node_id": evidence["node_id"],
                    "fact": evidence["fact_id"],
                    "why": evidence["why"],
                    "mandatory": (
                        "now"
                        if evidence["status"] == "missing"
                        else evidence["applies_when"]
                    ),
                    "already_supplied": False,
                }
            )
    summary = {
        "provided_sufficient": sum(
            item["status"] == "provided_sufficient" for item in items
        ),
        "provided_insufficient": sum(
            item["status"] == "provided_insufficient" for item in items
        ),
        "missing": sum(item["status"] == "missing" for item in items),
        "conditional": sum(item["status"] == "conditional" for item in items),
        "not_applicable": sum(
            item["status"] == "not_applicable" for item in items
        ),
        "process_nodes_covered": len({item["node_id"] for item in items}),
    }
    return {"present": present, "required": required, "summary": summary}


__all__ = [
    "DECISION_OPTIONS",
    "PROCESS_DECISION_KEYS",
    "apply_evidence_projection",
    "apply_process_projection",
    "checklist_derived_sections",
    "decision_projection",
]
