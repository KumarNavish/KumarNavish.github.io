from __future__ import annotations

from collections.abc import Mapping
from hashlib import sha256
import json
import math
import os
import re
from typing import Any

from langchain_openrouter import ChatOpenRouter as _LangChainChatOpenRouter
from langsmith.run_helpers import get_tracing_context
from openrouter import OpenRouter
from openrouter.errors import ResponseValidationError


NEMOTRON_MODEL = "nvidia/nemotron-3-ultra-550b-a55b"
OPENROUTER_ENDPOINT_TAG = "deepinfra/fp4"
OPENROUTER_EXPECTED_UPSTREAM_PROVIDER = "DeepInfra"
OPENROUTER_PROVIDER_POLICY = {
    "only": [OPENROUTER_ENDPOINT_TAG],
    "allow_fallbacks": False,
    "require_parameters": True,
    "data_collection": "deny",
}
OPENROUTER_REASONING = {"effort": "medium"}
OPENROUTER_TIMEOUT_MILLISECONDS = 180_000
OPENROUTER_RESPONSE_BODY_LIMIT_BYTES = 1_000_000
OPENROUTER_RESPONSE_TEXT_PART_LIMIT = 64
OPENROUTER_PROVIDER_ERROR_CODE_MAX = 9_999
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
_OPENROUTER_GENERATION_ID_PATTERN = re.compile(
    r"^gen-[0-9]{10}-[A-Za-z0-9]{20}$"
)
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


class OpenRouterUpstreamRejectionError(RuntimeError):
    """Bounded router/provider rejection with no provider-authored prose."""

    invariant = "provider_upstream_rejection"

    def __init__(
        self,
        *,
        response_id: str | None,
        provider_error_code: int | None,
    ) -> None:
        super().__init__("OpenRouter rejected the bounded provider request")
        self.response_id = (
            response_id
            if isinstance(response_id, str)
            and _OPENROUTER_GENERATION_ID_PATTERN.fullmatch(response_id) is not None
            else None
        )
        self.provider_error_code = (
            provider_error_code
            if isinstance(provider_error_code, int)
            and not isinstance(provider_error_code, bool)
            and 0 <= provider_error_code <= OPENROUTER_PROVIDER_ERROR_CODE_MAX
            else None
        )

    @property
    def safe_context(self) -> dict[str, str | int]:
        return {
            key: value
            for key, value in {
                "response_id": self.response_id,
                "provider_error_code": self.provider_error_code,
            }.items()
            if value is not None
        }


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


def _bounded_assistant_content(value: Any) -> tuple[bool, str]:
    """Project valid text response variants onto LangChain's JSON parser input."""

    if value is None:
        return True, ""
    if isinstance(value, str):
        return True, value
    if not isinstance(value, list) or len(value) > OPENROUTER_RESPONSE_TEXT_PART_LIMIT:
        return False, ""
    text_parts: list[str] = []
    for item in value:
        if (
            not isinstance(item, Mapping)
            or item.get("type") != "text"
            or not isinstance(item.get("text"), str)
        ):
            return False, ""
        text_parts.append(item["text"])
    return True, "".join(text_parts)


def _bounded_generation_id(headers: Any) -> str | None:
    if not isinstance(headers, Mapping):
        return None
    raw_value: Any = None
    for key, value in headers.items():
        if isinstance(key, str) and key.casefold() == "x-generation-id":
            raw_value = value
            break
    if not isinstance(raw_value, str):
        return None
    value = raw_value.strip()
    if _OPENROUTER_GENERATION_ID_PATTERN.fullmatch(value) is None:
        return None
    return value


def _bounded_provider_error_code(error: Mapping[str, Any]) -> int | None:
    value = error.get("code")
    if (
        not isinstance(value, int)
        or isinstance(value, bool)
        or not 0 <= value <= OPENROUTER_PROVIDER_ERROR_CODE_MAX
    ):
        return None
    return value


def _metadata_field(value: Any, field: str) -> Any:
    if isinstance(value, Mapping):
        return value.get(field)
    return getattr(value, field, None)


def _synchronous_deepinfra_provider(response: Any) -> str | None:
    """Project only an exact DeepInfra selection from router metadata.

    OpenRouter's generated SDK retains ``openrouter_metadata`` on ``ChatResult``,
    while ``langchain-openrouter`` currently drops that top-level field when it
    creates an ``AIMessage``. Accept both the SDK's selected-endpoint structure
    and the older direct ``provider_name`` shape, but never copy router-authored
    summaries, attempts, endpoint names, or an unapproved provider downstream.
    """

    metadata = _metadata_field(response, "openrouter_metadata")
    if metadata is None:
        return None
    candidates: list[Any] = []
    direct_provider = _metadata_field(metadata, "provider_name")
    if direct_provider is not None:
        candidates.append(direct_provider)
    endpoints = _metadata_field(metadata, "endpoints")
    available = _metadata_field(endpoints, "available")
    if isinstance(available, list) and len(available) <= OPENROUTER_RESPONSE_TEXT_PART_LIMIT:
        selected = [
            _metadata_field(item, "provider")
            for item in available
            if _metadata_field(item, "selected") is True
        ]
        if len(selected) == 1:
            candidates.append(selected[0])
        elif selected:
            return None
    if not candidates:
        return None
    sanitized_candidates: set[str] = set()
    for candidate in candidates:
        sanitized, violation = sanitize_provider_provenance(
            upstream_provider=candidate
        )
        provider = sanitized.get("upstream_provider")
        if violation is not None or provider is None:
            return None
        sanitized_candidates.add(provider)
    if sanitized_candidates == {OPENROUTER_EXPECTED_UPSTREAM_PROVIDER}:
        return OPENROUTER_EXPECTED_UPSTREAM_PROVIDER
    return None


