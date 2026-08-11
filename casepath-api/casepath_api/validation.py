from __future__ import annotations

from dataclasses import dataclass
import re
from typing import Any, Iterable
import unicodedata


FACT_STATES = {"known", "unknown", "conflicting", "not_applicable"}
EVIDENCE_STATES = {
    "provided_sufficient",
    "provided_insufficient",
    "missing",
    "conditional",
    "not_applicable",
    "present_unreviewed",
    "conflicting",
    "unknown",
}
PRECEDENT_STATUSES = {
    "generated_reference",
    "unverified_demo_memory",
    "qualified_expert_reviewed",
}
REVIEW_COMPONENTS = {"process_graph", "evidence_model"}
REVIEW_OPERATIONS = {"add", "replace", "remove"}
LOCATOR_KINDS = {"text_quote", "visual_observation", "metadata_field"}
DECISION_VALUES = {
    "in_scope",
    "out_of_scope",
    "dispute_present",
    "no_dispute",
    "urgent",
    "not_urgent",
    "notified",
    "notification_unverified",
    "not_notified",
    "recurrence_supported",
    "recurrence_unverified",
    "cause_building",
    "cause_tenant_use",
    "cause_mixed",
    "cause_unresolved",
    "scope_unverified",
    "dispute_unverified",
    "urgency_unverified",
    "recurrence_not_supported",
}
NORMALIZED_DECISIONS = {
    "scope": {"supported_in_scope": "in_scope", "supported_out_of_scope": "out_of_scope", "unverified": "scope_unverified"},
    "dispute": {"present": "dispute_present", "absent": "no_dispute", "unverified": "dispute_unverified"},
    "urgency": {"urgent": "urgent", "not_urgent": "not_urgent", "unverified": "urgency_unverified"},
    "notification": {"notified": "notified", "not_notified": "not_notified", "unverified": "notification_unverified"},
    "recurrence": {"supported": "recurrence_supported", "not_supported": "recurrence_not_supported", "unverified": "recurrence_unverified"},
    "causation": {"building": "cause_building", "tenant_use": "cause_tenant_use", "mixed": "cause_mixed", "unresolved": "cause_unresolved"},
}


@dataclass(frozen=True)
class ContractIssue:
    contract: str
    path: str
    message: str

    def as_dict(self) -> dict[str, str]:
        return {"contract": self.contract, "path": self.path, "message": self.message}


class ContractValidationError(ValueError):
    def __init__(self, issues: Iterable[ContractIssue]):
        self.issues = list(issues)
        detail = "; ".join(f"{issue.path}: {issue.message}" for issue in self.issues)
        super().__init__(detail or "contract validation failed")


def _require(condition: bool, contract: str, path: str, message: str, issues: list[ContractIssue]) -> None:
    if not condition:
        issues.append(ContractIssue(contract, path, message))


def _unique_ids(values: list[dict[str, Any]], field: str, contract: str, path: str, issues: list[ContractIssue]) -> set[str]:
    result: set[str] = set()
    for index, value in enumerate(values):
        item_id = value.get(field)
        _require(isinstance(item_id, str) and bool(item_id), contract, f"{path}[{index}].{field}", "must be a non-empty string", issues)
        if not isinstance(item_id, str) or not item_id:
            continue
        _require(item_id not in result, contract, f"{path}[{index}].{field}", f"duplicate id {item_id}", issues)
        result.add(item_id)
    return result


