from __future__ import annotations

from email import policy
from email.parser import BytesParser
from hashlib import sha256
from pathlib import Path
from typing import Any

from pypdf import PdfReader

ROOT = Path(__file__).resolve().parents[1]
ARTIFACT_DIR = ROOT / "artifacts"


def file_sha(path: Path) -> str:
    h = sha256()
    with path.open("rb") as f:
        for chunk in iter(lambda: f.read(65536), b""):
            h.update(chunk)
    return h.hexdigest()


def pdf_pages(path: Path) -> list[str]:
    reader = PdfReader(str(path))
    return [(page.extract_text() or "").strip() for page in reader.pages]


def email_payload(path: Path) -> dict[str, str]:
    msg = BytesParser(policy=policy.default).parsebytes(path.read_bytes())
    body = msg.get_body(preferencelist=("plain",))
    return {
        "from": str(msg.get("From", "")),
        "to": str(msg.get("To", "")),
        "date": str(msg.get("Date", "")),
        "subject": str(msg.get("Subject", "")),
        "message_id": str(msg.get("Message-ID", "")),
        "body": body.get_content().strip() if body else "",
    }


def artifact(
    artifact_id: str,
    filename: str,
    title: str,
    kind: str,
    received_at: str,
    document_type: str,
    facts: list[str],
    description: str,
) -> dict[str, Any]:
    path = ARTIFACT_DIR / filename
    media = {
        ".pdf": "application/pdf",
        ".jpg": "image/jpeg",
        ".jpeg": "image/jpeg",
        ".png": "image/png",
        ".eml": "message/rfc822",
    }[path.suffix.lower()]
    result: dict[str, Any] = {
        "artifact_id": artifact_id,
        "filename": filename,
        "title": title,
        "kind": kind,
        "document_type": document_type,
        "media_type": media,
        "received_at": received_at,
        "size_bytes": path.stat().st_size,
        "sha256": file_sha(path),
        "description": description,
        "fact_ids": facts,
        "path": path,
    }
    if media == "application/pdf":
        result["pages"] = pdf_pages(path)
        result["page_count"] = len(result["pages"])
    elif media == "message/rfc822":
        result["email"] = email_payload(path)
        result["page_count"] = 1
    else:
        result["page_count"] = 1
    return result


DEMO_ARTIFACTS = [
    artifact(
        "art_lease", "lease-agreement.pdf", "Residential lease agreement", "pdf", "2026-08-01T09:03:00Z",
        "lease_contract", ["fact_tenancy", "fact_address"],
        "Six-page signed lease, including maintenance, defect-notification, access and house-rule clauses.",
    ),
    artifact(
        "art_notification", "notification-email.eml", "Email notifying the property manager", "email", "2026-08-01T09:03:00Z",
        "defect_notification", ["fact_notification", "fact_access"],
        "Original RFC 822 email dated 15 July 2026.",
    ),
    artifact(
        "art_management_reply", "management-reply.eml", "Management reply", "email", "2026-08-01T09:03:00Z",
        "landlord_response", ["fact_ventilation_allegation", "fact_no_inspection"],
        "Original RFC 822 property-management reply.",
    ),
    artifact(
        "art_photo", "bedroom-mould-2026-07-27.jpg", "Bedroom photograph", "image", "2026-08-01T09:03:00Z",
        "dated_photograph", ["fact_visible_mould", "fact_recurrence"],
        "Source photograph dated 27 July 2026.",
    ),
    artifact(
        "art_timeline", "defect-timeline.pdf", "Defect timeline", "pdf", "2026-08-01T09:03:00Z",
        "defect_timeline", ["fact_recurrence", "fact_date_conflict", "fact_no_inspection"],
        "Two-page tenant timeline, including a first-observation date that conflicts with the customer message.",
    ),
    artifact(
        "art_delivery", "delivery-receipt.pdf", "Email delivery receipt", "pdf", "2026-08-01T09:03:00Z",
        "proof_of_notification", ["fact_notification"],
        "Mail-server delivery record for the written notification.",
    ),
]

LATER_ARTIFACTS = [
    artifact(
        "art_later_email", "later-claim-email.eml", "Customer email", "email", "2026-08-10T07:46:00Z",
        "claim_message", ["later_fact_recurrence", "later_fact_ventilation_allegation", "later_fact_no_inspection"],
        "Original RFC 822 email reporting condensation after window replacement.",
    ),
    artifact(
        "art_later_photo", "later-window-condensation-2026-08-08.jpg", "Window-corner photograph", "image", "2026-08-10T07:46:00Z",
        "dated_photograph", ["later_fact_visible_spots", "later_fact_recurrence"],
        "Source photograph dated 8 August 2026.",
    ),
    artifact(
        "art_window_notice", "window-replacement-notice.pdf", "Window replacement notice", "pdf", "2026-08-10T07:46:00Z",
        "repair_record", ["later_fact_recent_window_work", "later_fact_no_inspection"],
        "Window-replacement notice dated May 2026.",
    ),
]

