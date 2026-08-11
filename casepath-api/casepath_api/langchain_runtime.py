from __future__ import annotations

from hashlib import sha256
import os
import re
from typing import Any

from langchain_openrouter import ChatOpenRouter
from langsmith.run_helpers import get_tracing_context
from openrouter import OpenRouter


NEMOTRON_MODEL = "nvidia/nemotron-3-ultra-550b-a55b"
OPENROUTER_PROVIDER_POLICY = {
    "require_parameters": True,
    "data_collection": "deny",
}
OPENROUTER_TIMEOUT_MILLISECONDS = 180_000
_TRACING_ENV_VARS = ("LANGSMITH_TRACING", "LANGCHAIN_TRACING_V2", "LANGCHAIN_TRACING")
_PROVENANCE_LIMITS = {
    "response_id": 160,
    "response_model": 160,
    "upstream_provider": 80,
}
_PROVENANCE_PATTERNS = {
    "response_id": re.compile(r"^[A-Za-z0-9][A-Za-z0-9._-]{2,159}$"),
    "upstream_provider": re.compile(r"^[A-Za-z0-9][A-Za-z0-9._-]{1,79}$"),
}
_RESPONSE_MODELS = {
    NEMOTRON_MODEL,
    f"{NEMOTRON_MODEL}-20260604",
}
_FORBIDDEN_PROVENANCE_MARKERS = (
    "authorization",
    "api_key",
    "apikey",
    "bearer ",
    "credential",
    "sk-or-",
    "sk-",
    "secret",
    "sentinel",
)
_CLAIM_TEXT_MARKERS = (
    "customer",
    "landlord",
    "lease",
    "mould",
    "moisture",
    "tenant",
)
_FINISH_REASONS = {
    "stop",
    "length",
    "tool_calls",
    "content_filter",
    "error",
    "cancelled",
}


def external_tracing_environment_disabled() -> bool:
    return not any(
        os.getenv(name, "").strip().casefold() in {"1", "true", "yes", "on"}
        for name in _TRACING_ENV_VARS
    )


def assert_external_tracing_disabled() -> None:
    enabled = {
        name: os.getenv(name, "").strip().casefold()
        for name in _TRACING_ENV_VARS
        if os.getenv(name, "").strip().casefold() in {"1", "true", "yes", "on"}
    }
    if enabled:
        raise RuntimeError("External LangChain tracing must be disabled for CasePath")
    context = get_tracing_context()
    if (
        isinstance(context, dict)
        and context.get("enabled") is not None
        and context.get("enabled") is not False
    ):
        raise RuntimeError("Inherited LangChain tracing must be disabled for CasePath")


def sanitize_provider_provenance(
    *,
    response_id: Any = None,
    response_model: Any = None,
    upstream_provider: Any = None,
    finish_reason: Any = None,
) -> tuple[dict[str, str | None], dict[str, str] | None]:
    """Bound provider-authored audit identity without retaining rejected values.

    Missing values remain ``None`` so the caller can use its existing metadata or
    completeness path. A malformed or secret-like nonempty value is represented
    only by its field class and SHA-256 digest; the original value is never
    returned to a ledger, event, or exception.
    """

    raw_values = {
        "response_id": response_id,
        "response_model": response_model,
        "upstream_provider": upstream_provider,
        "finish_reason": finish_reason,
    }
    sanitized: dict[str, str | None] = {}
    violation: dict[str, str] | None = None
    for field, raw_value in raw_values.items():
        if raw_value is None or (isinstance(raw_value, str) and not raw_value.strip()):
            sanitized[field] = None
            continue
        valid = isinstance(raw_value, str)
        value = raw_value.strip() if valid else ""
        if field == "finish_reason":
            valid = valid and value in _FINISH_REASONS
        elif field == "response_model":
            valid = valid and value in _RESPONSE_MODELS
        else:
            valid = (
                valid
                and len(value) <= _PROVENANCE_LIMITS[field]
                and _PROVENANCE_PATTERNS[field].fullmatch(value) is not None
            )
        folded = value.casefold()
        valid = valid and not any(marker in folded for marker in _FORBIDDEN_PROVENANCE_MARKERS)
        valid = valid and not any(marker in folded for marker in _CLAIM_TEXT_MARKERS)
        if valid:
            sanitized[field] = value
            continue
        sanitized[field] = None
        if violation is None:
            bounded_raw = raw_value if isinstance(raw_value, str) else type(raw_value).__name__
            violation = {
                "invalid_provenance_field": field,
                "invalid_provenance_value_hash": sha256(
                    bounded_raw.encode("utf-8", errors="replace")
                ).hexdigest(),
            }
    return sanitized, violation


def structured_nemotron_runnable(
    *,
    schema: Any,
    api_key: str,
    orchestration_id: str,
    max_tokens: int,
):
    """Create one exact-model, provider-native, non-retrying structured runnable.

    No LangSmith callbacks or OpenRouter trace broadcast is configured. Callers pass
    ``config={"callbacks": []}`` at invocation so the local SQLite ledger remains the
    only persistent audit sink.
    """

    assert_external_tracing_disabled()
    # The OpenRouter SDK installs a long default backoff when retry_config is
    # omitted. Passing explicit None is the only unambiguous single-attempt
    # contract; ChatOpenRouter's max_retries=0 alone does not disable SDK retry.
    provider_client = OpenRouter(
        api_key=api_key,
        retry_config=None,
        timeout_ms=OPENROUTER_TIMEOUT_MILLISECONDS,
        x_open_router_title="CasePath",
    )
    model = ChatOpenRouter(
        model=NEMOTRON_MODEL,
        api_key=api_key,
        client=provider_client,
        temperature=0,
        max_tokens=max_tokens,
        timeout=OPENROUTER_TIMEOUT_MILLISECONDS,
        max_retries=0,
        openrouter_provider=OPENROUTER_PROVIDER_POLICY,
        app_title="CasePath",
        session_id=orchestration_id,
    )
    return model.with_structured_output(
        schema,
        method="json_schema",
        strict=True,
        include_raw=True,
    )


__all__ = [
    "NEMOTRON_MODEL",
    "OPENROUTER_PROVIDER_POLICY",
    "OPENROUTER_TIMEOUT_MILLISECONDS",
    "assert_external_tracing_disabled",
    "external_tracing_environment_disabled",
    "sanitize_provider_provenance",
    "structured_nemotron_runnable",
]