def validate_claim_state(
    understanding: dict[str, Any],
    *,
    allowed_artifact_ids: set[str],
    artifact_page_counts: dict[str, int],
    artifact_media_types: dict[str, str] | None = None,
) -> list[dict[str, str]]:
    contract = "canonical_claim_state"
    issues: list[ContractIssue] = []
    facts = understanding.get("facts")
    _require(isinstance(facts, list) and bool(facts), contract, "facts", "must contain at least one fact", issues)
    if not isinstance(facts, list):
        raise ContractValidationError(issues)
    _unique_ids(facts, "fact_id", contract, "facts", issues)
    media_types = artifact_media_types or {}
    allowed_sources = set(allowed_artifact_ids) | {"message", "intake"}
    for fact_index, value in enumerate(facts):
        if not isinstance(value, dict):
            issues.append(ContractIssue(contract, f"facts[{fact_index}]", "must be an object"))
            continue
        state = value.get("state")
        _require(state in FACT_STATES, contract, f"facts[{fact_index}].state", f"unsupported state {state!r}", issues)
        _require(isinstance(value.get("label"), str) and bool(value.get("label")), contract, f"facts[{fact_index}].label", "must be present", issues)
        _require(isinstance(value.get("value"), str), contract, f"facts[{fact_index}].value", "must be a string", issues)
        _require(isinstance(value.get("explanation"), str) and bool(value.get("explanation", "").strip()), contract, f"facts[{fact_index}].explanation", "must be present", issues)
        _require(isinstance(value.get("controls_process"), bool), contract, f"facts[{fact_index}].controls_process", "must be boolean", issues)
        if value.get("controls_process") is True:
            decision_key = value.get("decision_key")
            normalized_value = value.get("normalized_value")
            _require(decision_key in NORMALIZED_DECISIONS, contract, f"facts[{fact_index}].decision_key", "must identify a supported deterministic projection", issues)
            _require(decision_key in NORMALIZED_DECISIONS and normalized_value in NORMALIZED_DECISIONS[decision_key], contract, f"facts[{fact_index}].normalized_value", "must use a normalized observable value allowed for this decision", issues)
            expected_decision = NORMALIZED_DECISIONS.get(decision_key, {}).get(normalized_value)
            _require(value.get("decision_value") == expected_decision, contract, f"facts[{fact_index}].decision_value", "must be deterministically derived from decision_key and normalized_value", issues)
        elif value.get("controls_process") is False:
            _require(value.get("decision_key") is None, contract, f"facts[{fact_index}].decision_key", "non-controlling facts require a null decision key", issues)
            _require(value.get("normalized_value") is None, contract, f"facts[{fact_index}].normalized_value", "non-controlling facts require a null normalized value", issues)
            _require(value.get("decision_value") is None, contract, f"facts[{fact_index}].decision_value", "non-controlling facts require a null decision value", issues)
        _require(
            set(value) == {"fact_id", "label", "value", "state", "explanation", "source_refs", "confidence", "controls_process", "decision_key", "normalized_value", "decision_value"},
            contract,
            f"facts[{fact_index}]",
            "must contain exactly the canonical fact fields",
            issues,
        )
        confidence = value.get("confidence")
        _require(isinstance(confidence, (int, float)) and 0 <= confidence <= 1, contract, f"facts[{fact_index}].confidence", "must be between 0 and 1", issues)
        refs = value.get("source_refs")
        _require(isinstance(refs, list), contract, f"facts[{fact_index}].source_refs", "must be a list", issues)
        if state in {"known", "conflicting"}:
            _require(bool(refs), contract, f"facts[{fact_index}].source_refs", "known and conflicting facts require provenance", issues)
        if not isinstance(refs, list):
            continue
        for ref_index, ref in enumerate(refs):
            path = f"facts[{fact_index}].source_refs[{ref_index}]"
            if not isinstance(ref, dict):
                issues.append(ContractIssue(contract, path, "must be an object"))
                continue
            artifact_id = ref.get("artifact_id")
            _require(artifact_id in allowed_sources, contract, f"{path}.artifact_id", f"unknown source {artifact_id!r}", issues)
            locator_kind = ref.get("locator_kind")
            _require(locator_kind in LOCATOR_KINDS, contract, f"{path}.locator_kind", f"unsupported locator {locator_kind!r}", issues)
            _require(isinstance(ref.get("agent"), str) and bool(ref.get("agent", "").strip()), contract, f"{path}.agent", "must identify the producing component", issues)
            if locator_kind == "text_quote":
                _require(set(ref) == {"artifact_id", "locator_kind", "page", "excerpt", "agent"}, contract, path, "must contain exactly the text-quote fields", issues)
                page = ref.get("page")
                _require(isinstance(page, int) and page >= 1, contract, f"{path}.page", "must be a positive integer", issues)
                if artifact_id in artifact_page_counts and isinstance(page, int):
                    _require(page <= artifact_page_counts[artifact_id], contract, f"{path}.page", "exceeds source page count", issues)
                _require(isinstance(ref.get("excerpt"), str) and bool(ref.get("excerpt", "").strip()), contract, f"{path}.excerpt", "must be present", issues)
                _require(artifact_id == "message" or media_types.get(artifact_id) in {"application/pdf", "message/rfc822"}, contract, path, "text quotes require an observable textual source", issues)
            elif locator_kind == "visual_observation":
                _require(set(ref) == {"artifact_id", "locator_kind", "region", "observation", "agent"}, contract, path, "must contain exactly the visual-observation fields", issues)
                _require(media_types.get(artifact_id, "").startswith("image/"), contract, f"{path}.artifact_id", "visual observations require an image source", issues)
                _require(ref.get("agent") == "Visual Evidence Agent", contract, f"{path}.agent", "visual observations require Visual Evidence Agent provenance", issues)
                region = ref.get("region")
                valid_region = (
                    isinstance(region, list)
                    and len(region) == 4
                    and all(isinstance(value, (int, float)) and not isinstance(value, bool) and 0 <= value <= 1 for value in region)
                    and region[2] > 0
                    and region[3] > 0
                    and region[0] + region[2] <= 1
                    and region[1] + region[3] <= 1
                )
                _require(valid_region, contract, f"{path}.region", "must be normalized [x,y,width,height] within the image", issues)
                _require(isinstance(ref.get("observation"), str) and bool(ref.get("observation", "").strip()), contract, f"{path}.observation", "must describe the visual observation without presenting a quote", issues)
            elif locator_kind == "metadata_field":
                _require(set(ref) == {"artifact_id", "locator_kind", "field", "value", "agent"}, contract, path, "must contain exactly the metadata-field fields", issues)
                _require(isinstance(ref.get("field"), str) and bool(ref.get("field", "").strip()), contract, f"{path}.field", "must identify an observed metadata field", issues)
                _require(isinstance(ref.get("value"), (str, int, float, bool)) and not (isinstance(ref.get("value"), str) and not ref.get("value", "").strip()), contract, f"{path}.value", "must contain the observed metadata value", issues)
    if issues:
        raise ContractValidationError(issues)
    return [{"name": "Canonical fact and source contract", "status": "passed", "detail": f"{len(facts)} facts have valid states and provenance."}]


