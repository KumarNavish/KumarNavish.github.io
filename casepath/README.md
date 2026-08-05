# CasePath Swiss Claim Lab

Public URL: **https://kumarnavish.github.io/casepath/**

CasePath is an inspectable public product demonstration of process-grounded Swiss tenant-law claim handling on generated claims.

A visitor can select a claim, inspect the message and generated attachment previews, replay a cached reference pipeline, connect OpenRouter for an optional live Nemotron proposal, inspect the claim-specific process and process-derived checklist, compare profiles, submit a browser-local expert correction and search the canonical claim-handling knowledge index.

## Reference profile

- Provider: OpenRouter OAuth PKCE
- Model: `nvidia/nemotron-3-super-120b-a12b:free`
- Live calls: one fact-proposal call per immutable claim/profile combination
- Post-processing: deterministic process execution, checklist derivation and safety validation
- Cache: browser-local
- Shared application key: none

## Architecture

The public release is deliberately static and requires no server-side secret. Generated claims and cached reference outputs are shipped with the site. Optional live inference uses a visitor-controlled OpenRouter key stored in session storage. Public expert feedback remains local and cannot alter released knowledge.

## Evidence boundary

All included claims, process paths, document mappings, benchmark scores and friction metrics are generated or simulated. The product is not approved for real claim processing, customer contact, legal advice, deadline calculation, coverage decisions, autonomous escalation or production deployment.

## Source and reproducibility

The modular product source and full validation package are distributed in the release ZIP returned with this deployment. The rendered site is split into inspectable HTML, CSS, JavaScript and canonical-data files under this directory.
