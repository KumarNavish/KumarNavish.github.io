from __future__ import annotations

from enum import Enum
import os
import re
from typing import Any

from fastapi import Depends, FastAPI, Header, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse, Response
from pydantic import BaseModel, ConfigDict, Field

from . import __version__
from .data import ARTIFACTS, CLAIMS, DEMO_CLAIM, LATER_CLAIM, public_artifact, public_claim
from .canonicalizer import (
    MODEL_MODE_OPENROUTER,
    OPENROUTER_MODEL,
    OPENROUTER_PROVIDER,
    cumulative_usd_cap,
)
from .pipeline_v15 import (
    COMPONENT_VERSIONS,
    DETERMINISTIC_PROFILE,
    ClaimPipeline,
    ORCHESTRATOR,
    PROFILE,
    RELEASE,
)
from .multi_agent import (
    AGENT_RUNTIME_PROFILE,
    AI_AGENT_IDS,
    DETERMINISTIC_GATE_IDS,
    LANGCHAIN_OPENROUTER_VERSION,
    LANGCHAIN_VERSION,
    LANGGRAPH_VERSION,
    MULTI_AGENT_AUTHORITY_MODE,
    MULTI_AGENT_IMPLEMENTATION,
    MULTI_AGENT_SCHEMA_VERSION,
)
from .storage import ActiveRunResetError, Storage
from .langchain_runtime import (
    OPENROUTER_ENDPOINT_TAG,
    OPENROUTER_EXPECTED_UPSTREAM_PROVIDER,
    OPENROUTER_PROVIDER_MAX_IN_FLIGHT,
    openrouter_provider_policy,
    external_tracing_environment_disabled,
)

storage = Storage()
pipeline = ClaimPipeline(storage)
DEFAULT_RELEASE_ID = "casepath-v20-reference-20260811"
FRONTEND_CONTRACT = "focused-claim-workspace-v20"
SESSION_HEADER = "X-CasePath-Session"
SESSION_PATTERN = re.compile(r"^[A-Za-z0-9][A-Za-z0-9._:-]{7,127}$")
COMMIT_PATTERN = re.compile(r"^[0-9a-fA-F]{40}$")

app = FastAPI(
    title="CasePath full-process demo API",
    version=__version__,
    description="Fictional generated-data research demonstration only.",
)
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "https://casepath-swiss-claim-lab.onrender.com",
        "https://casepath-guided-v13-preview.onrender.com",
        "https://casepath-full-lifecycle-v15.onrender.com",
        "http://localhost:4173",
        "http://127.0.0.1:4173",
    ],
    allow_methods=["GET", "POST", "OPTIONS"],
    allow_headers=["Content-Type", SESSION_HEADER],
    allow_credentials=False,
)


class KnowledgeMode(str, Enum):
    current = "current"
    baseline = "baseline"


class ReviewDecision(str, Enum):
    approve_with_edit = "approve_with_edit"
    reject = "reject"


class BuildingEnvelopeMode(str, Enum):
    conditional = "conditional"
    required_now = "required_now"


class RunRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")
    claim_id: str
    knowledge_mode: KnowledgeMode = KnowledgeMode.current


class ReviewRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")
    decision: ReviewDecision = ReviewDecision.approve_with_edit
    building_envelope_mode: BuildingEnvelopeMode = BuildingEnvelopeMode.conditional
    confidence: float = Field(default=.9, ge=0, le=1)
    justification: str = Field(default="", max_length=1500)


def require_session(
    value: str | None = Header(default=None, alias=SESSION_HEADER),
) -> str:
    if value is None:
        raise HTTPException(400, f"{SESSION_HEADER} header is required")
    if not SESSION_PATTERN.fullmatch(value):
        raise HTTPException(
            400,
            f"{SESSION_HEADER} must be an opaque 8-128 character identifier",
        )
    return value