def _normalized_source_text(value: str) -> str:
    return re.sub(r"\s+", " ", unicodedata.normalize("NFKC", value)).strip()


def _package_artifact(package: dict[str, Any], artifact_id: str) -> dict[str, Any] | None:
    return next(
        (value for value in package.get("artifacts", []) if value.get("artifact_id") == artifact_id),
        None,
    )


def _textual_source_values(package: dict[str, Any], *, artifact_id: str, page: int) -> list[str]:
    if artifact_id == "message":
        if page != 1:
            return []
        message = package.get("customer_message", {})
        return [value for key in ("subject", "body") if isinstance((value := message.get(key)), str)]
    artifact = _package_artifact(package, artifact_id)
    if not isinstance(artifact, dict):
        return []
    if artifact.get("media_type") == "application/pdf":
        page_value = next((value for value in artifact.get("extracted_pages", []) if value.get("page") == page), None)
        text = page_value.get("text") if isinstance(page_value, dict) else None
        return [text] if isinstance(text, str) else []
    if artifact.get("media_type") == "message/rfc822" and page == 1:
        email = artifact.get("parsed_email")
        if isinstance(email, dict):
            return [value for value in email.values() if isinstance(value, str)]
    return []


def _metadata_value(package: dict[str, Any], *, artifact_id: str, field: str) -> Any:
    if artifact_id == "intake":
        current: Any = package.get("intake_metadata", {})
    elif artifact_id == "message":
        current = package.get("customer_message", {})
    else:
        current = _package_artifact(package, artifact_id)
    for part in field.split("."):
        if not isinstance(current, dict) or part not in current:
            return None
        current = current[part]
    return current