ARTIFACTS = {a["artifact_id"]: a for a in DEMO_ARTIFACTS + LATER_ARTIFACTS}

DEMO_CLAIM = {
    "claim_id": "DEF-027-E0-DEMO",
    "lineage": "DEF-027-E0",
    "generated": True,
    "language": "en",
    "canton": "BS",
    "received_at": "2026-08-01T09:03:00Z",
    "customer": {"name": "Alex Morgan", "address": "Feldbergstrasse 114, 4057 Basel", "policy": "LP-2024-08317"},
    "subject": "Recurring mould - management says ventilation",
    "message": (
        "Hello,\n\nThe mould in the external corner of our bedroom keeps coming back. I first noticed it around 20 March. "
        "We clean it and it returns. The radiator works and we air the room every morning and evening.\n\n"
        "I notified the property manager by email on 15 July. They replied that the cause was insufficient ventilation and said they would not arrange an inspection. "
        "I disagree because the problem keeps returning. There are no current health symptoms and no urgent deadline. I can provide access after 17:30.\n\n"
        "Please tell me what should happen next. I want the cause clarified and the defect repaired.\n\nKind regards,\nAlex Morgan"
    ),
    "artifact_ids": [a["artifact_id"] for a in DEMO_ARTIFACTS],
    "status": "new",
}

LATER_CLAIM = {
    "claim_id": "DEMO-MOULD-002",
    "lineage": "source-isolated-follow-up-demo",
    "generated": True,
    "language": "en",
    "canton": "BS",
    "received_at": "2026-08-10T07:46:00Z",
    "customer": {"name": "Sam Keller", "address": "Klybeckstrasse 77, 4057 Basel", "policy": "LP-2025-04192"},
    "subject": "Condensation after window replacement",
    "message": email_payload(ARTIFACT_DIR / "later-claim-email.eml")["body"],
    "artifact_ids": [a["artifact_id"] for a in LATER_ARTIFACTS],
    "status": "new",
}

CLAIMS = {DEMO_CLAIM["claim_id"]: DEMO_CLAIM, LATER_CLAIM["claim_id"]: LATER_CLAIM}

LAW_SOURCES = [
    {
        "source_id": "fedlex-or-256",
        "title": "Swiss Code of Obligations, Art. 256",
        "url": "https://www.fedlex.admin.ch/eli/cc/27/317_321_377/en",
        "source_type": "official_statute",
        "jurisdiction": "CH",
        "version_date": "2023-09-01",
        "location": "Article 256",
        "passage_summary": "The landlord must hand over and maintain the premises in a condition fit for their intended use.",
        "operational_interpretation": "Generated reference interpretation: fitness for intended use makes the alleged condition relevant to the handling process, but does not establish technical cause or responsibility.",
        "review_status": "qualified_review_pending",
        "role": "Makes the condition and maintenance question relevant without deciding causation.",
        "approved": False,
    },
    {
        "source_id": "fedlex-or-257g",
        "title": "Swiss Code of Obligations, Art. 257g",
        "url": "https://www.fedlex.admin.ch/eli/cc/27/317_321_377/en",
        "source_type": "official_statute",
        "jurisdiction": "CH",
        "version_date": "2023-09-01",
        "location": "Article 257g",
        "passage_summary": "A tenant must report defects they are not responsible for remedying and may be liable for loss caused by failing to report them.",
        "operational_interpretation": "Generated reference interpretation: notification is a relevant fact; written evidence can help establish that it occurred. The provision is not represented as imposing a statutory writing requirement.",
        "review_status": "qualified_review_pending",
        "role": "Makes notification a relevant fact; written evidence helps establish it.",
        "approved": False,
    },
    {
        "source_id": "fedlex-or-259a",
        "title": "Swiss Code of Obligations, Art. 259a et seq.",
        "url": "https://www.fedlex.admin.ch/eli/cc/27/317_321_377/en",
        "source_type": "official_statute",
        "jurisdiction": "CH",
        "version_date": "2023-09-01",
        "location": "Article 259a and following",
        "passage_summary": "The provisions frame remedies for defects not attributable to the tenant and not within the tenant's maintenance responsibility.",
        "operational_interpretation": "Generated reference interpretation: remedy questions follow supported defect and attribution facts; the provision itself does not establish causation.",
        "review_status": "qualified_review_pending",
        "role": "Frames possible remedy questions without deciding causation or attribution.",
        "approved": False,
    },
    {
        "source_id": "bwo-conciliation",
        "title": "Federal Housing Office - tenancy conciliation",
        "url": "https://www.bwo.admin.ch/de/schlichtungsverfahren",
        "source_type": "official_guidance",
        "jurisdiction": "CH",
        "version_date": "2024-07-16",
        "location": "Schlichtungsverfahren page",
        "passage_summary": "A conciliation attempt precedes judicial proceedings in civil disputes; tenancy conciliation bodies are independently chaired with parity tenant and landlord representation under the Civil Procedure Code.",
        "operational_interpretation": "Generated reference interpretation: conciliation may become relevant after the supported remedy remains disputed; case-specific escalation still requires qualified review.",
        "review_status": "qualified_review_pending",
        "role": "Explains the institutional conciliation route without deciding whether this claim should escalate.",
        "approved": False,
    },
]

