from __future__ import annotations

from collections.abc import Mapping
from hashlib import sha256
import json
import math
import os
import re
from typing import Any

from langchain_openrouter import ChatOpenRouter
from langsmith.run_helpers import get_tracing_context
from openrouter import OpenRouter
from openrouter.errors import ResponseValidationError


NEMOTRON_MODEL = "nvidia/nemotron-3-ultra-550b-a55b"
OPENROUTER_PROVIDER_POLICY = {
    "require_parameters": True,
    "data_collection": "deny",
}
OPENROUTER_TIMEOUT_MILLISECONDS = 180_000
OPENROUTER_RESPONSE_BODY_LIMIT_BYTES = 1_000_000
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


class OpenRouterProtocolError(RuntimeError):
    """Bounded failure for an incompatible provider response envelope."""

    invariant = "provider_response_envelope"

    def __init__(self) -> None:
        super().__init__("OpenRouter returned an incompatible response envelope")


def _unique_json_object(pairs: list[tuple[str, Any]]) -> dict[str, Any]:
    value: dict[str, Any] = {}
    for key, item in pairs:
        if key in value:
            raise ValueError("duplicate JSON key")
        value[key] = item
    return value


def _reject_nonfinite_json(_: str) -> None:
    raise ValueError("non-finite JSON number")


def _bounded_usage(value: Any) -> dict[str, int | float] | None:
    """Retain only scalar billing fields that LangChain and CasePath consume."""

    if value is None:
        return None
    if not isinstance(value, Mapping):
        raise ValueError("usage must be an object")
    prompt_tokens = value.get("prompt_tokens")
    completion_tokens = value.get("completion_tokens")
    total_tokens = value.get("total_tokens")
    if not all(
        isinstance(item, int) and not isinstance(item, bool) and item >= 0
        for item in (prompt_tokens, completion_tokens, total_tokens)
    ) or total_tokens < prompt_tokens + completion_tokens:
        # Preserve response identity and let the existing same-generation metadata
        # lookup recover authoritative billing instead of retaining malformed usage.
        return None
    usage: dict[str, int | float] = {
        "prompt_tokens": prompt_tokens,
        "completion_tokens": completion_tokens,
        "total_tokens": total_tokens,
    }
    cost = value.get("cost")
    if cost is not None:
        if (
            not isinstance(cost, (int, float))
            or isinstance(cost, bool)
            or not math.isfinite(float(cost))
            or float(cost) < 0
        ):
            return None
        usage["cost"] = float(cost)
    return usage


def _recover_openrouter_response(error: ResponseValidationError) -> dict[str, Any] | None:
    """Recover one already-returned HTTP 200 body from SDK schema drift.

    The generated OpenRouter 0.11.46 ``ChatResult`` incorrectly requires the
    nullable ``system_fingerprint`` field. OpenRouter may omit that field, causing
    the SDK to raise before LangChain can form its structured-output envelope.
    This bridge validates the smaller response contract CasePath actually uses,
    returns only those fields, and never stores or rethrows the raw body.
    """

    try:
        content_type = error.headers.get("content-type", "").split(";", 1)[0].strip().casefold()
        body = error.body
        if (
            error.status_code != 200
            or content_type != "application/json"
            or not isinstance(body, str)
            or len(body.encode("utf-8")) > OPENROUTER_RESPONSE_BODY_LIMIT_BYTES
        ):
            return None
        payload = json.loads(
            body,
            object_pairs_hook=_unique_json_object,
            parse_constant=_reject_nonfinite_json,
        )
        if not isinstance(payload, Mapping) or payload.get("error") is not None:
            return None
        response_id = payload.get("id")
        response_model = payload.get("model")
        created = payload.get("created")
        if (
            not isinstance(response_id, str)
            or not response_id.strip()
            or len(response_id) > 512
            or not isinstance(response_model, str)
            or not response_model.strip()
            or len(response_model) > 512
            or payload.get("object") != "chat.completion"
            or not isinstance(created, int)
            or isinstance(created, bool)
            or created < 0
        ):
            return None
        choices = payload.get("choices")
        if not isinstance(choices, list) or len(choices) != 1:
            return None
        choice = choices[0]
        if not isinstance(choice, Mapping):
            return None
        index = choice.get("index")
        finish_reason = choice.get("finish_reason")
        if choice.get("error") is not None:
            # Preserve billable identity/usage while guaranteeing the application
            # finish gate rejects a provider-reported choice error.
            finish_reason = "error"
        message = choice.get("message")
        if (
            not isinstance(index, int)
            or isinstance(index, bool)
            or index != 0
            or (finish_reason is not None and finish_reason not in _FINISH_REASONS)
            or not isinstance(message, Mapping)
            or message.get("role") != "assistant"
            or not isinstance(message.get("content"), str)
        ):
            return None
        recovered: dict[str, Any] = {
            "id": response_id,
            "model": response_model,
            "object": "chat.completion",
            "created": created,
            "choices": [
                {
                    "index": 0,
                    "finish_reason": finish_reason,
                    "message": {
                        "role": "assistant",
                        "content": message["content"],
                    },
                }
            ],
        }
        usage = _bounded_usage(payload.get("usage"))
        if usage is not None:
            recovered["usage"] = usage
        return recovered
    except (TypeError, ValueError, UnicodeError, RecursionError, OverflowError):
        return None


class _ChatSendBridge:
    """Delegate exactly once and recover only bounded SDK response-schema drift."""

    def __init__(self, chat: Any) -> None:
        self._chat = chat

    def send(self, **kwargs: Any) -> Any:
        recovered: dict[str, Any] | None = None
        try:
            return self._chat.send(**kwargs)
        except ResponseValidationError as error:
            recovered = _recover_openrouter_response(error)
        # Raise outside the SDK exception scope so raw_response/body are not
        # reachable through __context__ or __cause__ on the bounded error.
        if recovered is None:
            raise OpenRouterProtocolError()
        return recovered


class _OpenRouterClientBridge:
    """Minimal client facade required by ``ChatOpenRouter``."""

    def __init__(self, client: Any) -> None:
        self.chat = _ChatSendBridge(client.chat)


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
        client=_OpenRouterClientBridge(provider_client),
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
    "OPENROUTER_RESPONSE_BODY_LIMIT_BYTES",
    "OPENROUTER_TIMEOUT_MILLISECONDS",
    "OpenRouterProtocolError",
    "assert_external_tracing_disabled",
    "external_tracing_environment_disabled",
    "sanitize_provider_provenance",
    "structured_nemotron_runnable",
]
