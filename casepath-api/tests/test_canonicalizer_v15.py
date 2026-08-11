from __future__ import annotations

from concurrent.futures import ThreadPoolExecutor
from copy import deepcopy
import json
from pathlib import Path
import time

import pytest

from casepath_api.canonicalizer import (
    DEFAULT_CUMULATIVE_USD_CAP,
    MODEL_MODE_REFERENCE,
    OPENROUTER_CANONICAL_MODEL,
    OPENROUTER_GENERATION_URL,
    OPENROUTER_MODEL,
    OPENROUTER_URL,
    ModelConfigurationError,
    ModelCostGuardError,
    ModelResponseError,
    OpenRouterNemotronCanonicalizer,
    configured_model_mode,
    cumulative_usd_cap,
    observable_source_reference_registry,
    resolve_observable_source_reference_id,
    source_reference_id,
    validate_exact_source_excerpts,
)
from casepath_api.storage import Storage


def package() -> dict:
    return {
        "schema": "casepath.observable-claim-package/1.0.0",
        "received_at": "2026-08-01T09:03:00Z",
        "language": "en",
        "jurisdiction": {"country": "CH", "canton": "BS"},
        "intake_metadata": {"policy_reference": "POL-TEST"},
        "customer_message": {
            "artifact_id": "message",
            "subject": "Observable subject",
            "body": "The tenant reports a recurring mark.",
        },
        "artifacts": [
            {
                "artifact_id": "observable_email",
                "filename": "source.eml",
                "media_type": "message/rfc822",
                "received_at": "2026-08-01T09:03:00Z",
                "page_count": 1,
                "sha256": "0" * 64,
                "parsed_email": {"body": "The tenant reports a recurring mark."},
            }
        ],
    }


def text_reference(
    *,
    artifact_id: str = "message",
    page: int = 1,
    excerpt: str = "reports a recurring mark",
) -> dict:
    return {"artifact_id": artifact_id, "page": page, "excerpt": excerpt}


def observable_ref_id(value: dict, ref: dict | None = None) -> str:
    return resolve_observable_source_reference_id(
        ref or text_reference(),
        observable_source_reference_registry(value),
    )


def grounded_fact(*, ref: dict | None = None) -> dict:
    source = ref or text_reference()
    return {
        "fact_id": "fact_report",
        "label": "Reported condition",
        "state": "known",
        "source_refs": [
            {
                **source,
                "locator_kind": "text_quote",
                "agent": "OpenRouter Nemotron Canonicalizer",
            }
        ],
        "confidence": 0.9,
        "normalized_value": "supported",
    }


def response(*, model: str = OPENROUTER_MODEL, cost: float = 0.0042) -> dict:
    output = {
        "facts": [
            {
                "fact_id": "fact_report",
                "label": "Reported condition",
                "state": "known",
                "source_ref_ids": [observable_ref_id(package())],
                "confidence": 0.9,
                "normalized_value": "supported",
            }
        ]
    }
    return {
        "id": "generation-test-1",
        "model": model,
        "provider": "mock-upstream-provider",
        "choices": [
            {
                "finish_reason": "stop",
                "message": {"role": "assistant", "content": json.dumps(output)},
            }
        ],
        "usage": {
            "prompt_tokens": 123,
            "completion_tokens": 45,
            "total_tokens": 168,
            "cost": cost,
            "cost_details": {"upstream_inference_cost": cost},
        },
        "openrouter_metadata": {"provider_name": "mock-upstream-provider"},
    }


def generation_metadata(
    *,
    generation_id: str = "generation-test-1",
    model: str = OPENROUTER_CANONICAL_MODEL,
    cost: float = 0.0057,
    prompt_tokens: int = 321,
    completion_tokens: int = 87,
) -> dict:
    return {
        "data": {
            "id": generation_id,
            "model": model,
            "provider_name": "DeepInfra",
            "native_tokens_prompt": prompt_tokens,
            "native_tokens_completion": completion_tokens,
            "total_cost": cost,
            "usage": cost,
            "finish_reason": "stop",
        }
    }


def catalog(*, bounded_enrichments: list[dict] | None = None) -> list[dict]:
    return [
        {
            "fact_id": "fact_report",
            "label": "Reported condition",
            "controls_process": True,
            "decision_key": "recurrence",
            "normalized_options": {
                "supported": "recurrence_supported",
                "not_supported": "recurrence_not_supported",
                "unverified": "recurrence_unverified",
            },
            "admissible_normalized_values": ["supported"],
            "expected_state": "known",
            "canonical_value": "Recurring mark reported",
            "canonical_explanation": "The message directly reports recurrence.",
            "deterministic_confidence": 0.82,
            "admissible_text_refs": [
                text_reference()
            ],
            "deterministic_text_refs": [
                {
                    **text_reference(),
                    "locator_kind": "text_quote",
                    "agent": "Deterministic Reference Oracle",
                }
            ],
            "bounded_enrichments": bounded_enrichments or [],
        }
    ]


def set_contract_text_refs(contract: dict, refs: list[dict]) -> None:
    contract["admissible_text_refs"] = refs
    contract["deterministic_text_refs"] = [
        {
            **ref,
            "locator_kind": "text_quote",
            "agent": "Deterministic Reference Oracle",
        }
        for ref in refs
    ]


def three_fact_catalog() -> list[dict]:
    first = catalog()[0]
    second = deepcopy(first)
    second.update(
        {
            "fact_id": "fact_context",
            "label": "Context detail",
            "controls_process": False,
            "decision_key": None,
            "normalized_options": {},
            "admissible_normalized_values": [],
            "canonical_value": "Context reported",
            "canonical_explanation": "The message contains the bounded context.",
            "deterministic_confidence": 0.71,
        }
    )
    third = deepcopy(second)
    third.update(
        {
            "fact_id": "fact_background",
            "label": "Background detail",
            "canonical_value": "Background reported",
            "canonical_explanation": "The message contains the bounded background.",
            "deterministic_confidence": 0.72,
        }
    )
    return [first, second, third]


def assert_zero_accepted_rejection(storage: Storage, invariant: str) -> None:
    entry = storage.model_calls()[0]
    assert entry["outcome"] == "failed"
    assert entry["error_invariant"] == "hybrid_model_contribution"
    assert entry["authority_mode"] == "hybrid_guarded"
    assert entry["accepted_fact_ids"] == []
    assert entry["accepted_fact_count"] == 0
    assert entry["rejected_facts"] == [{"fact_id": "fact_report", "invariant": invariant}]
    assert entry["rejected_fact_count"] == 1


