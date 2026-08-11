from __future__ import annotations

from dataclasses import dataclass
from hashlib import sha256
import json
import math
import os
import re
import threading
from time import perf_counter, sleep
from typing import Any, Callable
from urllib.error import HTTPError, URLError
from urllib.parse import urlencode
from urllib.request import Request, urlopen

from langchain_core.messages import HumanMessage, SystemMessage
from pydantic import BaseModel

from .langchain_runtime import (
    OPENROUTER_EXPECTED_UPSTREAM_PROVIDER,
    OPENROUTER_REASONING,
    OpenRouterProtocolError,
    OpenRouterUpstreamRejectionError,
    assert_external_tracing_disabled,
    openrouter_provider_policy,
    sanitize_provider_provenance,
    structured_nemotron_runnable,
)
from .storage import Storage
from .validation import ContractValidationError, validate_claim_state, validate_source_grounding


MODEL_MODE_REFERENCE = "deterministic_reference"
MODEL_MODE_OPENROUTER = "openrouter_nemotron"
MODEL_MODES = {MODEL_MODE_REFERENCE, MODEL_MODE_OPENROUTER}
OPENROUTER_MODEL = "nvidia/nemotron-3-ultra-550b-a55b"
OPENROUTER_CANONICAL_MODEL = "nvidia/nemotron-3-ultra-550b-a55b-20260604"
OPENROUTER_ACCEPTED_RESPONSE_MODELS = {OPENROUTER_MODEL, OPENROUTER_CANONICAL_MODEL}
OPENROUTER_PROVIDER = "openrouter"
OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions"
OPENROUTER_GENERATION_URL = "https://openrouter.ai/api/v1/generation"
CANONICALIZER_VERSION = "1.6.5"
PROMPT_VERSION = "canonical-facts/1.5.1"
SCHEMA_VERSION = "casepath.canonical-facts/1.4.0"
NORMALIZED_VALUES = [
    "absent",
    "building",
    "mixed",
    "not_notified",
    "not_supported",
    "not_urgent",
    "notified",
    "present",
    "supported",
    "supported_in_scope",
    "supported_out_of_scope",
    "tenant_use",
    "unresolved",
    "unverified",
    "urgent",
]
PROVIDER_FACT_FIELDS = {
    "fact_id",
    "label",
    "state",
    "source_ref_ids",
    "confidence",
    "normalized_value",
}
MODEL_SINGLE_FLIGHT_LOCK = threading.RLock()

INPUT_USD_PER_MILLION_TOKENS = 0.625
OUTPUT_USD_PER_MILLION_TOKENS = 3.60
MAX_OUTPUT_TOKENS = 8_192
DEFAULT_CUMULATIVE_USD_CAP = 25.0
ABSOLUTE_CUMULATIVE_USD_CAP = 400.0
GENERATION_METADATA_POLL_ATTEMPTS = 8
GENERATION_METADATA_POLL_INTERVAL_SECONDS = 0.5
GENERATION_METADATA_POLL_MAX_INTERVAL_SECONDS = 8.0
GENERATION_METADATA_TIMEOUT_SECONDS = 10.0


class CanonicalizerError(RuntimeError):
    def __init__(self, message: str, *, safe_context: dict[str, Any] | None = None):
        super().__init__(message)
        self.safe_context = dict(safe_context or {})


class ModelConfigurationError(CanonicalizerError):
    pass


class ModelCostGuardError(CanonicalizerError):
    pass


class ModelResponseError(CanonicalizerError):
    def __init__(
        self,
        message: str,
        *,
        fact_id: str | None = None,
        invariant: str | None = None,
        diagnostics: dict[str, Any] | None = None,
        safe_context: dict[str, Any] | None = None,
    ):
        super().__init__(message, safe_context=safe_context)
        self.fact_id = fact_id
        self.invariant = invariant
        self.diagnostics = diagnostics


def _fact_response_error(fact_id: str, invariant: str) -> ModelResponseError:
    """Create a diagnostic that contains no provider-authored values."""

    return ModelResponseError(
        f"{fact_id}: {invariant} invariant failed",
        fact_id=fact_id,
        invariant=invariant,
    )


Transport = Callable[[str, dict[str, str], dict[str, Any], float], dict[str, Any]]
MetadataTransport = Callable[[str, dict[str, str], float], dict[str, Any]]
StructuredInvoker = Callable[
    [dict[str, Any], str, str, str, str, int],
    dict[str, Any],
]


class _GenerationMetadataPending(RuntimeError):
    pass


def configured_model_mode() -> str:
    mode = os.getenv("CASEPATH_MODEL_MODE", MODEL_MODE_REFERENCE).strip() or MODEL_MODE_REFERENCE
    if mode not in MODEL_MODES:
        raise ModelConfigurationError(f"Unsupported CASEPATH_MODEL_MODE {mode!r}")
    return mode


def cumulative_usd_cap() -> float:
    raw = os.getenv("CASEPATH_MODEL_CUMULATIVE_USD_CAP")
    if raw is None or not raw.strip():
        return DEFAULT_CUMULATIVE_USD_CAP
    try:
        requested = float(raw)
    except ValueError as exc:
        raise ModelConfigurationError("CASEPATH_MODEL_CUMULATIVE_USD_CAP must be numeric") from exc
    if not math.isfinite(requested) or requested <= 0:
        raise ModelConfigurationError(
            "CASEPATH_MODEL_CUMULATIVE_USD_CAP must be finite and positive"
        )
    return min(requested, DEFAULT_CUMULATIVE_USD_CAP, ABSOLUTE_CUMULATIVE_USD_CAP)


