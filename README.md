# Navish Kumar — Scroll-authored scientific worlds

One canonical **Past → Now → Frontier** timeline, ten living previews, and ten reversible scientific narratives. Scrolling—not a timer—is the default explanation. Each argument ends in an explorer operating on the same scientific model.

## Run

```bash
npm test
npm run build
npm run serve
# With Python Playwright, Chromium and Pillow installed:
python scripts/scroll_acceptance.py --url http://127.0.0.1:8765 --out /tmp/scroll-review --record
```

This is a static site. Node is required for tests and the HTML generator, not delivery. There is no model API, paid backend, database, analytics or runtime CDN. Three.js 0.180.0 is vendored with its license. Nine scientific viewports use WebGL 2; CasePath uses a persistent document workspace. Without WebGL, the same narrative retains its calculated reading view. Without JavaScript, the generated timeline and original-source links remain readable.

## Narrative architecture

`modules/content.mjs` remains the canonical record of role, contribution, evidence, status, sources and intellectual connections. Published results, active research, replications and conceptual interfaces are not conflated.

`modules/narrative/chapters.mjs` declares reader-facing chapters and camera keyframes. `model.mjs` reconstructs the entire frame from normalized progress: scientific inputs and outputs, chapter, camera, visibility and annotations. `director.mjs` maps measured paragraph anchors to progress and manages sticky layout, reverse traversal, navigation, reduced motion, deep links, optional autoplay and cleanup. Autoplay only scrolls the actual document; it cannot create a competing narrative state.

The scene modules retain geometry and update transforms, visibility and computed overlays. Rendering stops when idle or offscreen. Camera choreography and annotation appear only when relevant. The underlying `modules/worlds/math.mjs`, `modules/mechanisms.mjs` and `modules/worlds/compiler.mjs` calculations remain separate from presentation.

`explore.mjs` holds independent sandbox state. Controls unlock after the guided sequence; returning to earlier prose reconstructs the guide without overwriting the sandbox. The spatial sandbox alone persists to local storage when permitted. Its typed language is a limited, atomic local compiler—not a generative model. Unsupported clauses reject the entire edit. Original object IDs, undo/redo, collision checks, path planning and JSON export remain inspectable.

`journey.mjs` uses a single active scientific field for the homepage. As each work crosses the reading zone, its compact preview follows scroll progress. All ten works stay in the same chronological list; no rasterized thumbnails or parallel category systems are added.

## Sharing and accessibility

Project URLs are `#work/<id>`. During guided reading the URL becomes `#work/<id>/at/<0–1 progress>` so a reload, copied link or new tab reconstructs the same frame. `#work/<id>/chapter/<1-based chapter>` is also supported. Previous/next buttons and keyboard controls move to the same paragraph anchors. Reduced motion uses the same chapters and exact endpoint computations without continuous camera animation. Scrolling over the canvas does not capture the wheel; free inspection is optional after the story.

## Scientific boundaries

Every numerical display is explicitly classified as a live worked example, a declared simulation, a synthetic deterministic workflow, or a conceptual compiler interface. **None of the browser examples is presented as a paper measurement.**

- Gain computes the actual five-node Hermitian normalized Laplacian. Cycle transport accumulates directed gains. Repair is exact finite spanning-tree enumeration for this tiny graph, not the paper's entire bound family or a scalable new algorithm.
- Replay uses a three-parameter quadratic example and signed projection onto selected memory directions. A duplicated memory does not add a direction. Unavailable correction and available-but-unapplied correction remain distinct. The full-history optimum is explicitly an unavailable oracle, not an implementable replay method.
- Rank solves a minimum-norm linear repair inside rank-indexed coordinate subspaces. No solution is shown in an infeasible space. The cost sphere is a separate illustrative current-task constraint, not a full nonlinear LoRA model.
- TiC-LM is credited as a replication/investigation. The browser processes a fixed 64-observation synthetic budget: replay displaces new data. An explicitly lower-noise archive can help while stable, then harm after drift. The final known-drift optimum can be zero replay. Backward/archive error and current error are separate exact expectations in the toy model—not language-model benchmark results or a learned policy.
- Natural gradient uses the exact diagonal Gaussian specialization of the linked algorithm. Surface height is probability density; KL is separately computed. An attractive trajectory is not an unconditional convergence or speed guarantee.
- Signed bounds, urban context and interaction networks retain their declared tiny-graph or fictional-data scope. Vehicle positions are explanatory progression, not a time-accurate route simulation.
- CasePath's source, newer report, assertions, reviewed correction, cached obligations and provenance are synthetic. The original source is not overwritten. Visitor review is not authenticated production authority. No payment or legal determination occurs.
- The spatial world interprets supported text into typed operations, persistent IDs and collision-checked placements. Optional speech recognition may send audio to the browser provider and starts only after a visitor click. No unrestricted language model, autonomous policy or headset-validated VR capability is claimed.

## Validation

`tests/narrative.test.mjs` checks path-independent reconstruction, reverse order, chapter endpoints, scientific invariants, exact infeasibility, budget accounting, provenance and persistent identities in addition to the retained regression suite.

`scripts/scroll_acceptance.py` validates actual HTTP bytes and rendered WebGL, forward/reverse/slow/fast scrolling, sticky stages, copied progress URLs, reload, idle rendering, withheld/unlocked controls, sandbox preservation and exports. With `--record`, it captures each flagship forwards and backwards on desktop, mobile-sized viewport and reduced motion. `--reference` separately inspects the interaction reference; its appearance and assets are not copied.

Executed evidence is stored outside the application and attached to the delivery. A build or test pass is not an independent assessment of newcomer comprehension or subjective visual impact. Physical-device GPU performance, actual touch hardware, speech recognition, Safari and headset VR require separate validation.


## Completion pass: reader continuity and inspection

The director preserves the reader's normalized position across viewport changes. `/explore` is a reconstructible route; each tab retains its non-sensitive simulation inputs through refresh and Back. Optional auto-tour stops when the document is hidden. Mobile view manipulation is opt-in so the scientific canvas does not silently take over page scrolling.

The gain explorer retains an angle for every edge and exposes fundamental-cycle selection and computed Hermitian eigenmodes. Each mode is checked against the live operator using the residual `||Lv - lambda v||`; mode inspection does not alter the graph. Its Jacobi calculation is an inspection layer, not a substitute for the existing eigensystem.

Rank exploration can relax the A/B recovery thresholds. The existing active-set solver accepts those explicit inequalities; both the repair marker and feasible-region geometry use them. Rank-two feasible regions are rendered as the actual planar section, never a three-dimensional proxy. The default mathematical example is unchanged.

CasePath now records an explicit initial synthetic human review, followed by a newer conflicting report that supersedes it. This makes READY -> HOLD -> reviewed admissibility an actual state sequence, not merely changing status text. On small displays, attention moves from the full original header to its relevant source passage; the same DOM source and its date remain preserved. Source citations focus the cited passage.

`chapters.mjs` records each beat's intended incoming/outgoing reader state, camera intent and attention hierarchy. These are authoring contracts, not evidence that independent readers understood the explanation.

Additional acceptance:

```bash
python scripts/completion_acceptance.py --url http://127.0.0.1:8765 --out /tmp/completion
python scripts/completion_acceptance.py --url http://127.0.0.1:8765 --out /tmp/completion-webkit --engine webkit
```

A headless WebKit result is not a physical Safari, iPhone, microphone or headset certification. Browser evidence is stored separately from source.