def _recover_openrouter_response(
    error: ResponseValidationError,
) -> dict[str, Any] | OpenRouterUpstreamRejectionError | None:
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
        if not isinstance(payload, Mapping):
            return None
        upstream_error = payload.get("error")
        if isinstance(upstream_error, Mapping):
            return OpenRouterUpstreamRejectionError(
                response_id=_bounded_generation_id(error.headers),
                provider_error_code=_bounded_provider_error_code(upstream_error),
            )
        if upstream_error is not None:
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
        ):
            return None
        choices = payload.get("choices")
        if not isinstance(choices, list) or len(choices) != 1:
            return None
        choice = choices[0]
        if not isinstance(choice, Mapping):
            return None
        finish_reason = choice.get("finish_reason")
        if choice.get("error") is not None:
            # Preserve billable identity/usage while guaranteeing the application
            # finish gate rejects a provider-reported choice error.
            finish_reason = "error"
        message = choice.get("message")
        content_valid, message_content = _bounded_assistant_content(
            message.get("content") if isinstance(message, Mapping) else None
        )
        if (
            (finish_reason is not None and finish_reason not in _FINISH_REASONS)
            or not isinstance(message, Mapping)
            or message.get("role") != "assistant"
            or not content_valid
        ):
            return None
        recovered: dict[str, Any] = {
            "id": response_id,
            "model": response_model,
            "choices": [
                {
                    "finish_reason": finish_reason,
                    "message": {
                        "role": "assistant",
                        "content": message_content,
                    },
                }
            ],
        }
        if payload.get("object") == "chat.completion":
            recovered["object"] = "chat.completion"
        if isinstance(created, int) and not isinstance(created, bool) and created >= 0:
            recovered["created"] = created
        index = choice.get("index")
        if isinstance(index, int) and not isinstance(index, bool) and index == 0:
            recovered["choices"][0]["index"] = 0
        usage = _bounded_usage(payload.get("usage"))
        if usage is not None:
            recovered["usage"] = usage
        provider_name = _synchronous_deepinfra_provider(payload)
        if provider_name is not None:
            recovered["openrouter_metadata"] = {"provider_name": provider_name}
        return recovered
    except (
        AttributeError,
        KeyError,
        TypeError,
        ValueError,
        UnicodeError,
        RecursionError,
        OverflowError,
    ):
        return None


class _ChatSendBridge:
    """Delegate exactly once and recover only bounded SDK response-schema drift."""

    def __init__(self, chat: Any) -> None:
        self._chat = chat

    def send(self, **kwargs: Any) -> Any:
        recovered: dict[str, Any] | OpenRouterUpstreamRejectionError | None = None
        kwargs["x_open_router_metadata"] = "enabled"
        try:
            return self._chat.send(**kwargs)
        except ResponseValidationError as error:
            recovered = _recover_openrouter_response(error)
        # Raise outside the SDK exception scope so raw_response/body are not
        # reachable through __context__ or __cause__ on the bounded error.
        if isinstance(recovered, OpenRouterUpstreamRejectionError):
            raise recovered
        if recovered is None:
            raise OpenRouterProtocolError()
        return recovered


class _OpenRouterClientBridge:
    """Minimal client facade required by ``ChatOpenRouter``."""

    def __init__(self, client: Any) -> None:
        self.chat = _ChatSendBridge(client.chat)


class ChatOpenRouter(_LangChainChatOpenRouter):
    """OpenRouter chat adapter that retains one bounded routing attestation."""

    def _create_chat_result(self, response: Any):
        provider_name = _synchronous_deepinfra_provider(response)
        result = super()._create_chat_result(response)
        if provider_name is not None:
            for generation in result.generations:
                metadata = generation.message.response_metadata
                if isinstance(metadata, dict):
                    metadata["provider_name"] = provider_name
        return result


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


def openrouter_provider_policy() -> dict[str, Any]:
    """Return a fresh exact-endpoint policy for every provider request."""

    return {
        **OPENROUTER_PROVIDER_POLICY,
        "only": list(OPENROUTER_PROVIDER_POLICY["only"]),
    }


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
        openrouter_provider=openrouter_provider_policy(),
        reasoning=dict(OPENROUTER_REASONING),
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
    "OPENROUTER_ENDPOINT_TAG",
    "OPENROUTER_EXPECTED_UPSTREAM_PROVIDER",
    "OPENROUTER_PROVIDER_ERROR_CODE_MAX",
    "OPENROUTER_PROVIDER_POLICY",
    "OPENROUTER_REASONING",
    "OPENROUTER_RESPONSE_BODY_LIMIT_BYTES",
    "OPENROUTER_RESPONSE_TEXT_PART_LIMIT",
    "OPENROUTER_TIMEOUT_MILLISECONDS",
    "OpenRouterProtocolError",
    "OpenRouterUpstreamRejectionError",
    "assert_external_tracing_disabled",
    "external_tracing_environment_disabled",
    "openrouter_provider_policy",
    "sanitize_provider_provenance",
    "structured_nemotron_runnable",
]