def _default_structured_invoker(
    schema: dict[str, Any],
    system_prompt: str,
    user_prompt: str,
    api_key: str,
    orchestration_id: str,
    max_tokens: int,
) -> dict[str, Any]:
    """Invoke canonical facts through the shared non-retrying LangChain adapter."""

    runnable = structured_nemotron_runnable(
        schema={"title": "casepath_canonical_facts", **schema},
        api_key=api_key,
        orchestration_id=orchestration_id,
        max_tokens=max_tokens,
    )
    assert_external_tracing_disabled()
    protocol_invariant: str | None = None
    protocol_safe_context: dict[str, Any] = {}
    try:
        envelope = runnable.invoke(
            [SystemMessage(content=system_prompt), HumanMessage(content=user_prompt)],
            config={"callbacks": []},
        )
    except (OpenRouterProtocolError, OpenRouterUpstreamRejectionError) as exc:
        protocol_invariant = exc.invariant
        if isinstance(exc, OpenRouterUpstreamRejectionError):
            protocol_safe_context = exc.safe_context
    if protocol_invariant is not None:
        raise ModelResponseError(
            f"{protocol_invariant} invariant failed",
            invariant=protocol_invariant,
            safe_context=protocol_safe_context,
        )
    if not isinstance(envelope, dict):
        raise ModelResponseError("OpenRouter omitted the LangChain response envelope")
    parsed = envelope.get("parsed")
    if isinstance(parsed, BaseModel):
        parsed = parsed.model_dump(mode="json")
    raw = envelope.get("raw")
    response_metadata = getattr(raw, "response_metadata", None)
    usage_metadata = getattr(raw, "usage_metadata", None)
    if not isinstance(response_metadata, dict):
        response_metadata = {}
    if not isinstance(usage_metadata, dict):
        usage_metadata = {}
    response_id = response_metadata.get("id")
    response_model = response_metadata.get("model_name") or response_metadata.get("model")
    usage_value = response_metadata.get("usage")
    usage_value = dict(usage_value) if isinstance(usage_value, dict) else {}
    prompt_tokens = usage_value.get("prompt_tokens", usage_metadata.get("input_tokens"))
    completion_tokens = usage_value.get("completion_tokens", usage_metadata.get("output_tokens"))
    total_tokens = usage_value.get("total_tokens", usage_metadata.get("total_tokens"))
    cost = usage_value.get("cost", response_metadata.get("cost"))
    usage = {
        "prompt_tokens": prompt_tokens,
        "completion_tokens": completion_tokens,
        "total_tokens": total_tokens,
        "cost": cost,
    }
    return {
        "id": response_id,
        "model": response_model,
        "provider": response_metadata.get("provider_name"),
        "choices": [
            {
                "finish_reason": response_metadata.get("finish_reason"),
                "message": {
                    "role": "assistant",
                    "content": parsed if isinstance(parsed, dict) else None,
                },
            }
        ],
        "usage": usage,
        "openrouter_metadata": None,
        "_structured_parsing_error": envelope.get("parsing_error") is not None
        or not isinstance(parsed, dict),
    }


def _default_metadata_transport(url: str, headers: dict[str, str], timeout: float) -> dict[str, Any]:
    request = Request(url, headers=headers, method="GET")
    try:
        with urlopen(request, timeout=timeout) as response:  # noqa: S310 - fixed HTTPS endpoint
            return json.loads(response.read().decode("utf-8"))
    except HTTPError as exc:
        if exc.code == 404:
            raise _GenerationMetadataPending from exc
        raise ModelResponseError("OpenRouter generation-metadata request failed") from exc
    except URLError as exc:
        raise ModelResponseError("OpenRouter generation-metadata request failed") from exc


def canonical_facts_schema(source_reference_ids: list[str]) -> dict[str, Any]:
    source_ref_ids: dict[str, Any] = {
        "type": "array",
        "items": {"type": "string"},
        "uniqueItems": True,
    }
    if source_reference_ids:
        source_ref_ids["items"]["enum"] = source_reference_ids
    else:
        source_ref_ids["maxItems"] = 0
    fact = {
        "type": "object",
        "properties": {
            "fact_id": {"type": "string", "minLength": 1},
            "label": {"type": "string", "minLength": 1},
            "state": {"type": "string", "enum": ["known", "unknown", "conflicting", "not_applicable"]},
            "source_ref_ids": source_ref_ids,
            "confidence": {"type": "number", "minimum": 0, "maximum": 1},
            "normalized_value": {
                "anyOf": [
                    {"type": "string", "enum": NORMALIZED_VALUES},
                    {"type": "null"},
                ]
            },
        },
        "required": sorted(PROVIDER_FACT_FIELDS),
        "additionalProperties": False,
    }
    return {
        "type": "object",
        "properties": {"facts": {"type": "array", "minItems": 1, "items": fact}},
        "required": ["facts"],
        "additionalProperties": False,
    }


def _input_token_estimate(value: str) -> int:
    # Three bytes per token intentionally over-reserves relative to the common
    # four-character heuristic so the local preflight guard remains conservative.
    return max(1, math.ceil(len(value.encode("utf-8")) / 3))


def _estimated_cost(input_tokens: int) -> float:
    return round(
        input_tokens * INPUT_USD_PER_MILLION_TOKENS / 1_000_000
        + MAX_OUTPUT_TOKENS * OUTPUT_USD_PER_MILLION_TOKENS / 1_000_000,
        8,
    )


def _cache_key(package: dict[str, Any]) -> str:
    value = {
        "model": OPENROUTER_MODEL,
        "canonicalizer_version": CANONICALIZER_VERSION,
        "prompt_version": PROMPT_VERSION,
        "schema_version": SCHEMA_VERSION,
        "package": package,
    }
    return sha256(json.dumps(value, sort_keys=True, ensure_ascii=False, separators=(",", ":")).encode("utf-8")).hexdigest()


def _response_content(response: dict[str, Any]) -> dict[str, Any]:
    if response.get("_structured_parsing_error") is True:
        raise ModelResponseError(
            "provider_native_schema invariant failed",
            invariant="provider_native_schema",
        )
    try:
        content = response["choices"][0]["message"]["content"]
    except (KeyError, IndexError, TypeError) as exc:
        raise ModelResponseError("OpenRouter response omitted structured message content") from exc
    if isinstance(content, dict):
        value = content
    elif isinstance(content, str):
        try:
            value = json.loads(content)
        except json.JSONDecodeError as exc:
            raise ModelResponseError("OpenRouter returned invalid canonical-facts JSON") from exc
    else:
        raise ModelResponseError("OpenRouter returned an unsupported message content type")
    if not isinstance(value, dict):
        raise ModelResponseError("Canonical-facts response must be an object")
    return value


def _partial_response_identity(response: Any) -> dict[str, Any]:
    """Extract only bounded identity fields without deciding their admissibility."""

    response = response if isinstance(response, dict) else {}
    choices = response.get("choices")
    first_choice = choices[0] if isinstance(choices, list) and choices and isinstance(choices[0], dict) else {}
    sanitized, violation = sanitize_provider_provenance(
        response_id=response.get("id"),
        response_model=response.get("model"),
        upstream_provider=response.get("provider"),
        finish_reason=first_choice.get("finish_reason"),
    )
    return {
        "response_id": sanitized["response_id"],
        "response_model": sanitized["response_model"],
        "response_finish_reason": sanitized["finish_reason"],
        "upstream_provider": sanitized["upstream_provider"],
        "provenance_violation": violation,
    }


def _validate_response_identity(identity: dict[str, Any]) -> None:
    if identity.get("provenance_violation") is not None:
        raise ModelResponseError(
            "invalid_provenance invariant failed",
            invariant="invalid_provenance",
            diagnostics=identity["provenance_violation"],
            safe_context=identity["provenance_violation"],
        )
    if identity.get("response_id") is None or identity.get("response_model") is None:
        raise ModelResponseError(
            "response_identity invariant failed",
            invariant="response_identity",
        )
    if identity["response_model"] not in OPENROUTER_ACCEPTED_RESPONSE_MODELS:
        raise ModelResponseError(
            "response_model invariant failed",
            invariant="response_model",
        )