def validate_source_grounding(
    understanding: dict[str, Any],
    *,
    observable_package: dict[str, Any],
) -> list[dict[str, str]]:
    contract = "source_grounding"
    issues: list[ContractIssue] = []
    refs_checked = 0
    for fact_index, fact in enumerate(understanding.get("facts", [])):
        for ref_index, ref in enumerate(fact.get("source_refs", [])):
            refs_checked += 1
            path = f"facts[{fact_index}].source_refs[{ref_index}]"
            locator_kind = ref.get("locator_kind")
            if locator_kind == "text_quote":
                artifact_id = ref.get("artifact_id")
                page = ref.get("page")
                candidates = _textual_source_values(observable_package, artifact_id=artifact_id, page=page)
                if not candidates:
                    issues.append(ContractIssue(contract, path, f"cited source {artifact_id!r} page {page} has no observable text"))
                    continue
                excerpt = _normalized_source_text(ref.get("excerpt", ""))
                _require(bool(excerpt) and any(excerpt in _normalized_source_text(candidate) for candidate in candidates), contract, path, f"excerpt is not an exact normalized substring of {artifact_id!r} page {page}", issues)
            elif locator_kind == "visual_observation":
                artifact = _package_artifact(observable_package, ref.get("artifact_id"))
                _require(isinstance(artifact, dict) and str(artifact.get("media_type", "")).startswith("image/"), contract, path, "visual source is not present in the observable package", issues)
            elif locator_kind == "metadata_field":
                observed = _metadata_value(observable_package, artifact_id=ref.get("artifact_id"), field=ref.get("field", ""))
                _require(observed is not None and observed == ref.get("value"), contract, path, "metadata value does not match the observable package", issues)
    if issues:
        raise ContractValidationError(issues)
    return [{"name": "Exact source grounding", "status": "passed", "detail": f"{refs_checked} source locators resolve to exact observable text, metadata, or normalized visual regions."}]


def validate_legal_context(legal: dict[str, Any]) -> tuple[set[str], list[dict[str, str]]]:
    contract = "legal_context"
    issues: list[ContractIssue] = []
    sources = legal.get("sources")
    principles = legal.get("handling_principles")
    _require(isinstance(sources, list), contract, "sources", "must be a list", issues)
    _require(isinstance(principles, list), contract, "handling_principles", "must be a list", issues)
    source_values = sources if isinstance(sources, list) else []
    principle_values = principles if isinstance(principles, list) else []
    source_ids = _unique_ids(source_values + principle_values, "source_id", contract, "authorities", issues)
    for index, source in enumerate(source_values):
        _require(isinstance(source.get("title"), str) and bool(source.get("title", "").strip()), contract, f"sources[{index}].title", "must be present", issues)
        _require(source.get("source_type") in {"official_statute", "official_guidance"}, contract, f"sources[{index}].source_type", "must distinguish an official statute or guidance source", issues)
        _require(isinstance(source.get("url"), str) and source.get("url", "").startswith("https://"), contract, f"sources[{index}].url", "must be an HTTPS source", issues)
        _require(source.get("jurisdiction") == "CH", contract, f"sources[{index}].jurisdiction", "must identify Swiss jurisdiction", issues)
        version_date = source.get("version_date")
        _require(isinstance(version_date, str) and len(version_date) == 10 and version_date[4:5] == "-" and version_date[7:8] == "-", contract, f"sources[{index}].version_date", "must be an ISO date", issues)
        _require(isinstance(source.get("location"), str) and bool(source.get("location", "").strip()), contract, f"sources[{index}].location", "must identify the source location", issues)
        _require(source.get("approved") is False, contract, f"sources[{index}].approved", "generated reference sources must remain unapproved", issues)
        _require(source.get("review_status") == "qualified_review_pending", contract, f"sources[{index}].review_status", "qualified review must remain pending", issues)
        _require(isinstance(source.get("passage_summary"), str) and bool(source.get("passage_summary", "").strip()), contract, f"sources[{index}].passage_summary", "must keep source content separate from interpretation", issues)
        _require(isinstance(source.get("operational_interpretation"), str) and bool(source.get("operational_interpretation", "").strip()), contract, f"sources[{index}].operational_interpretation", "must be explicit", issues)
        _require(isinstance(source.get("role"), str) and bool(source.get("role", "").strip()), contract, f"sources[{index}].role", "must explain handling relevance", issues)
    for index, principle in enumerate(principle_values):
        _require(principle.get("source_type") == "operational_interpretation", contract, f"handling_principles[{index}].source_type", "must remain separate from official authority", issues)
        _require(principle.get("validation_status") in {"generated_reference_not_expert_approved", "candidate_not_expert_approved"}, contract, f"handling_principles[{index}].validation_status", "must carry an honest review status", issues)
        _require(isinstance(principle.get("role"), str) and bool(principle.get("role", "").strip()), contract, f"handling_principles[{index}].role", "must state the proposed handling rule", issues)
    if issues:
        raise ContractValidationError(issues)
    return source_ids, [{"name": "Legal authority contract", "status": "passed", "detail": f"{len(source_ids)} official or proposed authority records are explicitly typed."}]


