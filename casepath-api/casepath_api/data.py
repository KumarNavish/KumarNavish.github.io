from __future__ import annotations

from dataclasses import dataclass
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
        "Original generated RFC 822 email sent by the tenant on 15 July 2026.",
    ),
    artifact(
        "art_management_reply", "management-reply.eml", "Management reply", "email", "2026-08-01T09:03:00Z",
        "landlord_response", ["fact_ventilation_allegation", "fact_no_inspection"],
        "Original generated RFC 822 reply attributing the marks to ventilation without arranging an inspection.",
    ),
    artifact(
        "art_photo", "bedroom-mould-2026-07-27.jpg", "Bedroom photograph", "image", "2026-08-01T09:03:00Z",
        "dated_photograph", ["fact_visible_mould", "fact_recurrence"],
        "Generated source photograph supplied by the tenant, dated 27 July 2026.",
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
        "art_later_email", "later-claim-email.eml", "Customer email", "email", "2026-08-14T09:46:00Z",
        "claim_message", ["later_fact_recurrence", "later_fact_ventilation_allegation", "later_fact_no_inspection"],
        "Original generated email reporting condensation after window replacement.",
    ),
    artifact(
        "art_later_photo", "later-window-condensation-2026-08-12.jpg", "Window-corner photograph", "image", "2026-08-14T09:46:00Z",
        "dated_photograph", ["later_fact_visible_spots", "later_fact_recurrence"],
        "Generated source photograph of condensation and spotting around the replaced window.",
    ),
    artifact(
        "art_window_notice", "window-replacement-notice.pdf", "Window replacement notice", "pdf", "2026-08-14T09:46:00Z",
        "repair_record", ["later_fact_recent_window_work", "later_fact_no_inspection"],
        "Generated notice confirming recent window replacement but no post-installation moisture assessment.",
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
    "received_at": "2026-08-14T09:46:00Z",
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
        "role": "Frames the landlord's duty to make the premises available and maintain them in a condition fit for the agreed use.",
        "approved": False,
    },
    {
        "source_id": "fedlex-or-257g",
        "title": "Swiss Code of Obligations, Art. 257g",
        "url": "https://www.fedlex.admin.ch/eli/cc/27/317_321_377/en",
        "role": "Makes written notice of a non-minor defect a relevant handling fact.",
        "approved": False,
    },
    {
        "source_id": "fedlex-or-259a",
        "title": "Swiss Code of Obligations, Art. 259a et seq.",
        "url": "https://www.fedlex.admin.ch/eli/cc/27/317_321_377/en",
        "role": "Frames potential remedies when a defect is not attributable to the tenant and is not minor maintenance.",
        "approved": False,
    },
    {
        "source_id": "bwo-conciliation",
        "title": "Federal Housing Office - tenancy conciliation",
        "url": "https://www.bwo.admin.ch/de/schlichtungsverfahren",
        "role": "Explains the institutional conciliation route for residential tenancy disputes.",
        "approved": False,
    },
]

HISTORICAL_CASES = [
    {
        "claim_id": "HIST-MOULD-014",
        "title": "Recurring mould at an external wall",
        "review_status": "expert_reviewed",
        "why_useful": "Same disputed-causation branch. An independent inspection identified a facade thermal bridge before responsibility was assessed.",
        "shared_features": ["recurring mould", "cause disputed", "technical assessment"],
        "final_process": ["scope", "notification", "independent inspection", "building defect established", "repair request"],
        "evidence": ["notification email", "dated photographs", "independent inspection report"],
        "expert_correction": "The first handler requested a ventilation diary immediately. Review changed it to conditional because the inspection first established a structural defect.",
        "outcome": "Facade insulation repaired; repair branch used.",
    },
    {
        "claim_id": "HIST-MOULD-022",
        "title": "Condensation after renovation",
        "review_status": "expert_reviewed",
        "why_useful": "Similar recurrence after building work. Expert review kept the ventilation allegation as disputed and required neutral causation evidence.",
        "shared_features": ["renovation", "ventilation allegation", "cause disputed"],
        "final_process": ["scope", "notification", "causation dispute", "neutral assessment", "evidence review"],
        "evidence": ["management correspondence", "thermal imaging report", "humidity readings"],
        "expert_correction": "The management allegation was not treated as proof of tenant causation.",
        "outcome": "Seal defect identified; landlord repair arranged.",
    },
    {
        "claim_id": "HIST-MOULD-009",
        "title": "Mould reported, inspection missing",
        "review_status": "reviewed",
        "why_useful": "Same evidence gap. The claim could not move beyond causation until a technical assessment arrived.",
        "shared_features": ["mould", "landlord notified", "inspection missing"],
        "final_process": ["scope", "urgency", "notification", "technical assessment required"],
        "evidence": ["lease", "notification", "photographs"],
        "expert_correction": "Building-envelope testing remained conditional on an inconclusive first inspection.",
        "outcome": "Awaiting inspection at the recorded stage.",
    },
]


def public_artifact(a: dict[str, Any]) -> dict[str, Any]:
    return {k: v for k, v in a.items() if k not in {"path", "pages", "email"}}


def public_claim(claim: dict[str, Any]) -> dict[str, Any]:
    return {
        **claim,
        "artifacts": [public_artifact(ARTIFACTS[x]) for x in claim["artifact_ids"]],
    }