def test_openrouter_request_is_one_bounded_exact_model_structured_call(tmp_path: Path):
    storage = Storage(str(tmp_path / "ledger.db"))
    calls: list[tuple] = []
    metadata_calls = 0

    def transport(url, headers, payload, timeout):
        calls.append((url, headers, payload, timeout))
        return response()

    def forbidden_metadata_transport(*_args):
        nonlocal metadata_calls
        metadata_calls += 1
        raise AssertionError("usage-present response must not query generation metadata")

    canonicalizer = OpenRouterNemotronCanonicalizer(
        storage,
        transport=transport,
        metadata_transport=forbidden_metadata_transport,
        api_key_provider=lambda: "runtime-only-test-value",
    )
    result = canonicalizer.canonicalize(
        package(),
        run_id="run_test",
        allowed_fact_catalog=catalog(),
    )
    assert result["model"] == "nvidia/nemotron-3-ultra-550b-a55b"
    assert result["implementation"] == "hybrid_guarded_openrouter_canonicalizer"
    assert result["authority_mode"] == "hybrid_guarded"
    assert result["agent_id"] == "canonical_facts"
    assert result["orchestration_id"].startswith("orch_")
    assert result["diagnostics"] == {
        "authority_mode": "hybrid_guarded",
        "accepted_fact_ids": ["fact_report"],
        "accepted_fact_count": 1,
        "rejected_facts": [],
        "rejected_fact_count": 0,
        "deterministic_fallback_applied": False,
        "ignored_noncontrolling_normalized_proposals": 0,
    }
    assert result["cache_hit"] is False
    assert len(calls) == 1
    assert metadata_calls == 0
    url, headers, request, timeout = calls[0]
    assert url == "https://openrouter.ai/api/v1/chat/completions"
    assert timeout == 180.0
    assert headers["X-OpenRouter-Metadata"] == "enabled"
    assert request["model"] == OPENROUTER_MODEL
    assert "models" not in request
    assert request["max_tokens"] == 4000
    assert request["stream"] is False
    assert request["response_format"]["type"] == "json_schema"
    assert request["response_format"]["json_schema"]["strict"] is True
    fact_schema = request["response_format"]["json_schema"]["schema"]["properties"]["facts"]["items"]
    assert "value" not in fact_schema["properties"]
    assert "explanation" not in fact_schema["properties"]
    assert "controls_process" not in fact_schema["properties"]
    assert "decision_value" not in fact_schema["properties"]
    assert "source_refs" not in fact_schema["properties"]
    assert fact_schema["properties"]["source_ref_ids"]["uniqueItems"] is True
    registry_ids = fact_schema["properties"]["source_ref_ids"]["items"]["enum"]
    assert observable_ref_id(package()) in registry_ids
    assert len(registry_ids) > 1
    assert request["provider"] == {"require_parameters": True, "data_collection": "deny"}
    assert "usage" not in request
    user_prompt = request["messages"][1]["content"]
    for private_field in (
        "controls_process",
        "decision_key",
        "normalized_options",
        "admissible_normalized_values",
        "expected_state",
        "canonical_value",
        "canonical_explanation",
        "admissible_text_refs",
        "recurrence_supported",
    ):
        assert private_field not in user_prompt
    assert "required_text_reference_count" not in user_prompt
    assert "SOURCE REFERENCE REGISTRY:" in user_prompt
    assert observable_ref_id(package()) in user_prompt
    assert '"artifact_id":"message"' in user_prompt
    assert '"excerpt":"The tenant reports a recurring mark."' in user_prompt
    system_prompt = request["messages"][0]["content"]
    assert "required_text_reference_count" not in system_prompt
    assert "smallest passage from every observable side of a conflict" in system_prompt
    assert result["facts"][0]["controls_process"] is True
    assert result["facts"][0]["decision_key"] == "recurrence"
    assert result["facts"][0]["decision_value"] == "recurrence_supported"
    assert result["facts"][0]["value"] == "Recurring mark reported"
    assert result["facts"][0]["explanation"] == "The message directly reports recurrence."
    assert result["facts"][0]["source_refs"] == [
        {
            "artifact_id": "message",
            "locator_kind": "text_quote",
            "page": 1,
                "excerpt": "The tenant reports a recurring mark.",
            "agent": "OpenRouter Nemotron Canonicalizer",
        }
    ]

    ledger = storage.model_calls()
    assert len(ledger) == 1
    entry = ledger[0]
    assert entry["provider"] == "openrouter"
    assert entry["provider_endpoint"] == OPENROUTER_URL
    assert entry["model"] == OPENROUTER_MODEL
    assert entry["implementation"] == "hybrid_guarded_openrouter_canonicalizer"
    assert entry["agent_id"] == "canonical_facts"
    assert entry["agent_role"] == "guarded_canonical_facts"
    assert entry["orchestration_id"] == result["orchestration_id"]
    assert entry["parent_call_id"] is None
    assert entry["call_count"] == 1
    assert entry["prompt_tokens"] == 123
    assert entry["completion_tokens"] == 45
    assert entry["total_tokens"] == 168
    assert entry["actual_cost_usd"] == pytest.approx(0.0042)
    assert entry["usage_source"] == "response"
    assert entry["latency_ms"] >= 0
    assert entry["cache_key"] == result["cache_key"]
    assert entry["purpose"] == "observable package to canonical facts"
    assert entry["outcome"] == "succeeded"
    assert entry["authority_mode"] == "hybrid_guarded"
    assert entry["accepted_fact_ids"] == ["fact_report"]
    assert entry["accepted_fact_count"] == 1
    assert entry["rejected_facts"] == []
    assert entry["rejected_fact_count"] == 0
    assert entry["upstream_provider"] == "mock-upstream-provider"
    assert entry["model"] == OPENROUTER_MODEL
    assert entry["response_model"] == OPENROUTER_MODEL
    assert entry["response_id"] == "generation-test-1"
    assert "cost_details" not in json.dumps(entry)
    assert "openrouter_metadata" not in json.dumps(entry)
    assert "runtime-only-test-value" not in json.dumps(entry)