HISTORICAL_CASES = [
    {
        "claim_id": "HIST-MOULD-014",
        "title": "Recurring mould at an external wall",
        "review_status": "generated_reference",
        "why_useful": "Generated reference with the same disputed-causation branch. Its reference outcome uses an independent inspection before responsibility is assessed.",
        "provenance": "generated_reference_not_qualified_review",
        "shared_features": ["recurring mould", "cause disputed", "technical assessment"],
        "final_process": ["scope", "notification", "independent inspection", "building defect established", "repair request"],
        "evidence": ["notification email", "dated photographs", "independent inspection report"],
        "reference_lesson": "The generated reference sequence keeps a ventilation diary conditional because its reference inspection first establishes a structural defect.",
        "outcome": "Facade insulation repaired; repair branch used.",
    },
    {
        "claim_id": "HIST-MOULD-022",
        "title": "Condensation after renovation",
        "review_status": "generated_reference",
        "why_useful": "Generated reference with recurrence after building work; its reference path keeps the ventilation allegation disputed and requests neutral causation evidence.",
        "provenance": "generated_reference_not_qualified_review",
        "shared_features": ["renovation", "ventilation allegation", "cause disputed"],
        "final_process": ["scope", "notification", "causation dispute", "neutral assessment", "evidence review"],
        "evidence": ["management correspondence", "thermal imaging report", "humidity readings"],
        "reference_lesson": "The generated reference does not treat the management allegation as proof of tenant causation.",
        "outcome": "Seal defect identified; landlord repair arranged.",
    },
    {
        "claim_id": "HIST-MOULD-009",
        "title": "Mould reported, inspection missing",
        "review_status": "generated_reference",
        "why_useful": "Generated reference with the same evidence gap; its reference path remains at causation until a technical assessment arrives.",
        "provenance": "generated_reference_not_qualified_review",
        "shared_features": ["mould", "landlord notified", "inspection missing"],
        "final_process": ["scope", "urgency", "notification", "technical assessment required"],
        "evidence": ["lease", "notification", "photographs"],
        "reference_lesson": "The generated reference keeps building-envelope testing conditional on an inconclusive first inspection.",
        "outcome": "Awaiting inspection at the recorded stage.",
    },
]


def public_artifact(a: dict[str, Any]) -> dict[str, Any]:
    return {k: v for k, v in a.items() if k not in {"path", "pages", "email", "fact_ids"}}


def public_claim(claim: dict[str, Any]) -> dict[str, Any]:
    return {
        **claim,
        "artifacts": [public_artifact(ARTIFACTS[x]) for x in claim["artifact_ids"]],
    }


def observable_claim_package(claim: dict[str, Any]) -> dict[str, Any]:
    """Return the only claim DTO that a model-backed component may consume.

    Generation provenance, lineage, reference fact IDs, semantic document labels,
    and answer-bearing descriptions deliberately remain outside this boundary.
    """

    artifacts: list[dict[str, Any]] = []
    for artifact_id in claim["artifact_ids"]:
        value = ARTIFACTS[artifact_id]
        item: dict[str, Any] = {
            "artifact_id": artifact_id,
            "filename": value["filename"],
            "media_type": value["media_type"],
            "received_at": value["received_at"],
            "page_count": value["page_count"],
            "sha256": value["sha256"],
        }
        if value["media_type"] == "application/pdf":
            item["extracted_pages"] = [
                {"page": index + 1, "text": text}
                for index, text in enumerate(value["pages"])
            ]
        elif value["media_type"] == "message/rfc822":
            item["parsed_email"] = value["email"]
        else:
            item["binary_source_available"] = True
        artifacts.append(item)
    return {
        "schema": "casepath.observable-claim-package/1.0.0",
        "received_at": claim["received_at"],
        "language": claim["language"],
        "jurisdiction": {"country": "CH", "canton": claim["canton"]},
        "intake_metadata": {"policy_reference": claim["customer"]["policy"]},
        "customer_message": {
            "artifact_id": "message",
            "subject": claim["subject"],
            "body": claim["message"],
        },
        "artifacts": artifacts,
    }
