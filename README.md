# Navish Kumar — Living scientific worlds

A static, source-inspectable research portfolio organised by one **Past → Now → Frontier** timeline. Ten native explanations connect an intervention to a computed consequence. Original sources, Navish's role and the limits of each example remain beside the experience.

## Run and verify

```bash
npm test
npm run build
npm run serve
# In a separate terminal, with Python Playwright and Chromium installed:
python scripts/worlds_acceptance.py --url http://127.0.0.1:8765 --out /tmp/worlds-review
```

Node is used for tests and the HTML generator. Serving requires only a static HTTP server. There is no model API, account, paid backend, telemetry or database. Three.js 0.180.0 is vendored with its license; no runtime CDN is required. Interactive worlds use WebGL 2. When it is unavailable, controls and numerical explanations remain available; the interface explicitly identifies the graphics limitation.

## Architecture

`modules/content.mjs` is the canonical work record. The timeline, full project pages, roles, evidence and connections derive from those records. `modules/app.mjs` loads each world on demand and disposes it on navigation.

`modules/worlds/math.mjs` separates exact illustrative calculations from rendering. `graph.mjs`, `geometry.mjs`, `temporal.mjs`, `case.mjs` and `spatial.mjs` own distinct project experiences. `stage.mjs` handles Three.js, materials, lighting, picking, camera controls, labels and resource cleanup. `compiler.mjs` contains the atomic scene language, validation and path planning. `laboratory.mjs` constructs the editable instruments and physical environment. `worlds.css` provides project-specific visual systems within the shared portfolio shell.

The homepage is generated ordinary HTML, including original-source links without JavaScript. Hash routes require no server rewrite. Earlier studio modules are retained for timeline previews and regression tests; they are not the new project-page renderer.

## Scientific scope

The rendered quantities are **worked examples, not measured paper results**.

- The gain observatory computes a five-node Hermitian normalized Laplacian and three fundamental cycles. Spanning-tree enumeration finds a minimum-count edge-retuning repair only for this tiny graph.
- Replay projects a desired correction onto selected memory directions in a three-parameter quadratic problem. A duplicated memory adds no direction. Signed-span projection is not a claim about nonnegative replay weights or a new selection algorithm.
- Rank solves a three-variable minimum-norm problem in rank-indexed coordinate subspaces. Infeasible spaces have no rendered repair. The separately drawn budget is an illustrative isotropic change cost, not a full nonlinear LoRA model.
- The temporal example processes exactly 64 simulated observations per period. Replay displaces new observations. The archive is explicitly assumed less noisy; the optimal allocation uses known toy drift. This is not language-model training or a TiC-LM benchmark result. TiC-LM is credited to its original authors; Navish's work is replication/investigation.
- The posterior world uses the exact diagonal Gaussian specialization of the linked square-root natural-gradient algorithm. Surface height is probability density, not loss. The KL trace does not establish universal speed superiority.
- The urban and interaction examples use fictional times, accounts and messages. The miniature buildings do not represent a geographic dataset.
- CasePath is a synthetic document workflow. Visitor review is not authenticated production authority. It sends no payment and makes no legal determination. The source-record hash, cached dependencies and HOLD transitions demonstrate software mechanics only.

## Persistent scene and privacy

The spatial world is a **limited local compiler, not unrestricted generative AI or a learned planner**. Supported clauses are parsed, bound to stable IDs, collision-checked and committed atomically. A rejected clause leaves the scene unchanged. Three.js objects are retained across transform edits. Undo/redo restores scene snapshots; local storage preserves the latest scene when allowed; export writes explicit JSON.

Typed commands remain local. Optional speech recognition is initiated only by the visitor and may transmit audio to the browser vendor's recognition provider. Support varies. No microphone success, physical-device GPU performance, Safari compatibility or headset VR validation is inferred from headless tests.

## Evidence

`tests/` covers numerical identities, feasible/infeasible cases, budget accounting, scene compilation and regression behavior. `scripts/worlds_acceptance.py` exercises actual HTTP module delivery, state changes, source preservation, camera independence, mobile layout, persistence and export. GitHub Actions stores the executed reports and screenshots separately from the application. A test pass establishes those checks, not an independent human assessment of explanatory impact.