def validate_process_graph(
    process: dict[str, Any],
    *,
    fact_ids: set[str],
    legal_source_ids: set[str],
    evidence_item_ids: set[str] | None = None,
) -> list[dict[str, str]]:
    contract = "process_graph"
    issues: list[ContractIssue] = []
    nodes = process.get("nodes")
    edges = process.get("edges")
    _require(isinstance(nodes, list) and bool(nodes), contract, "nodes", "must contain process nodes", issues)
    _require(isinstance(edges, list), contract, "edges", "must be a list", issues)
    node_values = nodes if isinstance(nodes, list) else []
    edge_values = edges if isinstance(edges, list) else []
    node_ids = _unique_ids(node_values, "node_id", contract, "nodes", issues)
    current_nodes = [node.get("node_id") for node in node_values if node.get("state") == "current"]
    _require(len(current_nodes) == 1, contract, "nodes", "must contain exactly one current node", issues)
    _require(process.get("current_node") in node_ids, contract, "current_node", "must reference a node", issues)
    if len(current_nodes) == 1:
        _require(process.get("current_node") == current_nodes[0], contract, "current_node", "must match the node marked current", issues)
    for index, node_id in enumerate(process.get("main_spine", [])):
        _require(node_id in node_ids, contract, f"main_spine[{index}]", f"unknown node {node_id!r}", issues)
    for index, node_id in enumerate(process.get("selected_path", [])):
        _require(node_id in node_ids, contract, f"selected_path[{index}]", f"unknown node {node_id!r}", issues)
    overlay = process.get("current_overlay", {})
    if isinstance(overlay, dict):
        for key in ("completed_node_ids", "blocked_node_ids", "inactive_branch_ids"):
            for index, node_id in enumerate(overlay.get(key, [])):
                _require(node_id in node_ids, contract, f"current_overlay.{key}[{index}]", f"unknown node {node_id!r}", issues)
        for key in ("current_node_id", "next_action_node_id"):
            _require(overlay.get(key) in node_ids, contract, f"current_overlay.{key}", "must reference a node", issues)
        _require(overlay.get("current_node_id") == process.get("current_node"), contract, "current_overlay.current_node_id", "must match the process current node", issues)
    branch_ids: set[str] = set()
    branch_targets: dict[str, str] = {}
    for node_index, node in enumerate(node_values):
        for ref_index, fact_id in enumerate(node.get("fact_ids", [])):
            _require(fact_id in fact_ids, contract, f"nodes[{node_index}].fact_ids[{ref_index}]", f"unknown fact {fact_id!r}", issues)
        for ref_index, source_id in enumerate(node.get("legal_source_ids", [])):
            _require(source_id in legal_source_ids, contract, f"nodes[{node_index}].legal_source_ids[{ref_index}]", f"unknown legal source {source_id!r}", issues)
        if evidence_item_ids is not None:
            for ref_index, item_id in enumerate(node.get("evidence_requirement_ids", [])):
                _require(item_id in evidence_item_ids, contract, f"nodes[{node_index}].evidence_requirement_ids[{ref_index}]", f"unknown evidence item {item_id!r}", issues)
        for branch_index, branch in enumerate(node.get("branches", [])):
            branch_id = branch.get("branch_id")
            _require(isinstance(branch_id, str) and bool(branch_id), contract, f"nodes[{node_index}].branches[{branch_index}].branch_id", "must be a non-empty string", issues)
            if isinstance(branch_id, str) and branch_id:
                _require(branch_id not in branch_ids, contract, f"nodes[{node_index}].branches[{branch_index}].branch_id", f"duplicate branch {branch_id!r}", issues)
                branch_ids.add(branch_id)
                branch_targets[branch_id] = branch.get("target")
            _require(branch.get("target") in node_ids, contract, f"nodes[{node_index}].branches[{branch_index}].target", f"unknown branch target {branch.get('target')!r}", issues)
    if isinstance(overlay, dict):
        selected_branch_id = overlay.get("selected_branch_id")
        _require(selected_branch_id in branch_ids, contract, "current_overlay.selected_branch_id", "must reference a declared branch", issues)
        if selected_branch_id in branch_targets:
            _require(branch_targets[selected_branch_id] == overlay.get("next_action_node_id"), contract, "current_overlay.next_action_node_id", "must match the selected branch target", issues)
    edge_pairs: set[tuple[str, str]] = set()
    for edge_index, value in enumerate(edge_values):
        if not isinstance(value, dict):
            issues.append(ContractIssue(contract, f"edges[{edge_index}]", "must be an object"))
            continue
        source = value.get("source")
        target = value.get("target")
        _require(source in node_ids, contract, f"edges[{edge_index}].source", f"unknown node {source!r}", issues)
        _require(target in node_ids, contract, f"edges[{edge_index}].target", f"unknown node {target!r}", issues)
        _require((source, target) not in edge_pairs, contract, f"edges[{edge_index}]", "duplicate edge", issues)
        edge_pairs.add((source, target))
    for index in range(max(0, len(process.get("selected_path", [])) - 1)):
        source, target = process["selected_path"][index : index + 2]
        _require((source, target) in edge_pairs, contract, f"selected_path[{index}:{index + 2}]", f"missing selected edge {source!r} -> {target!r}", issues)
    if issues:
        raise ContractValidationError(issues)
    return [{"name": "Graph integrity", "status": "passed", "detail": f"{len(node_ids)} nodes and {len(edge_pairs)} edges are referentially valid."}]


