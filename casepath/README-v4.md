# CasePath Swiss Claim Lab — public product v4

CasePath turns a generated customer's first claim submission into a clear handling process, the exact evidence still needed, an inspectable next action, structured expert feedback, and a governed knowledge-update path.

## Public product

This directory is a self-contained static application. It has no build step and no runtime secret.

```bash
python -m http.server 4173 --directory casepath-final
```

## Included public workflow

- browse eight generated Swiss tenant-law claims;
- inspect messages and safe attachment metadata;
- run a cached reference, static baseline, or visitor-authorized Nemotron profile;
- inspect the claim-specific process and its current blocker;
- trace every evidence request back to the process question it supports;
- inspect the complete audit trail;
- compare process-grounded and category-template handling;
- save and export structured browser-local expert corrections;
- inspect the quarantined knowledge-update path;
- search the shared human/agent knowledge representation;
- inspect nine module replacement contracts.

## Live profile

- Provider: OpenRouter
- Model: `nvidia/nemotron-3-super-120b-a12b:free`
- Calls per run: one
- Credential: visitor-controlled key stored in `sessionStorage`
- Daily browser guard: 50 calls
- Authority: model output is a proposal; deterministic validation remains authoritative

## Evidence boundary

All public claims, process paths, checklist labels and value metrics are generated or simulated. The public product is not approved for real claim processing, customer communication, legal advice, deadline calculation, insurance coverage decisions, autonomous escalation or autonomous playbook updates.