def _synchronous_usage_ledger_patch(
    response: dict[str, Any],
    *,
    identity: dict[str, Any],
    latency_ms: float,
) -> dict[str, Any] | None:
    """Return complete synchronous billing evidence, or request metadata fallback."""

    usage = response.get("usage")
    if not isinstance(usage, dict):
        return None
    cost = usage.get("cost")
    prompt_tokens = usage.get("prompt_tokens")
    completion_tokens = usage.get("completion_tokens")
    total_tokens = usage.get("total_tokens")
    upstream_provider = identity.get("upstream_provider")
    if (
        not isinstance(cost, (int, float))
        or isinstance(cost, bool)
        or float(cost) <= 0
        or not math.isfinite(float(cost))
        or not isinstance(prompt_tokens, int)
        or isinstance(prompt_tokens, bool)
        or prompt_tokens <= 0
        or not isinstance(completion_tokens, int)
        or isinstance(completion_tokens, bool)
        or completion_tokens <= 0
        or not isinstance(total_tokens, int)
        or isinstance(total_tokens, bool)
        or total_tokens < prompt_tokens + completion_tokens
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


def _generation_metadata_ledger_patch(
    *,
    identity: dict[str, Any],
    headers: dict[str, str],
    metadata_transport: MetadataTransport,
    metadata_sleep: Callable[[float], None],
    timeout_seconds: float,
    poll_attempts: int,
    poll_interval_seconds: float,
    latency_ms: float,
) -> dict[str, Any]:
    """Resolve billing evidence for one existing generation without retrying inference."""

    metadata_url = f"{OPENROUTER_GENERATION_URL}?{urlencode({'id': identity['response_id']})}"
    metadata_headers = {
        "Authorization": headers["Authorization"],
        "Accept": "application/json",
    }
    started = perf_counter()
    for attempt in range(1, poll_attempts + 1):
        try:
            envelope = metadata_transport(metadata_url, metadata_headers, timeout_seconds)
        except _GenerationMetadataPending:
            envelope = None
        data = envelope.get("data") if isinstance(envelope, dict) else None
        if isinstance(data, dict):
            required = {
                "id",
                "model",
                "provider_name",
                "native_tokens_prompt",
                "native_tokens_completion",
                "total_cost",
                "usage",
                "finish_reason",
            }
            # The generation row is eventually materialized. During that window
            # OpenRouter can expose the full key set with nullable fields still
            # unset; treat that shape like a 404/partial row and keep polling.
            if required.issubset(data) and all(
                data[key] is not None for key in required
            ):
                prompt_tokens = data["native_tokens_prompt"]
                completion_tokens = data["native_tokens_completion"]
                total_cost = data["total_cost"]
                usage_cost = data["usage"]
                provenance, provenance_violation = sanitize_provider_provenance(
                    response_id=data["id"],
                    response_model=data["model"],
                    upstream_provider=data["provider_name"],
                    finish_reason=data["finish_reason"],
                )
                provider_name = provenance["upstream_provider"]
                finish_reason = provenance["finish_reason"]
                valid_usage = (
                    isinstance(prompt_tokens, int)
                    and not isinstance(prompt_tokens, bool)
                    and prompt_tokens > 0
                    and isinstance(completion_tokens, int)
                    and not isinstance(completion_tokens, bool)
                    and completion_tokens > 0
                    and isinstance(total_cost, (int, float))
                    and not isinstance(total_cost, bool)
                    and float(total_cost) > 0
                    and math.isfinite(float(total_cost))
                    and isinstance(usage_cost, (int, float))
                    and not isinstance(usage_cost, bool)
                    and float(usage_cost) > 0
                    and math.isfinite(float(usage_cost))
                    and math.isclose(float(total_cost), float(usage_cost), rel_tol=1e-6, abs_tol=1e-9)
                )
                if not valid_usage:
                    raise ModelResponseError(
                        "generation_metadata_usage invariant failed",
                        invariant="generation_metadata_usage",
                        safe_context={
                            "latency_ms": latency_ms,
                            "metadata_latency_ms": round(
                                (perf_counter() - started) * 1000, 3
                            ),
                            "metadata_poll_count": attempt,
                        },
                    )
                total_tokens = prompt_tokens + completion_tokens
                billing_patch = {
                    "latency_ms": latency_ms,
                    "metadata_latency_ms": round((perf_counter() - started) * 1000, 3),
                    "metadata_poll_count": attempt,
                    "prompt_tokens": prompt_tokens,
                    "completion_tokens": completion_tokens,
                    "total_tokens": total_tokens,
                    "actual_cost_usd": float(total_cost),
                    "usage_source": "generation_metadata",
                    "response_id": identity["response_id"],
                    **(
                        {"response_model": identity["response_model"]}
                        if identity.get("response_model") is not None
                        else {}
                    ),
                }
                if provenance_violation is not None:
                    raise ModelResponseError(
                        "invalid_provenance invariant failed",
                        invariant="invalid_provenance",
                        diagnostics=provenance_violation,
                        safe_context={**billing_patch, **provenance_violation},
                    )
                if provenance["response_id"] != identity["response_id"]:
                    raise ModelResponseError(
                        "generation_metadata_identity invariant failed",
                        invariant="generation_metadata_identity",
                    )
                if provider_name is None or finish_reason is None:
                    raise ModelResponseError(
                        "invalid_provenance invariant failed",
                        invariant="invalid_provenance",
                    )
                return {
                    **billing_patch,
                    "generation_model": provenance["response_model"],
                    "upstream_provider": provider_name,
                    "finish_reason": finish_reason,
                }
        if attempt < poll_attempts:
            metadata_sleep(
                min(
                    poll_interval_seconds * (2 ** (attempt - 1)),
                    GENERATION_METADATA_POLL_MAX_INTERVAL_SECONDS,
                )
            )
    raise ModelResponseError(
        "generation_metadata_completeness invariant failed",
        invariant="generation_metadata_completeness",
        safe_context={
            "latency_ms": latency_ms,
            "metadata_latency_ms": round((perf_counter() - started) * 1000, 3),
            "metadata_poll_count": poll_attempts,
        },
    )


def validate_exact_source_excerpts(package: dict[str, Any], facts: list[dict[str, Any]]) -> None:
    """Fail closed unless every cited excerpt occurs on the exact textual source page."""
    try:
        validate_source_grounding({"facts": facts}, observable_package=package)
    except ContractValidationError as exc:
        raise ModelResponseError(str(exc)) from exc


def source_reference_id(ref: dict[str, Any]) -> str:
    """Return a stable identifier for an exact observable text reference."""

    try:
        value = {
            "artifact_id": ref["artifact_id"],
            "page": ref["page"],
            "excerpt": ref["excerpt"],
        }
    except (KeyError, TypeError) as exc:
        raise ModelConfigurationError("Text-reference candidates require artifact_id, page, and excerpt") from exc
    if (
        not isinstance(value["artifact_id"], str)
        or not value["artifact_id"].strip()
        or not isinstance(value["page"], int)
        or isinstance(value["page"], bool)
        or value["page"] < 1
        or not isinstance(value["excerpt"], str)
        or not value["excerpt"].strip()
    ):
        raise ModelConfigurationError("Text-reference candidates require a nonempty source, page, and excerpt")
    digest = sha256(
        json.dumps(value, sort_keys=True, ensure_ascii=False, separators=(",", ":")).encode("utf-8")
    ).hexdigest()
    return f"src_{digest[:24]}"


def _bounded_passages(text: str) -> list[str]:
    """Split one observable field into bounded, source-owned passage candidates."""

    values: set[str] = set()
    lines = [" ".join(line.split()) for line in text.splitlines() if line.strip()]
    for line in lines:
        if not line:
            continue
        values.add(line)
        values.update(
            part.strip()
            for part in re.split(r"(?<=[.!?])\s+|\s*[;]\s*", line)
            if part.strip()
        )
    # Adjacent lines are exposed only for short structural labels (for example
    # ``Tenant\nAlex Morgan``). Blanket windows and whole-document compaction add
    # hundreds of redundant candidates and make the bounded provider task noisy.
    values.update(
        f"{lines[index]} {lines[index + 1]}"
        for index in range(len(lines) - 1)
        if len(lines[index]) <= 40
    )
    return sorted(values, key=lambda value: (len(value), value))


def observable_source_reference_registry(package: dict[str, Any]) -> list[dict[str, Any]]:
    """Build text candidates solely from the model-observable package."""

    candidates: list[dict[str, Any]] = []
    message = package.get("customer_message")
    if isinstance(message, dict):
        artifact_id = message.get("artifact_id", "message")
        for key in ("subject", "body"):
            value = message.get(key)
            if isinstance(value, str):
                candidates.extend(
                    {"artifact_id": artifact_id, "page": 1, "excerpt": passage}
                    for passage in _bounded_passages(value)
                )
    for artifact in package.get("artifacts", []):
        if not isinstance(artifact, dict) or not isinstance(artifact.get("artifact_id"), str):
            continue
        artifact_id = artifact["artifact_id"]
        for page in artifact.get("extracted_pages", []):
            if not isinstance(page, dict) or not isinstance(page.get("page"), int):
                continue
            text = page.get("text")
            if isinstance(text, str):
                candidates.extend(
                    {"artifact_id": artifact_id, "page": page["page"], "excerpt": passage}
                    for passage in _bounded_passages(text)
                )
        email = artifact.get("parsed_email")
        if isinstance(email, dict):
            for value in email.values():
                if isinstance(value, str):
                    candidates.extend(
                        {"artifact_id": artifact_id, "page": 1, "excerpt": passage}
                        for passage in _bounded_passages(value)
                    )

    registry_by_id: dict[str, dict[str, Any]] = {}
    for ref in candidates:
        ref_id = source_reference_id(ref)
        candidate = {"source_ref_id": ref_id, **ref}
        existing = registry_by_id.get(ref_id)
        if existing is not None and existing != candidate:
            raise ModelConfigurationError("Text-reference identifier collision")
        registry_by_id[ref_id] = candidate

    registry = [registry_by_id[ref_id] for ref_id in sorted(registry_by_id)]
    grounded_refs = [
        {
            "artifact_id": item["artifact_id"],
            "locator_kind": "text_quote",
            "page": item["page"],
            "excerpt": item["excerpt"],
            "agent": "CasePath Source Registry",
        }
        for item in registry
    ]
    if grounded_refs:
        try:
            validate_source_grounding(
                {"facts": [{"source_refs": grounded_refs}]},
                observable_package=package,
            )
        except ContractValidationError as exc:
            raise ModelConfigurationError("Source-reference registry contains ungrounded text") from exc
    return registry


def resolve_observable_source_reference_id(
    ref: dict[str, Any],
    registry: list[dict[str, Any]],
) -> str:
    """Resolve a private exact quote to its smallest observable source passage."""

    expected = " ".join(str(ref.get("excerpt", "")).split()).casefold()
    matches = [
        item
        for item in registry
        if item.get("artifact_id") == ref.get("artifact_id")
        and item.get("page") == ref.get("page")
        and expected
        and expected in " ".join(str(item.get("excerpt", "")).split()).casefold()
    ]
    if not matches:
        raise ModelConfigurationError("Private quote has no observable passage candidate")
    selected = min(matches, key=lambda item: (len(item["excerpt"]), item["source_ref_id"]))
    return selected["source_ref_id"]


def _merge_fact_contracts(
    output: dict[str, Any],
    fact_catalog: list[dict[str, Any]],
    source_reference_registry: list[dict[str, Any]],
) -> tuple[list[dict[str, Any]], dict[str, Any]]:
    """Accept guarded provider contributions and deterministically replace rejections."""

    if set(output) != {"facts"} or not isinstance(output.get("facts"), list):
        raise ModelResponseError("Canonical-facts response must contain only a facts array")
    catalog_by_id = {item.get("fact_id"): item for item in fact_catalog}
    if len(catalog_by_id) != len(fact_catalog) or None in catalog_by_id:
        raise ModelConfigurationError("Fact catalog identifiers must be present and unique")
    returned_ids = [item.get("fact_id") for item in output["facts"] if isinstance(item, dict)]
    if len(returned_ids) != len(output["facts"]) or len(set(returned_ids)) != len(returned_ids):
        raise ModelResponseError("Canonical facts must be objects with unique identifiers")
    allowed_ids = set(catalog_by_id)
    if set(returned_ids) != allowed_ids:
        raise ModelResponseError(
            "fact_catalog_membership invariant failed",
            invariant="fact_catalog_membership",
        )

    registry_by_id = {
        item.get("source_ref_id"): item
        for item in source_reference_registry
        if isinstance(item, dict)
    }
    if (
        len(registry_by_id) != len(source_reference_registry)
        or None in registry_by_id
        or any(
            set(item) != {"source_ref_id", "artifact_id", "page", "excerpt"}
            for item in source_reference_registry
        )
    ):
        raise ModelConfigurationError("Source-reference registry is invalid")

    merged: list[dict[str, Any]] = []
    accepted_fact_ids: list[str] = []
    rejected_facts: list[dict[str, str]] = []
    source_reference_projection_fact_ids: list[str] = []
    ignored_noncontrolling_normalized_proposals = 0
    for returned_fact in output["facts"]:
        fact_id = returned_fact["fact_id"]
        contract = catalog_by_id[fact_id]
        label = contract.get("label")
        expected_state = contract.get("expected_state")
        canonical_value = contract.get("canonical_value")
        canonical_explanation = contract.get("canonical_explanation")
        deterministic_confidence = contract.get("deterministic_confidence")
        admissible_text_refs = contract.get("admissible_text_refs")
        deterministic_text_refs = contract.get("deterministic_text_refs")
        if (
            not isinstance(label, str)
            or not label.strip()
            or expected_state not in {"known", "unknown", "conflicting", "not_applicable"}
            or not isinstance(canonical_value, str)
            or not isinstance(canonical_explanation, str)
            or not canonical_explanation.strip()
            or not isinstance(deterministic_confidence, (int, float))
            or isinstance(deterministic_confidence, bool)
            or not 0 <= deterministic_confidence <= 1
            or not isinstance(admissible_text_refs, list)
            or any(
                not isinstance(ref, dict)
                or set(ref) != {"artifact_id", "page", "excerpt"}
                or not isinstance(ref.get("artifact_id"), str)
                or not ref.get("artifact_id", "").strip()
                or not isinstance(ref.get("page"), int)
                or isinstance(ref.get("page"), bool)
                or ref.get("page", 0) < 1
                or not isinstance(ref.get("excerpt"), str)
                or not ref.get("excerpt", "").strip()
                for ref in admissible_text_refs
            )
            or not isinstance(deterministic_text_refs, list)
            or any(
                not isinstance(ref, dict)
                or set(ref) != {"artifact_id", "locator_kind", "page", "excerpt", "agent"}
                or ref.get("locator_kind") != "text_quote"
                or not isinstance(ref.get("agent"), str)
                or not ref.get("agent", "").strip()
                for ref in deterministic_text_refs
            )
            or {
                (ref["artifact_id"], ref["page"], ref["excerpt"])
                for ref in deterministic_text_refs
            }
            != {
                (ref["artifact_id"], ref["page"], ref["excerpt"])
                for ref in admissible_text_refs
            }
        ):
            raise ModelConfigurationError("Fact catalog canonical truth metadata is invalid")
        controls_process = contract.get("controls_process")
        decision_key = contract.get("decision_key")
        normalized_options = contract.get("normalized_options")
        if not isinstance(controls_process, bool) or not isinstance(normalized_options, dict):
            raise ModelConfigurationError("Fact catalog process metadata is incomplete")
        if controls_process:
            admissible_values = contract.get("admissible_normalized_values")
            if (
                not isinstance(admissible_values, list)
                or len(admissible_values) != 1
                or not isinstance(decision_key, str)
                or any(value not in normalized_options for value in admissible_values)
            ):
                raise ModelConfigurationError("Controlling fact admissibility metadata is invalid")
            normalized_value = admissible_values[0]
            decision_value = normalized_options[normalized_value]
        else:
            if (
                decision_key is not None
                or normalized_options
                or contract.get("admissible_normalized_values")
            ):
                raise ModelConfigurationError("Non-controlling fact process metadata must remain empty")
            normalized_value = None
            decision_value = None
        enrichments = contract.get("bounded_enrichments", [])
        if not isinstance(enrichments, list) or any(
            not isinstance(ref, dict)
            or ref.get("locator_kind") not in {"visual_observation", "metadata_field"}
            for ref in enrichments
        ):
            raise ModelConfigurationError("Fact catalog bounded enrichments are invalid")

        rejection_invariant: str | None = None
        source_reference_projection_required = False
        returned_ref_ids = returned_fact.get("source_ref_ids")
        provider_confidence = returned_fact.get("confidence")
        if set(returned_fact) != PROVIDER_FACT_FIELDS:
            rejection_invariant = "provider_fact_fields"
        elif returned_fact["label"] != label:
            rejection_invariant = "catalog_label"
        elif returned_fact["state"] != expected_state:
            rejection_invariant = "canonical_state"
        elif (
            not isinstance(provider_confidence, (int, float))
            or isinstance(provider_confidence, bool)
            or not 0 <= provider_confidence <= 1
        ):
            rejection_invariant = "confidence_contract"
        elif controls_process and returned_fact["normalized_value"] not in normalized_options:
            rejection_invariant = "normalized_value_contract"
        elif controls_process and returned_fact["normalized_value"] != normalized_value:
            rejection_invariant = "normalized_value_admissibility"
        elif (
            not isinstance(returned_ref_ids, list)
            or any(not isinstance(ref_id, str) or not ref_id for ref_id in returned_ref_ids)
            or len(set(returned_ref_ids)) != len(returned_ref_ids)
        ):
            rejection_invariant = "source_reference_ids"
        elif set(returned_ref_ids) - set(registry_by_id):
            rejection_invariant = "source_reference_registry"
        else:
            source_reference_projection_required = set(returned_ref_ids) != {
                resolve_observable_source_reference_id(ref, source_reference_registry)
                for ref in admissible_text_refs
            }

        if not controls_process and returned_fact.get("normalized_value") is not None:
            ignored_noncontrolling_normalized_proposals += 1
        if rejection_invariant is None:
            accepted_fact_ids.append(fact_id)
            if source_reference_projection_required:
                source_reference_projection_fact_ids.append(fact_id)
                fact_refs = deterministic_text_refs
            else:
                fact_refs = [
                    {
                        "artifact_id": registry_by_id[ref_id]["artifact_id"],
                        "locator_kind": "text_quote",
                        "page": registry_by_id[ref_id]["page"],
                        "excerpt": registry_by_id[ref_id]["excerpt"],
                        "agent": "OpenRouter Nemotron Canonicalizer",
                    }
                    for ref_id in returned_ref_ids
                ]
            confidence = provider_confidence
        else:
            rejected_facts.append({"fact_id": fact_id, "invariant": rejection_invariant})
            fact_refs = deterministic_text_refs
            confidence = deterministic_confidence
        merged.append(
            {
                "fact_id": fact_id,
                "label": label,
                "value": canonical_value,
                "state": expected_state,
                "explanation": canonical_explanation,
                "source_refs": [*fact_refs, *enrichments],
                "confidence": confidence,
                "controls_process": controls_process,
                "decision_key": decision_key,
                "normalized_value": normalized_value,
                "decision_value": decision_value,
            }
        )
    diagnostics = {
        "authority_mode": "hybrid_guarded",
        "accepted_fact_ids": accepted_fact_ids,
        "accepted_fact_count": len(accepted_fact_ids),
        "rejected_facts": rejected_facts,
        "rejected_fact_count": len(rejected_facts),
        "source_reference_projection_fact_ids": source_reference_projection_fact_ids,
        "source_reference_projection_count": len(source_reference_projection_fact_ids),
        "deterministic_fallback_applied": bool(rejected_facts),
        "ignored_noncontrolling_normalized_proposals": (
            ignored_noncontrolling_normalized_proposals
        ),
    }
    if len(accepted_fact_ids) <= len(rejected_facts):
        raise ModelResponseError(
            "hybrid_model_contribution invariant failed",
            invariant="hybrid_model_contribution",
            diagnostics=diagnostics,
        )
    return merged, diagnostics


def _validated_hybrid_diagnostics(
    value: Any,
    *,
    allowed_fact_ids: set[str],
) -> dict[str, Any]:
    expected_keys = {
        "authority_mode",
        "accepted_fact_ids",
        "accepted_fact_count",
        "rejected_facts",
        "rejected_fact_count",
        "source_reference_projection_fact_ids",
        "source_reference_projection_count",
        "deterministic_fallback_applied",
        "ignored_noncontrolling_normalized_proposals",
    }
    if not isinstance(value, dict) or set(value) != expected_keys:
        raise ModelConfigurationError("Cached hybrid diagnostics are invalid")
    accepted = value["accepted_fact_ids"]
    rejected = value["rejected_facts"]
    projected = value["source_reference_projection_fact_ids"]
    if (
        value["authority_mode"] != "hybrid_guarded"
        or not isinstance(accepted, list)
        or not accepted
        or any(not isinstance(fact_id, str) or fact_id not in allowed_fact_ids for fact_id in accepted)
        or len(set(accepted)) != len(accepted)
        or value["accepted_fact_count"] != len(accepted)
        or len(accepted) <= len(rejected)
        or not isinstance(rejected, list)
        or any(
            not isinstance(item, dict)
            or set(item) != {"fact_id", "invariant"}
            or item.get("fact_id") not in allowed_fact_ids
            or not isinstance(item.get("invariant"), str)
            or not item.get("invariant", "").strip()
            for item in rejected
        )
        or len({item["fact_id"] for item in rejected}) != len(rejected)
        or set(accepted) & {item["fact_id"] for item in rejected}
        or set(accepted) | {item["fact_id"] for item in rejected} != allowed_fact_ids
        or value["rejected_fact_count"] != len(rejected)
        or not isinstance(projected, list)
        or any(
            not isinstance(fact_id, str) or fact_id not in accepted
            for fact_id in projected
        )
        or len(set(projected)) != len(projected)
        or value["source_reference_projection_count"] != len(projected)
        or value["deterministic_fallback_applied"] is not bool(rejected)
        or not isinstance(value["ignored_noncontrolling_normalized_proposals"], int)
        or isinstance(value["ignored_noncontrolling_normalized_proposals"], bool)
        or value["ignored_noncontrolling_normalized_proposals"] < 0
    ):
        raise ModelConfigurationError("Cached hybrid diagnostics are invalid")
    return value


@dataclass
class OpenRouterNemotronCanonicalizer:
    storage: Storage
    # Raw transport is retained only as an injection seam for the existing mocked
    # contract suite. Production uses the shared LangChain ChatOpenRouter adapter.
    transport: Transport | None = None
    structured_invoker: StructuredInvoker = _default_structured_invoker
    metadata_transport: MetadataTransport = _default_metadata_transport
    api_key_provider: Callable[[], str | None] = lambda: os.getenv("OPENROUTER_API_KEY")
    timeout_seconds: float = 180.0
    metadata_timeout_seconds: float = GENERATION_METADATA_TIMEOUT_SECONDS
    metadata_poll_attempts: int = GENERATION_METADATA_POLL_ATTEMPTS
    metadata_poll_interval_seconds: float = GENERATION_METADATA_POLL_INTERVAL_SECONDS
    metadata_sleep: Callable[[float], None] = sleep

    implementation: str = "hybrid_guarded_openrouter_canonicalizer"
    model: str = OPENROUTER_MODEL
    provider: str = OPENROUTER_PROVIDER

    def canonicalize(
        self,
        package: dict[str, Any],
        *,
        run_id: str,
        allowed_fact_catalog: list[dict[str, Any]],
    ) -> dict[str, Any]:
        # One worker serves two fixed fixtures. Serializing cache misses prevents
        # concurrent sessions from duplicating the same paid request; the cache is
        # rechecked inside the lock by the delegated implementation.
        with MODEL_SINGLE_FLIGHT_LOCK:
            return self._canonicalize_locked(
                package,
                run_id=run_id,
                allowed_fact_catalog=allowed_fact_catalog,
            )

    def _canonicalize_locked(
        self,
        package: dict[str, Any],
        *,
        run_id: str,
        allowed_fact_catalog: list[dict[str, Any]],
    ) -> dict[str, Any]:
        if self.model != OPENROUTER_MODEL:
            raise ModelConfigurationError("OpenRouter canonicalizer must use the configured Nemotron alias")
        if (
            not isinstance(self.metadata_poll_attempts, int)
            or isinstance(self.metadata_poll_attempts, bool)
            or not 1 <= self.metadata_poll_attempts <= GENERATION_METADATA_POLL_ATTEMPTS
            or not isinstance(self.metadata_timeout_seconds, (int, float))
            or isinstance(self.metadata_timeout_seconds, bool)
            or not 0 < self.metadata_timeout_seconds <= GENERATION_METADATA_TIMEOUT_SECONDS
            or not isinstance(self.metadata_poll_interval_seconds, (int, float))
            or isinstance(self.metadata_poll_interval_seconds, bool)
            or not 0 <= self.metadata_poll_interval_seconds <= GENERATION_METADATA_POLL_INTERVAL_SECONDS
        ):
            raise ModelConfigurationError("Generation-metadata polling must remain within its fixed safety bounds")
        package_text = json.dumps(package, sort_keys=True, ensure_ascii=False, separators=(",", ":"))
        orchestration_id = f"orch_{sha256(run_id.encode('utf-8')).hexdigest()[:16]}"
        source_reference_registry = observable_source_reference_registry(package)
        source_reference_ids = [item["source_ref_id"] for item in source_reference_registry]
        registry_text = json.dumps(
            source_reference_registry,
            sort_keys=True,
            ensure_ascii=False,
            separators=(",", ":"),
        )
        model_fact_catalog = [
            {
                "fact_id": item["fact_id"],
                "label": item["label"],
                "allowed_normalized_values": (
                    list(item["normalized_options"])
                    if item.get("controls_process") is True
                    else None
                ),
            }
            for item in allowed_fact_catalog
        ]
        catalog_text = json.dumps(model_fact_catalog, sort_keys=True, ensure_ascii=False, separators=(",", ":"))
        cache_key = _cache_key({"package": package, "fact_catalog": allowed_fact_catalog})
        cached = self.storage.cached_model_output(cache_key)
        if cached is not None:
            diagnostics = _validated_hybrid_diagnostics(
                cached.get("diagnostics"),
                allowed_fact_ids={item["fact_id"] for item in allowed_fact_catalog},
            )
            call_id = self.storage.create_model_call(
                run_id=run_id,
                provider=self.provider,
                model=self.model,
                cache_key=cache_key,
                purpose="observable package to canonical facts",
                call_count=0,
                estimated_cost_usd=0.0,
                outcome="cache_hit",
                provider_endpoint=OPENROUTER_URL,
                implementation=self.implementation,
                orchestration_id=orchestration_id,
                agent_id="canonical_facts",
                agent_role="guarded_canonical_facts",
            )
            origin = cached.get("origin") if isinstance(cached.get("origin"), dict) else {}
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
                "facts": cached["facts"],
                "diagnostics": diagnostics,
                "authority_mode": "hybrid_guarded",
                "orchestration_id": orchestration_id,
                "agent_id": "canonical_facts",
                "implementation": self.implementation,
                "model": self.model,
                "provider": self.provider,
                "call_id": call_id,
                "cache_key": cache_key,
                "cache_hit": True,
                **cache_provenance,
                "usage_source": "cache",
            }

        system_prompt = (
            "You are the bounded CasePath canonical-facts component. Read only the supplied observable claim package. "
            "Return fact states, bounded source-reference IDs, confidence, and allowed normalized values. Never infer a process, legal conclusion, responsibility, remedy, "
            "checklist, precedent, or knowledge update. Preserve unknown and conflicting states. Use only the supplied fact IDs "
            "and labels. Select source_ref_ids only from the global SOURCE REFERENCE REGISTRY; each ID deterministically maps "
            "to one exact observable artifact, page, and excerpt. Binary images expose no textual content in "
            "this package: do not cite or describe their pixels, and leave image-dependent facts unknown unless a textual source "
            "independently states them. Select the smallest nonredundant exact passage or passages that independently "
            "support the proposed fact state, including the smallest passage from every observable side of a conflict, "
            "and return an empty array when no candidate supports it. Choose normalized_value "
            "only from allowed_normalized_values; use null when that field is null. "
            "Treat source_ref_ids as bounded evidence proposals: the application independently validates them and "
            "projects the authoritative exact source bindings. "
            "Do not return value, explanation, controls_process, decision_key, or decision_value: the application owns and "
            "deterministically attaches canonical prose and all process metadata after this call."
        )
        user_prompt = (
            f"FACT CATALOG:\n{catalog_text}\n\n"
            f"SOURCE REFERENCE REGISTRY:\n{registry_text}\n\n"
            f"OBSERVABLE CLAIM PACKAGE:\n{package_text}"
        )
        prompt_text = system_prompt + "\n" + user_prompt
        assert_external_tracing_disabled()
        estimated_input_tokens = _input_token_estimate(prompt_text)
        estimated_cost_usd = _estimated_cost(estimated_input_tokens)
        cap = cumulative_usd_cap()
        key = self.api_key_provider()
        with self.storage.lock:
            committed = self.storage.model_cost_committed_or_reserved()
            if committed + estimated_cost_usd > cap:
                blocked_call_id = self.storage.create_model_call(
                    run_id=run_id,
                    provider=self.provider,
                    model=self.model,
                    cache_key=cache_key,
                    purpose="observable package to canonical facts",
                    call_count=0,
                    estimated_cost_usd=estimated_cost_usd,
                    outcome="blocked_cost_guard",
                    provider_endpoint=OPENROUTER_URL,
                    implementation=self.implementation,
                    orchestration_id=orchestration_id,
                    agent_id="canonical_facts",
                    agent_role="guarded_canonical_facts",
                )
                self.storage.finish_model_call(
                    blocked_call_id,
                    outcome="blocked_cost_guard",
                    error_type="ModelCostGuardError",
                    error_invariant="cost_guard",
                )
                raise ModelCostGuardError(
                    f"Estimated call cost would exceed the configured cumulative USD cap ({cap:.2f})",
                    safe_context={
                        "call_id": blocked_call_id,
                        "orchestration_id": orchestration_id,
                        "agent_id": "canonical_facts",
                        "outcome": "blocked_cost_guard",
                        "error_invariant": "cost_guard",
                    },
                )
            if not key:
                blocked_call_id = self.storage.create_model_call(
                    run_id=run_id,
                    provider=self.provider,
                    model=self.model,
                    cache_key=cache_key,
                    purpose="observable package to canonical facts",
                    call_count=0,
                    estimated_cost_usd=estimated_cost_usd,
                    outcome="blocked_missing_credential",
                    provider_endpoint=OPENROUTER_URL,
                    implementation=self.implementation,
                    orchestration_id=orchestration_id,
                    agent_id="canonical_facts",
                    agent_role="guarded_canonical_facts",
                )
                self.storage.finish_model_call(
                    blocked_call_id,
                    outcome="blocked_missing_credential",
                    error_type="ModelConfigurationError",
                    error_invariant="missing_credential",
                )
                raise ModelConfigurationError(
                    "OpenRouter model mode requires an API credential",
                    safe_context={
                        "call_id": blocked_call_id,
                        "orchestration_id": orchestration_id,
                        "agent_id": "canonical_facts",
                        "outcome": "blocked_missing_credential",
                        "error_invariant": "missing_credential",
                    },
                )

            call_id = self.storage.create_model_call(
                run_id=run_id,
                provider=self.provider,
                model=self.model,
                cache_key=cache_key,
                purpose="observable package to canonical facts",
                call_count=1,
                estimated_cost_usd=estimated_cost_usd,
                outcome="started",
                provider_endpoint=OPENROUTER_URL,
                implementation=self.implementation,
                orchestration_id=orchestration_id,
                agent_id="canonical_facts",
                agent_role="guarded_canonical_facts",
            )
        request_payload = {
            "model": self.model,
            "messages": [
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_prompt},
            ],
            "stream": False,
            "temperature": 0,
            "max_tokens": MAX_OUTPUT_TOKENS,
            "reasoning": dict(OPENROUTER_REASONING),
            "response_format": {
                "type": "json_schema",
                "json_schema": {
                    "name": "casepath_canonical_facts",
                    "strict": True,
                    "schema": canonical_facts_schema(source_reference_ids),
                },
            },
            "provider": openrouter_provider_policy(),
        }
        headers = {
            "Authorization": f"Bearer {key}",
            "Content-Type": "application/json",
            "X-OpenRouter-Title": "CasePath",
            "X-OpenRouter-Metadata": "enabled",
        }
        started = perf_counter()
        ledger_finished = False
        provider_ledger_patch: dict[str, Any] = {}
        try:
            if self.transport is None:
                response = self.structured_invoker(
                    canonical_facts_schema(source_reference_ids),
                    system_prompt,
                    user_prompt,
                    key,
                    orchestration_id,
                    MAX_OUTPUT_TOKENS,
                )
            else:
                response = self.transport(
                    OPENROUTER_URL,
                    headers,
                    request_payload,
                    self.timeout_seconds,
                )
            latency_ms = round((perf_counter() - started) * 1000, 3)
            identity = _partial_response_identity(response)
            provider_ledger_patch = {"latency_ms": latency_ms}
            if identity["response_id"] is not None:
                provider_ledger_patch["response_id"] = identity["response_id"]
            if identity["response_model"] is not None:
                provider_ledger_patch["response_model"] = identity["response_model"]
            if identity["response_finish_reason"] is not None:
                provider_ledger_patch["finish_reason"] = identity["response_finish_reason"]
            if identity["provenance_violation"] is not None:
                provider_ledger_patch.update(identity["provenance_violation"])
            synchronous_usage = _synchronous_usage_ledger_patch(
                response,
                identity=identity,
                latency_ms=latency_ms,
            )
            if synchronous_usage is not None:
                provider_ledger_patch.update(synchronous_usage)
            needs_metadata = synchronous_usage is None or (
                identity["provenance_violation"] is None
                and (
                    identity.get("response_finish_reason") is None
                    or identity.get("upstream_provider") is None
                )
            )
            if needs_metadata and identity["response_id"] is not None:
                metadata_patch = _generation_metadata_ledger_patch(
                    identity=identity,
                    headers=headers,
                    metadata_transport=self.metadata_transport,
                    metadata_sleep=self.metadata_sleep,
                    timeout_seconds=self.metadata_timeout_seconds,
                    poll_attempts=self.metadata_poll_attempts,
                    poll_interval_seconds=self.metadata_poll_interval_seconds,
                    latency_ms=latency_ms,
                )
                provider_ledger_patch.update(metadata_patch)
                if identity["response_finish_reason"] is not None:
                    provider_ledger_patch["finish_reason"] = identity[
                        "response_finish_reason"
                    ]
            if "actual_cost_usd" in provider_ledger_patch:
                with self.storage.lock:
                    self.storage.finish_model_call(
                        call_id,
                        outcome="provider_succeeded",
                        **provider_ledger_patch,
                    )
                    actual_overrun = self.storage.model_actual_cost_total() > cap
            else:
                actual_overrun = False
            _validate_response_identity(identity)
            if (
                provider_ledger_patch.get("generation_model") is not None
                and provider_ledger_patch["generation_model"]
                not in OPENROUTER_ACCEPTED_RESPONSE_MODELS
            ):
                raise ModelResponseError(
                    "generation_metadata_model invariant failed",
                    invariant="generation_metadata_model",
                )
            if "actual_cost_usd" not in provider_ledger_patch:
                raise ModelResponseError(
                    "generation_metadata_completeness invariant failed",
                    invariant="generation_metadata_completeness",
                )
            if (
                provider_ledger_patch.get("upstream_provider")
                != OPENROUTER_EXPECTED_UPSTREAM_PROVIDER
            ):
                raise ModelResponseError(
                    "upstream_provider_policy invariant failed",
                    invariant="upstream_provider_policy",
                )
            if provider_ledger_patch.get("finish_reason") != "stop":
                raise ModelResponseError(
                    "provider_finish_reason invariant failed",
                    invariant="provider_finish_reason",
                )
            output = _response_content(response)
            merged_facts, diagnostics = _merge_fact_contracts(
                output,
                allowed_fact_catalog,
                source_reference_registry,
            )
            understanding = {"facts": merged_facts}
            validate_claim_state(
                understanding,
                allowed_artifact_ids={item["artifact_id"] for item in package["artifacts"]},
                artifact_page_counts={item["artifact_id"]: item["page_count"] for item in package["artifacts"]},
                artifact_media_types={item["artifact_id"]: item["media_type"] for item in package["artifacts"]},
            )
            validate_exact_source_excerpts(package, merged_facts)
            with self.storage.lock:
                success_outcome = (
                    "succeeded"
                    if diagnostics["rejected_fact_count"] == 0
                    else "succeeded_with_guarded_fallback"
                )
                self.storage.finish_model_call(
                    call_id,
                    outcome="actual_cost_overrun" if actual_overrun else success_outcome,
                    **provider_ledger_patch,
                    **diagnostics,
                    canonical_output={
                        "facts": merged_facts,
                        "diagnostics": diagnostics,
                        "origin": {
                            "origin_call_id": call_id,
                            "response_id": provider_ledger_patch["response_id"],
                            "response_model": provider_ledger_patch["response_model"],
                            "upstream_provider": provider_ledger_patch["upstream_provider"],
                            "usage_source": provider_ledger_patch["usage_source"],
                            "origin_finish_reason": provider_ledger_patch["finish_reason"],
                            "origin_usage": {
                                "prompt_tokens": provider_ledger_patch["prompt_tokens"],
                                "completion_tokens": provider_ledger_patch["completion_tokens"],
                                "total_tokens": provider_ledger_patch["total_tokens"],
                                "actual_cost_usd": provider_ledger_patch["actual_cost_usd"],
                                "usage_source": provider_ledger_patch["usage_source"],
                            },
                        },
                    },
                )
            ledger_finished = True
            if actual_overrun:
                raise ModelCostGuardError(
                    "Actual model cost exceeded the configured cumulative USD cap",
                    safe_context={
                        "call_id": call_id,
                        "orchestration_id": orchestration_id,
                        "agent_id": "canonical_facts",
                        "outcome": "actual_cost_overrun",
                        "error_invariant": "actual_cost_overrun",
                        **{
                            key: provider_ledger_patch[key]
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
                "facts": merged_facts,
                "diagnostics": diagnostics,
                "authority_mode": "hybrid_guarded",
                "orchestration_id": orchestration_id,
                "agent_id": "canonical_facts",
                "implementation": self.implementation,
                "model": self.model,
                "provider": self.provider,
                "call_id": call_id,
                "cache_key": cache_key,
                "cache_hit": False,
                "origin_call_id": call_id,
                "response_id": provider_ledger_patch["response_id"],
                "response_model": provider_ledger_patch["response_model"],
                "upstream_provider": provider_ledger_patch["upstream_provider"],
                "usage_source": provider_ledger_patch["usage_source"],
                "finish_reason": provider_ledger_patch["finish_reason"],
                "usage": {
                    "prompt_tokens": provider_ledger_patch["prompt_tokens"],
                    "completion_tokens": provider_ledger_patch["completion_tokens"],
                    "total_tokens": provider_ledger_patch["total_tokens"],
                    "actual_cost_usd": provider_ledger_patch["actual_cost_usd"],
                    "usage_source": provider_ledger_patch["usage_source"],
                },
            }
        except Exception as exc:
            latency_ms = round((perf_counter() - started) * 1000, 3)
            if isinstance(exc, CanonicalizerError):
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
                    "provider_error_code",
                ):
                    if key in exc.safe_context:
                        provider_ledger_patch[key] = exc.safe_context[key]
            if not ledger_finished:
                failure_patch = {
                    **provider_ledger_patch,
                    "latency_ms": provider_ledger_patch.get("latency_ms", latency_ms),
                    "error_type": type(exc).__name__,
                }
                if isinstance(exc, ModelResponseError):
                    if exc.fact_id is not None:
                        failure_patch["error_fact_id"] = exc.fact_id
                    if exc.invariant is not None:
                        failure_patch["error_invariant"] = exc.invariant
                    if exc.diagnostics is not None:
                        failure_patch.update(exc.diagnostics)
                self.storage.finish_model_call(
                    call_id,
                    outcome="failed",
                    **failure_patch,
                )
            if isinstance(exc, CanonicalizerError):
                exc.safe_context = {
                    "call_id": call_id,
                    "orchestration_id": orchestration_id,
                    "agent_id": "canonical_facts",
                    "outcome": exc.safe_context.get("outcome", "failed"),
                    **{
                        key: provider_ledger_patch[key]
                        for key in (
                            "response_id",
                            "response_model",
                            "upstream_provider",
                            "usage_source",
                            "finish_reason",
                            "invalid_provenance_field",
                            "invalid_provenance_value_hash",
                            "provider_error_code",
                        )
                        if key in provider_ledger_patch
                    },
                    **exc.safe_context,
                }
                raise
            raise ModelResponseError(
                "OpenRouter canonicalization failed",
                safe_context={
                    "call_id": call_id,
                    "orchestration_id": orchestration_id,
                    "agent_id": "canonical_facts",
                    "outcome": "failed",
                },
            ) from None