def test_missing_sync_usage_polls_generation_metadata_without_retrying_inference(tmp_path: Path):
    storage = Storage(str(tmp_path / "ledger.db"))
    inference_calls = 0
    metadata_calls: list[tuple[str, dict[str, str], float]] = []
    sleeps: list[float] = []

    def transport(*_args):
        nonlocal inference_calls
        inference_calls += 1
        value = response()
        value.pop("usage")
        return value

    metadata_success = generation_metadata(cost=0.0057, prompt_tokens=321, completion_tokens=87)
    metadata_success["data"]["secret_provider_blob"] = "must-not-be-persisted"
    metadata_values = [{"data": {}}, metadata_success]

    def metadata_transport(url, headers, timeout):
        metadata_calls.append((url, headers, timeout))
        return metadata_values.pop(0)

    canonicalizer = OpenRouterNemotronCanonicalizer(
        storage,
        transport=transport,
        metadata_transport=metadata_transport,
        metadata_sleep=sleeps.append,
        api_key_provider=lambda: "runtime-only-test-value",
    )
    result = canonicalizer.canonicalize(
        package(),
        run_id="run_metadata_fallback",
        allowed_fact_catalog=catalog(),
    )
    assert result["facts"][0]["decision_value"] == "recurrence_supported"
    assert inference_calls == 1
    assert len(metadata_calls) == 2
    assert sleeps == [0.25]
    for url, metadata_headers, timeout in metadata_calls:
        assert url == f"{OPENROUTER_GENERATION_URL}?id=generation-test-1"
        assert metadata_headers == {
            "Authorization": "Bearer runtime-only-test-value",
            "Accept": "application/json",
        }
        assert timeout == 10.0
    entry = storage.model_calls()[0]
    assert entry["outcome"] == "succeeded"
    assert entry["usage_source"] == "generation_metadata"
    assert entry["response_id"] == "generation-test-1"
    assert entry["response_model"] == OPENROUTER_MODEL
    assert entry["generation_model"] == OPENROUTER_CANONICAL_MODEL
    assert entry["upstream_provider"] == "DeepInfra"
    assert entry["prompt_tokens"] == 321
    assert entry["completion_tokens"] == 87
    assert entry["total_tokens"] == 408
    assert entry["actual_cost_usd"] == pytest.approx(0.0057)
    assert entry["metadata_poll_count"] == 2
    assert entry["metadata_latency_ms"] >= 0
    serialized = json.dumps(storage.model_calls())
    assert "runtime-only-test-value" not in serialized
    assert "must-not-be-persisted" not in serialized


def test_identical_canonicalization_uses_cache_without_network(tmp_path: Path):
    storage = Storage(str(tmp_path / "ledger.db"))
    network_calls = 0

    def transport(*_args):
        nonlocal network_calls
        network_calls += 1
        return response()

    canonicalizer = OpenRouterNemotronCanonicalizer(
        storage,
        transport=transport,
        api_key_provider=lambda: "runtime-only-test-value",
    )
    kwargs = {
        "run_id": "run_test",
        "allowed_fact_catalog": catalog(),
    }
    first = canonicalizer.canonicalize(package(), **kwargs)
    second = canonicalizer.canonicalize(package(), **kwargs)
    assert first["cache_hit"] is False
    assert second["cache_hit"] is True
    assert network_calls == 1
    assert storage.model_call_summary()["network_calls"] == 1
    assert [value["outcome"] for value in storage.model_calls()] == ["succeeded", "cache_hit"]


def test_partial_guarded_fallback_preserves_diagnostics_and_cache(tmp_path: Path):
    storage = Storage(str(tmp_path / "ledger.db"))
    network_calls = 0

    def transport(*_args):
        nonlocal network_calls
        network_calls += 1
        value = response()
        output = json.loads(value["choices"][0]["message"]["content"])
        output["facts"][0]["confidence"] = 0.37
        output["facts"].append(
            {
                "fact_id": "fact_context",
                "label": "Context detail",
                "state": "known",
                "source_ref_ids": [],
                "confidence": 0.99,
                "normalized_value": None,
            }
        )
        output["facts"].append(
            {
                "fact_id": "fact_background",
                "label": "Background detail",
                "state": "known",
                "source_ref_ids": [observable_ref_id(package())],
                "confidence": 0.61,
                "normalized_value": None,
            }
        )
        value["choices"][0]["message"]["content"] = json.dumps(output)
        return value

    canonicalizer = OpenRouterNemotronCanonicalizer(
        storage,
        transport=transport,
        api_key_provider=lambda: "runtime-only-test-value",
    )
    kwargs = {
        "allowed_fact_catalog": three_fact_catalog(),
    }
    first = canonicalizer.canonicalize(package(), run_id="run_partial", **kwargs)
    second = canonicalizer.canonicalize(package(), run_id="run_cached", **kwargs)
    assert network_calls == 1
    assert first["cache_hit"] is False
    assert second["cache_hit"] is True
    assert second["facts"] == first["facts"]
    assert second["diagnostics"] == first["diagnostics"] == {
        "authority_mode": "hybrid_guarded",
        "accepted_fact_ids": ["fact_report", "fact_background"],
        "accepted_fact_count": 2,
        "rejected_facts": [
            {"fact_id": "fact_context", "invariant": "source_reference_set"}
        ],
        "rejected_fact_count": 1,
        "deterministic_fallback_applied": True,
        "ignored_noncontrolling_normalized_proposals": 0,
    }
    accepted, rejected, background = first["facts"]
    assert accepted["confidence"] == 0.37
    assert {ref["agent"] for ref in accepted["source_refs"]} == {
        "OpenRouter Nemotron Canonicalizer"
    }
    assert rejected["confidence"] == 0.71
    assert {ref["agent"] for ref in rejected["source_refs"]} == {
        "Deterministic Reference Oracle"
    }
    assert background["confidence"] == 0.61
    ledger = storage.model_calls()
    assert [item["outcome"] for item in ledger] == [
        "succeeded_with_guarded_fallback",
        "cache_hit",
    ]
    for item in storage.sanitized_model_ledger():
        assert item["authority_mode"] == "hybrid_guarded"
        assert item["accepted_fact_ids"] == ["fact_report", "fact_background"]
        assert item["rejected_facts"] == [
            {"fact_id": "fact_context", "invariant": "source_reference_set"}
        ]
    sanitized = json.dumps(storage.sanitized_model_ledger())
    assert "reports a recurring mark" not in sanitized
    assert "source_ref_ids" not in sanitized
    assert "runtime-only-test-value" not in sanitized


@pytest.mark.parametrize("invalid_usage", [{"cost": 0.0}, {"completion_tokens": 0}, {"total_tokens": 1}])
def test_incomplete_sync_usage_fails_when_generation_metadata_remains_missing(
    tmp_path: Path,
    invalid_usage: dict,
):
    storage = Storage(str(tmp_path / "ledger.db"))
    metadata_calls = 0

    def transport(*_args):
        value = response()
        value["usage"].update(invalid_usage)
        return value

    def missing_metadata(*_args):
        nonlocal metadata_calls
        metadata_calls += 1
        return {"data": {}}

    canonicalizer = OpenRouterNemotronCanonicalizer(
        storage,
        transport=transport,
        metadata_transport=missing_metadata,
        metadata_sleep=lambda _seconds: None,
        api_key_provider=lambda: "runtime-only-test-value",
    )
    with pytest.raises(ModelResponseError, match="generation_metadata_completeness invariant failed"):
        canonicalizer.canonicalize(
            package(),
            run_id="run_invalid_usage",
            allowed_fact_catalog=catalog(),
        )
    assert metadata_calls == 3
    assert storage.model_calls()[0]["outcome"] == "failed"