def release_metadata() -> dict[str, Any]:
    render_commit = (os.getenv("RENDER_GIT_COMMIT") or "").strip()
    custom_commit = (os.getenv("CASEPATH_SOURCE_COMMIT") or "").strip()
    render_valid = bool(COMMIT_PATTERN.fullmatch(render_commit))
    custom_valid = bool(COMMIT_PATTERN.fullmatch(custom_commit))
    if render_commit:
        source_commit = render_commit.lower() if render_valid else "unknown"
        identity_source = "render_git_commit" if render_valid else "invalid_render_git_commit"
        identity_aligned = render_valid and (not custom_valid or custom_commit.lower() == source_commit)
    elif custom_valid:
        source_commit = custom_commit.lower()
        identity_source = "casepath_source_commit_fallback"
        identity_aligned = True
    else:
        source_commit = "unknown"
        identity_source = "unavailable"
        identity_aligned = False
    identity_conflict = render_valid and custom_valid and render_commit.lower() != custom_commit.lower()
    model_agentic = pipeline.model_mode == MODEL_MODE_OPENROUTER
    runtime_profile = AGENT_RUNTIME_PROFILE if model_agentic else "deterministic_reference"
    configured_runtime_profile = (
        (os.getenv("CASEPATH_AGENT_RUNTIME_PROFILE") or "").strip() or None
    )
    runtime_profile_aligned = (
        not model_agentic or configured_runtime_profile == AGENT_RUNTIME_PROFILE
    )
    credential_configured = bool((os.getenv("OPENROUTER_API_KEY") or "").strip())
    trace_policy_aligned = external_tracing_environment_disabled()
    return {
        "release_id": os.getenv("CASEPATH_RELEASE_ID") or DEFAULT_RELEASE_ID,
        "release": __version__,
        "pipeline_release": RELEASE,
        "source_commit": source_commit,
        "source_commit_source": identity_source,
        "source_commit_aligned": identity_aligned,
        "source_commit_conflict": identity_conflict,
        "profile": PROFILE if model_agentic else DETERMINISTIC_PROFILE,
        "orchestrator": ORCHESTRATOR,
        "model_mode": pipeline.model_mode,
        "model": OPENROUTER_MODEL if pipeline.model_mode == MODEL_MODE_OPENROUTER else None,
        "configured_model_identity": OPENROUTER_MODEL,
        "model_provider": OPENROUTER_PROVIDER,
        "runtime_profile": runtime_profile,
        "agentic_runtime": {
            "profile": runtime_profile,
            "compiled_profile": AGENT_RUNTIME_PROFILE,
            "configured_profile": configured_runtime_profile,
            "profile_aligned": runtime_profile_aligned,
            "trace_policy_aligned": trace_policy_aligned,
            "execution_mode": (
                "nemotron_multi_agent" if model_agentic else "deterministic_reference"
            ),
            "authority_mode": (
                MULTI_AGENT_AUTHORITY_MODE if model_agentic else "deterministic_reference"
            ),
            "implementation": (
                MULTI_AGENT_IMPLEMENTATION if model_agentic else "deterministic_reference"
            ),
            "schema": MULTI_AGENT_SCHEMA_VERSION if model_agentic else None,
            "framework": {
                "langchain": LANGCHAIN_VERSION,
                "langgraph": LANGGRAPH_VERSION,
                "langchain_openrouter": LANGCHAIN_OPENROUTER_VERSION,
            },
            "required_agent_ids": list(AI_AGENT_IDS) if model_agentic else [],
            "deterministic_gate_ids": list(DETERMINISTIC_GATE_IDS) if model_agentic else [],
            "safety": {
                "deterministic_contract_authority": True,
                "external_tracing": False,
                "prompt_storage": False,
                "raw_output_storage": False,
                "model_fallback": False,
                "automatic_inference_retry": False,
                "provider_max_in_flight": OPENROUTER_PROVIDER_MAX_IN_FLIGHT,
                "ledger_persistence": "ephemeral_instance",
                "budget_scope": "instance_lifetime",
                "cache_scope": "instance_lifetime",
                "external_key_hard_limit_guard": "configured",
                "credential_configured": credential_configured,
                "provider_routing": {
                    "endpoint_tag": OPENROUTER_ENDPOINT_TAG,
                    "expected_upstream_provider": OPENROUTER_EXPECTED_UPSTREAM_PROVIDER,
                    **{
                        key: value
                        for key, value in openrouter_provider_policy().items()
                        if key != "only"
                    },
                },
            },
        },
        "components": COMPONENT_VERSIONS,
        "session_isolation": {
            "enabled": True,
            "header": SESSION_HEADER,
            "format": "8-128 characters; ASCII letters, digits, dot, underscore, colon, or hyphen",
            "state_scope": "caller_session",
            "model_ledger_scope": "global",
            "session_reset_scope": "caller_session_only",
        },
    }


