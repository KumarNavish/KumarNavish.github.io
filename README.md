# Navish Kumar — Living research timeline

A dependency-free static portfolio with one canonical **Past → Now → Frontier** timeline and ten native explanatory experiences. GitHub Pages serves the files directly. No build service, API key, paid model, database, or third-party JavaScript is required.

## Content and architecture

`modules/content.mjs` is the canonical Work record. Each entry contains its period, status, role, contribution, evidence, mechanism, real-world interpretation, limitation, predecessor, successor, current example/question, sources and four guided stages. To add a work, add its record, implement a native mechanism, and register that mechanism in `modules/demos.mjs`. The timeline and contextual navigation derive from the records; do not add a parallel organizational system.

`modules/mechanisms.mjs` contains pure, tested calculations. `modules/demos.mjs` connects controls to those calculations. `modules/render.mjs` renders the site hierarchy. `modules/app.mjs` handles hash routes, back navigation and guided playback. The three `world-*`/`world` modules separate persistent scene state, command interpretation, path planning, rendering and controls.

The homepage is generated as ordinary HTML, so the list and source links survive disabled JavaScript. Project explanations progressively enhance it. Direct links use `#work/<id>` and need no server rewrite.

```
npm test
npm run build
npm run serve
```

Node is needed only for the tests and HTML generator. Browser delivery does not depend on npm packages. Regenerate `index.html` after changing the content or homepage renderer.

## Scientific boundaries

All displayed demo quantities are computed illustrative examples, not paper measurements. Published contributions, applications, active questions and prototype capabilities are separated in each work's evidence section. Author roles are stated conservatively where individual task attribution was not independently available.

- The natural-gradient example follows the exact diagonal Gaussian specialization of Algorithm 1 in arXiv:2507.07853v1; it is not a universal speed claim.
- The gain triangle uses its exact normalized spectrum. The signed four-node example uses a basic Rayleigh lower bound and exhaustive tiny-graph repair; it does not pretend to reproduce all stronger paper bounds.
- Replay and rank examples explain constraints and trade-offs. The linked active OpenReview records could not be independently retrieved during this update; no acceptance, novelty or benchmark result is asserted from them.
- TiC-LM is credited to the original Li et al. benchmark. Navish's entry is a replication/investigation, not authorship of that benchmark.
- CasePath's browser example is synthetic and local. It demonstrates an authority gate and dependency replay, not legal correctness, production readiness, or the current standalone application's hosted availability.
- The spatial editor has a deliberately limited grammar and procedural geometry. It is not an unrestricted generative model, a learned planner, or an evaluated VR system.

## Spatial privacy and compatibility

Typed commands are local. Supported speech is optional and uses the browser's SpeechRecognition API, which may transmit audio to the browser's provider. Permission is requested only after a microphone click. Unsupported or denied speech leaves typed controls available.

Objects have stable IDs and explicit coordinates. Local storage is best-effort and guarded. Export preserves scene JSON. Undo/redo covers the current visit. WebGL uses a depth buffer; devices without WebGL use the same 3D geometry with a software depth buffer. Camera motion does not modify world state. Agent motion replays a computed collision-free grid route; reduced-motion preference suppresses animated playback.

## Validation scope for the 2026-09-13 revision

25 Node tests cover numerical identities, all 64 signed K4 configurations, cost trade-offs, authority/cache invalidation, command parsing, stable object IDs, obstacle avoidance and history restoration. Chromium in-memory fixture checks cover desktop and mobile rendering and 35 interaction assertions. Network navigation to localhost was blocked by the environment's administrator policy; that policy was not altered. In-memory rendering validates interface behavior, not live-origin network loading. Hardware WebGL, microphone recognition and real-origin persistence require separate verification. Deployment checks must be recorded separately rather than inferred from these tests.
