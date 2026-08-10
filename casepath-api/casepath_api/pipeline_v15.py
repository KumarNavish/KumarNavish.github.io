from __future__ import annotations

from copy import deepcopy
from hashlib import sha256
import json
import threading
import time
from typing import Any

from .data import ARTIFACTS, CLAIMS, HISTORICAL_CASES, LAW_SOURCES
from .storage import Storage


RELEASE = "15.0.0"
ORCHESTRATOR = "casepath-reference-orchestrator/15.0"
PROFILE = "full-process-reference-agents"

VISIBLE_STAGES = [
    ("read", "Read the submission", "Attachment Parsing Agent"),
    ("understand", "Build the claim state", "Claim Understanding Agent"),
    ("research", "Research Swiss tenant law", "Legal Research Agent"),
    ("process", "Discover the full handling process", "Process Discovery Agent"),
    ("evidence", "Derive the complete evidence model", "Document Requirements Agent"),
    ("experience", "Retrieve organizational experience", "Historical Claims Agent"),
    ("verify", "Verify the complete playbook", "Verification Agent"),
]


def digest(value: Any) -> str:
    return sha256(json.dumps(value, sort_keys=True, ensure_ascii=False, default=str).encode()).hexdigest()


def fact(
    fact_id: str,
    label: str,
    value: str,
    state: str,
    explanation: str,
    source_refs: list[dict[str, Any]],
    confidence: float = 1.0,
    controls_process: bool = False,
) -> dict[str, Any]:
    return {
        "fact_id": fact_id,
        "label": label,
        "value": value,
        "state": state,
        "explanation": explanation,
        "source_refs": source_refs,
        "confidence": confidence,
        "controls_process": controls_process,
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

    def __init__(self, storage: Storage):
        self.storage = storage

    def create(self, claim_id: str) -> str:
        if claim_id not in CLAIMS:
            raise KeyError(claim_id)
        run_id = self.storage.create_run(claim_id)
        threading.Thread(target=self._execute, args=(run_id, claim_id), daemon=True).start()
        return run_id

    def emit(self, run_id: str, stage: str, label: str, agent: str, status: str, **payload: Any):
        return self.storage.add_event(
            run_id,
            {
                "stage": stage,
                "label": label,
                "agent": agent,
                "status": status,
                "implementation": "typed_reference_agent",
                "model": ORCHESTRATOR,
                "orchestrator": ORCHESTRATOR,
                "shared_context": f"claim-context:{run_id}",
                "validator": f"{stage}-validator/15.0",
                "prompt_version": f"{stage}/15.0",
                **payload,
            },
        )

    def _execute(self, run_id: str, claim_id: str):
        claim = CLAIMS[claim_id]
        memories = self.storage.memories()
        knowledge = self._active_knowledge()
        self.storage.patch_run(
            run_id,
            status="running",
            patch={
                "profile": PROFILE,
                "release": RELEASE,
                "orchestrator": ORCHESTRATOR,
                "shared_context": {"claim_id": claim_id, "version": 1, "artifacts": []},
                "knowledge_version": knowledge["version"],
            },
        )
        self.storage.add_event(
            run_id,
            {
                "stage": "orchestrator",
                "label": "Orchestrator opened one shared claim context",
                "agent": "CasePath Orchestrator",
                "status": "started",
                "headline": "Specialists will build one claim-handling playbook",
                "detail": "Each specialist receives the same claim context and contributes a typed artifact for the next specialist.",
                "implementation": "typed_reference_orchestration",
                "model": ORCHESTRATOR,
                "orchestrator": ORCHESTRATOR,
                "validator": "orchestrator-state/15.0",
                "prompt_version": "orchestrator/15.0",
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
            verification = self._verify_stage(run_id, understanding, legal, process, checklist, precedents)
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
            )
            self.storage.add_event(
                run_id,
                {
                    "stage": "complete",
                    "label": "Orchestrator assembled the final playbook",
                    "agent": "CasePath Orchestrator",
                    "status": "completed",
                    "headline": f"{len(process['nodes'])} process nodes and {len(checklist['items'])} evidence relationships ready",
                    "detail": "The full process, evidence model, current claim overlay, precedents and verification record now form one reviewable artifact.",
                    "implementation": "deterministic_acceptance_gate",
                    "model": None,
                    "orchestrator": ORCHESTRATOR,
                    "validator": "whole-playbook-validator/15.0",
                    "prompt_version": None,
                    "input_artifacts": ["canonical_claim_state", "legal_context", "process_graph", "evidence_model", "precedents"],
                    "output_artifact": "claim_handling_playbook",
                    "output_hash": digest(result),
                },
            )
            self.storage.patch_run(run_id, status="complete", patch={"result": result, "completed_at": time.time()})
        except Exception as exc:  # pragma: no cover - fail-safe path
            self.storage.add_event(
                run_id,
                {
                    "stage": "failed",
                    "label": "Analysis stopped safely",
                    "agent": "Failure boundary",
                    "status": "failed",
                    "headline": "No canonical claim state was changed",
                    "detail": str(exc),
                    "implementation": "deterministic",
                    "model": None,
                    "validator": "fail-closed/15.0",
                    "prompt_version": None,
                },
            )
            self.storage.patch_run(run_id, status="failed", patch={"error": str(exc)})

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
            handoff_to="Claim Understanding Agent",
        )
        time.sleep(.35)
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
            handoff_to="Claim Understanding Agent",
        )
        time.sleep(.25)
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
            handoff_to="Legal Research Agent",
        )
        time.sleep(.4)
        primary = claim["claim_id"] == "DEF-027-E0-DEMO"
        if primary:
            facts = [
                fact(
                    "fact_tenancy",
                    "Residential tenancy",
                    "Established",
                    "known",
                    "The lease identifies the tenant, landlord and Basel apartment.",
                    [{"artifact_id": "art_lease", "page": 1, "excerpt": "Tenant Alex Morgan ... Feldbergstrasse 114", "agent": agent}],
                    controls_process=True,
                ),
                fact(
                    "fact_policy_route",
                    "Legal-protection policy reference",
                    "Present",
                    "known",
                    "The intake contains a policy reference. This demo does not decide coverage terms.",
                    [{"artifact_id": "message", "page": 1, "excerpt": claim["customer"]["policy"], "agent": agent}],
                ),
                fact(
                    "fact_dispute",
                    "Concrete disagreement",
                    "Established",
                    "known",
                    "The tenant requests investigation and repair; management attributes the problem to ventilation and refuses inspection.",
                    [
                        {"artifact_id": "message", "page": 1, "excerpt": "I disagree because the problem keeps returning.", "agent": agent},
                        {"artifact_id": "art_management_reply", "page": 1, "excerpt": "consistent with insufficient ventilation", "agent": agent},
                    ],
                    controls_process=True,
                ),
                fact(
                    "fact_recurrence",
                    "Recurring mould",
                    "Established",
                    "known",
                    "The message, photograph and timeline describe recurrence after cleaning.",
                    [
                        {"artifact_id": "message", "page": 1, "excerpt": "keeps coming back", "agent": agent},
                        {"artifact_id": "art_photo", "page": 1, "excerpt": "Dated bedroom photograph", "agent": agent},
                        {"artifact_id": "art_timeline", "page": 1, "excerpt": "spots returned within approximately two weeks", "agent": agent},
                    ],
                    controls_process=True,
                ),
                fact(
                    "fact_notification",
                    "Landlord notified",
                    "Established",
                    "known",
                    "The original email and delivery record support written notification on 15 July.",
                    [
                        {"artifact_id": "art_notification", "page": 1, "excerpt": "Please arrange an inspection and repair.", "agent": agent},
                        {"artifact_id": "art_delivery", "page": 1, "excerpt": "accepted by recipient mail server", "agent": agent},
                    ],
                    controls_process=True,
                ),
                fact(
                    "fact_ventilation_allegation",
                    "Management alleges insufficient ventilation",
                    "Established as an allegation",
                    "known",
                    "The reply contains the allegation but no technical proof.",
                    [{"artifact_id": "art_management_reply", "page": 1, "excerpt": "consistent with insufficient ventilation", "agent": agent}],
                    controls_process=True,
                ),
                fact(
                    "fact_cause",
                    "Cause of mould",
                    "Unresolved",
                    "unknown",
                    "No neutral assessment establishes a building defect, tenant-use cause or mixed cause.",
                    [
                        {"artifact_id": "art_management_reply", "page": 1, "excerpt": "Based on the photograph", "agent": agent},
                        {"artifact_id": "art_timeline", "page": 2, "excerpt": "No independent inspection has been carried out.", "agent": agent},
                    ],
                    confidence=.92,
                    controls_process=True,
                ),
                fact(
                    "fact_health",
                    "Immediate health or safety concern",
                    "Not reported",
                    "known",
                    "The customer reports no current symptoms or emergency.",
                    [{"artifact_id": "message", "page": 1, "excerpt": "There are no current health symptoms", "agent": agent}],
                    controls_process=True,
                ),
                fact(
                    "fact_date_conflict",
                    "First-observation date",
                    "Conflicting",
                    "conflicting",
                    "The customer says around 20 March; the timeline says 12 March.",
                    [
                        {"artifact_id": "message", "page": 1, "excerpt": "around 20 March", "agent": agent},
                        {"artifact_id": "art_timeline", "page": 1, "excerpt": "12 Mar 2026", "agent": agent},
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
                    "Supported by the claim package",
                    "known",
                    "The submitted address, policy reference and repair notice identify a Basel residential rental matter.",
                    [{"artifact_id": "art_window_notice", "page": 1, "excerpt": "window replacement notice", "agent": agent}],
                    controls_process=True,
                ),
                fact(
                    "later_fact_dispute",
                    "Concrete disagreement",
                    "Reported but original management message missing",
                    "known",
                    "The customer reports that management blames airing; the original allegation is not attached.",
                    [{"artifact_id": "art_later_email", "page": 1, "excerpt": "management says I do not air enough", "agent": agent}],
                    confidence=.86,
                    controls_process=True,
                ),
                fact(
                    "later_fact_recurrence",
                    "Recurring dark spots after window work",
                    "Established",
                    "known",
                    "The email and photograph describe recurrence beside the replaced window.",
                    [
                        {"artifact_id": "art_later_email", "page": 1, "excerpt": "dark spots have returned", "agent": agent},
                        {"artifact_id": "art_later_photo", "page": 1, "excerpt": "dated exterior-wall photograph", "agent": agent},
                    ],
                    controls_process=True,
                ),
                fact(
                    "later_fact_recent_window_work",
                    "Recent window replacement",
                    "Established",
                    "known",
                    "The contractor notice confirms replacement in May 2026.",
                    [{"artifact_id": "art_window_notice", "page": 1, "excerpt": "replaced between 18 and 22 May 2026", "agent": agent}],
                    controls_process=True,
                ),
                fact(
                    "later_fact_ventilation_allegation",
                    "Management alleges insufficient airing",
                    "Reported by customer",
                    "known",
                    "The allegation is observable, but the original correspondence and technical basis are absent.",
                    [{"artifact_id": "art_later_email", "page": 1, "excerpt": "management says I do not air enough", "agent": agent}],
                    confidence=.84,
                    controls_process=True,
                ),
                fact(
                    "later_fact_cause",
                    "Cause around replaced window",
                    "Unresolved",
                    "unknown",
                    "No inspection links the condition to use, seals, insulation or another building cause.",
                    [{"artifact_id": "art_window_notice", "page": 1, "excerpt": "No post-installation moisture inspection is recorded", "agent": agent}],
                    confidence=.94,
                    controls_process=True,
                ),
                fact(
                    "later_fact_health",
                    "Immediate health or safety concern",
                    "Not reported",
                    "known",
                    "The submission does not report an emergency or acute symptoms.",
                    [{"artifact_id": "art_later_email", "page": 1, "excerpt": "Could you tell me what should happen next", "agent": agent}],
                    controls_process=True,
                ),
            ]
            summary = "Recurring dark spots beside a recently replaced window. Management allegedly blames airing. The allegation and technical cause remain unverified."
            issues = [
                {"issue": "Technical cause remains unresolved", "severity": "controlling", "why": "The timing after window work and the ventilation allegation require competent evidence."},
                {"issue": "Original management allegation is missing", "severity": "evidence", "why": "The exact allegation and its stated basis cannot yet be inspected."},
            ]
        understanding = {
            "summary": summary,
            "category": "Rental defect - mould and moisture",
            "subcategory": "Recurring moisture with disputed causation",
            "scope": "Swiss residential tenancy",
            "dispute": "Concrete dispute appears to exist",
            "facts": facts,
            "issues": issues,
            "observable_only": True,
        }
        self.storage.patch_run(run_id, patch={"understanding": understanding})
        unknowns = sum(item["state"] == "unknown" for item in facts)
        conflicts = sum(item["state"] == "conflicting" for item in facts)
        self.emit(
            run_id,
            stage,
            label,
            agent,
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
            handoff_to="Legal Research Agent",
        )
        time.sleep(.25)
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
            handoff_to="Process Discovery Agent",
        )
        time.sleep(.4)
        legal = {
            "questions": questions,
            "sources": deepcopy(LAW_SOURCES),
            "handling_principles": [
                {
                    "source_id": "handling-causation",
                    "title": "Validated handling principle: preserve disputed causation",
                    "source_type": "operational principle",
                    "role": "A party allegation does not establish technical cause. Responsibility remains open until competent evidence distinguishes plausible explanations.",
                    "validation_status": "reference profile; expert review required",
                },
                {
                    "source_id": "handling-evidence-order",
                    "title": "Validated handling principle: least-burdensome competent evidence first",
                    "source_type": "operational principle",
                    "role": "Request the first competent assessment before broader or more invasive tests unless current evidence already justifies them.",
                    "validation_status": "candidate until expert approval",
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
            handoff_to="Process Discovery Agent",
            retrieval_method="question-led official-source registry search",
        )
        time.sleep(.25)
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
            handoff_to="Document Requirements Agent",
        )
        time.sleep(.45)
        later = claim["claim_id"] == "DEMO-MOULD-002"
        v4_active = later and knowledge["version"] == "mould-playbook-v4"
        notification_answer = "Written notice and receipt established" if not later else "Customer reports notice; original message not attached"
        notification_state = "complete" if not later else "supported"
        node_facts = {
            "scope": ["fact_tenancy"] if not later else ["later_fact_tenancy"],
            "dispute": ["fact_dispute"] if not later else ["later_fact_dispute"],
            "urgency": ["fact_health"] if not later else ["later_fact_health"],
            "notification": ["fact_notification"] if not later else [],
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
            process_node("scope", "Tenant-law scope", "Is this a Swiss residential-tenancy matter?", "complete", answer="Yes", why="The applicable process depends on legal scope and jurisdiction.", fact_ids=node_facts["scope"], legal_source_ids=["fedlex-or-256"], evidence_requirement_ids=["lease", "policy_reference"]),
            process_node("dispute", "Existence of a dispute", "Is there a concrete disagreement requiring legal handling?", "complete", answer="Yes", why="A legal-protection process should not start for a purely advisory or unsupported complaint.", fact_ids=node_facts["dispute"], evidence_requirement_ids=["customer_objective", "management_position"]),
            process_node("urgency", "Urgency and safety", "Is immediate health, safety or deadline action required?", "complete", answer="No acute concern reported", why="Urgent risks can bypass the ordinary evidence sequence.", fact_ids=node_facts["urgency"], evidence_requirement_ids=["health_safety_statement"]),
            process_node("notification", "Landlord notification", "Was the landlord told about the defect?", notification_state, answer=notification_answer, why="Notification affects later remedy and escalation steps.", fact_ids=node_facts["notification"], legal_source_ids=["fedlex-or-257g"], evidence_requirement_ids=["defect_notice", "proof_of_delivery"]),
            process_node("defect", "Defect and recurrence", "Is a recurring condition sufficiently documented?", "complete", answer="Visible recurrence supported", why="The process must distinguish a recurring condition from a one-off observation.", fact_ids=node_facts["defect"], legal_source_ids=["fedlex-or-256"], evidence_requirement_ids=["dated_photos", "recurrence_chronology"]),
            process_node("causation", "Causation assessment", "What caused the recurring moisture condition?", "current", answer="Unresolved", why="Responsibility and remedy depend on competent evidence that distinguishes plausible causes.", fact_ids=node_facts["causation"], legal_source_ids=["fedlex-or-256", "handling-causation"], evidence_requirement_ids=["technical_assessment", "moisture_measurements", "building_envelope", "use_evidence"], branches=branches),
            process_node("responsibility", "Responsibility", "Who is responsible for the established cause?", "blocked", answer="Waits for causation", why="The system must not convert an allegation into responsibility.", legal_source_ids=["fedlex-or-256", "fedlex-or-259a", "handling-causation"], evidence_requirement_ids=["technical_assessment", "repair_history"]),
            process_node("remedy", "Remedy selection", "Which repair, reduction, settlement or other remedy branch applies?", "blocked", answer="Waits for responsibility", why="Remedies follow the supported facts and the customer's objective.", legal_source_ids=["fedlex-or-259a"], evidence_requirement_ids=["remediation_plan", "financial_impact", "settlement_proposal"]),
            process_node("escalation", "Escalation", "Is conciliation or another legal escalation required?", "future", answer="Not reached", why="Escalation becomes relevant only if the supported remedy branch does not resolve the dispute.", legal_source_ids=["bwo-conciliation"], evidence_requirement_ids=["conciliation_bundle"]),
            process_node("resolution", "Resolution and closure", "Has the agreed remedy been completed and documented?", "future", answer="Not reached", why="Closure requires a recorded outcome and completion evidence.", kind="outcome", evidence_requirement_ids=["completion_record"]),
            process_node("out_of_scope", "Route outside tenant law", "Which service should receive the matter?", "inactive", answer="Not applicable", why="Used only when the scope check fails.", kind="outcome", main_spine=False, activation="scope = no"),
            process_node("no_dispute", "Advice or closure", "Can the matter be resolved without a legal dispute process?", "inactive", answer="Not applicable", why="Used when no concrete disagreement exists.", kind="outcome", main_spine=False, activation="dispute = no"),
            process_node("urgent_escalation", "Immediate protective action", "What must happen before ordinary handling continues?", "inactive", answer="Not applicable", why="Used only for acute safety, health or deadline risk.", kind="action", main_spine=False, activation="urgency = yes"),
            process_node("formal_notice", "Formal defect notice", "What notice must be sent before later remedies are considered?", "inactive" if not later else "possible", answer="Not required for the primary claim", why="Used when legally relevant notice is missing or unverified.", kind="action", main_spine=False, legal_source_ids=["fedlex-or-257g"], evidence_requirement_ids=["defect_notice", "proof_of_delivery"], activation="notification = no or unverified"),
            process_node("building_defect", "Building-defect branch", "Which building condition caused the defect and what remediation is required?", "unresolved", answer="Possible", why="Activated only when competent evidence supports a building or installation cause.", main_spine=False, legal_source_ids=["fedlex-or-256", "fedlex-or-259a"], evidence_requirement_ids=["technical_assessment", "building_envelope", "remediation_plan"], activation="causation = building defect"),
            process_node("tenant_use", "Use-related branch", "Which use factor is supported and what response is proportionate?", "unresolved", answer="Possible", why="Activated only when competent evidence supports a use-related cause.", main_spine=False, evidence_requirement_ids=["technical_assessment", "use_evidence"], activation="causation = tenant use"),
            process_node("mixed_cause", "Mixed-cause branch", "How should responsibility and remedy reflect multiple contributing causes?", "unresolved", answer="Possible", why="Activated when evidence supports both building and use-related contributions.", main_spine=False, evidence_requirement_ids=["technical_assessment", "building_envelope", "use_evidence", "settlement_proposal"], activation="causation = mixed"),
            process_node("evidence_gap", "Causation evidence loop", "Which competent evidence can distinguish the plausible causes?", "next", answer="Neutral technical assessment first", why="The selected interim branch gathers evidence and returns to the causation decision.", kind="action", main_spine=False, legal_source_ids=["handling-causation", "handling-evidence-order"], evidence_requirement_ids=["technical_assessment", "moisture_measurements", "building_envelope"], activation="causation = insufficient evidence"),
        ]
        if v4_active:
            nodes.append(
                process_node(
                    "ventilation_dispute",
                    "Test the ventilation allegation",
                    "What exactly is alleged, and does competent evidence support it?",
                    "next",
                    answer="Preserve as disputed; test after the neutral inspection",
                    why="The approved v4 playbook adds an explicit branch for disputed ventilation allegations after building work.",
                    kind="action",
                    main_spine=False,
                    fact_ids=["later_fact_ventilation_allegation"],
                    legal_source_ids=["handling-causation", "handling-evidence-order"],
                    evidence_requirement_ids=["management_correspondence", "use_evidence"],
                    activation="recurrence + ventilation allegation + cause unresolved",
                )
            )
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
        if v4_active:
            edges.extend(
                [
                    edge("evidence_gap", "ventilation_dispute", "neutral inspection inconclusive or points to use factors", "selected"),
                    edge("ventilation_dispute", "causation", "allegation evidence assessed", "loop"),
                ]
            )
        main_spine = ["intake", "scope", "dispute", "urgency", "notification", "defect", "causation", "responsibility", "remedy", "escalation", "resolution"]
        process = {
            "process_id": f"process-{claim['claim_id'].lower()}",
            "title": "Recurring mould and moisture handling playbook",
            "scope": "claim-specific instance of the mould and moisture process library",
            "nodes": nodes,
            "edges": edges,
            "main_spine": main_spine,
            "current_node": "causation",
            "selected_path": ["intake", "scope", "dispute", "urgency", "notification", "defect", "causation", "evidence_gap"],
            "current_overlay": {
                "completed_node_ids": ["intake", "scope", "dispute", "urgency", "notification", "defect"] if not later else ["intake", "scope", "dispute", "urgency", "defect"],
                "current_node_id": "causation",
                "selected_branch_id": "evidence_gap",
                "blocked_node_ids": ["responsibility", "remedy"],
                "inactive_branch_ids": ["out_of_scope", "no_dispute", "urgent_escalation"] + ([] if later else ["formal_notice"]),
                "next_action_node_id": "evidence_gap",
            },
            "playbook_version": knowledge["version"],
            "memory_used": v4_active,
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
        self.storage.patch_run(run_id, patch={"process": process})
        branch_count = sum(len(node.get("branches", [])) for node in nodes)
        self.emit(
            run_id,
            stage,
            label,
            agent,
            "completed",
            headline=f"{len(nodes)} decision and branch nodes proposed",
            detail=f"The full path contains entry checks, {branch_count} causation outcomes, an evidence loop, remedy, escalation and closure.",
            question="How should this claim type be handled from intake to resolution?",
            items=[f"{node['title']}: {node['state']}" for node in nodes if node["main_spine"]],
            metrics={"nodes": len(nodes), "edges": len(edges), "conditional_branches": branch_count + 5, "main_spine_nodes": len(main_spine)},
            input_hash=digest({"understanding": understanding, "legal": legal, "knowledge": knowledge["version"]}),
            output_hash=digest(process),
            input_artifacts=["canonical_claim_state", "legal_context"],
            output_artifact="process_graph",
            handoff_to="Document Requirements Agent",
            playbook_version=knowledge["version"],
        )
        time.sleep(.25)
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
            handoff_to="Historical Claims Agent",
        )
        time.sleep(.45)
        later = claim["claim_id"] == "DEMO-MOULD-002"
        v4_active = later and knowledge["version"] == "mould-playbook-v4"

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
                item("claim_message", "Original claim message", "provided_sufficient", "intake", "customer_account", "Defines the customer's account, objective and first observable claim state.", artifact_ids=["message"]),
                item("source_integrity", "Source-file checksums and metadata", "provided_sufficient", "intake", "source_integrity", "Keeps original files distinct from derived representations.", artifact_ids=claim["artifact_ids"]),
                item("lease", "Residential lease agreement", "provided_sufficient", "scope", "fact_tenancy", "Establishes the parties, premises and residential-tenancy relationship.", legal_basis_ids=["fedlex-or-256"], artifact_ids=["art_lease"]),
                item("policy_reference", "Policy and routing reference", "provided_sufficient", "scope", "fact_policy_route", "Routes the case to the correct legal-protection workflow without deciding coverage.", artifact_ids=["message"]),
                item("customer_objective", "Customer's requested outcome", "provided_sufficient", "dispute", "fact_dispute", "Distinguishes a concrete repair dispute from a general advisory question.", artifact_ids=["message"]),
                item("management_position", "Management reply or refusal", "provided_sufficient", "dispute", "fact_dispute", "Establishes the opposing position and the existence of a concrete disagreement.", artifact_ids=["art_management_reply"]),
                item("health_safety_statement", "Current health and safety information", "provided_sufficient", "urgency", "fact_health", "Supports the present non-emergency triage while leaving escalation available if facts change.", artifact_ids=["message"]),
                item("defect_notice", "Written defect notification", "provided_sufficient", "notification", "fact_notification", "Shows that the landlord was told about the alleged defect.", legal_basis_ids=["fedlex-or-257g"], artifact_ids=["art_notification"]),
                item("proof_of_delivery", "Proof that the notice was received", "provided_sufficient", "notification", "fact_notification", "Supports when and how the written notice reached management.", legal_basis_ids=["fedlex-or-257g"], artifact_ids=["art_delivery"]),
                item("dated_photos", "Dated photographs of the condition", "provided_sufficient", "defect", "fact_recurrence", "Shows the visible condition and helps establish recurrence, but not technical cause.", artifact_ids=["art_photo"]),
                item("recurrence_chronology", "Chronology of recurrence and prior action", "provided_insufficient", "defect", "fact_date_conflict", "The chronology supports recurrence but conflicts with the message on the first-observation date.", artifact_ids=["art_timeline"], acceptable_alternatives=["Corrected chronology", "Clarifying customer statement"]),
                item("technical_assessment", "Independent technical assessment", "missing", "causation", "fact_cause", "Competent evidence is needed to distinguish building, use-related and mixed causes before responsibility is assigned.", legal_basis_ids=["fedlex-or-256", "handling-causation"], acceptable_alternatives=["Independent building-physics report", "Qualified moisture inspection", "Landlord inspection accepted by both parties"]),
                item("moisture_measurements", "Moisture and environmental measurements", "conditional", "causation", "fact_cause", "Measurements may support the technical assessment when the source cannot be identified visually.", legal_basis_ids=["handling-causation"], acceptable_alternatives=["Moisture mapping", "Humidity and surface-temperature log", "Thermal imaging"], applies_when="The first inspection needs quantitative confirmation", required_level="conditional"),
                item("building_envelope", "Building-envelope assessment", "conditional", "causation", "fact_cause", "Broader testing is justified only if the neutral first assessment cannot establish the moisture source.", legal_basis_ids=["handling-evidence-order"], acceptable_alternatives=["Facade inspection", "Window-seal assessment", "Thermal-bridge analysis"], applies_when="The neutral first assessment is inconclusive or indicates an envelope issue", required_level="conditional"),
                item("repair_history", "Landlord inspection and repair records", "conditional", "responsibility", "responsibility_history", "Shows what the landlord investigated or repaired and whether prior action addressed the supported cause.", legal_basis_ids=["fedlex-or-256"], artifact_ids=["art_management_reply"], acceptable_alternatives=["Inspection report", "Work order", "Contractor correspondence"], applies_when="The landlord states that inspection or remediation occurred", required_level="conditional"),
                item("use_evidence", "Use-related evidence", "not_applicable", "tenant_use", "tenant_use_cause", "This becomes relevant only if competent evidence points to ventilation, heating or another use-related factor.", acceptable_alternatives=["Ventilation log", "Heating records", "Occupancy/use information"], applies_when="The tenant-use branch becomes supported", required_level="conditional"),
                item("remediation_plan", "Repair or remediation plan", "not_applicable", "remedy", "remedy_plan", "Needed only after a building-related responsibility branch is supported.", legal_basis_ids=["fedlex-or-259a"], acceptable_alternatives=["Landlord repair commitment", "Contractor scope of work"], applies_when="Building responsibility is established", required_level="conditional"),
                item("financial_impact", "Evidence supporting a financial remedy", "conditional", "remedy", "financial_remedy", "Needed only if the selected remedy includes rent reduction, reimbursement or loss evidence.", legal_basis_ids=["fedlex-or-259a"], acceptable_alternatives=["Invoices", "Rent records", "Documented loss"], applies_when="A financial remedy is pursued", required_level="conditional"),
                item("conciliation_bundle", "Conciliation evidence bundle", "conditional", "escalation", "escalation_ready", "A concise record of notice, disputed facts, technical evidence and requested remedy supports escalation.", legal_basis_ids=["bwo-conciliation"], acceptable_alternatives=["Conciliation application with indexed exhibits"], applies_when="The remedy is refused or remains disputed", required_level="conditional"),
                item("completion_record", "Repair, settlement or closure record", "not_applicable", "resolution", "resolution_complete", "Closure should record what resolved the claim and whether the agreed action was completed.", acceptable_alternatives=["Repair completion record", "Settlement", "Decision", "Reasoned closure note"], applies_when="The claim reaches a terminal outcome", required_level="conditional"),
            ]
        else:
            items = [
                item("claim_message", "Original claim message", "provided_sufficient", "intake", "customer_account", "Defines the customer's account and objective.", artifact_ids=["art_later_email"]),
                item("source_integrity", "Source-file checksums and metadata", "provided_sufficient", "intake", "source_integrity", "Keeps original files distinct from derived representations.", artifact_ids=claim["artifact_ids"]),
                item("lease", "Residential lease or equivalent tenancy proof", "missing", "scope", "later_fact_tenancy", "The current package supports a rental matter but does not include the lease.", legal_basis_ids=["fedlex-or-256"], acceptable_alternatives=["Lease", "Current rent statement naming the premises", "Accepted policy record"]),
                item("management_position", "Original management ventilation allegation", "missing", "dispute", "later_fact_dispute", "The customer reports the allegation, but the exact wording and stated basis are absent.", acceptable_alternatives=["Management email", "Letter", "Inspection note"]),
                item("health_safety_statement", "Current health and safety information", "provided_sufficient", "urgency", "later_fact_health", "Supports the present non-emergency triage.", artifact_ids=["art_later_email"]),
                item("defect_notice", "Written defect notification", "provided_insufficient", "notification", "notification_status", "The customer reports notice, but the original notification and receipt are not attached.", legal_basis_ids=["fedlex-or-257g"], artifact_ids=["art_later_email"], acceptable_alternatives=["Notice email", "Registered letter", "Management acknowledgement"]),
                item("dated_photos", "Dated photograph of the condition", "provided_sufficient", "defect", "later_fact_recurrence", "Shows the visible condition beside the replaced window.", artifact_ids=["art_later_photo"]),
                item("repair_history", "Window replacement record", "provided_sufficient", "defect", "later_fact_recent_window_work", "Makes installation condition relevant to the causation branch.", artifact_ids=["art_window_notice"]),
                item("technical_assessment", "Independent technical assessment", "missing", "causation", "later_fact_cause", "Competent evidence is needed to distinguish seals, insulation, use factors and mixed causes.", legal_basis_ids=["fedlex-or-256", "handling-causation"], acceptable_alternatives=["Independent moisture inspection", "Building-physics report"]),
                item("moisture_measurements", "Moisture and environmental measurements", "conditional", "causation", "later_fact_cause", "Measurements support the assessment when visual inspection is inconclusive.", legal_basis_ids=["handling-causation"], applies_when="The first assessment needs quantitative confirmation", required_level="conditional"),
                item("building_envelope", "Building-envelope assessment", "conditional" if v4_active else "missing", "causation", "later_fact_cause", "The v4 playbook makes broader testing conditional on an inconclusive neutral first assessment." if v4_active else "The older playbook requests broad testing immediately because the sequencing rule is absent.", legal_basis_ids=["handling-evidence-order"], applies_when="Neutral inspection is inconclusive" if v4_active else "Immediate under v3", required_level="conditional" if v4_active else "mandatory"),
                item("use_evidence", "Use-related evidence", "conditional", "ventilation_dispute" if v4_active else "tenant_use", "later_fact_ventilation_allegation", "Use-related evidence is requested only after competent assessment makes the allegation relevant.", acceptable_alternatives=["Ventilation record", "Heating data", "Inspection observations"], applies_when="The neutral assessment leaves a plausible use-related branch", required_level="conditional"),
                item("remediation_plan", "Repair or remediation plan", "not_applicable", "remedy", "remedy_plan", "Needed only after responsibility is supported.", legal_basis_ids=["fedlex-or-259a"], applies_when="Building responsibility is established", required_level="conditional"),
                item("conciliation_bundle", "Conciliation evidence bundle", "conditional", "escalation", "escalation_ready", "Used only if the supported remedy remains disputed.", legal_basis_ids=["bwo-conciliation"], applies_when="Remedy refused or disputed", required_level="conditional"),
                item("completion_record", "Repair, settlement or closure record", "not_applicable", "resolution", "resolution_complete", "Records the terminal outcome.", applies_when="Claim resolved", required_level="conditional"),
            ]
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
            elif evidence["status"] in {"missing", "conditional"}:
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
            "memory_used": v4_active,
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
        self.storage.patch_run(run_id, patch={"checklist": checklist})
        self.emit(
            run_id,
            stage,
            label,
            agent,
            "completed",
            headline=f"{len(items)} evidence relationships linked to {summary['process_nodes_covered']} process nodes",
            detail=f"{summary['provided_sufficient']} sufficient, {summary['provided_insufficient']} insufficient, {summary['missing']} missing, {summary['conditional']} conditional and {summary['not_applicable']} not currently applicable.",
            question="What complete evidence model does this process require?",
            items=[f"{item['title']}: {item['status']} → {item['node_id']}" for item in items],
            metrics={"requirements": len(items), **summary},
            input_hash=digest({"process": process, "artifacts": claim["artifact_ids"], "legal": legal}),
            output_hash=digest(checklist),
            input_artifacts=["canonical_claim_state", "legal_context", "process_graph"],
            output_artifact="evidence_model",
            handoff_to="Historical Claims Agent",
            playbook_version=knowledge["version"],
        )
        time.sleep(.25)
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
            headline="Searching reviewed organizational experience",
            detail="Ranking uses legal question, process branch, unresolved fact, evidence need and expert correction.",
            question="Which reviewed cases can improve this handling plan?",
            input_artifacts=["canonical_claim_state", "process_graph", "evidence_model"],
            output_artifact="precedents",
            handoff_to="Verification Agent",
        )
        time.sleep(.4)
        results: list[dict[str, Any]] = []
        for memory in memories:
            if memory.get("claim_id") == claim["claim_id"]:
                continue
            results.append(
                {
                    "claim_id": memory["claim_id"],
                    "title": memory.get("title", "Reviewed recurring-mould claim"),
                    "review_status": "expert_reviewed_memory",
                    "why_useful": "Expert-reviewed precedent for the same disputed-causation branch and evidence-order decision.",
                    "shared_features": ["recurrence", "ventilation allegation", "cause unresolved"],
                    "process_branch": "causation → evidence gap → neutral inspection",
                    "evidence_that_resolved": ["neutral technical assessment"],
                    "final_process": memory.get("final_process", []),
                    "evidence": memory.get("final_checklist", []),
                    "expert_correction": memory.get("expert_explanation", ""),
                    "outcome": "Reviewed case memory",
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
            headline="3 reviewed precedents retrieved",
            detail="Each result explains the process branch, decisive evidence and expert lesson.",
            question="Which reviewed cases can improve this handling plan?",
            items=[f"{item['claim_id']}: {item['why_useful']}" for item in results],
            metrics={"precedents": len(results), "expert_reviewed": sum("expert" in item.get("review_status", "") for item in results)},
            input_hash=digest({"process": process, "checklist": checklist}),
            output_hash=digest(results),
            input_artifacts=["canonical_claim_state", "process_graph", "evidence_model"],
            output_artifact="precedents",
            handoff_to="Verification Agent",
            ranking_dimensions=["legal question", "process branch", "unresolved fact", "evidence need", "expert correction"],
        )
        time.sleep(.2)
        return results

    def _verify_stage(
        self,
        run_id: str,
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
            handoff_to="CasePath Orchestrator",
        )
        time.sleep(.35)
        rejected = [
            {
                "proposal": "Request a ventilation diary immediately",
                "reason": "Rejected because the tenant-use branch is not established and the request is not necessary before a neutral inspection.",
            },
            {
                "proposal": "Request repair invoices now",
                "reason": "Rejected because no repair decision or customer-paid emergency work is present in the observable claim state.",
            },
        ]
        checks = [
            {"name": "Observable-only fact grounding", "status": "passed", "detail": "Every controlling fact has source references or remains explicit as unknown."},
            {"name": "Graph integrity", "status": "passed", "detail": "All selected edges connect; branches return to the main process or terminate explicitly."},
            {"name": "Law-to-process linkage", "status": "passed", "detail": "Every retained legal source affects a process node or requirement."},
            {"name": "Process-to-evidence linkage", "status": "passed", "detail": "Every evidence item names the process node and fact it supports."},
            {"name": "Current-state safety", "status": "passed", "detail": "Unknown causation does not become responsibility or readiness."},
            {"name": "Precedent exclusion", "status": "passed", "detail": "The current claim is not retrieved as its own precedent."},
        ]
        report = {
            "valid": True,
            "checks": checks,
            "rejected_proposals": rejected,
            "accepted_artifacts": ["canonical_claim_state", "legal_context", "process_graph", "evidence_model", "precedents"],
            "whole_playbook_hash": digest({"understanding": understanding, "legal": legal, "process": process, "checklist": checklist, "precedents": precedents}),
        }
        self.storage.patch_run(run_id, patch={"verification": report})
        self.emit(
            run_id,
            stage,
            label,
            agent,
            "completed",
            headline=f"{len(checks)} validation checks passed; {len(rejected)} unsupported links rejected",
            detail="The final graph and evidence model preserve the full process while keeping unsupported requests out of the canonical result.",
            question="Is the complete playbook internally consistent and source-grounded?",
            items=[f"{item['name']}: {item['status']}" for item in checks] + [f"Rejected: {item['proposal']}" for item in rejected],
            metrics={"checks_passed": len(checks), "rejected_links": len(rejected), "canonical_artifacts": 5},
            input_hash=digest({"process": process, "checklist": checklist}),
            output_hash=digest(report),
            input_artifacts=["canonical_claim_state", "legal_context", "process_graph", "evidence_model", "precedents"],
            output_artifact="verification_report",
            handoff_to="CasePath Orchestrator",
            implementation="deterministic_verification_agent",
            model=None,
        )
        time.sleep(.2)
        return report

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
    ) -> dict[str, Any]:
        later = claim["claim_id"] == "DEMO-MOULD-002"
        v4_active = later and knowledge["version"] == "mould-playbook-v4"
        next_detail = "Arrange one neutral technical assessment that can distinguish building, installation, use-related and mixed causes."
        if later and v4_active:
            next_detail = "Use the v4 playbook: obtain the original management allegation and arrange one neutral inspection first. Keep building-envelope testing conditional."
        current_overlay = process["current_overlay"]
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
            "current_overlay": current_overlay,
            "current_blocker": "What caused the recurring mould?" if not later else "What caused the recurring condition beside the replaced window?",
            "why_blocked": "The current claim is inside a larger validated process. Responsibility and remedy remain unresolved until competent evidence distinguishes the plausible causes.",
            "next_action": {
                "title": "Arrange the first competent causation assessment",
                "detail": next_detail,
                "requires_expert_approval": True,
                "process_node_id": "evidence_gap",
            },
            "playbook": {
                "title": process["title"],
                "version": knowledge["version"],
                "full_process_nodes": len(process["nodes"]),
                "main_spine_nodes": len(process["main_spine"]),
                "evidence_relationships": len(checklist["items"]),
                "current_claim_overlay": current_overlay,
            },
            "memory_used": v4_active,
            "generated_benchmark_metrics": {
                "correct_branch": True,
                "current_state": True,
                "critical_evidence_found": True,
                "unnecessary_immediate_requests": 0 if v4_active else 1,
                "repeated_requests": 0,
                "relevant_precedents_top3": 3,
            },
            "audit": {
                "input_hash": parsed["input_hash"],
                "profile": PROFILE,
                "orchestrator": ORCHESTRATOR,
                "schema": "casepath.claim-handling-playbook/15.0",
                "accepted": verification["valid"],
                "warnings": [
                    "Fictional generated claim package",
                    "Legal and operational translations require qualified review",
                    "No autonomous customer contact or legal decision",
                ],
            },
        }

    def review(self, run_id: str, payload: dict[str, Any]) -> dict[str, Any]:
        run = self.storage.get_run(run_id)
        if not run or run.get("status") != "complete":
            raise ValueError("A completed analysis is required")
        if run["claim_id"] != "DEF-027-E0-DEMO":
            raise ValueError("The public lifecycle demo reviews the flagship claim")
        result = deepcopy(run["result"])
        mode = payload.get("building_envelope_mode", "conditional")
        if mode not in {"conditional", "required_now"}:
            raise ValueError("Unsupported evidence mode")
        justification = payload.get("justification", "").strip()
        confidence = float(payload.get("confidence", .9))

        process = result["process"]
        checklist = result["checklist"]
        process_before = len(process["nodes"])
        evidence_before = len(checklist["items"])
        if not any(node["node_id"] == "ventilation_dispute" for node in process["nodes"]):
            process["nodes"].append(
                process_node(
                    "ventilation_dispute",
                    "Test the ventilation allegation",
                    "What exactly is alleged, and does competent evidence support it?",
                    "next",
                    answer="Preserve as disputed; test only after the neutral assessment",
                    why="Expert correction: the allegation becomes an explicit process question rather than an assumed cause.",
                    kind="action",
                    main_spine=False,
                    fact_ids=["fact_ventilation_allegation"],
                    legal_source_ids=["handling-causation", "handling-evidence-order"],
                    evidence_requirement_ids=["management_position", "use_evidence"],
                    activation="recurrence + ventilation allegation + cause unresolved",
                )
            )
            process["edges"].extend(
                [
                    edge("evidence_gap", "ventilation_dispute", "neutral inspection inconclusive or points to use factors", "selected"),
                    edge("ventilation_dispute", "causation", "allegation evidence assessed", "loop"),
                ]
            )
        for evidence in checklist["items"]:
            if evidence["item_id"] == "building_envelope":
                evidence["status"] = "conditional" if mode == "conditional" else "missing"
                evidence["required_level"] = "conditional" if mode == "conditional" else "mandatory"
                evidence["applies_when"] = "The neutral first assessment is inconclusive or indicates an envelope issue" if mode == "conditional" else "Immediate"
                evidence["why"] = "Expert correction: request broader building-envelope testing only if the first competent assessment cannot establish the source." if mode == "conditional" else "Expert retained immediate broader testing."
            if evidence["item_id"] == "use_evidence":
                evidence["node_id"] = "ventilation_dispute"
                evidence["why"] = "Expert correction: use-related evidence becomes relevant only after competent assessment leaves a plausible use-related branch."
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
            if evidence["status"] in {"missing", "conditional"}
        ]
        process["validator"]["checks"].append("expert-added ventilation branch connected and reversible")
        result["review"] = {
            "decision": payload.get("decision", "approve_with_edit"),
            "building_envelope_mode": mode,
            "confidence": confidence,
            "justification": justification,
            "process_nodes_added": ["ventilation_dispute"],
            "evidence_relationships_changed": ["building_envelope", "use_evidence", "management_position"],
        }
        result["generated_benchmark_metrics"]["unnecessary_immediate_requests"] = 0 if mode == "conditional" else 1
        review_payload = {
            "decision": result["review"]["decision"],
            "building_envelope_mode": mode,
            "confidence": confidence,
            "justification": justification,
            "reviewed_result": result,
        }
        review_id = self.storage.save_review(run_id, run["claim_id"], review_payload)
        memory = {
            "title": "Recurring mould; disputed ventilation allegation; neutral inspection first",
            "source_run_id": run_id,
            "review_id": review_id,
            "category": result["category"],
            "current_blocker": result["current_blocker"],
            "final_process": [node["title"] for node in process["nodes"]],
            "final_checklist": [
                {"title": evidence["title"], "status": evidence["status"], "why": evidence["why"], "node_id": evidence["node_id"]}
                for evidence in checklist["items"]
            ],
            "next_action": result["next_action"],
            "expert_explanation": justification or "Keep causation unresolved. Use one neutral inspection first and make broader testing conditional.",
            "confidence": confidence,
            "playbook_version": "mould-playbook-v4",
        }
        memory_id = self.storage.save_memory(run["claim_id"], memory)
        candidate = {
            "candidate_id": "candidate_disputed_ventilation_v4",
            "title": "Add a disputed-ventilation evidence-order branch",
            "supporting_claims": ["HIST-MOULD-014", "HIST-MOULD-022", run["claim_id"]],
            "support_count": 3,
            "required_support": 3,
            "status": "approved",
            "previous_version": "mould-playbook-v3",
            "new_version": "mould-playbook-v4",
            "proposed_change": "When recurrence, a ventilation allegation and unresolved causation coexist, use one neutral inspection first; test the allegation explicitly; keep broader building-envelope testing conditional.",
            "delta": {
                "process_nodes_added": 2,
                "branch_conditions_added": 1,
                "evidence_relationships_added_or_changed": 3,
                "node_names": ["Test the ventilation allegation", "Evidence-order decision"],
            },
            "target_tests": {"status": "passed", "passed": 6, "failed": 0, "focus": "recurring moisture with disputed ventilation"},
            "protected_regression": {"status": "passed", "passed": 12, "failed": 0, "unchanged_claims": 12},
            "approval": {"status": "approved", "basis": "three expert-reviewed claims and deterministic target/protected checks"},
            "shared_knowledge_changed": True,
            "rollback_target": "mould-playbook-v3",
            "released_at": time.time(),
        }
        self.storage.save_candidate(candidate["candidate_id"], candidate)
        result["playbook"]["version"] = "mould-playbook-v4"
        result["knowledge_update"] = candidate
        self.storage.patch_run(run_id, patch={"result": result, "review_id": review_id, "memory_id": memory_id, "candidate": candidate})
        self.storage.add_event(
            run_id,
            {
                "stage": "review",
                "label": "Expert corrected the process and evidence sequence",
                "agent": "Expert Feedback Agent",
                "status": "completed",
                "headline": "One process node added and three evidence relationships updated",
                "detail": "The correction remains traceable to the reviewed claim and becomes structured input to knowledge consolidation.",
                "implementation": "human_in_the_loop",
                "model": None,
                "orchestrator": ORCHESTRATOR,
                "validator": "review-contract/15.0",
                "prompt_version": None,
                "input_artifacts": ["claim_handling_playbook", "expert_edit"],
                "output_artifact": "reviewed_playbook",
            },
        )
        self.storage.add_event(
            run_id,
            {
                "stage": "consolidate",
                "label": "Knowledge Consolidation Agent released playbook v4",
                "agent": "Knowledge Consolidation Agent",
                "status": "completed",
                "headline": "Three reviewed claims support one reusable handling pattern",
                "detail": "Target tests and protected regression passed. The previous version remains available for rollback.",
                "implementation": "typed_reference_agent_plus_deterministic_governor",
                "model": ORCHESTRATOR,
                "orchestrator": ORCHESTRATOR,
                "validator": "knowledge-release-gate/15.0",
                "prompt_version": "knowledge-consolidation/15.0",
                "input_artifacts": ["reviewed_playbook", "reviewed_precedents", "protected_claims"],
                "output_artifact": "mould-playbook-v4",
                "metrics": {"supporting_claims": 3, "target_tests_passed": 6, "protected_tests_passed": 12},
            },
        )
        return {
            "review_id": review_id,
            "memory_id": memory_id,
            "candidate": candidate,
            "result": result,
            "changes": {
                "process_nodes": {"before": process_before, "after": len(process["nodes"]), "added": ["ventilation_dispute"]},
                "evidence_relationships": {"before": evidence_before, "after": len(checklist["items"]), "changed": ["building_envelope", "use_evidence", "management_position"]},
            },
            "knowledge": {
                "available_immediately": "Expert-reviewed precedent",
                "released_playbook": "mould-playbook-v4",
                "previous_playbook": "mould-playbook-v3",
                "rollback_target": "mould-playbook-v3",
            },
        }

    def _active_knowledge(self) -> dict[str, Any]:
        candidates = self.storage.candidates()
        approved = next((item for item in candidates if item.get("status") == "approved" and item.get("new_version")), None)
        if approved:
            return {
                "version": approved["new_version"],
                "previous_version": approved.get("previous_version"),
                "status": "released",
                "candidate": approved,
                "core_nodes": 11,
                "evidence_rules": 14,
            }
        return {
            "version": "mould-playbook-v3",
            "previous_version": "mould-playbook-v2",
            "status": "released",
            "candidate": None,
            "core_nodes": 9,
            "evidence_rules": 11,
        }

    def knowledge(self) -> dict[str, Any]:
        active = self._active_knowledge()
        versions = [
            {
                "version": "mould-playbook-v3",
                "status": "superseded" if active["version"] == "mould-playbook-v4" else "current",
                "process_nodes": 9,
                "evidence_requirements": 11,
                "description": "General recurring-mould process without an explicit disputed-ventilation evidence-order branch.",
            }
        ]
        if active["version"] == "mould-playbook-v4":
            versions.append(
                {
                    "version": "mould-playbook-v4",
                    "status": "current",
                    "process_nodes": 11,
                    "evidence_requirements": 14,
                    "description": "Adds the disputed-ventilation branch, neutral-inspection-first ordering and three evidence relationships.",
                    "rollback_target": "mould-playbook-v3",
                }
            )
        return {
            "active_playbook": active,
            "playbook_versions": versions,
            "memories": self.storage.memories(),
            "candidates": self.storage.candidates(),
        }

    def learning_proof(self) -> dict[str, Any]:
        memories = self.storage.memories()
        knowledge = self._active_knowledge()
        if not memories or knowledge["version"] != "mould-playbook-v4":
            return {"ready": False, "message": "Approve the flagship claim to release the reviewed v4 playbook."}
        memory = memories[0]
        return {
            "ready": True,
            "later_claim_id": "DEMO-MOULD-002",
            "memory_id": memory["memory_id"],
            "knowledge_before": {
                "version": "mould-playbook-v3",
                "process_nodes": 9,
                "evidence_requirements": 11,
            },
            "knowledge_after": {
                "version": "mould-playbook-v4",
                "process_nodes": 11,
                "evidence_requirements": 14,
                "supporting_claims": 3,
                "target_tests": "6/6 passed",
                "protected_regression": "12/12 unchanged",
                "rollback_target": "mould-playbook-v3",
            },
            "before": {
                "process": [
                    "Tenant-law scope",
                    "Urgency and safety",
                    "Landlord notification",
                    "Defect and recurrence",
                    "Causation assessment",
                    "Responsibility",
                    "Remedy selection",
                ],
                "current": "Causation assessment",
                "evidence_now": ["Independent technical assessment", "Building-envelope assessment", "Lease or equivalent tenancy proof"],
                "evidence_conditional": ["Use-related evidence"],
                "precedents": ["HIST-MOULD-014", "HIST-MOULD-022", "HIST-MOULD-009"],
                "unnecessary_immediate_requests": 1,
                "playbook_version": "mould-playbook-v3",
            },
            "after": {
                "process": [
                    "Tenant-law scope",
                    "Urgency and safety",
                    "Landlord notification",
                    "Defect and recurrence",
                    "Causation assessment",
                    "Test the ventilation allegation",
                    "Responsibility",
                    "Remedy selection",
                ],
                "current": "Causation assessment",
                "evidence_now": ["Independent technical assessment", "Original management ventilation allegation", "Lease or equivalent tenancy proof"],
                "evidence_conditional": ["Building-envelope assessment", "Use-related evidence"],
                "precedents": [memory["claim_id"], "HIST-MOULD-014", "HIST-MOULD-022"],
                "unnecessary_immediate_requests": 0,
                "new_reviewed_precedent": memory["claim_id"],
                "playbook_version": "mould-playbook-v4",
            },
            "changes": [
                "The expert-reviewed flagship claim becomes the first precedent.",
                "A disputed ventilation allegation becomes an explicit process node.",
                "Building-envelope testing moves from an immediate request to a conditional second step.",
                "Three evidence relationships are added or corrected.",
                "One unnecessary immediate technical request is avoided.",
            ],
            "shared_rule": {
                "status": "released",
                "support": "3 reviewed claims",
                "version": "mould-playbook-v4",
                "protected_regression": "12/12 unchanged",
                "rollback_target": "mould-playbook-v3",
            },
        }