@app.get("/healthz")
def healthz():
    return {
        "status": "ok",
        **release_metadata(),
        "product": "CasePath full-process lifecycle demo",
        "generated_data_only": True,
        "real_claims_approved": False,
    }


@app.get("/readyz")
def readyz():
    metadata = release_metadata()
    model_agentic = pipeline.model_mode == MODEL_MODE_OPENROUTER
    credential_configured = metadata["agentic_runtime"]["safety"][
        "credential_configured"
    ]
    ready = (
        metadata["agentic_runtime"]["profile_aligned"]
        and metadata["agentic_runtime"]["trace_policy_aligned"]
        and (credential_configured or not model_agentic)
    )
    payload = {
        "status": "ready" if ready else "not_ready",
        "database": "sqlite-demo",
        "claims": len(CLAIMS),
        "artifacts": len(ARTIFACTS),
        "active_playbook": "mould-playbook-v3",
        "model_budget": {
            "cumulative_usd_cap": cumulative_usd_cap(),
            "budget_scope": "instance_lifetime",
            "ledger_persistence": "ephemeral_instance",
            "external_key_hard_limit_guard": "configured",
            "credential_configured": credential_configured,
            **storage.model_call_summary(),
        },
        "agentic_runtime": metadata["agentic_runtime"],
    }
    return payload if ready else JSONResponse(payload, status_code=503)


@app.get("/deployment-health")
def deployment_health():
    return {
        "status": "ok",
        **release_metadata(),
        "frontend_contract": FRONTEND_CONTRACT,
        "api_release": __version__,
        "flagship_claim": DEMO_CLAIM["claim_id"],
        "later_claim": LATER_CLAIM["claim_id"],
        "knowledge_version": "mould-playbook-v3",
    }


@app.get("/api/demo")
def demo(session_id: str = Depends(require_session)):
    try:
        knowledge_value = pipeline.knowledge(session_id=session_id)
    except ValueError:
        raise HTTPException(409, "knowledge integrity boundary") from None
    return {
        **release_metadata(),
        "demo_claim_id": DEMO_CLAIM["claim_id"],
        "later_claim_id": LATER_CLAIM["claim_id"],
        "claim": public_claim(DEMO_CLAIM),
        "knowledge": knowledge_value,
    }


@app.get("/api/claims")
def claims():
    return {"items": [public_claim(DEMO_CLAIM), public_claim(LATER_CLAIM)]}


@app.get("/api/claims/{claim_id}")
def claim(claim_id: str):
    if claim_id not in CLAIMS:
        raise HTTPException(404, "claim not found")
    return public_claim(CLAIMS[claim_id])


@app.get("/api/artifacts/{artifact_id}")
def raw_artifact(artifact_id: str):
    if artifact_id not in ARTIFACTS:
        raise HTTPException(404, "artifact not found")
    artifact = ARTIFACTS[artifact_id]
    return Response(
        artifact["path"].read_bytes(),
        media_type=artifact["media_type"],
        headers={
            "Content-Disposition": f'inline; filename="{artifact["filename"]}"',
            "Cache-Control": "public, max-age=3600",
        },
    )