@pytest.mark.parametrize(
    ("metadata_value", "expected_invariant", "expected_calls", "expected_cost"),
    [
        (
            generation_metadata(generation_id="different-generation"),
            "generation_metadata_identity",
            1,
            None,
        ),
        (
            generation_metadata(model="different/model"),
            "invalid_provenance",
            1,
            0.0057,
        ),
        (
            {"data": {}},
            "generation_metadata_completeness",
            3,
            None,
        ),
        (
            generation_metadata(cost=0.0),
            "generation_metadata_usage",
            1,
            None,
        ),
    ],
)
def test_generation_metadata_mismatch_missing_or_zero_fails_closed(
    tmp_path: Path,
    metadata_value: dict,
    expected_invariant: str,
    expected_calls: int,
    expected_cost: float | None,
):
    storage = Storage(str(tmp_path / "ledger.db"))
    inference_calls = 0
    metadata_calls = 0

    def transport(*_args):
        nonlocal inference_calls
        inference_calls += 1
        value = response()
        value.pop("usage")
        return value

    def metadata_transport(*_args):
        nonlocal metadata_calls
        metadata_calls += 1
        return metadata_value

    canonicalizer = OpenRouterNemotronCanonicalizer(
        storage,
        transport=transport,
        metadata_transport=metadata_transport,
        metadata_sleep=lambda _seconds: None,
        api_key_provider=lambda: "runtime-only-test-value",
    )
    with pytest.raises(ModelResponseError, match=rf"{expected_invariant} invariant failed"):
        canonicalizer.canonicalize(
            package(),
            run_id="run_bad_metadata",
            allowed_fact_catalog=catalog(),
        )
    assert inference_calls == 1
    assert metadata_calls == expected_calls
    entry = storage.model_calls()[0]
    assert entry["outcome"] == "failed"
    assert entry["response_id"] == "generation-test-1"
    assert entry["response_model"] == OPENROUTER_MODEL
    assert entry["actual_cost_usd"] == expected_cost
    assert entry["error_invariant"] == expected_invariant
    if expected_invariant == "invalid_provenance":
        assert entry["invalid_provenance_field"] == "response_model"
        assert len(entry["invalid_provenance_value_hash"]) == 64
        assert "different/model" not in json.dumps(entry)


def test_generation_metadata_provenance_is_bounded_while_billing_is_retained(
    tmp_path: Path,
):
    storage = Storage(str(tmp_path / "metadata-provenance.db"))

    def transport(*_args):
        value = response()
        value.pop("usage")
        return value

    metadata = generation_metadata()
    metadata["data"]["provider_name"] = "SECRET_SENTINEL_PROVIDER"
    canonicalizer = OpenRouterNemotronCanonicalizer(
        storage,
        transport=transport,
        metadata_transport=lambda *_args: metadata,
        metadata_sleep=lambda _seconds: None,
        api_key_provider=lambda: "runtime-only-test-value",
    )
    with pytest.raises(ModelResponseError, match="invalid_provenance"):
        canonicalizer.canonicalize(
            package(),
            run_id="run_invalid_metadata_provenance",
            allowed_fact_catalog=catalog(),
        )
    entry = storage.model_calls()[0]
    serialized = json.dumps(entry)
    assert entry["outcome"] == "failed"
    assert entry["error_invariant"] == "invalid_provenance"
    assert entry["actual_cost_usd"] == pytest.approx(0.0057)
    assert entry["prompt_tokens"] == 321
    assert entry["completion_tokens"] == 87
    assert entry["invalid_provenance_field"] == "upstream_provider"
    assert "SECRET_SENTINEL_PROVIDER" not in serialized


def test_concurrent_identical_cold_cache_calls_are_single_flight(tmp_path: Path):
    storage = Storage(str(tmp_path / "ledger.db"))
    network_calls = 0

    def transport(*_args):
        nonlocal network_calls
        network_calls += 1
        time.sleep(0.05)
        return response()

    canonicalizer = OpenRouterNemotronCanonicalizer(
        storage,
        transport=transport,
        api_key_provider=lambda: "runtime-only-test-value",
    )

    def invoke(run_id: str) -> dict:
        return canonicalizer.canonicalize(
            package(),
            run_id=run_id,
            allowed_fact_catalog=catalog(),
        )

    with ThreadPoolExecutor(max_workers=2) as executor:
        results = list(executor.map(invoke, ["run_a", "run_b"]))
    assert network_calls == 1
    assert sorted(result["cache_hit"] for result in results) == [False, True]
    assert sorted(value["outcome"] for value in storage.model_calls()) == ["cache_hit", "succeeded"]
    assert storage.model_call_summary()["network_calls"] == 1


def test_missing_credential_is_fail_closed_and_never_calls_network(tmp_path: Path):
    storage = Storage(str(tmp_path / "ledger.db"))

    def forbidden_transport(*_args):
        raise AssertionError("network must not be called")

    canonicalizer = OpenRouterNemotronCanonicalizer(
        storage,
        transport=forbidden_transport,
        api_key_provider=lambda: None,
    )
    with pytest.raises(ModelConfigurationError, match="requires an API credential") as caught:
        canonicalizer.canonicalize(
            package(),
            run_id="run_test",
            allowed_fact_catalog=catalog(),
        )
    entry = storage.model_calls()[0]
    assert entry["outcome"] == "blocked_missing_credential"
    assert entry["call_count"] == 0
    assert entry["error_invariant"] == "missing_credential"
    assert caught.value.safe_context["error_invariant"] == "missing_credential"


