# CasePath agent replacement contract

A replacement agent may be implemented as a Python plugin, HTTP endpoint or MCP adapter in the full research engine.

```json
{
  "agent_id": "custom.process-agent",
  "transport": "http",
  "endpoint": "https://example.org/casepath-agent",
  "input_contract": "CanonicalClaimState + ProcessLibrary",
  "output_contract": "ClaimProcessInstance",
  "timeout_ms": 30000,
  "provenance_required": true,
  "fallback": "fail_closed"
}
```

A conforming agent must validate the input contract, avoid canonical-state mutation, preserve unknown and conflicting evidence, remain within permitted tools, return provenance for consequential values, return typed failures, and accept deterministic validator rejection.

The public product provides a browser-safe five-fixture conformance pre-check. The downloadable research release contains the deeper Python test suite and generated benchmark.