@app.get("/api/artifacts/{artifact_id}/pages/{page_number}")
def artifact_page(artifact_id: str, page_number: int):
    if artifact_id not in ARTIFACTS:
        raise HTTPException(404, "artifact not found")
    artifact = ARTIFACTS[artifact_id]
    if artifact["media_type"] != "application/pdf":
        raise HTTPException(409, "artifact is not a PDF")
    if page_number < 1 or page_number > artifact["page_count"]:
        raise HTTPException(404, "page not found")
    page_path = artifact["path"].parent / "pages" / artifact_id / f"page-{page_number}.png"
    if not page_path.exists():
        raise HTTPException(404, "rendered page not found")
    return Response(page_path.read_bytes(), media_type="image/png", headers={"Cache-Control": "public, max-age=3600"})


@app.get("/api/artifacts/{artifact_id}/extraction")
def artifact_extraction(artifact_id: str):
    if artifact_id not in ARTIFACTS:
        raise HTTPException(404, "artifact not found")
    artifact = ARTIFACTS[artifact_id]
    payload: dict[str, Any] = public_artifact(artifact)
    if artifact["media_type"] == "application/pdf":
        payload["pages"] = artifact["pages"]
    elif artifact["media_type"] == "message/rfc822":
        payload["email"] = artifact["email"]
    else:
        payload["image_note"] = "The source image is available directly."
    return payload


@app.post("/api/runs", status_code=202)
def create_run(req: RunRequest, session_id: str = Depends(require_session)):
    try:
        run_id = pipeline.create(
            req.claim_id,
            knowledge_mode=req.knowledge_mode.value,
            session_id=session_id,
        )
    except KeyError:
        raise HTTPException(404, "claim not found")
    return {
        "run_id": run_id,
        "status": "queued",
        "release": RELEASE,
        "profile": (
            PROFILE
            if pipeline.model_mode == MODEL_MODE_OPENROUTER
            else DETERMINISTIC_PROFILE
        ),
        "knowledge_mode": req.knowledge_mode.value,
        "model_mode": pipeline.model_mode,
    }


@app.get("/api/runs/{run_id}")
def get_run(run_id: str, session_id: str = Depends(require_session)):
    run = storage.get_run(run_id, session_id=session_id)
    if not run:
        raise HTTPException(404, "run not found")
    return run


@app.post("/api/runs/{run_id}/review")
def review(run_id: str, req: ReviewRequest, session_id: str = Depends(require_session)):
    if not storage.get_run(run_id, session_id=session_id):
        raise HTTPException(404, "run not found")
    try:
        return pipeline.review(
            run_id,
            req.model_dump(mode="json"),
            session_id=session_id,
        )
    except ValueError as exc:
        raise HTTPException(409, str(exc))


@app.get("/api/knowledge")
def knowledge(session_id: str = Depends(require_session)):
    try:
        return pipeline.knowledge(session_id=session_id)
    except ValueError:
        raise HTTPException(409, "knowledge integrity boundary") from None


@app.get("/api/learning-proof")
def learning_proof(
    baseline_run_id: str = Query(min_length=1),
    later_run_id: str = Query(min_length=1),
    session_id: str = Depends(require_session),
):
    try:
        return pipeline.learning_proof(
            baseline_run_id,
            later_run_id,
            session_id=session_id,
        )
    except ValueError as exc:
        raise HTTPException(409, str(exc))


@app.post("/api/demo/reset")
def reset_demo(session_id: str = Depends(require_session)):
    ledger_records_before = storage.model_call_summary()["records"]
    try:
        removed = storage.reset(session_id=session_id)
    except ActiveRunResetError:
        raise HTTPException(
            409,
            "Cannot reset demo state while this session has a queued or running analysis",
        ) from None
    return {
        "status": "reset",
        "session_scope": "caller_only",
        "removed": removed,
        "active_playbook": pipeline.knowledge(session_id=session_id)["active_playbook"]["version"],
        "model_ledger_scope": "global",
        "model_ledger_preserved": storage.model_call_summary()["records"] == ledger_records_before,
        "model_ledger_records": ledger_records_before,
    }


@app.get("/api/model-ledger")
def model_ledger():
    return {
        "scope": "global_budget_ledger",
        "budget_scope": "instance_lifetime",
        "ledger_persistence": "ephemeral_instance",
        "summary": storage.model_call_summary(),
        "items": storage.sanitized_model_ledger(),
    }