def test_preflight_cost_guard_uses_persistent_committed_cost(tmp_path: Path):
    storage = Storage(str(tmp_path / "ledger.db"))
    call_id = storage.create_model_call(
        run_id="prior",
        provider="openrouter",
        model=OPENROUTER_MODEL,
        cache_key="prior-cache",
        purpose="prior paid call",
        call_count=1,
        estimated_cost_usd=24.999,
        outcome="started",
        provider_endpoint=OPENROUTER_URL,
        implementation="model_backed_openrouter_canonicalizer",
    )
    storage.finish_model_call(call_id, outcome="succeeded", actual_cost_usd=24.999)
    canonicalizer = OpenRouterNemotronCanonicalizer(
        storage,
        transport=lambda *_args: (_ for _ in ()).throw(AssertionError("network must not be called")),
        api_key_provider=lambda: "runtime-only-test-value",
    )
    with pytest.raises(ModelCostGuardError, match="cumulative USD cap") as caught:
        canonicalizer.canonicalize(
            package(),
            run_id="run_test",
            allowed_fact_catalog=catalog(),
        )
    assert storage.model_calls()[-1]["outcome"] == "blocked_cost_guard"
    assert storage.model_calls()[-1]["call_count"] == 0
    assert storage.model_calls()[-1]["error_invariant"] == "cost_guard"
    assert caught.value.safe_context["error_invariant"] == "cost_guard"


def test_actual_usage_cost_is_recorded_even_when_it_exceeds_cap(tmp_path: Path):
    storage = Storage(str(tmp_path / "ledger.db"))
    canonicalizer = OpenRouterNemotronCanonicalizer(
        storage,
        transport=lambda *_args: response(cost=25.01),
        api_key_provider=lambda: "runtime-only-test-value",
    )
    with pytest.raises(ModelCostGuardError, match="Actual model cost") as caught:
        canonicalizer.canonicalize(
            package(),
            run_id="run_test",
            allowed_fact_catalog=catalog(),
        )
    entry = storage.model_calls()[0]
    assert entry["outcome"] == "actual_cost_overrun"
    assert entry["actual_cost_usd"] == pytest.approx(25.01)
    assert storage.model_actual_cost_total() == pytest.approx(25.01)
    assert caught.value.safe_context["call_id"] == entry["call_id"]
    assert caught.value.safe_context["outcome"] == "actual_cost_overrun"
    assert caught.value.safe_context["error_invariant"] == "actual_cost_overrun"
    assert caught.value.safe_context["response_id"] == "generation-test-1"


@pytest.mark.parametrize(
    ("field", "invalid_value"),
    [
        ("id", "gen-" + "x" * 200),
        ("provider", "SECRET_SENTINEL_PROVIDER"),
        ("finish_reason", "SECRET_SENTINEL_FINISH"),
    ],
)
def test_provider_provenance_is_bounded_before_internal_storage(
    tmp_path: Path,
    field: str,
    invalid_value: str,
):
    storage = Storage(str(tmp_path / "bounded-provenance.db"))

    def transport(*_args):
        value = response()
        if field == "finish_reason":
            value["choices"][0]["finish_reason"] = invalid_value
        else:
            value[field] = invalid_value
        return value

    canonicalizer = OpenRouterNemotronCanonicalizer(
        storage,
        transport=transport,
        api_key_provider=lambda: "runtime-only-test-value",
    )
    with pytest.raises(ModelResponseError, match="invalid_provenance") as caught:
        canonicalizer.canonicalize(
            package(),
            run_id="run_invalid_provenance",
            allowed_fact_catalog=catalog(),
        )
    entry = storage.model_calls()[0]
    serialized = json.dumps(entry)
    assert entry["outcome"] == "failed"
    assert entry["error_invariant"] == "invalid_provenance"
    assert entry["actual_cost_usd"] == pytest.approx(0.0042)
    assert entry["invalid_provenance_field"] in {
        "response_id",
        "upstream_provider",
        "finish_reason",
    }
    assert len(entry["invalid_provenance_value_hash"]) == 64
    assert invalid_value not in serialized
    assert "runtime-only-test-value" not in serialized
    assert caught.value.safe_context["invalid_provenance_value_hash"] == entry[
        "invalid_provenance_value_hash"
    ]


def test_foreign_response_model_is_hashed_and_rejected_as_invalid_provenance(
    tmp_path: Path,
):
    storage = Storage(str(tmp_path / "ledger.db"))
    canonicalizer = OpenRouterNemotronCanonicalizer(
        storage,
        transport=lambda *_args: response(model="different/model"),
        api_key_provider=lambda: "runtime-only-test-value",
    )
    with pytest.raises(ModelResponseError, match="invalid_provenance invariant failed") as caught:
        canonicalizer.canonicalize(
            package(),
            run_id="run_test",
            allowed_fact_catalog=catalog(),
        )
    entry = storage.model_calls()[0]
    assert entry["outcome"] == "failed"
    assert entry["usage_source"] == "response"
    assert entry["actual_cost_usd"] == pytest.approx(0.0042)
    assert entry["error_invariant"] == "invalid_provenance"
    assert entry["invalid_provenance_field"] == "response_model"
    assert "response_model" not in entry
    assert caught.value.safe_context["call_id"] == entry["call_id"]
    assert caught.value.safe_context["invalid_provenance_value_hash"] == entry[
        "invalid_provenance_value_hash"
    ]
    assert "different/model" not in json.dumps(entry)


def test_canonicalizer_fails_closed_on_source_reference_id_outside_registry(tmp_path: Path):
    storage = Storage(str(tmp_path / "ledger.db"))

    def incorrect_id_response(*_args):
        value = response()
        output = json.loads(value["choices"][0]["message"]["content"])
        output["facts"][0]["source_ref_ids"] = ["src_not_in_the_observable_registry"]
        value["choices"][0]["message"]["content"] = json.dumps(output)
        return value

    canonicalizer = OpenRouterNemotronCanonicalizer(
        storage,
        transport=incorrect_id_response,
        api_key_provider=lambda: "runtime-only-test-value",
    )
    with pytest.raises(ModelResponseError, match="hybrid_model_contribution invariant failed"):
        canonicalizer.canonicalize(
            package(),
            run_id="run_test",
            allowed_fact_catalog=catalog(),
        )
    assert_zero_accepted_rejection(storage, "source_reference_registry")