def validate_evidence_model(
    checklist: dict[str, Any],
    *,
    node_ids: set[str],
    facts_by_id: dict[str, dict[str, Any]],
    legal_source_ids: set[str],
    allowed_artifact_ids: set[str],
) -> list[dict[str, str]]:
    contract = "evidence_model"
    issues: list[ContractIssue] = []
    items = checklist.get("items")
    _require(isinstance(items, list) and bool(items), contract, "items", "must contain evidence items", issues)
    item_values = items if isinstance(items, list) else []
    item_ids = _unique_ids(item_values, "item_id", contract, "items", issues)
    allowed_sources = set(allowed_artifact_ids) | {"message", "intake"}
    for index, item in enumerate(item_values):
        status = item.get("status")
        _require(status in EVIDENCE_STATES, contract, f"items[{index}].status", f"unsupported status {status!r}", issues)
        _require(item.get("node_id") in node_ids, contract, f"items[{index}].node_id", f"unknown node {item.get('node_id')!r}", issues)
        fact_id = item.get("fact_id")
        _require(fact_id in facts_by_id, contract, f"items[{index}].fact_id", f"unknown fact {fact_id!r}", issues)
        _require(isinstance(item.get("why"), str) and bool(item.get("why", "").strip()), contract, f"items[{index}].why", "must explain the process dependency", issues)
        for source_index, source_id in enumerate(item.get("legal_basis_ids", [])):
            _require(source_id in legal_source_ids, contract, f"items[{index}].legal_basis_ids[{source_index}]", f"unknown legal source {source_id!r}", issues)
        for artifact_index, artifact_id in enumerate(item.get("artifact_ids", [])):
            _require(artifact_id in allowed_sources, contract, f"items[{index}].artifact_ids[{artifact_index}]", f"unknown artifact {artifact_id!r}", issues)
        if isinstance(status, str) and status.startswith("provided"):
            _require(bool(item.get("artifact_ids")), contract, f"items[{index}].artifact_ids", "provided evidence requires at least one source artifact", issues)
            fact_source_ids = {
                ref.get("artifact_id")
                for ref in facts_by_id.get(fact_id, {}).get("source_refs", [])
            }
            _require(
                bool(set(item.get("artifact_ids", [])) & fact_source_ids),
                contract,
                f"items[{index}].artifact_ids",
                "provided evidence must cite a source that grounds its linked fact",
                issues,
            )
        if status == "conditional":
            _require(item.get("required_level") == "conditional", contract, f"items[{index}].required_level", "conditional evidence must have conditional required level", issues)
            _require(item.get("applies_when") not in {None, "", "always"}, contract, f"items[{index}].applies_when", "conditional evidence requires an activation condition", issues)
    present_ids = {item.get("item_id") for item in checklist.get("present", [])}
    required_ids = {item.get("item_id") for item in checklist.get("required", [])}
    _require(not (present_ids & required_ids), contract, "present/required", "the same evidence cannot be both supplied and requested", issues)
    expected_present = {item["item_id"] for item in item_values if item.get("status", "").startswith("provided")}
    expected_required = {
        item["item_id"]
        for item in item_values
        if item.get("status") in {"missing", "conditional"} and item.get("current_path") is True
    }
    _require(present_ids == expected_present, contract, "present", "must be a projection of provided evidence items", issues)
    _require(required_ids == expected_required, contract, "required", "must be a projection of missing and conditional evidence items", issues)
    if issues:
        raise ContractValidationError(issues)
    return [{"name": "Process-to-evidence linkage", "status": "passed", "detail": f"{len(item_ids)} evidence items resolve to valid process nodes, facts, authorities, and sources."}]


