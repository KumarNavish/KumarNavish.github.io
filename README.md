# Navish Kumar — Living research studio

A static research portfolio organized around one Past → Now → Frontier timeline. Every project has a state-driven 3D explanation, controls that update an explicit calculation, a contextual next intervention, and its evidence boundary. No model API, runtime package, or paid hosting service is required.

## Run

```sh
npm test
npm run build
npm run serve
```

Node 22 runs the tests and generates the static homepage. The browser itself needs no Node runtime. `scripts/browser_acceptance.py` tests a served source tree or the live origin with Playwright 1.57.0. The public-repository workflow uses a standard Ubuntu runner, with screenshots and results retained for one day.

## Architecture

`modules/content.mjs` is the canonical work record: period, role, contribution, evidence, limitation, guide, predecessor and successor. `modules/mechanisms.mjs` holds the pure illustrative calculations. `demos.mjs` connects the controls to those calculations. `studio.mjs` renders each calculation as a scene and selects contextual guidance from its current state. These are deterministic rules, not model-generated answers.

`studio-engine.mjs` supplies native 3D geometry, a perspective camera, normal-based studio lighting, material highlights, depth testing, object picking and keyboard camera controls. It uses WebGL when available and a depth-buffered software renderer otherwise. `project-scenes.mjs` gives the ten works different geometry and semantic labels. `timeline-scenes.mjs` produces lightweight previews from those same scenes, releases each temporary graphics context, and reserves layout space before loading.

`world-model.mjs` owns persistent scene state, object IDs, command parsing, collision constraints, path planning and undo/redo. `world-view.mjs` renders it through the shared engine. `world.mjs` owns direct manipulation and commands. A camera change never changes scientific or world state.

The homepage is ordinary generated HTML. Hash routes use `#work/<id>`, with full embedded project pages rather than drawers. The readable timeline and source links survive disabled JavaScript. To add a work, add a record, its calculation/control binding, and its scene. Do not introduce a parallel navigation hierarchy.

## Scientific boundaries

Every displayed quantity is a computed illustrative example, not a paper measurement. Published contributions, active questions, applications and prototypes are distinguished in each work. The diagonal natural-gradient example follows the cited algorithm; the low-rank example is a standard approximation, not a new theorem. TiC-LM credits the benchmark authors and labels Navish's work as replication. No acceptance or result is inferred from unretrieved OpenReview records.

The CasePath scene is a synthetic explanation, not the current standalone application or a real payment system. Its model-only correction cannot satisfy human authority. A changed invoice invalidates the action even after a reviewed date correction.

The spatial editor is a limited local command grammar, not unrestricted generative AI or production VR. Geometry is procedural. The route avoids the modeled fixed workbench; it is not a learned planner or a general robotics guarantee. World edits retain stable object IDs. Undo/redo is per visit; scene persistence uses guarded localStorage. Export preserves the current JSON state.

## Privacy and rendering

Typed commands and calculations remain local. Optional browser speech recognition may send audio to its provider; this is disclosed before microphone use. No audio permission is requested on page load. Unsupported speech leaves typed commands available.

Animation pauses when its scene is not visible or the page is hidden. Reduced-motion preference disables automatic flow. Static geometric explanations do not present an inert flow button. Hardware-accelerated performance, microphone recognition and Safari behavior must not be inferred from software-rendered Chromium tests. A lost graphics context is reported visibly without hiding the underlying calculation.

## Validation history

The first release, source `ee4d06d`, passed 25 numerical/state tests and 35 in-memory browser assertions. Those historical checks did not verify HTTP module delivery.

The studio revision adds finite-geometry and state-dependent guidance tests, per-project desktop/mobile acceptance, camera invariance, authority checks, and real-origin reload/persistence verification in the browser workflow. Workflow outcomes and their retained artifacts are the evidence; the existence of a test script is not a passing result. The public website's emotional impact has not been independently evaluated.