def test_semantic_rejection_retains_charged_provider_usage_and_identity(tmp_path: Path):
    storage = Storage(str(tmp_path / "ledger.db"))

    def semantically_invalid_response(*_args):
        value = response(model=OPENROUTER_CANONICAL_MODEL, cost=0.0061)
        output = json.loads(value["choices"][0]["message"]["content"])
        output["facts"][0]["source_ref_ids"] = []
        value["choices"][0]["message"]["content"] = json.dumps(output)
        return value

    canonicalizer = OpenRouterNemotronCanonicalizer(
        storage,
        transport=semantically_invalid_response,
        api_key_provider=lambda: "runtime-only-test-value",
    )
    with pytest.raises(ModelResponseError, match="hybrid_model_contribution invariant failed"):
        canonicalizer.canonicalize(
            package(),
            run_id="run_semantic_failure",
            allowed_fact_catalog=catalog(),
        )
    entry = storage.model_calls()[0]
    assert entry["outcome"] == "failed"
    assert entry["error_type"] == "ModelResponseError"
    assert entry["model"] == OPENROUTER_MODEL
    assert entry["response_model"] == OPENROUTER_CANONICAL_MODEL
    assert entry["upstream_provider"] == "mock-upstream-provider"
    assert entry["response_id"] == "generation-test-1"
    assert entry["prompt_tokens"] == 123
    assert entry["completion_tokens"] == 45
    assert entry["total_tokens"] == 168
    assert entry["actual_cost_usd"] == pytest.approx(0.0061)
    assert storage.model_actual_cost_total() == pytest.approx(0.0061)
    assert_zero_accepted_rejection(storage, "source_reference_set")


def test_dated_canonical_nemotron_response_identity_is_accepted(tmp_path: Path):
    storage = Storage(str(tmp_path / "ledger.db"))
    canonicalizer = OpenRouterNemotronCanonicalizer(
        storage,
        transport=lambda *_args: response(model=OPENROUTER_CANONICAL_MODEL),
        api_key_provider=lambda: "runtime-only-test-value",
    )
    result = canonicalizer.canonicalize(
        package(),
        run_id="run_dated_identity",
        allowed_fact_catalog=catalog(),
    )
    assert result["model"] == OPENROUTER_MODEL
    entry = storage.model_calls()[0]
    assert entry["model"] == OPENROUTER_MODEL
    assert entry["response_model"] == OPENROUTER_CANONICAL_MODEL
    assert entry["upstream_provider"] == "mock-upstream-provider"


def test_conflicting_fact_requires_all_private_conflicting_text_refs(tmp_path: Path):
    observable = package()
    observable["customer_message"]["body"] = "The message says 20 March, while the chronology says 12 March."
    contract = catalog()
    contract[0].update(
        {
            "controls_process": False,
            "decision_key": None,
            "normalized_options": {},
            "admissible_normalized_values": [],
            "expected_state": "conflicting",
            "canonical_value": "Conflicting dates",
            "canonical_explanation": "Two observable dates conflict.",
            "admissible_text_refs": [
                {"artifact_id": "message", "page": 1, "excerpt": "20 March"},
                {"artifact_id": "message", "page": 1, "excerpt": "12 March"},
            ],
        }
    )
    set_contract_text_refs(
        contract[0],
        [
            {"artifact_id": "message", "page": 1, "excerpt": "20 March"},
            {"artifact_id": "message", "page": 1, "excerpt": "12 March"},
        ],
    )

    def one_sided_response(*_args):
        value = response()
        output = json.loads(value["choices"][0]["message"]["content"])
        output["facts"][0].update(
            {
                "state": "conflicting",
                "normalized_value": None,
                "source_ref_ids": [
                    source_reference_id(text_reference(excerpt="20 March"))
                ],
            }
        )
        value["choices"][0]["message"]["content"] = json.dumps(output)
        return value

    canonicalizer = OpenRouterNemotronCanonicalizer(
        Storage(str(tmp_path / "ledger.db")),
        transport=one_sided_response,
        api_key_provider=lambda: "runtime-only-test-value",
    )
    with pytest.raises(ModelResponseError, match="hybrid_model_contribution invariant failed"):
        canonicalizer.canonicalize(
            observable,
            run_id="run_test",
            allowed_fact_catalog=contract,
        )


def test_text_grounded_unknown_fact_cannot_drop_all_private_refs(tmp_path: Path):
    contract = catalog()
    contract[0].update(
        {
            "controls_process": False,
            "decision_key": None,
            "normalized_options": {},
            "admissible_normalized_values": [],
            "expected_state": "unknown",
            "canonical_value": "Cause unresolved",
            "canonical_explanation": "A reported condition exists but technical cause is unknown.",
        }
    )
    def ungrounded_response(*_args):
        value = response()
        output = json.loads(value["choices"][0]["message"]["content"])
        output["facts"][0].update(
            {"state": "unknown", "normalized_value": None, "source_ref_ids": []}
        )
        value["choices"][0]["message"]["content"] = json.dumps(output)
        return value

    canonicalizer = OpenRouterNemotronCanonicalizer(
        Storage(str(tmp_path / "ledger.db")),
        transport=ungrounded_response,
        api_key_provider=lambda: "runtime-only-test-value",
    )
    with pytest.raises(ModelResponseError, match="hybrid_model_contribution invariant failed"):
        canonicalizer.canonicalize(
            package(),
            run_id="run_test",
            allowed_fact_catalog=contract,
        )


def test_exact_excerpt_grounding_normalizes_whitespace_and_rejects_hallucination():
    value = package()
    value["customer_message"]["body"] = "The tenant reports a\n recurring   mark."
    fact = grounded_fact()
    validate_exact_source_excerpts(value, [fact])
    fact["source_refs"][0]["excerpt"] = "reports a severe structural defect"
    with pytest.raises(ModelResponseError, match="exact normalized substring"):
        validate_exact_source_excerpts(value, [fact])


def test_exact_excerpt_grounding_rejects_text_quoted_from_wrong_pdf_page():
    value = package()
    value["artifacts"].append(
        {
            "artifact_id": "observable_pdf",
            "filename": "source.pdf",
            "media_type": "application/pdf",
            "received_at": "2026-08-01T09:03:00Z",
            "page_count": 2,
            "sha256": "1" * 64,
            "extracted_pages": [
                {"page": 1, "text": "The first page reports recurring moisture."},
                {"page": 2, "text": "The second page contains routing details only."},
            ],
        }
    )
    fact = grounded_fact()
    fact["source_refs"][0] = {
        "artifact_id": "observable_pdf",
        "locator_kind": "text_quote",
        "page": 2,
        "excerpt": "reports recurring moisture",
        "agent": "OpenRouter Nemotron Canonicalizer",
    }
    with pytest.raises(ModelResponseError, match="exact normalized substring"):
        validate_exact_source_excerpts(value, [fact])


def test_exact_excerpt_grounding_rejects_binary_image_as_direct_text_evidence():
    value = package()
    value["artifacts"].append(
        {
            "artifact_id": "observable_image",
            "filename": "source.jpg",
            "media_type": "image/jpeg",
            "received_at": "2026-08-01T09:03:00Z",
            "page_count": 1,
            "sha256": "2" * 64,
            "binary_source_available": True,
        }
    )
    fact = grounded_fact()
    fact["source_refs"][0] = {
        "artifact_id": "observable_image",
        "locator_kind": "text_quote",
        "page": 1,
        "excerpt": "the pixels show mould",
        "agent": "OpenRouter Nemotron Canonicalizer",
    }
    with pytest.raises(ModelResponseError, match="has no observable text"):
        validate_exact_source_excerpts(value, [fact])