def validate_current_state(
    understanding: dict[str, Any],
    process: dict[str, Any],
    checklist: dict[str, Any],
) -> list[dict[str, str]]:
    contract = "current_state"
    issues: list[ContractIssue] = []
    facts = {value.get("fact_id"): value for value in understanding.get("facts", [])}
    nodes = {value.get("node_id"): value for value in process.get("nodes", [])}
    cause_facts = [
        facts[fact_id]
        for fact_id in facts
        if fact_id in {"fact_cause", "later_fact_cause"}
    ]
    cause_unresolved = any(value.get("state") in {"unknown", "conflicting"} for value in cause_facts)
    if cause_unresolved:
        for node_id in ("responsibility", "remedy"):
            node = nodes.get(node_id, {})
            _require(node.get("state") == "blocked", contract, f"nodes.{node_id}.state", "must remain blocked while causation is unresolved", issues)
    _require(
        process.get("playbook_version") == checklist.get("playbook_version"),
        contract,
        "playbook_version",
        "process and evidence model must use the same playbook version",
        issues,
    )
    immediate_items = {
        item.get("item_id")
        for item in checklist.get("required", [])
        if item.get("status") == "still_needed"
    }
    supplied_items = {item.get("item_id") for item in checklist.get("present", [])}
    _require(not (immediate_items & supplied_items), contract, "required", "supplied evidence cannot remain an immediate request", issues)
    if issues:
        raise ContractValidationError(issues)
    return [{"name": "Current-state safety", "status": "passed", "detail": "Unresolved causation remains unresolved, downstream decisions are blocked, and version/request projections are consistent."}]


def validate_review_operations(operations: list[dict[str, Any]]) -> list[dict[str, str]]:
    contract = "review_operations"
    issues: list[ContractIssue] = []
    _require(bool(operations), contract, "operations", "an accepted edit requires typed operations", issues)
    pointers: set[tuple[str, str]] = set()
    for index, operation in enumerate(operations):
        path = f"operations[{index}]"
        component = operation.get("component")
        operation_type = operation.get("operation")
        pointer = operation.get("pointer")
        _require(component in REVIEW_COMPONENTS, contract, f"{path}.component", f"unsupported component {component!r}", issues)
        _require(operation_type in REVIEW_OPERATIONS, contract, f"{path}.operation", f"unsupported operation {operation_type!r}", issues)
        _require(isinstance(pointer, str) and pointer.startswith("/"), contract, f"{path}.pointer", "must be an absolute JSON-style pointer", issues)
        if isinstance(component, str) and isinstance(pointer, str):
            _require((component, pointer) not in pointers, contract, path, "duplicate operation pointer", issues)
            pointers.add((component, pointer))
        _require(isinstance(operation.get("reason"), str) and bool(operation.get("reason", "").strip()), contract, f"{path}.reason", "must explain the edit", issues)
        if operation_type == "add":
            _require(operation.get("old_value") is None, contract, f"{path}.old_value", "add operations require a null old value", issues)
            _require(operation.get("new_value") is not None, contract, f"{path}.new_value", "add operations require a new value", issues)
        elif operation_type == "replace":
            _require(operation.get("old_value") != operation.get("new_value"), contract, path, "replace operations must change the value", issues)
    if issues:
        raise ContractValidationError(issues)
    return [{"name": "Typed review operations", "status": "passed", "detail": f"{len(operations)} review operations declare component, operation, pointer, before/after values, and reason."}]


def validate_precedents(precedents: list[dict[str, Any]], *, current_claim_id: str) -> list[dict[str, str]]:
    contract = "precedents"
    issues: list[ContractIssue] = []
    _require(0 < len(precedents) <= 3, contract, "precedents", "must contain one to three precedents", issues)
    claim_ids = _unique_ids(precedents, "claim_id", contract, "precedents", issues)
    _require(current_claim_id not in claim_ids, contract, "precedents", "must exclude the current claim", issues)
    for index, precedent in enumerate(precedents):
        _require(precedent.get("review_status") in PRECEDENT_STATUSES, contract, f"precedents[{index}].review_status", "must distinguish generated reference, unverified memory, and qualified review", issues)
        _require(isinstance(precedent.get("why_useful"), str) and bool(precedent.get("why_useful", "").strip()), contract, f"precedents[{index}].why_useful", "must explain decision usefulness", issues)
    if issues:
        raise ContractValidationError(issues)
    return [{"name": "Precedent exclusion and provenance", "status": "passed", "detail": f"{len(claim_ids)} distinct precedents exclude the current claim and declare their authority."}]


def validate_playbook(
    *,
    claim_id: str,
    understanding: dict[str, Any],
    legal: dict[str, Any],
    process: dict[str, Any],
    checklist: dict[str, Any],
    precedents: list[dict[str, Any]],
    allowed_artifact_ids: set[str],
    artifact_page_counts: dict[str, int],
    artifact_media_types: dict[str, str],
    observable_package: dict[str, Any],
) -> list[dict[str, str]]:
    checks = validate_claim_state(
        understanding,
        allowed_artifact_ids=allowed_artifact_ids,
        artifact_page_counts=artifact_page_counts,
        artifact_media_types=artifact_media_types,
    )
    checks.extend(validate_source_grounding(understanding, observable_package=observable_package))
    legal_ids, legal_checks = validate_legal_context(legal)
    facts_by_id = {fact["fact_id"]: fact for fact in understanding["facts"]}
    fact_ids = set(facts_by_id)
    node_ids = {node["node_id"] for node in process["nodes"]}
    item_ids = {item["item_id"] for item in checklist["items"]}
    checks.extend(legal_checks)
    checks.extend(validate_process_graph(process, fact_ids=fact_ids, legal_source_ids=legal_ids, evidence_item_ids=item_ids))
    checks.extend(
        validate_evidence_model(
            checklist,
            node_ids=node_ids,
            facts_by_id=facts_by_id,
            legal_source_ids=legal_ids,
            allowed_artifact_ids=allowed_artifact_ids,
        )
    )
    checks.extend(validate_precedents(precedents, current_claim_id=claim_id))
    linked_legal_ids = {
        source_id
        for node in process["nodes"]
        for source_id in node.get("legal_source_ids", [])
    } | {
        source_id
        for item in checklist["items"]
        for source_id in item.get("legal_basis_ids", [])
    }
    missing_legal_links = legal_ids - linked_legal_ids
    if missing_legal_links:
        raise ContractValidationError(
            [
                ContractIssue("legal_context", "authorities", f"unlinked authority {source_id!r}")
                for source_id in sorted(missing_legal_links)
            ]
        )
    checks.append({"name": "Law-to-process linkage", "status": "passed", "detail": f"All {len(legal_ids)} authority records affect a process node or evidence requirement."})
    checks.extend(validate_current_state(understanding, process, checklist))
    return checks