def test_model_cannot_override_deterministic_process_control_metadata(tmp_path: Path):
    def malicious_response(*_args):
        value = response()
        output = json.loads(value["choices"][0]["message"]["content"])
        output["facts"][0]["controls_process"] = False
        output["facts"][0]["decision_value"] = "cause_building"
        value["choices"][0]["message"]["content"] = json.dumps(output)
        return value

    canonicalizer = OpenRouterNemotronCanonicalizer(
        Storage(str(tmp_path / "ledger.db")),
        transport=malicious_response,
        api_key_provider=lambda: "runtime-only-test-value",
    )
    with pytest.raises(ModelResponseError, match="hybrid_model_contribution invariant failed"):
        canonicalizer.canonicalize(
            package(),
            run_id="run_test",
            allowed_fact_catalog=catalog(),
        )


def test_noncontrolling_normalized_proposal_is_ignored_and_counted(tmp_path: Path):
    storage = Storage(str(tmp_path / "ledger.db"))
    contract = catalog()
    contract[0].update(
        {
            "controls_process": False,
            "decision_key": None,
            "normalized_options": {},
            "admissible_normalized_values": [],
        }
    )
    def proposed_value_response(*_args):
        value = response()
        output = json.loads(value["choices"][0]["message"]["content"])
        output["facts"][0]["normalized_value"] = "urgent"
        value["choices"][0]["message"]["content"] = json.dumps(output)
        return value

    canonicalizer = OpenRouterNemotronCanonicalizer(
        storage,
        transport=proposed_value_response,
        api_key_provider=lambda: "runtime-only-test-value",
    )
    result = canonicalizer.canonicalize(
        package(),
        run_id="run_noncontrolling_proposal",
        allowed_fact_catalog=contract,
    )
    assert result["facts"][0]["controls_process"] is False
    assert result["facts"][0]["normalized_value"] is None
    assert result["facts"][0]["decision_value"] is None
    assert result["diagnostics"] == {
        "authority_mode": "hybrid_guarded",
        "accepted_fact_ids": ["fact_report"],
        "accepted_fact_count": 1,
        "rejected_facts": [],
        "rejected_fact_count": 0,
        "deterministic_fallback_applied": False,
        "ignored_noncontrolling_normalized_proposals": 1,
    }
    assert storage.model_calls()[0]["ignored_noncontrolling_normalized_proposals"] == 1


def test_model_cannot_invert_fixture_bound_decision_polarity(tmp_path: Path):
    observable = package()
    observable["customer_message"]["body"] = "There are no current symptoms and no urgent deadline."
    contract = catalog()
    contract[0].update(
        {
            "decision_key": "urgency",
            "normalized_options": {
                "urgent": "urgent",
                "not_urgent": "not_urgent",
                "unverified": "urgency_unverified",
            },
            "admissible_normalized_values": ["not_urgent"],
            "canonical_value": "No acute concern reported",
            "canonical_explanation": "The source states there are no current symptoms or urgent deadline.",
            "admissible_text_refs": [
                {
                    "artifact_id": "message",
                    "page": 1,
                    "excerpt": "no current symptoms and no urgent deadline",
                }
            ],
        }
    )
    set_contract_text_refs(
        contract[0],
        [
            {
                "artifact_id": "message",
                "page": 1,
                "excerpt": "no current symptoms and no urgent deadline",
            }
        ],
    )

    def inverted_response(*_args):
        value = response()
        output = json.loads(value["choices"][0]["message"]["content"])
        output["facts"][0].update(
            {
                "normalized_value": "urgent",
                "source_ref_ids": [
                    source_reference_id(
                        text_reference(excerpt="no current symptoms and no urgent deadline")
                    )
                ],
            }
        )
        value["choices"][0]["message"]["content"] = json.dumps(output)
        return value

    storage = Storage(str(tmp_path / "ledger.db"))
    canonicalizer = OpenRouterNemotronCanonicalizer(
        storage,
        transport=inverted_response,
        api_key_provider=lambda: "runtime-only-test-value",
    )
    with pytest.raises(ModelResponseError, match="hybrid_model_contribution invariant failed"):
        canonicalizer.canonicalize(
            observable,
            run_id="run_test",
            allowed_fact_catalog=contract,
        )
    assert_zero_accepted_rejection(storage, "normalized_value_admissibility")


def test_provider_cannot_author_contradictory_display_prose(tmp_path: Path):
    observable = package()
    observable["customer_message"]["body"] = "There are no current symptoms and no urgent deadline."
    contract = catalog()
    contract[0].update(
        {
            "decision_key": "urgency",
            "normalized_options": {
                "urgent": "urgent",
                "not_urgent": "not_urgent",
                "unverified": "urgency_unverified",
            },
            "admissible_normalized_values": ["not_urgent"],
            "canonical_value": "No acute concern reported",
            "canonical_explanation": "The source states there are no current symptoms or urgent deadline.",
            "admissible_text_refs": [
                {
                    "artifact_id": "message",
                    "page": 1,
                    "excerpt": "no current symptoms and no urgent deadline",
                }
            ],
        }
    )
    set_contract_text_refs(
        contract[0],
        [
            {
                "artifact_id": "message",
                "page": 1,
                "excerpt": "no current symptoms and no urgent deadline",
            }
        ],
    )

    def contradictory_response(*_args):
        value = response()
        output = json.loads(value["choices"][0]["message"]["content"])
        output["facts"][0].update(
            {
                "value": "Acute emergency requiring immediate action",
                "explanation": "Symptoms and an urgent deadline are present.",
                "normalized_value": "not_urgent",
                "source_ref_ids": [
                    source_reference_id(
                        text_reference(excerpt="no current symptoms and no urgent deadline")
                    )
                ],
            }
        )
        value["choices"][0]["message"]["content"] = json.dumps(output)
        return value

    storage = Storage(str(tmp_path / "ledger.db"))
    canonicalizer = OpenRouterNemotronCanonicalizer(
        storage,
        transport=contradictory_response,
        api_key_provider=lambda: "runtime-only-test-value",
    )
    with pytest.raises(ModelResponseError, match="hybrid_model_contribution invariant failed"):
        canonicalizer.canonicalize(
            observable,
            run_id="run_test",
            allowed_fact_catalog=contract,
        )
    assert_zero_accepted_rejection(storage, "provider_fact_fields")


def test_process_owned_visual_enrichment_survives_model_merge(tmp_path: Path):
    observable = package()
    observable["artifacts"].append(
        {
            "artifact_id": "observable_image",
            "filename": "source.jpg",
            "media_type": "image/jpeg",
            "received_at": "2026-08-01T09:03:00Z",
            "page_count": 1,
            "sha256": "2" * 64,
            "binary_source_available": True,
        }
    )
    visual_ref = {
        "artifact_id": "observable_image",
        "locator_kind": "visual_observation",
        "region": [0.1, 0.2, 0.3, 0.4],
        "observation": "Visible localized dark spotting.",
        "agent": "Visual Evidence Agent",
    }
    requests: list[dict] = []

    def transport(_url, _headers, payload, _timeout):
        requests.append(payload)
        return response()

    canonicalizer = OpenRouterNemotronCanonicalizer(
        Storage(str(tmp_path / "ledger.db")),
        transport=transport,
        api_key_provider=lambda: "runtime-only-test-value",
    )
    result = canonicalizer.canonicalize(
        observable,
        run_id="run_test",
        allowed_fact_catalog=catalog(bounded_enrichments=[visual_ref]),
    )
    assert visual_ref in result["facts"][0]["source_refs"]
    assert "Visible localized dark spotting" not in requests[0]["messages"][1]["content"]


def test_model_budget_cap_defaults_to_25_and_only_configures_downward(monkeypatch):
    monkeypatch.delenv("CASEPATH_MODEL_CUMULATIVE_USD_CAP", raising=False)
    assert cumulative_usd_cap() == DEFAULT_CUMULATIVE_USD_CAP == 25.0
    monkeypatch.setenv("CASEPATH_MODEL_CUMULATIVE_USD_CAP", "12.5")
    assert cumulative_usd_cap() == 12.5
    monkeypatch.setenv("CASEPATH_MODEL_CUMULATIVE_USD_CAP", "400")
    assert cumulative_usd_cap() == 25.0
    monkeypatch.setenv("CASEPATH_MODEL_CUMULATIVE_USD_CAP", "1000")
    assert cumulative_usd_cap() == 25.0
    for invalid in ("nan", "inf", "+inf", "-inf"):
        monkeypatch.setenv("CASEPATH_MODEL_CUMULATIVE_USD_CAP", invalid)
        with pytest.raises(ModelConfigurationError, match="finite and positive"):
            cumulative_usd_cap()


def test_no_key_default_remains_deterministic_reference(monkeypatch):
    monkeypatch.delenv("CASEPATH_MODEL_MODE", raising=False)
    monkeypatch.delenv("OPENROUTER_API_KEY", raising=False)
    assert configured_model_mode() == MODEL_MODE_REFERENCE


def test_missing_finish_reason_uses_metadata_and_warm_cache_retains_origin_finish(
    tmp_path: Path,
):
    inference_calls = 0
    metadata_calls = 0

    def transport(*_args):
        nonlocal inference_calls
        inference_calls += 1
        value = response()
        value["choices"][0]["finish_reason"] = None
        return value

    def metadata_transport(*_args):
        nonlocal metadata_calls
        metadata_calls += 1
        return generation_metadata()

    storage = Storage(str(tmp_path / "finish.db"))
    canonicalizer = OpenRouterNemotronCanonicalizer(
        storage,
        transport=transport,
        metadata_transport=metadata_transport,
        api_key_provider=lambda: "runtime-only-test-value",
    )
    first = canonicalizer.canonicalize(
        package(), run_id="run-finish-cold", allowed_fact_catalog=catalog()
    )
    second = canonicalizer.canonicalize(
        package(), run_id="run-finish-warm", allowed_fact_catalog=catalog()
    )
    assert inference_calls == metadata_calls == 1
    assert first["finish_reason"] == "stop"
    assert first["usage_source"] == "generation_metadata"
    assert second["cache_hit"] is True
    assert second["origin_finish_reason"] == "stop"
    warm_ledger = storage.sanitized_model_ledger()[1]
    assert warm_ledger["finish_reason"] == "stop"
    assert warm_ledger["origin_finish_reason"] == "stop"
    assert warm_ledger["origin_usage"] == {
        "prompt_tokens": 321,
        "completion_tokens": 87,
        "total_tokens": 408,
        "actual_cost_usd": 0.0057,
        "usage_source": "generation_metadata",
    }


def test_missing_response_id_with_sync_usage_retains_charge_and_safe_context(
    tmp_path: Path,
):
    def transport(*_args):
        value = response()
        value.pop("id")
        return value

    storage = Storage(str(tmp_path / "missing-id.db"))
    canonicalizer = OpenRouterNemotronCanonicalizer(
        storage,
        transport=transport,
        metadata_transport=lambda *_args: (_ for _ in ()).throw(
            AssertionError("metadata lookup requires a valid response ID")
        ),
        api_key_provider=lambda: "runtime-only-test-value",
    )
    with pytest.raises(ModelResponseError, match="response_identity") as caught:
        canonicalizer.canonicalize(
            package(), run_id="run-missing-id", allowed_fact_catalog=catalog()
        )
    ledger = storage.model_calls()[0]
    assert ledger["outcome"] == "failed"
    assert ledger["actual_cost_usd"] == pytest.approx(0.0042)
    assert ledger["prompt_tokens"] == 123
    assert "response_id" not in ledger
    assert caught.value.safe_context["call_id"] == ledger["call_id"]


def test_canonical_equal_accept_reject_minority_fails_and_never_caches(tmp_path: Path):
    calls = 0

    def transport(*_args):
        nonlocal calls
        calls += 1
        value = response()
        output = json.loads(value["choices"][0]["message"]["content"])
        output["facts"].append(
            {
                "fact_id": "fact_context",
                "label": "Context detail",
                "state": "known",
                "source_ref_ids": [],
                "confidence": 0.5,
                "normalized_value": None,
            }
        )
        value["choices"][0]["message"]["content"] = json.dumps(output)
        return value

    storage = Storage(str(tmp_path / "minority.db"))
    canonicalizer = OpenRouterNemotronCanonicalizer(
        storage,
        transport=transport,
        api_key_provider=lambda: "runtime-only-test-value",
    )
    two = three_fact_catalog()[:2]
    for index in range(2):
        with pytest.raises(ModelResponseError, match="hybrid_model_contribution"):
            canonicalizer.canonicalize(
                package(), run_id=f"run-minority-{index}", allowed_fact_catalog=two
            )
    assert calls == 2
    assert [item["outcome"] for item in storage.model_calls()] == ["failed", "failed"]
